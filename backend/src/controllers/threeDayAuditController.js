const { query, transaction } = require('../config/database');
const { calculateThreeDayAudit, evaluateReconciliation, toFixed2, toDateStr } = require('../services/calculationService');
const { logAudit } = require('../services/auditLogService');

// ---------------------------------------------------------------------------
// Get closed days eligible for 3-Day Audit
// ---------------------------------------------------------------------------
async function getEligibleAuditDays(req, res) {
  try {
    const days = await query(
      `SELECT bd.*,
              DATE_FORMAT(bd.business_date, '%Y-%m-%d') AS business_date_key,
              dc.actual_cash, dc.actual_bank, dc.daily_status
       FROM business_days bd
       JOIN daily_closings dc ON bd.id = dc.business_day_id
       WHERE bd.status = 'CLOSED'
       ORDER BY bd.business_date ASC`
    );
    return res.json({ success: true, closedDays: days });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

// ---------------------------------------------------------------------------
// Preview Three-Day Audit Calculations (before finalizing)
// ---------------------------------------------------------------------------
async function previewThreeDayAudit(req, res) {
  try {
    const { day_ids, additional_cash_income } = req.body;

    if (!day_ids || day_ids.length !== 3) {
      return res.status(400).json({
        success: false,
        error: 'Please select exactly 3 consecutive closed business days for the audit cycle.',
      });
    }

    const calc = await calculateThreeDayAudit(day_ids, additional_cash_income || 0);

    return res.json({ success: true, auditPreview: calc });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
}

// ---------------------------------------------------------------------------
// Submit Three-Day Audit
// Implements Section 3 (carry-forward) and Section 4 (audit difference)
// ---------------------------------------------------------------------------
async function submitThreeDayAudit(req, res) {
  try {
    const { day_ids, actual_cash, actual_bank, additional_cash_income, remarks } = req.body;

    if (!day_ids || day_ids.length !== 3) {
      return res.status(400).json({
        success: false,
        error: 'Three-Day Audit requires selecting exactly 3 business days.',
      });
    }

    if (actual_cash === undefined || actual_cash === null ||
        actual_bank === undefined || actual_bank === null) {
      return res.status(400).json({
        success: false,
        error: 'Actual verified cash and bank balances are required.',
      });
    }

    const actCash = toFixed2(actual_cash);
    const actBank = toFixed2(actual_bank);
    const addCash = toFixed2(additional_cash_income || 0);

    const result = await transaction(async (conn) => {
      // 1. Calculate three-day closing balances (Section 3 carry-forward logic)
      const calc = await calculateThreeDayAudit(day_ids, addCash);

      // Verify all 3 days are CLOSED
      if (
        calc.day1.status !== 'CLOSED' ||
        calc.day2.status !== 'CLOSED' ||
        calc.day3.status !== 'CLOSED'
      ) {
        throw new Error(
          'All 3 days in the audit cycle must have status CLOSED before performing a 3-Day Audit.'
        );
      }

      // 2. Evaluate audit differences (Section 4)
      //    Difference = Actual Verified − Calculated Closing Balance
      //    Cash and bank evaluated independently
      const recon = evaluateReconciliation(
        calc.closingCashBalance,  // calculated three-day cash closing balance
        actCash,
        calc.closingBankBalance,  // calculated three-day bank closing balance
        actBank
      );

      const startStr = calc.startDate;
      const endStr   = calc.endDate;
      const auditCode = `AUD-${startStr.replace(/-/g, '')}-${endStr.replace(/-/g, '')}`;

      let overallStatus = 'BALANCED';
      if (recon.cashStatus !== 'BALANCED' || recon.bankStatus !== 'BALANCED') {
        overallStatus = 'DISCREPANCY_FOUND';
      }

      // 3. Insert audit record
      //    opening_cash = starting balance (previous audit closing OR day-1 opening)
      //    expected_cash = calculated closing balance (saved for next audit carry-forward)
      const [auditInsert] = await conn.execute(
        `INSERT INTO three_day_audits
          (audit_code, start_date, end_date, day_1_id, day_2_id, day_3_id,
           starting_balance_source,
           opening_cash, total_3day_cash_income, total_3day_cash_expenses,
           additional_cash_income, cash_adjustments,
           expected_cash, actual_cash, cash_difference, cash_audit_status,
           opening_bank, total_3day_bank_income, total_3day_bank_expenses,
           bank_adjustments,
           expected_bank, actual_bank, bank_difference, bank_audit_status,
           overall_status, auditor_id, auditor_remarks)
         VALUES (?, ?, ?, ?, ?, ?, ?,  ?, ?, ?, ?, ?,  ?, ?, ?, ?,  ?, ?, ?, ?,  ?, ?, ?, ?,  ?, ?, ?)`,
        [
          auditCode,
          startStr,
          endStr,
          calc.day1.id,
          calc.day2.id,
          calc.day3.id,

          calc.startingBalanceSource,     // NEW: 'INITIAL_BALANCE' or 'PREVIOUS_AUDIT'

          calc.openingCash,               // starting cash balance (carry-forward or initial)
          calc.total3DayCashIncome,
          calc.total3DayCashExpenses,
          addCash,
          calc.cashAdjustments,
          recon.expectedCash,             // closingCashBalance = saved for next audit
          recon.actualCash,
          recon.cashDifference,
          recon.cashStatus,               // 'BALANCED' | 'SHORTAGE' | 'SURPLUS'

          calc.openingBank,               // starting bank balance (carry-forward or initial)
          calc.total3DayBankIncome,
          calc.total3DayBankExpenses,
          calc.bankAdjustments,
          recon.expectedBank,             // closingBankBalance = saved for next audit
          recon.actualBank,
          recon.bankDifference,
          recon.bankStatus,               // 'BALANCED' | 'SHORTAGE' | 'SURPLUS'

          overallStatus,
          req.user.id,
          remarks || null,
        ]
      );

      // 4. Register discrepancy records for each imbalanced account independently
      if (recon.cashStatus !== 'BALANCED') {
        const discCode  = `DISC-3D-CASH-${auditCode}-${Date.now()}`;
        const discType  = recon.cashDifference < 0 ? 'SHORTAGE' : 'SURPLUS';
        await conn.execute(
          `INSERT INTO discrepancies
            (discrepancy_code, source_type, source_id, business_date,
             account_type, expected_amount, actual_amount, difference_amount,
             discrepancy_type, status, responsible_user_id, explanation)
           VALUES (?, 'THREE_DAY_AUDIT', ?, ?, 'CASH', ?, ?, ?, ?, 'OPEN', ?, ?)`,
          [
            discCode,
            auditInsert.insertId,
            endStr,
            recon.expectedCash,
            recon.actualCash,
            recon.cashDifference,
            discType,
            req.user.id,
            `Three-Day Cash ${discType} for period ${startStr}–${endStr}. ` +
            `Calculated closing balance: ${recon.expectedCash} ETB. ` +
            `Actual verified cash: ${recon.actualCash} ETB. ` +
            `Difference: ${recon.cashDifference} ETB.`,
          ]
        );
      }

      if (recon.bankStatus !== 'BALANCED') {
        const discCode  = `DISC-3D-BANK-${auditCode}-${Date.now()}`;
        const discType  = recon.bankDifference < 0 ? 'SHORTAGE' : 'SURPLUS';
        await conn.execute(
          `INSERT INTO discrepancies
            (discrepancy_code, source_type, source_id, business_date,
             account_type, expected_amount, actual_amount, difference_amount,
             discrepancy_type, status, responsible_user_id, explanation)
           VALUES (?, 'THREE_DAY_AUDIT', ?, ?, 'BANK', ?, ?, ?, ?, 'OPEN', ?, ?)`,
          [
            discCode,
            auditInsert.insertId,
            endStr,
            recon.expectedBank,
            recon.actualBank,
            recon.bankDifference,
            discType,
            req.user.id,
            `Three-Day Bank ${discType} for period ${startStr}–${endStr}. ` +
            `Calculated closing balance: ${recon.expectedBank} ETB. ` +
            `Actual verified bank: ${recon.actualBank} ETB. ` +
            `Difference: ${recon.bankDifference} ETB.`,
          ]
        );
      }

      // 5. Mark the 3 business days as AUDITED
      await conn.execute(
        `UPDATE business_days SET status = 'AUDITED' WHERE id IN (?, ?, ?)`,
        [calc.day1.id, calc.day2.id, calc.day3.id]
      );

      return {
        auditId:              auditInsert.insertId,
        auditCode,
        startDate:            startStr,
        endDate:              endStr,
        startingBalanceSource: calc.startingBalanceSource,
        previousAuditEndDate: calc.previousAuditEndDate,
        openingCash:          calc.openingCash,
        openingBank:          calc.openingBank,
        closingCashBalance:   recon.expectedCash,
        closingBankBalance:   recon.expectedBank,
        overallStatus,
        reconciliation:       recon,
      };
    });

    await logAudit({
      userId:     req.user.id,
      action:     'SUBMIT_THREE_DAY_AUDIT',
      entityName: 'three_day_audits',
      entityId:   result.auditId,
      newValues:  result,
      reason:     `3-Day Audit ${result.auditCode} for ${result.startDate}–${result.endDate}. ` +
                  `Starting balance source: ${result.startingBalanceSource}. ` +
                  `Status: ${result.overallStatus}.`,
      req,
    });

    return res.status(201).json({
      success: true,
      message: `Three-Day Audit ${result.auditCode} submitted successfully.`,
      audit:   result,
    });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
}

// ---------------------------------------------------------------------------
// Get All Three-Day Audits (historical)
// ---------------------------------------------------------------------------
async function getAllAudits(req, res) {
  try {
    const audits = await query(
      `SELECT tda.*,
              DATE_FORMAT(tda.start_date, '%Y-%m-%d') AS start_date_str,
              DATE_FORMAT(tda.end_date,   '%Y-%m-%d') AS end_date_str,
              u.full_name  AS auditor_name,
              ua.full_name AS approved_by_name
       FROM three_day_audits tda
       JOIN  users u  ON tda.auditor_id  = u.id
       LEFT JOIN users ua ON tda.approved_by = ua.id
       ORDER BY tda.end_date DESC`
    );
    return res.json({ success: true, audits });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

// ---------------------------------------------------------------------------
// Formal Sign-Off / Close a Three-Day Audit
// ---------------------------------------------------------------------------
async function signOffAudit(req, res) {
  try {
    const { id }      = req.params;
    const { remarks } = req.body;

    const [audit] = await query('SELECT * FROM three_day_audits WHERE id = ?', [id]);
    if (!audit) {
      return res.status(404).json({ success: false, error: 'Audit record not found.' });
    }

    if (audit.overall_status === 'CLOSED') {
      return res.status(400).json({ success: false, error: 'Audit is already formally closed.' });
    }

    await query(
      `UPDATE three_day_audits
       SET overall_status = 'CLOSED',
           approved_by    = ?,
           auditor_remarks = CONCAT(COALESCE(auditor_remarks, ''), '\nSign-off: ', ?)
       WHERE id = ?`,
      [req.user.id, remarks || 'Formally verified and approved', id]
    );

    await logAudit({
      userId:     req.user.id,
      action:     'SIGN_OFF_AUDIT',
      entityName: 'three_day_audits',
      entityId:   id,
      newValues:  { overall_status: 'CLOSED', approved_by: req.user.id },
      reason:     remarks || 'Formal sign-off completed',
      req,
    });

    return res.json({
      success: true,
      message: `Three-Day Audit ${audit.audit_code} formally signed off and closed.`,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = {
  getEligibleAuditDays,
  previewThreeDayAudit,
  submitThreeDayAudit,
  getAllAudits,
  signOffAudit,
};
