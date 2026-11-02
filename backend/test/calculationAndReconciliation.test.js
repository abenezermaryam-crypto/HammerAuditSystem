const test = require('node:test');
const assert = require('node:assert/strict');
const { toFixed2, evaluateReconciliation } = require('../src/services/calculationService');

test('toFixed2 correctly rounds financial amounts with epsilon protection', () => {
  assert.equal(toFixed2(100.005), 100.01);
  assert.equal(toFixed2(0.1 + 0.2), 0.3);
  assert.equal(toFixed2('150.75'), 150.75);
  assert.equal(toFixed2(null), 0);
  assert.equal(toFixed2(undefined), 0);
  assert.equal(toFixed2(NaN), 0);
});

test('evaluateReconciliation calculates independent cash and bank variances without offsetting', () => {
  // Scenario 1: Cash Shortage (-50 ETB), Bank Balanced (0 ETB)
  const res1 = evaluateReconciliation(1000, 950, 5000, 5000);
  assert.equal(res1.cashDifference, -50);
  assert.equal(res1.cashStatus, 'SHORTAGE');
  assert.equal(res1.bankDifference, 0);
  assert.equal(res1.bankStatus, 'BALANCED');
  assert.equal(res1.dailyStatus, 'CASH_DISCREPANCY');

  // Scenario 2: Cash Surplus (+100 ETB), Bank Shortage (-200 ETB) -> DUAL DISCREPANCY
  const res2 = evaluateReconciliation(1000, 1100, 5000, 4800);
  assert.equal(res2.cashDifference, 100);
  assert.equal(res2.cashStatus, 'SURPLUS');
  assert.equal(res2.bankDifference, -200);
  assert.equal(res2.bankStatus, 'SHORTAGE');
  assert.equal(res2.dailyStatus, 'DUAL_DISCREPANCY');

  // Scenario 3: Perfectly Balanced Cash and Bank
  const res3 = evaluateReconciliation(2500.50, 2500.50, 8000.00, 8000.00);
  assert.equal(res3.cashDifference, 0);
  assert.equal(res3.cashStatus, 'BALANCED');
  assert.equal(res3.bankDifference, 0);
  assert.equal(res3.bankStatus, 'BALANCED');
  assert.equal(res3.dailyStatus, 'BALANCED');
});
