const { query, transaction } = require('../config/database');
const { logAudit } = require('../services/auditLogService');
const { toFixed2 } = require('../services/calculationService');
const { updateFinancialRecord } = require('../services/financialRecordService');

// Record Daily Aggregated Income
async function recordDailyIncome(req, res) {
  try {
    const { business_day_id, cash_income, bank_income, description, reference_number } = req.body;

    if (!business_day_id) {
      return res.status(400).json({ success: false, error: 'business_day_id is required.' });
    }

    const rawCash = cash_income === undefined || cash_income === null || cash_income === '' ? 0 : Number(cash_income);
    const rawBank = bank_income === undefined || bank_income === null || bank_income === '' ? 0 : Number(bank_income);
    if (!Number.isFinite(rawCash) || !Number.isFinite(rawBank) || rawCash < 0 || rawBank < 0
      || rawCash > 999999999999.99 || rawBank > 999999999999.99) {
      return res.status(400).json({ success: false, error: 'Income amounts must be valid monetary values.' });
    }
    const cIncome = toFixed2(rawCash);
    const bIncome = toFixed2(rawBank);

    if (cIncome < 0 || bIncome < 0) {
      return res.status(400).json({ success: false, error: 'Income amounts cannot be negative.' });
    }

    if (cIncome === 0 && bIncome === 0) {
      return res.status(400).json({ success: false, error: 'At least one income amount (Cash or Bank) must be greater than zero.' });
    }

    if (![cIncome, bIncome].every((amount) => Number.isFinite(amount) && amount >= 0)
      || cIncome + bIncome <= 0 || description !== undefined && (typeof description !== 'string' || description.length > 255)
      || reference_number !== undefined && reference_number !== null && (typeof reference_number !== 'string' || reference_number.length > 100)) {
      return res.status(400).json({ success: false, error: 'Income values, description, or reference are invalid.' });
    }
    const result = await transaction(async (connection) => {
      const [days] = await connection.execute('SELECT status FROM business_days WHERE id = ? FOR UPDATE', [business_day_id]);
      if (!days.length) {
        const error = new Error('Business day not found.');
        error.status = 404;
        throw error;
      }
      if (days[0].status !== 'OPEN') {
        const error = new Error('Income can only be recorded while the business day is open.');
        error.status = 403;
        throw error;
      }
      if (reference_number) {
        const [duplicates] = await connection.execute(
          `SELECT id FROM daily_incomes
           WHERE business_day_id = ? AND reference_number = ? LIMIT 1`,
          [business_day_id, reference_number]
        );
        if (duplicates.length) {
          const error = new Error('That reference number is already used for an income on this business day.');
          error.status = 409;
          throw error;
        }
      }
      const [insert] = await connection.execute(
        `INSERT INTO daily_incomes (business_day_id, cash_income, bank_income, description, reference_number, created_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [business_day_id, cIncome, bIncome, description || 'Aggregated daily income', reference_number || null, req.user.id]
      );
      return insert;
    });

    const totalIncome = toFixed2(cIncome + bIncome);

    await logAudit({
      userId: req.user.id,
      action: 'RECORD_DAILY_INCOME',
      entityName: 'daily_incomes',
      entityId: result.insertId,
      newValues: { business_day_id, cash_income: cIncome, bank_income: bIncome, total_income: totalIncome },
      reason: 'Standard daily income entry',
      req
    });

    return res.status(201).json({
      success: true,
      message: 'Daily income recorded successfully.',
      income: {
        id: result.insertId,
        business_day_id,
        cash_income: cIncome,
        bank_income: bIncome,
        total_income: totalIncome,
        description,
        reference_number
      }
    });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message });
  }
}

async function updateDailyIncome(req, res) {
  try {
    const income = await updateFinancialRecord('INCOME', req.params.id, req);
    return res.json({ success: true, message: 'Income updated and the change recorded.', income: { id: Number(req.params.id), ...income } });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message });
  }
}

// Get incomes for a business day
async function getIncomesByDay(req, res) {
  try {
    const { business_day_id } = req.query;
    if (!business_day_id) {
      return res.status(400).json({ success: false, error: 'business_day_id query param is required.' });
    }

    const rows = await query(
      `SELECT di.*, u.full_name as recorded_by_name 
       FROM daily_incomes di
       JOIN users u ON di.created_by = u.id
       WHERE di.business_day_id = ?
       ORDER BY di.created_at DESC`,
      [business_day_id]
    );

    return res.json({ success: true, incomes: rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = {
  recordDailyIncome,
  getIncomesByDay,
  updateDailyIncome
};
