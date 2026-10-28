const { query } = require('../config/database');

// 1. Daily Income Report
async function getDailyIncomeReport(req, res) {
  try {
    const { start_date, end_date } = req.query;
    let sql = `
      SELECT di.*, bd.business_date, u.full_name as recorded_by_name
      FROM daily_incomes di
      JOIN business_days bd ON di.business_day_id = bd.id
      JOIN users u ON di.created_by = u.id
      WHERE 1=1
    `;
    const params = [];
    if (start_date) {
      sql += ' AND bd.business_date >= ?';
      params.push(start_date);
    }
    if (end_date) {
      sql += ' AND bd.business_date <= ?';
      params.push(end_date);
    }
    sql += ' ORDER BY bd.business_date DESC, di.created_at DESC';

    const report = await query(sql, params);
    return res.json({ success: true, count: report.length, data: report });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

// 2. Daily Expense Report
async function getDailyExpenseReport(req, res) {
  try {
    const { start_date, end_date, payment_source } = req.query;
    let sql = `
      SELECT de.*, bd.business_date, u.full_name as recorded_by_name
      FROM daily_expenses de
      JOIN business_days bd ON de.business_day_id = bd.id
      JOIN users u ON de.created_by = u.id
      WHERE 1=1
    `;
    const params = [];
    if (start_date) {
      sql += ' AND bd.business_date >= ?';
      params.push(start_date);
    }
    if (end_date) {
      sql += ' AND bd.business_date <= ?';
      params.push(end_date);
    }
    if (payment_source) {
      sql += ' AND de.payment_source = ?';
      params.push(payment_source.toUpperCase());
    }
    sql += ' ORDER BY bd.business_date DESC, de.created_at DESC';

    const report = await query(sql, params);
    return res.json({ success: true, count: report.length, data: report });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

// 3. Daily Closing Reconciliation Report
async function getDailyClosingReport(req, res) {
  try {
    const { start_date, end_date } = req.query;
    let sql = `
      SELECT dc.*, bd.business_date, 
             uc.full_name as closed_by_name,
             uv.full_name as verified_by_name
      FROM daily_closings dc
      JOIN business_days bd ON dc.business_day_id = bd.id
      JOIN users uc ON dc.closed_by = uc.id
      LEFT JOIN users uv ON dc.verified_by = uv.id
      WHERE 1=1
    `;
    const params = [];
    if (start_date) {
      sql += ' AND bd.business_date >= ?';
      params.push(start_date);
    }
    if (end_date) {
      sql += ' AND bd.business_date <= ?';
      params.push(end_date);
    }
    sql += ' ORDER BY bd.business_date DESC';

    const report = await query(sql, params);
    return res.json({ success: true, count: report.length, data: report });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

// 4. Three-Day Audit Report
async function getThreeDayAuditReport(req, res) {
  try {
    const { audit_id } = req.query;
    let sql = `
      SELECT tda.*, 
             u.full_name as auditor_name,
             ua.full_name as approved_by_name
      FROM three_day_audits tda
      JOIN users u ON tda.auditor_id = u.id
      LEFT JOIN users ua ON tda.approved_by = ua.id
      WHERE 1=1
    `;
    const params = [];
    if (audit_id) {
      sql += ' AND tda.id = ?';
      params.push(audit_id);
    }
    sql += ' ORDER BY tda.end_date DESC';

    const report = await query(sql, params);
    return res.json({ success: true, count: report.length, data: report });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

// 5. Audit Trail Logs Report (Audit trail reporting disabled)
async function getAuditTrailReport(req, res) {
  return res.json({ success: true, count: 0, logs: [] });
}

module.exports = {
  getDailyIncomeReport,
  getDailyExpenseReport,
  getDailyClosingReport,
  getThreeDayAuditReport,
  getAuditTrailReport
};
