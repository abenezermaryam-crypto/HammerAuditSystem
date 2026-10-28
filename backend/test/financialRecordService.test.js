const test = require('node:test');
const assert = require('node:assert/strict');
const { updateFinancialRecord } = require('../src/services/financialRecordService');

test('requires a clear reason before editing a financial record', async () => {
  await assert.rejects(
    updateFinancialRecord('INCOME', 1, { body: {}, user: { id: 1 } }),
    { message: /reason/i, status: 400 }
  );
});

test('rejects invalid financial amounts before accessing the database', async () => {
  await assert.rejects(
    updateFinancialRecord('INCOME', 1, {
      body: { reason: 'Correcting a data-entry error', cash_income: -1, bank_income: 10 },
      user: { id: 1 }
    }),
    { message: /valid positive income/i, status: 400 }
  );
  await assert.rejects(
    updateFinancialRecord('EXPENSE', 1, {
      body: { reason: 'Correcting a data-entry error', description: 'Supplies', amount: 0, payment_source: 'CASH' },
      user: { id: 1 }
    }),
    { status: 400 }
  );
});
