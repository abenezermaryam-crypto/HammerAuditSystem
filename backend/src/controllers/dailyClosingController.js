const { query, transaction } = require('../config/database');
const { calculateDayReconciliation, evaluateReconciliation, toFixed2 } = require('../services/calculationService');
const { logAudit } = require('../services/auditLogService');

// Get real-time reconciliation calculation preview for the current shift
async function getClosingPreview(req, res) {
  try {
    const { business_day_id } = req.params;
    if (!business_day_id) {
      return res.status(400).json({ success: false, error: 'business_day_id parameter is required.' });
    }

    const calc = await calculateDayReconciliation(business_day_id);

    return res.json({
      success: true,
      reconciliationPreview: calc
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

// Perform Formal Daily Closing (Atomic ACID Transaction)
async function performDailyClosing(req, res) {
  try {
    const { business_day_id } = req.params;
    const { actual_cash, actual_bank, notes } = req.body;

    // Run within atomic transaction
    const result = await transaction(async (conn) => {
      // 1. Lock day record for update
      const [days] = await conn.execute(
        `SELECT *, DATE_FORMAT(business_date, '%Y-%m-%d') AS business_date_key
         FROM business_days WHERE id = ? FOR UPDATE`,
        [business_day_id]
      );
      if (days.length === 0) {
        throw new Error('Business day not found.');
      }
      const day = days[0];

      if (day.status !== 'OPEN') {
        throw new Error(`ACCESS DENIED: Business day ${day.business_date} is already ${day.status} and cannot be closed again.`);
      }

      // 2. Perform Server-Authoritative Calculations
      const calc = await calculateDayReconciliation(business_day_id);

      // In daily closing, actual counts are defaulted to calculated totals (Cross-check verification occurs on 3-Day Audit)
      const actCash = (actual_cash !== undefined && actual_cash !== null && actual_cash !== '') ? toFixed2(actual_cash) : calc.expectedCash;
      const actBank = (actual_bank !== undefined && actual_bank !== null && actual_bank !== '') ? toFixed2(actual_bank) : calc.expectedBank;

      const recon = evaluateReconciliation(calc.expectedCash, actCash, calc.expectedBank, actBank);

      // 3. Insert/Update daily_closings table
      const closingValues = [
          business_day_id,
          calc.openingCash,
          calc.totalCashIncome,
          calc.totalCashExpenses,
          calc.cashAdjustments,
          recon.expectedCash,
          recon.actualCash,
          recon.cashDifference,
          recon.cashStatus,

          calc.openingBank,
          calc.totalBankIncome,
          calc.totalBankExpenses,
          calc.bankAdjustments,
          recon.expectedBank,
          recon.actualBank,
          recon.bankDifference,
          recon.bankStatus,

          recon.dailyStatus,
          notes || null,
          req.user.id,
          req.user.id
      ];
      const [existingClosings] = await conn.execute(
        'SELECT id FROM daily_closings WHERE business_day_id = ? FOR UPDATE',
        [business_day_id]
      );
      let closingId;
      if (existingClosings.length) {
        closingId = existingClosings[0].id;
        await conn.execute(
          `UPDATE daily_closings SET opening_cash = ?, total_cash_income = ?, total_cash_expenses = ?,
           cash_adjustments = ?, expected_cash = ?, actual_cash = ?, cash_difference = ?, cash_status = ?,
           opening_bank = ?, total_bank_income = ?, total_bank_expenses = ?, bank_adjustments = ?,
           expected_bank = ?, actual_bank = ?, bank_difference = ?, bank_status = ?, daily_status = ?,
           notes = ?, closed_by = ?, verified_by = ?, automatically_closed = FALSE, closed_at = NOW()
           WHERE business_day_id = ?`,
          [
            calc.openingCash, calc.totalCashIncome, calc.totalCashExpenses, calc.cashAdjustments,
            recon.expectedCash, recon.actualCash, recon.cashDifference, recon.cashStatus,
            calc.openingBank, calc.totalBankIncome, calc.totalBankExpenses, calc.bankAdjustments,
            recon.expectedBank, recon.actualBank, recon.bankDifference, recon.bankStatus,
            recon.dailyStatus, notes || null, req.user.id, req.user.id, business_day_id
          ]
        );
      } else {
        const [closingResult] = await conn.execute(
          `INSERT INTO daily_closings 
            (business_day_id, opening_cash, total_cash_income, total_cash_expenses, cash_adjustments, expected_cash, actual_cash, cash_difference, cash_status,
             opening_bank, total_bank_income, total_bank_expenses, bank_adjustments, expected_bank, actual_bank, bank_difference, bank_status,
             daily_status, notes, closed_by, verified_by, closed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          closingValues
        );
        closingId = closingResult.insertId;
      }

      // 4. Freeze and update business day status to CLOSED
      await conn.execute(
        `UPDATE business_days 
         SET status = 'CLOSED', closed_by = ?, closed_at = NOW() 
         WHERE id = ?`,
        [req.user.id, business_day_id]
      );
      await conn.execute(
        `INSERT INTO business_day_schedule_overrides (business_date, override_action, changed_by)
         VALUES (?, 'CLOSED', ?) ON DUPLICATE KEY UPDATE override_action = 'CLOSED', changed_by = VALUES(changed_by), changed_at = CURRENT_TIMESTAMP`,
        [day.business_date_key, req.user.id]
      );

      return {
        closingId,
        business_date: day.business_date,
        reconciliation: recon
      };
    });

    await logAudit({
      userId: req.user.id,
      action: 'PERFORM_DAILY_CLOSING',
      entityName: 'daily_closings',
      entityId: result.closingId,
      newValues: result.reconciliation,
      reason: `Daily closing executed for ${result.business_date}. Status: ${result.reconciliation.dailyStatus}`,
      req
    });

    return res.status(200).json({
      success: true,
      message: `Business day ${result.business_date} successfully closed and locked.`,
      closing: result
    });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
}

module.exports = {
  getClosingPreview,
  performDailyClosing
};
