const { query } = require('../config/database');
const { toFixed2 } = require('../services/calculationService');

/**
 * FINANCIAL ANALYTICS & TRENDS CONTROLLER
 * Aggregates financial movements across Daily, 3-Day Audit Cycle, Weekly, and Monthly timeframes.
 */

// 1. Get Financial Trends (Income vs Expense, Cash vs Bank)
async function getFinancialTrends(req, res) {
  try {
    const { timeframe = 'daily' } = req.query; // daily, 3day, weekly, monthly

    if (timeframe === '3day') {
      // Aggregate by 3-Day Audit periods
      const audits = await query(
        `SELECT 
            audit_code,
            DATE_FORMAT(start_date, '%m-%d') AS start_label,
            DATE_FORMAT(end_date, '%m-%d') AS end_label,
            total_3day_cash_income,
            total_3day_bank_income,
            (total_3day_cash_income + total_3day_bank_income) as total_income,
            total_3day_cash_expenses,
            total_3day_bank_expenses,
            (total_3day_cash_expenses + total_3day_bank_expenses) as total_expenses,
            expected_cash,
            actual_cash,
            cash_difference,
            expected_bank,
            actual_bank,
            bank_difference,
            overall_status
         FROM three_day_audits
         ORDER BY end_date DESC
         LIMIT 12`
      );

      audits.reverse();
      const trendData = audits.map((a) => ({
        label: `${a.start_label} to ${a.end_label}`,
        code: a.audit_code,
        cashIncome: toFixed2(a.total_3day_cash_income),
        bankIncome: toFixed2(a.total_3day_bank_income),
        totalIncome: toFixed2(a.total_income),
        cashExpense: toFixed2(a.total_3day_cash_expenses),
        bankExpense: toFixed2(a.total_3day_bank_expenses),
        totalExpense: toFixed2(a.total_expenses),
        cashBalance: toFixed2(a.actual_cash),
        bankBalance: toFixed2(a.actual_bank),
        cashDiff: toFixed2(a.cash_difference),
        bankDiff: toFixed2(a.bank_difference),
        status: a.overall_status
      }));

      return res.json({ success: true, timeframe: '3day', data: trendData });
    }

    if (timeframe === 'weekly') {
      // Aggregate by calendar weeks with pre-aggregated subqueries to prevent cartesian duplication
      const weekly = await query(
        `SELECT 
            YEARWEEK(bd.business_date, 1) as year_week,
            DATE_FORMAT(MIN(bd.business_date), '%m-%d') as week_start_label,
            MAX(bd.business_date) as week_end,
            COALESCE(SUM(di.cash_income), 0) as cash_income,
            COALESCE(SUM(di.bank_income), 0) as bank_income,
            COALESCE(SUM(di.total_income), 0) as total_income,
            COALESCE(SUM(de.cash_expense), 0) as cash_expense,
            COALESCE(SUM(de.bank_expense), 0) as bank_expense,
            COALESCE(SUM(de.total_expense), 0) as total_expense
         FROM business_days bd
         LEFT JOIN (
            SELECT business_day_id,
                   SUM(cash_income) as cash_income,
                   SUM(bank_income) as bank_income,
                   SUM(total_income) as total_income
            FROM daily_incomes
            GROUP BY business_day_id
         ) di ON bd.id = di.business_day_id
         LEFT JOIN (
            SELECT business_day_id,
                   SUM(CASE WHEN payment_source = 'CASH' THEN amount ELSE 0 END) as cash_expense,
                   SUM(CASE WHEN payment_source = 'BANK' THEN amount ELSE 0 END) as bank_expense,
                   SUM(amount) as total_expense
            FROM daily_expenses
            GROUP BY business_day_id
         ) de ON bd.id = de.business_day_id
         GROUP BY YEARWEEK(bd.business_date, 1)
         ORDER BY year_week DESC
         LIMIT 8`
      );

      weekly.reverse();
      const trendData = weekly.map((w) => ({
        label: `Wk ${String(w.year_week).slice(4)} (${w.week_start_label})`,
        cashIncome: toFixed2(w.cash_income),
        bankIncome: toFixed2(w.bank_income),
        totalIncome: toFixed2(w.total_income),
        cashExpense: toFixed2(w.cash_expense),
        bankExpense: toFixed2(w.bank_expense),
        totalExpense: toFixed2(w.total_expense)
      }));

      return res.json({ success: true, timeframe: 'weekly', data: trendData });
    }

    if (timeframe === 'monthly') {
      // Aggregate by Month with pre-aggregated subqueries
      const monthly = await query(
        `SELECT 
            DATE_FORMAT(bd.business_date, '%Y-%m') as month_key,
            DATE_FORMAT(bd.business_date, '%b %Y') as month_label,
            COALESCE(SUM(di.cash_income), 0) as cash_income,
            COALESCE(SUM(di.bank_income), 0) as bank_income,
            COALESCE(SUM(di.total_income), 0) as total_income,
            COALESCE(SUM(de.cash_expense), 0) as cash_expense,
            COALESCE(SUM(de.bank_expense), 0) as bank_expense,
            COALESCE(SUM(de.total_expense), 0) as total_expense
         FROM business_days bd
         LEFT JOIN (
            SELECT business_day_id,
                   SUM(cash_income) as cash_income,
                   SUM(bank_income) as bank_income,
                   SUM(total_income) as total_income
            FROM daily_incomes
            GROUP BY business_day_id
         ) di ON bd.id = di.business_day_id
         LEFT JOIN (
            SELECT business_day_id,
                   SUM(CASE WHEN payment_source = 'CASH' THEN amount ELSE 0 END) as cash_expense,
                   SUM(CASE WHEN payment_source = 'BANK' THEN amount ELSE 0 END) as bank_expense,
                   SUM(amount) as total_expense
            FROM daily_expenses
            GROUP BY business_day_id
         ) de ON bd.id = de.business_day_id
         GROUP BY DATE_FORMAT(bd.business_date, '%Y-%m'), DATE_FORMAT(bd.business_date, '%b %Y')
         ORDER BY month_key DESC
         LIMIT 6`
      );

      monthly.reverse();
      const trendData = monthly.map((m) => ({
        label: m.month_label,
        cashIncome: toFixed2(m.cash_income),
        bankIncome: toFixed2(m.bank_income),
        totalIncome: toFixed2(m.total_income),
        cashExpense: toFixed2(m.cash_expense),
        bankExpense: toFixed2(m.bank_expense),
        totalExpense: toFixed2(m.total_expense)
      }));

      return res.json({ success: true, timeframe: 'monthly', data: trendData });
    }

    // Default: Daily trends (Last 14 days) with pre-aggregated subqueries
    const daily = await query(
      `SELECT 
          bd.id as day_id,
          DATE_FORMAT(bd.business_date, '%Y-%m-%d') as date_key,
          bd.opening_cash,
          bd.opening_bank,
          bd.status,
          COALESCE(di.cash_income, 0) as cash_income,
          COALESCE(di.bank_income, 0) as bank_income,
          COALESCE(di.total_income, 0) as total_income,
          COALESCE(de.cash_expense, 0) as cash_expense,
          COALESCE(de.bank_expense, 0) as bank_expense,
          COALESCE(de.total_expense, 0) as total_expense,
          dc.actual_cash,
          dc.actual_bank,
          dc.cash_difference,
          dc.bank_difference,
          dc.daily_status
       FROM business_days bd
       LEFT JOIN (
          SELECT business_day_id,
                 SUM(cash_income) as cash_income,
                 SUM(bank_income) as bank_income,
                 SUM(total_income) as total_income
          FROM daily_incomes
          GROUP BY business_day_id
       ) di ON bd.id = di.business_day_id
       LEFT JOIN (
          SELECT business_day_id,
                 SUM(CASE WHEN payment_source = 'CASH' THEN amount ELSE 0 END) as cash_expense,
                 SUM(CASE WHEN payment_source = 'BANK' THEN amount ELSE 0 END) as bank_expense,
                 SUM(amount) as total_expense
          FROM daily_expenses
          GROUP BY business_day_id
       ) de ON bd.id = de.business_day_id
       LEFT JOIN daily_closings dc ON bd.id = dc.business_day_id
       ORDER BY bd.business_date DESC
       LIMIT 14`
    );

    daily.reverse();
    const trendData = daily.map((d) => ({
      label: d.date_key.slice(5), // MM-DD
      date: d.date_key,
      cashIncome: toFixed2(d.cash_income),
      bankIncome: toFixed2(d.bank_income),
      totalIncome: toFixed2(d.total_income),
      cashExpense: toFixed2(d.cash_expense),
      bankExpense: toFixed2(d.bank_expense),
      totalExpense: toFixed2(d.total_expense),
      expectedCash: toFixed2(d.opening_cash + d.cash_income - d.cash_expense),
      expectedBank: toFixed2(d.opening_bank + d.bank_income - d.bank_expense),
      actualCash: d.actual_cash !== null ? toFixed2(d.actual_cash) : null,
      actualBank: d.actual_bank !== null ? toFixed2(d.actual_bank) : null,
      cashDiff: d.cash_difference !== null ? toFixed2(d.cash_difference) : 0,
      bankDiff: d.bank_difference !== null ? toFixed2(d.bank_difference) : 0,
      status: d.daily_status || d.status
    }));

    return res.json({ success: true, timeframe: 'daily', data: trendData });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

// 2. Discrepancy & Variance Metrics
async function getDiscrepancyMetrics(req, res) {
  try {
    const summary = await query(
      `SELECT 
          COUNT(*) as total_cases,
          COALESCE(SUM(CASE WHEN status = 'OPEN' THEN 1 ELSE 0 END), 0) as open_cases,
          COALESCE(SUM(CASE WHEN status = 'IN_INVESTIGATION' THEN 1 ELSE 0 END), 0) as investigating_cases,
          COALESCE(SUM(CASE WHEN status IN ('RESOLVED', 'ADJUSTED_RESOLVED', 'CLOSED') THEN 1 ELSE 0 END), 0) as resolved_cases,
          COALESCE(SUM(CASE WHEN discrepancy_type = 'SHORTAGE' THEN ABS(difference_amount) ELSE 0 END), 0) as total_shortage_etb,
          COALESCE(SUM(CASE WHEN discrepancy_type = 'SURPLUS' THEN difference_amount ELSE 0 END), 0) as total_surplus_etb
       FROM discrepancies`
    );

    return res.json({
      success: true,
      metrics: {
        totalCases: summary[0].total_cases,
        openCases: summary[0].open_cases,
        investigatingCases: summary[0].investigating_cases,
        resolvedCases: summary[0].resolved_cases,
        totalShortageETB: toFixed2(summary[0].total_shortage_etb),
        totalSurplusETB: toFixed2(summary[0].total_surplus_etb)
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = {
  getFinancialTrends,
  getDiscrepancyMetrics
};
