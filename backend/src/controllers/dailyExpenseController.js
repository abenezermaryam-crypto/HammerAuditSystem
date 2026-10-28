const { query, transaction } = require('../config/database');
const { logAudit } = require('../services/auditLogService');
const { toFixed2 } = require('../services/calculationService');
const { updateFinancialRecord } = require('../services/financialRecordService');

// Record Daily Operational Expense
async function recordDailyExpense(req, res) {
  try {
    const { business_day_id, description, amount, payment_source, reference_number, expense_category } = req.body;

    if (!business_day_id || !description || amount === undefined || !payment_source) {
      return res.status(400).json({
        success: false,
        error: 'business_day_id, description, amount, and payment_source (CASH/BANK) are required.'
      });
    }

    if (typeof payment_source !== 'string' || !['CASH', 'BANK'].includes(payment_source.toUpperCase())) {
      return res.status(400).json({ success: false, error: 'payment_source must be either CASH or BANK.' });
    }

    const rawAmount = Number(amount);
    if (!Number.isFinite(rawAmount) || rawAmount > 999999999999.99) {
      return res.status(400).json({ success: false, error: 'Expense amount must be a valid monetary value.' });
    }
    const expAmount = toFixed2(rawAmount);
    if (expAmount <= 0) {
      return res.status(400).json({ success: false, error: 'Expense amount must be greater than 0.' });
    }

    const source = payment_source.toUpperCase();
    if (typeof description !== 'string' || !Number.isFinite(expAmount) || expAmount <= 0 || description.length > 255
      || reference_number !== undefined && reference_number !== null && (typeof reference_number !== 'string' || reference_number.length > 100)
      || expense_category !== undefined && expense_category !== null && (typeof expense_category !== 'string' || expense_category.length > 100)) {
      return res.status(400).json({ success: false, error: 'Expense values, description, or reference are invalid.' });
    }
    const result = await transaction(async (connection) => {
      const [days] = await connection.execute('SELECT status FROM business_days WHERE id = ? FOR UPDATE', [business_day_id]);
      if (!days.length) {
        const error = new Error('Business day not found.');
        error.status = 404;
        throw error;
      }
      if (days[0].status !== 'OPEN') {
        const error = new Error('Expenses can only be recorded while the business day is open.');
        error.status = 403;
        throw error;
      }
      if (reference_number) {
        const [duplicates] = await connection.execute(
          `SELECT id FROM daily_expenses
           WHERE business_day_id = ? AND reference_number = ? LIMIT 1`,
          [business_day_id, reference_number]
        );
        if (duplicates.length) {
          const error = new Error('That reference number is already used for an expense on this business day.');
          error.status = 409;
          throw error;
        }
      }
      const [insert] = await connection.execute(
        `INSERT INTO daily_expenses 
          (business_day_id, description, amount, payment_source, reference_number, expense_category, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [business_day_id, description, expAmount, source, reference_number || null, expense_category || 'General', req.user.id]
      );
      return insert;
    });

    await logAudit({
      userId: req.user.id,
      action: 'RECORD_DAILY_EXPENSE',
      entityName: 'daily_expenses',
      entityId: result.insertId,
      newValues: { business_day_id, description, amount: expAmount, payment_source: source },
      reason: 'Operational expense logged',
      req
    });

    return res.status(201).json({
      success: true,
      message: 'Expense recorded successfully.',
      expense: {
        id: result.insertId,
        business_day_id,
        description,
        amount: expAmount,
        payment_source: source,
        reference_number,
        expense_category
      }
    });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message });
  }
}

async function updateDailyExpense(req, res) {
  try {
    const expense = await updateFinancialRecord('EXPENSE', req.params.id, req);
    return res.json({ success: true, message: 'Expense updated and the change recorded.', expense: { id: Number(req.params.id), ...expense } });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message });
  }
}

// Get expenses for a business day
async function getExpensesByDay(req, res) {
  try {
    const { business_day_id } = req.query;
    if (!business_day_id) {
      return res.status(400).json({ success: false, error: 'business_day_id query param is required.' });
    }

    const rows = await query(
      `SELECT de.*, u.full_name as recorded_by_name 
       FROM daily_expenses de
       JOIN users u ON de.created_by = u.id
       WHERE de.business_day_id = ?
       ORDER BY de.created_at DESC`,
      [business_day_id]
    );

    return res.json({ success: true, expenses: rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = {
  recordDailyExpense,
  getExpensesByDay,
  updateDailyExpense
};
