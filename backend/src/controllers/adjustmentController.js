const { query, transaction } = require('../config/database');
const { logAudit } = require('../services/auditLogService');
const { toFixed2 } = require('../services/calculationService');

// Create an approved financial adjustment (Auditor or Manager).
async function createAdjustment(req, res) {
  try {
    const { discrepancy_id, business_day_id, account_type, amount, reason_category, detailed_reason, supporting_doc_ref } = req.body;

    if (!business_day_id || !account_type || amount === undefined || !reason_category || !detailed_reason) {
      return res.status(400).json({
        success: false,
        error: 'business_day_id, account_type (CASH/BANK), amount, reason_category, and detailed_reason are mandatory.'
      });
    }

    if (!['CASH', 'BANK'].includes(account_type.toUpperCase())) {
      return res.status(400).json({ success: false, error: 'account_type must be CASH or BANK.' });
    }

    const adjAmount = toFixed2(amount);
    if (adjAmount === 0) {
      return res.status(400).json({ success: false, error: 'Adjustment amount cannot be zero.' });
    }

    const validCategories = [
      'UNRECORDED_EXPENSE',
      'UNRECORDED_INCOME',
      'COUNTING_CORRECTION',
      'DATA_ENTRY_ERROR',
      'APPROVED_POLICY_ADJUSTMENT'
    ];
    if (!validCategories.includes(reason_category)) {
      return res.status(400).json({
        success: false,
        error: `Invalid reason_category. Valid values: [${validCategories.join(', ')}]`
      });
    }

    const result = await transaction(async (conn) => {
      // 1. Verify business day exists
      const [days] = await conn.execute('SELECT * FROM business_days WHERE id = ?', [business_day_id]);
      if (days.length === 0) {
        throw new Error('Business day not found.');
      }

      const adjCode = `ADJ-${days[0].business_date.replace(/-/g, '')}-${Date.now().toString().slice(-4)}`;

      // 2. Insert into adjustments
      const [adjInsert] = await conn.execute(
        `INSERT INTO adjustments 
          (adjustment_code, discrepancy_id, business_day_id, account_type, amount, reason_category, detailed_reason, supporting_doc_ref, requested_by, approved_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          adjCode,
          discrepancy_id || null,
          business_day_id,
          account_type.toUpperCase(),
          adjAmount,
          reason_category,
          detailed_reason,
          supporting_doc_ref || null,
          req.user.id,
          req.user.id // Signed off by authorized auditor
        ]
      );

      // 3. If linked to a discrepancy, update discrepancy status to ADJUSTED_RESOLVED
      if (discrepancy_id) {
        await conn.execute(
          `UPDATE discrepancies 
           SET status = 'ADJUSTED_RESOLVED', resolution_notes = CONCAT('Resolved via approved adjustment ', ?), resolved_by = ?, updated_at = NOW()
           WHERE id = ?`,
          [adjCode, req.user.id, discrepancy_id]
        );
      }

      return {
        adjustmentId: adjInsert.insertId,
        adjustment_code: adjCode,
        amount: adjAmount,
        account_type: account_type.toUpperCase()
      };
    });

    await logAudit({
      userId: req.user.id,
      action: 'CREATE_APPROVED_ADJUSTMENT',
      entityName: 'adjustments',
      entityId: result.adjustmentId,
      newValues: { ...req.body, adjustment_code: result.adjustment_code },
      reason: detailed_reason,
      req
    });

    return res.status(201).json({
      success: true,
      message: `Approved adjustment ${result.adjustment_code} created successfully.`,
      adjustment: result
    });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
}

// Get adjustments list
async function getAdjustments(req, res) {
  try {
    const { business_day_id } = req.query;
    let sql = `
      SELECT a.*, 
             u1.full_name as requested_by_name,
             u2.full_name as approved_by_name,
             bd.business_date
      FROM adjustments a
      JOIN business_days bd ON a.business_day_id = bd.id
      JOIN users u1 ON a.requested_by = u1.id
      JOIN users u2 ON a.approved_by = u2.id
      WHERE 1=1
    `;
    const params = [];

    if (business_day_id) {
      sql += ' AND a.business_day_id = ?';
      params.push(business_day_id);
    }

    sql += ' ORDER BY a.created_at DESC';

    const adjustments = await query(sql, params);
    return res.json({ success: true, adjustments });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = {
  createAdjustment,
  getAdjustments
};
