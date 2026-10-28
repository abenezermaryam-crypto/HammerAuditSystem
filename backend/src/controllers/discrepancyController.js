const { query } = require('../config/database');
const { logAudit } = require('../services/auditLogService');

// Get discrepancies list (with filters)
async function getDiscrepancies(req, res) {
  try {
    const { status, account_type } = req.query;
    let sql = `
      SELECT d.*, 
             u.full_name as responsible_person_name,
             ui.full_name as investigator_name,
             ur.full_name as resolver_name
      FROM discrepancies d
      LEFT JOIN users u ON d.responsible_user_id = u.id
      LEFT JOIN users ui ON d.investigated_by = ui.id
      LEFT JOIN users ur ON d.resolved_by = ur.id
      WHERE 1=1
    `;
    const params = [];

    if (req.user.role === 'recorder') {
      sql += ' AND d.responsible_user_id = ?';
      params.push(req.user.id);
    }
    if (status) {
      sql += ' AND d.status = ?';
      params.push(status);
    }
    if (account_type) {
      sql += ' AND d.account_type = ?';
      params.push(account_type.toUpperCase());
    }

    sql += ' ORDER BY d.created_at DESC';

    const discrepancies = await query(sql, params);
    return res.json({ success: true, discrepancies });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

// Submit explanation for discrepancy
async function submitExplanation(req, res) {
  try {
    const { id } = req.params;
    const { explanation, evidence_ref } = req.body;

    if (!explanation) {
      return res.status(400).json({ success: false, error: 'Explanation is mandatory.' });
    }

    const [discrepancy] = await query('SELECT * FROM discrepancies WHERE id = ?', [id]);
    if (!discrepancy) {
      return res.status(404).json({ success: false, error: 'Discrepancy record not found.' });
    }

    if (req.user.role === 'recorder' && discrepancy.responsible_user_id !== req.user.id) {
      return res.status(403).json({ success: false, error: 'You can only explain discrepancies assigned to you.' });
    }

    if (discrepancy.status === 'CLOSED') {
      return res.status(400).json({ success: false, error: 'Cannot modify a closed discrepancy.' });
    }

    await query(
      `UPDATE discrepancies 
       SET explanation = ?, evidence_ref = ?, status = 'IN_INVESTIGATION', investigated_by = ?, updated_at = NOW()
       WHERE id = ?`,
      [explanation, evidence_ref || null, req.user.id, id]
    );

    await logAudit({
      userId: req.user.id,
      action: 'EXPLAIN_DISCREPANCY',
      entityName: 'discrepancies',
      entityId: id,
      newValues: { explanation, evidence_ref, status: 'IN_INVESTIGATION' },
      reason: 'Discrepancy explanation submitted',
      req
    });

    return res.json({
      success: true,
      message: 'Explanation recorded. Discrepancy is now under investigation.'
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

// Resolve/Close discrepancy
async function resolveDiscrepancy(req, res) {
  try {
    const { id } = req.params;
    const { resolution_notes, status } = req.body; // RESOLVED or CLOSED

    const targetStatus = status || 'RESOLVED';
    if (!['RESOLVED', 'CLOSED'].includes(targetStatus)) {
      return res.status(400).json({ success: false, error: 'Status must be RESOLVED or CLOSED.' });
    }

    const [discrepancy] = await query('SELECT * FROM discrepancies WHERE id = ?', [id]);
    if (!discrepancy) {
      return res.status(404).json({ success: false, error: 'Discrepancy not found.' });
    }

    await query(
      `UPDATE discrepancies 
       SET status = ?, resolution_notes = ?, resolved_by = ?, updated_at = NOW()
       WHERE id = ?`,
      [targetStatus, resolution_notes || 'Resolved by auditor/manager', req.user.id, id]
    );

    await logAudit({
      userId: req.user.id,
      action: 'RESOLVE_DISCREPANCY',
      entityName: 'discrepancies',
      entityId: id,
      newValues: { status: targetStatus, resolution_notes },
      reason: `Discrepancy updated to ${targetStatus}`,
      req
    });

    return res.json({
      success: true,
      message: `Discrepancy #${discrepancy.discrepancy_code} updated to ${targetStatus}.`
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = {
  getDiscrepancies,
  submitExplanation,
  resolveDiscrepancy
};
