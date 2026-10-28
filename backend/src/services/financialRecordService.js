const { query, transaction } = require('../config/database');
const { logAudit } = require('./auditLogService');
const { toFixed2 } = require('./calculationService');

const RECORDS = {
  INCOME: {
    table: 'daily_incomes',
    fields: ['cash_income', 'bank_income', 'description', 'reference_number']
  },
  EXPENSE: {
    table: 'daily_expenses',
    fields: ['description', 'amount', 'payment_source', 'reference_number', 'expense_category']
  }
};

function parseAmount(value) {
  if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '') return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0 || amount > 999999999999.99) return null;
  return toFixed2(amount);
}

async function updateFinancialRecord(type, recordId, req) {
  const config = RECORDS[type];
  if (!config || !/^\d+$/.test(String(recordId))) {
    const error = new Error('Invalid financial record.');
    error.status = 400;
    throw error;
  }

  const reason = req.body?.reason;
  if (typeof reason !== 'string' || reason.trim().length < 10 || reason.trim().length > 1000) {
    const error = new Error('A clear modification reason of 10 to 1000 characters is required.');
    error.status = 400;
    throw error;
  }

  const values = {};
  if (type === 'INCOME') {
    values.cash_income = parseAmount(req.body.cash_income);
    values.bank_income = parseAmount(req.body.bank_income);
    values.description = typeof req.body.description === 'string' ? req.body.description.trim() : '';
    values.reference_number = typeof req.body.reference_number === 'string' ? req.body.reference_number.trim() : null;
    if (values.cash_income === null || values.bank_income === null
      || values.cash_income + values.bank_income <= 0 || values.description.length > 255
      || (values.reference_number && values.reference_number.length > 100)) {
      const error = new Error('Enter valid positive income totals, a description of at most 255 characters, and a reference of at most 100 characters.');
      error.status = 400;
      throw error;
    }
    values.reference_number = values.reference_number || null;
  } else {
    values.amount = parseAmount(req.body.amount);
    values.description = typeof req.body.description === 'string' ? req.body.description.trim() : '';
    values.payment_source = typeof req.body.payment_source === 'string' ? req.body.payment_source.toUpperCase() : '';
    values.reference_number = typeof req.body.reference_number === 'string' ? req.body.reference_number.trim() : null;
    values.expense_category = typeof req.body.expense_category === 'string' ? req.body.expense_category.trim() : '';
    if (values.amount === null || values.amount <= 0 || !values.description || values.description.length > 255
      || !['CASH', 'BANK'].includes(values.payment_source)
      || (values.reference_number && values.reference_number.length > 100)
      || values.expense_category.length > 100) {
      const error = new Error('Enter a valid positive amount, description, payment source, and reference/category within their allowed lengths.');
      error.status = 400;
      throw error;
    }
    values.reference_number = values.reference_number || null;
    values.expense_category = values.expense_category || 'General';
  }

  const updateResult = await transaction(async (connection) => {
    const [initial] = await connection.execute(
      `SELECT business_day_id FROM ${config.table} WHERE id = ?`,
      [recordId]
    );
    if (!initial.length) {
      const error = new Error('Financial record not found.');
      error.status = 404;
      throw error;
    }
    const [days] = await connection.execute(
      'SELECT id, status FROM business_days WHERE id = ? FOR UPDATE',
      [initial[0].business_day_id]
    );
    if (!days.length || days[0].status !== 'OPEN') {
      const error = new Error('Financial records can only be edited while their business day is open. A Manager must reopen a closed day with a recorded reason first.');
      error.status = 403;
      throw error;
    }
    const [records] = await connection.execute(
      `SELECT * FROM ${config.table} WHERE id = ? AND business_day_id = ? FOR UPDATE`,
      [recordId, initial[0].business_day_id]
    );
    if (!records.length) {
      const error = new Error('Financial record changed or was removed.');
      error.status = 409;
      throw error;
    }
    if (values.reference_number) {
      const [duplicates] = await connection.execute(
        `SELECT id FROM ${config.table}
         WHERE business_day_id = ? AND reference_number = ? AND id <> ? LIMIT 1`,
        [initial[0].business_day_id, values.reference_number, recordId]
      );
      if (duplicates.length) {
        const error = new Error('That reference number is already used on this business day.');
        error.status = 409;
        throw error;
      }
    }
    const oldValues = {};
    for (const field of config.fields) oldValues[field] = records[0][field];
    const setClause = config.fields.map((field) => `\`${field}\` = ?`).join(', ');
    await connection.execute(
      `UPDATE ${config.table} SET ${setClause} WHERE id = ?`,
      [...config.fields.map((field) => values[field]), recordId]
    );
    await connection.execute(
      `INSERT INTO financial_record_changes
       (record_type, record_id, business_day_id, changed_by, reason, old_values, new_values)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [type, recordId, initial[0].business_day_id, req.user.id, reason.trim(),
        JSON.stringify(oldValues), JSON.stringify(values)]
    );
    return { oldValues, values, businessDayId: initial[0].business_day_id };
  });

  await logAudit({
    userId: req.user.id,
    action: `UPDATE_DAILY_${type}`,
    entityName: config.table,
    entityId: recordId,
    oldValues: updateResult.oldValues,
    newValues: updateResult.values,
    reason: reason.trim(),
    req
  });
  return updateResult.values;
}

module.exports = { updateFinancialRecord };
