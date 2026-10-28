const { query } = require('../config/database');
const { calculateDayReconciliation, toFixed2 } = require('../services/calculationService');
const { getLocalParts, TIME_ZONE } = require('../services/businessDayScheduler');

async function getDashboardSummary(req, res) {
  try {
    // 1. Fetch current active or latest business day
    const latestDays = await query(
      `SELECT * FROM business_days WHERE business_date <= ?
       ORDER BY (status = 'OPEN') DESC, business_date DESC LIMIT 1`,
      [getLocalParts().dateKey]
    );

    let todayMetrics = {
      hasDay: false,
      business_date: null,
      status: 'NO_DAY_OPENED',
      opening_cash: 0,
      opening_bank: 0,
      today_income: 0,
      today_expenses: 0,
      expected_cash: 0,
      actual_cash: 0,
      cash_difference: 0,
      cash_status: 'BALANCED',
      expected_bank: 0,
      actual_bank: 0,
      bank_difference: 0,
      bank_status: 'BALANCED'
    };

    if (latestDays.length > 0) {
      const currentDay = latestDays[0];
      todayMetrics.hasDay = true;
      todayMetrics.business_day_id = currentDay.id;
      todayMetrics.business_date = currentDay.business_date;
      todayMetrics.status = currentDay.status;
      todayMetrics.opening_cash = toFixed2(currentDay.opening_cash);
      todayMetrics.opening_bank = toFixed2(currentDay.opening_bank);

      if (currentDay.status === 'OPEN') {
        const preview = await calculateDayReconciliation(currentDay.id);
        todayMetrics.today_income = preview.totalDailyIncome;
        todayMetrics.today_expenses = preview.totalDailyExpenses;
        todayMetrics.expected_cash = preview.expectedCash;
        todayMetrics.expected_bank = preview.expectedBank;
      } else {
        // Fetch from closing record
        const closings = await query('SELECT * FROM daily_closings WHERE business_day_id = ?', [currentDay.id]);
        if (closings.length > 0) {
          const c = closings[0];
          todayMetrics.today_income = toFixed2(c.total_cash_income + c.total_bank_income);
          todayMetrics.today_expenses = toFixed2(c.total_cash_expenses + c.total_bank_expenses);
          todayMetrics.expected_cash = toFixed2(c.expected_cash);
          todayMetrics.actual_cash = toFixed2(c.actual_cash);
          todayMetrics.cash_difference = toFixed2(c.cash_difference);
          todayMetrics.cash_status = c.cash_status;
          todayMetrics.expected_bank = toFixed2(c.expected_bank);
          todayMetrics.actual_bank = toFixed2(c.actual_bank);
          todayMetrics.bank_difference = toFixed2(c.bank_difference);
          todayMetrics.bank_status = c.bank_status;
        }
      }
    }

    // 2. Count Open Discrepancies
    const [discCount] = await query("SELECT COUNT(*) as openCount FROM discrepancies WHERE status IN ('OPEN', 'IN_INVESTIGATION')");
    const openDiscrepancies = discCount?.openCount || 0;

    // 3. Latest 3-Day Audit status
    const latestAudits = await query("SELECT * FROM three_day_audits ORDER BY end_date DESC LIMIT 1");
    let threeDayAuditStatus = 'NO_AUDIT_YET';
    let latestAuditCode = null;
    if (latestAudits.length > 0) {
      threeDayAuditStatus = latestAudits[0].overall_status;
      latestAuditCode = latestAudits[0].audit_code;
    }

    // 4. Recent Activities / Alerts
    const alerts = [];
    if (todayMetrics.cash_status === 'SHORTAGE') {
      alerts.push({ type: 'danger', message: `Cash Shortage of ${Math.abs(todayMetrics.cash_difference)} ETB detected.` });
    } else if (todayMetrics.cash_status === 'SURPLUS') {
      alerts.push({ type: 'warning', message: `Cash Surplus of ${todayMetrics.cash_difference} ETB detected.` });
    }

    if (todayMetrics.bank_status === 'DISCREPANCY') {
      alerts.push({ type: 'danger', message: `Bank Discrepancy of ${Math.abs(todayMetrics.bank_difference)} ETB detected.` });
    }

    if (openDiscrepancies > 0) {
      alerts.push({ type: 'info', message: `${openDiscrepancies} open discrepancy case(s) requiring attention.` });
    }

    return res.json({
      success: true,
      metrics: {
        ...todayMetrics,
        openDiscrepancies,
        threeDayAuditStatus,
        latestAuditCode,
        alerts
        ,schedule: {
          timeZone: TIME_ZONE,
          opensAt: '00:00',
          closesAt: '22:00',
          remainingMinutes: todayMetrics.status === 'OPEN'
            ? Math.max(0, 22 * 60 - getLocalParts().minuteOfDay)
            : 0
        }
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = {
  getDashboardSummary
};
