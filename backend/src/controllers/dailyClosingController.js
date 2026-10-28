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

    if (actual_cash === undefined || actual_bank === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Both actual physical cash count (actual_cash) and verified bank balance (actual_bank) are required.'
      });
    }

    const rawCash = Number(actual_cash);
    const rawBank = Number(actual_bank);
    if (!Number.isFinite(rawCash) || !Number.isFinite(rawBank)
      || rawCash > 999999999999.99 || rawBank > 999999999999.99) {
      return res.status(400).json({ success: false, error: 'Actual balances must be valid monetary amounts.' });
    }
    const actCash = toFixed2(rawCash);
    const actBank = toFixed2(rawBank);

    if (actCash < 0 || actBank < 0) {
      return res.status(400).json({ success: false, error: 'Actual cash and bank balances cannot be negative.' });
    }

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
      const recon = evaluateReconciliation(calc.expectedCash, actCash, calc.expectedBank, actBank);

      // 3. Insert into daily_closings table
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

      // 4. If discrepancies exist, automatically create discrepancy records
      if (recon.cashStatus !== 'BALANCED') {
        const discCode = `DISC-CASH-${day.business_date_key.replace(/-/g, '')}-${closingId}-${Date.now()}`;
        const discType = recon.cashDifference < 0 ? 'SHORTAGE' : 'SURPLUS';
        await conn.execute(
          `INSERT INTO discrepancies 
            (discrepancy_code, source_type, source_id, business_date, account_type, expected_amount, actual_amount, difference_amount, discrepancy_type, status, responsible_user_id, explanation)
           VALUES (?, 'DAILY_CLOSING', ?, ?, 'CASH', ?, ?, ?, ?, 'OPEN', ?, ?)`,
          [
            discCode,
            closingId,
            day.business_date,
            recon.expectedCash,
            recon.actualCash,
            recon.cashDifference,
            discType,
            req.user.id,
            `Daily Closing Cash ${discType} detected on ${day.business_date}. Expected: ${recon.expectedCash} ETB, Actual: ${recon.actualCash} ETB.`
          ]
        );
      }

      if (recon.bankStatus !== 'BALANCED') {
        const discCode = `DISC-BANK-${day.business_date_key.replace(/-/g, '')}-${closingId}-${Date.now()}`;
        const bankDiscType = recon.bankDifference < 0 ? 'SHORTAGE' : 'SURPLUS';
        await conn.execute(
          `INSERT INTO discrepancies 
            (discrepancy_code, source_type, source_id, business_date, account_type, expected_amount, actual_amount, difference_amount, discrepancy_type, status, responsible_user_id, explanation)
           VALUES (?, 'DAILY_CLOSING', ?, ?, 'BANK', ?, ?, ?, ?, 'OPEN', ?, ?)`,
          [
            discCode,
            closingId,
            day.business_date,
            recon.expectedBank,
            recon.actualBank,
            recon.bankDifference,
            bankDiscType,
            req.user.id,
            `Daily Closing Bank ${bankDiscType} detected on ${day.business_date}. Expected: ${recon.expectedBank} ETB, Actual: ${recon.actualBank} ETB.`
          ]
        );
      }

      // 5. Freeze and update business day status to CLOSED
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
