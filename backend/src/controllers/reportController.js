const { query } = require('../config/database');

// Helper to convert array of objects to CSV
function convertToCSV(data, headers) {
  if (!data || !data.length) return headers.map(h => `"${h.label}"`).join(',') + '\r\n';
  const headerLine = headers.map(h => `"${h.label}"`).join(',');
  const rows = data.map(row => {
    return headers.map(h => {
      let val = row[h.key];
      if (val === null || val === undefined) val = '';
      val = String(val).replace(/"/g, '""');
      return `"${val}"`;
    }).join(',');
  });
  return [headerLine, ...rows].join('\r\n');
}

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

// 5. Audit Trail Logs Report
async function getAuditTrailReport(req, res) {
  return res.json({ success: true, count: 0, logs: [] });
}

// 6. CSV Report Exporter
async function exportCSVReport(req, res) {
  try {
    const { type = 'incomes', start_date, end_date } = req.query;
    let filename = `hamer_shop_${type}_report_${Date.now()}.csv`;
    let headers = [];
    let data = [];

    if (type === 'incomes') {
      let sql = `
        SELECT di.*, bd.business_date, u.full_name as recorded_by_name
        FROM daily_incomes di
        JOIN business_days bd ON di.business_day_id = bd.id
        JOIN users u ON di.created_by = u.id WHERE 1=1
      `;
      const params = [];
      if (start_date) { sql += ' AND bd.business_date >= ?'; params.push(start_date); }
      if (end_date) { sql += ' AND bd.business_date <= ?'; params.push(end_date); }
      sql += ' ORDER BY bd.business_date DESC';
      data = await query(sql, params);
      headers = [
        { label: 'Business Date', key: 'business_date' },
        { label: 'Cash Income (ETB)', key: 'cash_income' },
        { label: 'Bank Income (ETB)', key: 'bank_income' },
        { label: 'Total Income (ETB)', key: 'total_income' },
        { label: 'Description', key: 'description' },
        { label: 'Reference Number', key: 'reference_number' },
        { label: 'Recorded By', key: 'recorded_by_name' }
      ];
    } else if (type === 'expenses') {
      let sql = `
        SELECT de.*, bd.business_date, u.full_name as recorded_by_name
        FROM daily_expenses de
        JOIN business_days bd ON de.business_day_id = bd.id
        JOIN users u ON de.created_by = u.id WHERE 1=1
      `;
      const params = [];
      if (start_date) { sql += ' AND bd.business_date >= ?'; params.push(start_date); }
      if (end_date) { sql += ' AND bd.business_date <= ?'; params.push(end_date); }
      sql += ' ORDER BY bd.business_date DESC';
      data = await query(sql, params);
      headers = [
        { label: 'Business Date', key: 'business_date' },
        { label: 'Description', key: 'description' },
        { label: 'Payment Source', key: 'payment_source' },
        { label: 'Amount (ETB)', key: 'amount' },
        { label: 'Category', key: 'expense_category' },
        { label: 'Reference Number', key: 'reference_number' },
        { label: 'Recorded By', key: 'recorded_by_name' }
      ];
    } else if (type === 'closings') {
      let sql = `
        SELECT dc.*, bd.business_date, uc.full_name as closed_by_name
        FROM daily_closings dc
        JOIN business_days bd ON dc.business_day_id = bd.id
        JOIN users uc ON dc.closed_by = uc.id WHERE 1=1
      `;
      const params = [];
      if (start_date) { sql += ' AND bd.business_date >= ?'; params.push(start_date); }
      if (end_date) { sql += ' AND bd.business_date <= ?'; params.push(end_date); }
      sql += ' ORDER BY bd.business_date DESC';
      data = await query(sql, params);
      headers = [
        { label: 'Business Date', key: 'business_date' },
        { label: 'Expected Cash', key: 'expected_cash' },
        { label: 'Actual Cash', key: 'actual_cash' },
        { label: 'Cash Status', key: 'cash_status' },
        { label: 'Expected Bank', key: 'expected_bank' },
        { label: 'Actual Bank', key: 'actual_bank' },
        { label: 'Bank Status', key: 'bank_status' },
        { label: 'Overall Status', key: 'daily_status' },
        { label: 'Closed By', key: 'closed_by_name' }
      ];
    }

    const csvContent = convertToCSV(data, headers);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(csvContent);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

// 7. Formatted HTML Printable Document Exporter (PDF Ready)
async function exportPrintableReport(req, res) {
  try {
    const { type = 'closings', start_date, end_date } = req.query;
    let title = 'Financial Report';
    let sql = '';
    const params = [];

    if (type === 'closings') {
      title = 'Daily Closing Reconciliation Report';
      sql = `
        SELECT dc.*, bd.business_date, uc.full_name as closed_by_name
        FROM daily_closings dc
        JOIN business_days bd ON dc.business_day_id = bd.id
        JOIN users uc ON dc.closed_by = uc.id WHERE 1=1
      `;
    } else if (type === 'audits') {
      title = 'Three-Day Audit Report';
      sql = `
        SELECT tda.*, u.full_name as auditor_name
        FROM three_day_audits tda
        JOIN users u ON tda.auditor_id = u.id WHERE 1=1
      `;
    } else if (type === 'expenses') {
      title = 'Daily Operational Expense Report';
      sql = `
        SELECT de.*, bd.business_date, u.full_name as recorded_by_name
        FROM daily_expenses de
        JOIN business_days bd ON de.business_day_id = bd.id
        JOIN users u ON de.created_by = u.id WHERE 1=1
      `;
    } else {
      title = 'Daily Income Report';
      sql = `
        SELECT di.*, bd.business_date, u.full_name as recorded_by_name
        FROM daily_incomes di
        JOIN business_days bd ON di.business_day_id = bd.id
        JOIN users u ON di.created_by = u.id WHERE 1=1
      `;
    }

    if (start_date) { sql += type === 'audits' ? ' AND tda.start_date >= ?' : ' AND bd.business_date >= ?'; params.push(start_date); }
    if (end_date) { sql += type === 'audits' ? ' AND tda.end_date <= ?' : ' AND bd.business_date <= ?'; params.push(end_date); }
    sql += type === 'audits' ? ' ORDER BY tda.end_date DESC' : ' ORDER BY bd.business_date DESC';

    const data = await query(sql, params);

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Hamer Shop - ${title}</title>
        <style>
          body { font-family: 'Helvetica Neue', Arial, sans-serif; margin: 30px; color: #1f2937; }
          .header { text-align: center; border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 20px; }
          .header h1 { margin: 0; color: #0369a1; font-size: 22px; }
          .header h2 { margin: 4px 0 0; color: #475569; font-size: 15px; font-weight: normal; }
          .meta { margin-bottom: 15px; font-size: 13px; color: #64748b; display: flex; justify-content: space-between; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
          th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; }
          th { background-color: #f1f5f9; color: #0f172a; font-weight: 600; }
          tr:nth-child(even) { background-color: #f8fafc; }
          .text-right { text-align: right; }
          .badge { padding: 3px 6px; border-radius: 4px; font-weight: bold; font-size: 10px; }
          .badge-balanced { background: #dcfce7; color: #15803d; }
          .badge-shortage { background: #fee2e2; color: #b91c1c; }
          .badge-surplus { background: #ffedd5; color: #c2410c; }
          .footer-signatures { margin-top: 50px; display: flex; justify-content: space-between; font-size: 12px; }
          .sig-box { width: 40%; border-top: 1px solid #64748b; padding-top: 5px; text-align: center; }
          @media print { .no-print { display: none; } body { margin: 0; } }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom: 15px; text-align: right;">
          <button onclick="window.print()" style="padding: 8px 16px; background: #0284c7; color: white; border: none; border-radius: 4px; cursor: pointer;">🖨️ Print / Save as PDF</button>
        </div>
        <div class="header">
          <h1>🏪 HAMER SHOP FINANCIAL CONTROL SYSTEM</h1>
          <h2>${title}</h2>
        </div>
        <div class="meta">
          <span>Date Range: ${start_date || 'All Time'} to ${end_date || 'Current'}</span>
          <span>Generated: ${new Date().toLocaleString()}</span>
        </div>
        <table>
          <thead>
            <tr>
              ${type === 'closings' ? `
                <th>Date</th><th>Expected Cash</th><th>Actual Cash</th><th>Cash Status</th><th>Expected Bank</th><th>Actual Bank</th><th>Bank Status</th><th>Closed By</th>
              ` : type === 'audits' ? `
                <th>Code</th><th>Period</th><th>Expected Cash</th><th>Actual Cash</th><th>Cash Status</th><th>Expected Bank</th><th>Actual Bank</th><th>Bank Status</th><th>Auditor</th>
              ` : type === 'expenses' ? `
                <th>Date</th><th>Description</th><th>Source</th><th>Amount (ETB)</th><th>Category</th><th>Recorded By</th>
              ` : `
                <th>Date</th><th>Cash Income (ETB)</th><th>Bank Income (ETB)</th><th>Total Income (ETB)</th><th>Description</th><th>Recorded By</th>
              `}
            </tr>
          </thead>
          <tbody>
            ${data.map(row => `
              <tr>
                ${type === 'closings' ? `
                  <td>${row.business_date}</td>
                  <td class="text-right">${Number(row.expected_cash).toFixed(2)}</td>
                  <td class="text-right">${Number(row.actual_cash).toFixed(2)}</td>
                  <td><span class="badge badge-${row.cash_status.toLowerCase()}">${row.cash_status}</span></td>
                  <td class="text-right">${Number(row.expected_bank).toFixed(2)}</td>
                  <td class="text-right">${Number(row.actual_bank).toFixed(2)}</td>
                  <td><span class="badge badge-${row.bank_status.toLowerCase()}">${row.bank_status}</span></td>
                  <td>${row.closed_by_name || '-'}</td>
                ` : type === 'audits' ? `
                  <td>${row.audit_code}</td>
                  <td>${row.start_date_str || row.start_date} to ${row.end_date_str || row.end_date}</td>
                  <td class="text-right">${Number(row.expected_cash).toFixed(2)}</td>
                  <td class="text-right">${Number(row.actual_cash).toFixed(2)}</td>
                  <td><span class="badge badge-${row.cash_audit_status.toLowerCase()}">${row.cash_audit_status}</span></td>
                  <td class="text-right">${Number(row.expected_bank).toFixed(2)}</td>
                  <td class="text-right">${Number(row.actual_bank).toFixed(2)}</td>
                  <td><span class="badge badge-${row.bank_audit_status.toLowerCase()}">${row.bank_audit_status}</span></td>
                  <td>${row.auditor_name || '-'}</td>
                ` : type === 'expenses' ? `
                  <td>${row.business_date}</td>
                  <td>${row.description}</td>
                  <td>${row.payment_source}</td>
                  <td class="text-right">${Number(row.amount).toFixed(2)}</td>
                  <td>${row.expense_category || 'General'}</td>
                  <td>${row.recorded_by_name || '-'}</td>
                ` : `
                  <td>${row.business_date}</td>
                  <td class="text-right">${Number(row.cash_income).toFixed(2)}</td>
                  <td class="text-right">${Number(row.bank_income).toFixed(2)}</td>
                  <td class="text-right"><strong>${Number(row.total_income).toFixed(2)}</strong></td>
                  <td>${row.description || '-'}</td>
                  <td>${row.recorded_by_name || '-'}</td>
                `}
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="footer-signatures">
          <div class="sig-box">
            <br><br>
            <strong>Manager Signature & Stamp</strong>
          </div>
          <div class="sig-box">
            <br><br>
            <strong>Auditor Sign-off</strong>
          </div>
        </div>
      </body>
      </html>
    `;

    res.setHeader('Content-Type', 'text/html');
    return res.send(html);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = {
  getDailyIncomeReport,
  getDailyExpenseReport,
  getDailyClosingReport,
  getThreeDayAuditReport,
  getAuditTrailReport,
  exportCSVReport,
  exportPrintableReport
};
