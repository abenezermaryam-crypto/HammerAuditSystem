const { query } = require('../config/database');

/**
 * FINANCIAL CALCULATION ENGINE
 *
 * Implements the Hamer Shop financial control methodology:
 *
 * PRINCIPLE 1 – DAILY ACTIVITY (Section 1):
 *   Net Daily Cash Activity = Cash Income − Cash Expenses   (NO opening balance)
 *   Net Daily Bank Activity = Bank Income − Bank Expenses   (NO opening balance)
 *   Opening balances are carried-forward positions, NOT new income.
 *
 * PRINCIPLE 2 – DAILY CLOSING BALANCE (Section 2):
 *   Closing Cash = Previous Closing Cash + Cash Income − Cash Expenses ± Cash Adjustments
 *   Closing Bank = Previous Closing Bank + Bank Income − Bank Expenses ± Bank Adjustments
 *
 * PRINCIPLE 3 – THREE-DAY AUDIT CARRY-FORWARD (Section 3):
 *   Starting balance = previous completed audit's closing balance (NOT day-1 opening_cash)
 *   First audit only: use day-1 verified opening balance (no previous audit exists)
 *
 *   Closing Cash Balance = Previous Audit Closing Cash + 3-Day Cash Income
 *                          − 3-Day Cash Expenses ± Cash Adjustments + Additional Cash Income
 *   Closing Bank Balance = Previous Audit Closing Bank + 3-Day Bank Income
 *                          − 3-Day Bank Expenses ± Bank Adjustments
 *
 * PRINCIPLE 4 – AUDIT DIFFERENCE (Section 4):
 *   Cash Audit Difference = Actual Verified Cash − Calculated Three-Day Cash Balance
 *   Bank Audit Difference = Actual Verified Bank − Calculated Three-Day Bank Balance
 *   < 0 → SHORTAGE | = 0 → BALANCED | > 0 → SURPLUS   (applied independently to cash AND bank)
 *
 * These three concepts are kept strictly separate: activity, closing balance, audit difference.
 */

// ---------------------------------------------------------------------------
// Helper: Ensure 2-decimal fixed-point arithmetic
// ---------------------------------------------------------------------------
function toFixed2(val) {
  return Math.round((Number(val) || 0) * 100) / 100;
}

// ---------------------------------------------------------------------------
// Helper: Safely convert mysql2 Date objects or strings to 'YYYY-MM-DD'
// ---------------------------------------------------------------------------
function toDateStr(val, key) {
  if (key) return String(key);
  if (!val) return '';
  if (val instanceof Date) {
    const year = val.getFullYear();
    const month = String(val.getMonth() + 1).padStart(2, '0');
    const day = String(val.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return String(val).split('T')[0];
}

// ---------------------------------------------------------------------------
// SECTION 2: Daily Closing Balance Reconciliation
// Closing Balance = Previous Closing Cash + Income − Expenses ± Adjustments
// Note: opening_cash in business_days IS the previous day's closing cash.
// ---------------------------------------------------------------------------
async function calculateDayReconciliation(businessDayId) {
  const [day] = await query('SELECT * FROM business_days WHERE id = ?', [businessDayId]);
  if (!day) {
    throw new Error(`Business day with ID ${businessDayId} not found.`);
  }

  // Aggregated incomes for the day
  const [incomeRow] = await query(
    `SELECT
        COALESCE(SUM(cash_income), 0) AS total_cash_income,
        COALESCE(SUM(bank_income), 0) AS total_bank_income,
        COALESCE(SUM(total_income), 0) AS total_income
     FROM daily_incomes
     WHERE business_day_id = ?`,
    [businessDayId]
  );
  const totalCashIncome   = toFixed2(incomeRow.total_cash_income);
  const totalBankIncome   = toFixed2(incomeRow.total_bank_income);
  const totalDailyIncome  = toFixed2(totalCashIncome + totalBankIncome);

  // Aggregated expenses by payment source
  const [expenseRow] = await query(
    `SELECT
        COALESCE(SUM(CASE WHEN payment_source = 'CASH' THEN amount ELSE 0 END), 0) AS total_cash_expenses,
        COALESCE(SUM(CASE WHEN payment_source = 'BANK' THEN amount ELSE 0 END), 0) AS total_bank_expenses,
        COALESCE(SUM(amount), 0) AS total_expenses
     FROM daily_expenses
     WHERE business_day_id = ?`,
    [businessDayId]
  );
  const totalCashExpenses  = toFixed2(expenseRow.total_cash_expenses);
  const totalBankExpenses  = toFixed2(expenseRow.total_bank_expenses);
  const totalDailyExpenses = toFixed2(totalCashExpenses + totalBankExpenses);

  // Approved adjustments
  const [adjRow] = await query(
    `SELECT
        COALESCE(SUM(CASE WHEN account_type = 'CASH' THEN amount ELSE 0 END), 0) AS cash_adjustments,
        COALESCE(SUM(CASE WHEN account_type = 'BANK' THEN amount ELSE 0 END), 0) AS bank_adjustments
     FROM adjustments
     WHERE business_day_id = ?`,
    [businessDayId]
  );
  const cashAdjustments = toFixed2(adjRow.cash_adjustments);
  const bankAdjustments = toFixed2(adjRow.bank_adjustments);

  // Previous closing cash = opening_cash of the current business day (set when day was opened)
  const openingCash = toFixed2(day.opening_cash);
  const openingBank = toFixed2(day.opening_bank);

  // Net daily activity (excludes opening balance — pure activity measurement)
  const netDailyCashActivity = toFixed2(totalCashIncome - totalCashExpenses);
  const netDailyBankActivity = toFixed2(totalBankIncome - totalBankExpenses);

  // Closing Balance = Previous Closing + Net Activity ± Adjustments
  const expectedCash = toFixed2(openingCash + totalCashIncome - totalCashExpenses + cashAdjustments);
  const expectedBank = toFixed2(openingBank + totalBankIncome - totalBankExpenses + bankAdjustments);

  return {
    businessDay: day,
    openingCash,
    openingBank,
    totalCashIncome,
    totalBankIncome,
    totalDailyIncome,
    totalCashExpenses,
    totalBankExpenses,
    totalDailyExpenses,
    netDailyCashActivity,
    netDailyBankActivity,
    cashAdjustments,
    bankAdjustments,
    expectedCash,
    expectedBank,
  };
}

// ---------------------------------------------------------------------------
// SECTION 4: Evaluate Audit Difference (applied to both daily and 3-day)
// Difference = Actual − Calculated
// < 0 → SHORTAGE | = 0 → BALANCED | > 0 → SURPLUS
// Cash and bank are evaluated INDEPENDENTLY — never offset against each other.
// ---------------------------------------------------------------------------
function evaluateReconciliation(expectedCash, actualCash, expectedBank, actualBank) {
  const expCash = toFixed2(expectedCash);
  const actCash = toFixed2(actualCash);
  const expBank = toFixed2(expectedBank);
  const actBank = toFixed2(actualBank);

  const cashDifference = toFixed2(actCash - expCash);
  const bankDifference = toFixed2(actBank - expBank);

  // Cash status
  let cashStatus = 'BALANCED';
  if (cashDifference < 0) cashStatus = 'SHORTAGE';
  else if (cashDifference > 0) cashStatus = 'SURPLUS';

  // Bank status — same rules, independent of cash
  let bankStatus = 'BALANCED';
  if (bankDifference < 0) bankStatus = 'SHORTAGE';
  else if (bankDifference > 0) bankStatus = 'SURPLUS';

  // Overall combined status
  let dailyStatus = 'BALANCED';
  if (cashStatus !== 'BALANCED' && bankStatus !== 'BALANCED') {
    dailyStatus = 'DUAL_DISCREPANCY';
  } else if (cashStatus !== 'BALANCED') {
    dailyStatus = 'CASH_DISCREPANCY';
  } else if (bankStatus !== 'BALANCED') {
    dailyStatus = 'BANK_DISCREPANCY';
  }

  return {
    expectedCash: expCash,
    actualCash: actCash,
    cashDifference,
    cashStatus,
    expectedBank: expBank,
    actualBank: actBank,
    bankDifference,
    bankStatus,
    dailyStatus,
  };
}

// ---------------------------------------------------------------------------
// SECTION 3: Three-Day Audit Carry-Forward Calculation
//
// Starting balance determination (sequential, non-overlapping):
//   - If a PREVIOUS completed audit exists → use its expected_cash / expected_bank
//     (the saved closing balance from that audit)
//   - If NO previous audit → use day-1 opening_cash / opening_bank
//     (the verified initial starting balance)
//
// Three-Day Closing Cash Balance =
//   Starting Cash + 3-Day Cash Income − 3-Day Cash Expenses
//   ± Approved Cash Adjustments + Additional Cash Income
//
// Three-Day Closing Bank Balance =
//   Starting Bank + 3-Day Bank Income − 3-Day Bank Expenses
//   ± Approved Bank Adjustments
// ---------------------------------------------------------------------------
async function calculateThreeDayAudit(dayIds, additionalCashIncome = 0) {
  if (!Array.isArray(dayIds) || dayIds.length !== 3) {
    throw new Error('A Three-Day Audit requires exactly 3 consecutive business day IDs.');
  }

  // Fetch all 3 business days in chronological order
  const days = await query(
    `SELECT *, DATE_FORMAT(business_date, '%Y-%m-%d') AS business_date_key
     FROM business_days
     WHERE id IN (?, ?, ?)
     ORDER BY business_date ASC`,
    dayIds
  );

  if (days.length !== 3) {
    throw new Error('One or more specified business days could not be retrieved.');
  }

  const [day1, day2, day3] = days;

  const startDateStr = toDateStr(day1.business_date, day1.business_date_key);
  const endDateStr   = toDateStr(day3.business_date, day3.business_date_key);

  // ── SECTION 3: Determine Starting Balance ──────────────────────────────────
  // Look for the most recent completed audit whose end_date is BEFORE our start_date.
  // "Previous completed audit" = the sequential audit that immediately precedes this period.
  const previousAudits = await query(
    `SELECT expected_cash, expected_bank, end_date,
            DATE_FORMAT(end_date, '%Y-%m-%d') AS end_date_key
     FROM three_day_audits
     WHERE end_date < ?
     ORDER BY end_date DESC
     LIMIT 1`,
    [startDateStr]
  );

  let openingCash, openingBank, startingBalanceSource, previousAuditEndDate;

  if (previousAudits.length > 0) {
    // Carry the previous audit's closing balance forward as this audit's starting balance.
    // This is the SAVED expected_cash / expected_bank from the completed audit.
    openingCash          = toFixed2(previousAudits[0].expected_cash);
    openingBank          = toFixed2(previousAudits[0].expected_bank);
    startingBalanceSource = 'PREVIOUS_AUDIT';
    previousAuditEndDate  = toDateStr(previousAudits[0].end_date, previousAudits[0].end_date_key);
  } else {
    // First audit — no previous audit exists. Use day-1 verified opening balance.
    openingCash          = toFixed2(day1.opening_cash);
    openingBank          = toFixed2(day1.opening_bank);
    startingBalanceSource = 'INITIAL_BALANCE';
    previousAuditEndDate  = null;
  }

  // ── Aggregate 3-Day Income ─────────────────────────────────────────────────
  const [incomeSums] = await query(
    `SELECT
        COALESCE(SUM(cash_income), 0) AS total_3day_cash_income,
        COALESCE(SUM(bank_income), 0) AS total_3day_bank_income
     FROM daily_incomes
     WHERE business_day_id IN (?, ?, ?)`,
    dayIds
  );
  const total3DayCashIncome = toFixed2(incomeSums.total_3day_cash_income);
  const total3DayBankIncome = toFixed2(incomeSums.total_3day_bank_income);

  // ── Aggregate 3-Day Expenses ───────────────────────────────────────────────
  const [expenseSums] = await query(
    `SELECT
        COALESCE(SUM(CASE WHEN payment_source = 'CASH' THEN amount ELSE 0 END), 0) AS total_3day_cash_expenses,
        COALESCE(SUM(CASE WHEN payment_source = 'BANK' THEN amount ELSE 0 END), 0) AS total_3day_bank_expenses
     FROM daily_expenses
     WHERE business_day_id IN (?, ?, ?)`,
    dayIds
  );
  const total3DayCashExpenses = toFixed2(expenseSums.total_3day_cash_expenses);
  const total3DayBankExpenses = toFixed2(expenseSums.total_3day_bank_expenses);

  // ── Aggregate Approved Adjustments across the 3 days ──────────────────────
  const [adjustmentSums] = await query(
    `SELECT
        COALESCE(SUM(CASE WHEN account_type = 'CASH' THEN amount ELSE 0 END), 0) AS cash_adjustments,
        COALESCE(SUM(CASE WHEN account_type = 'BANK' THEN amount ELSE 0 END), 0) AS bank_adjustments
     FROM adjustments
     WHERE business_day_id IN (?, ?, ?)`,
    dayIds
  );
  const cashAdjustments = toFixed2(adjustmentSums.cash_adjustments);
  const bankAdjustments = toFixed2(adjustmentSums.bank_adjustments);

  const addCash = toFixed2(additionalCashIncome);

  // ── SECTION 3 FORMULA: Three-Day Closing Balance ──────────────────────────
  // Net 3-Day Cash Activity (pure activity, no carry-forward)
  const net3DayCashActivity = toFixed2(total3DayCashIncome - total3DayCashExpenses);
  const net3DayBankActivity = toFixed2(total3DayBankIncome - total3DayBankExpenses);

  // Closing Balance = Starting Balance + Net Activity ± Adjustments
  // For cash: additional income is also included
  const closingCashBalance = toFixed2(
    openingCash + total3DayCashIncome + addCash - total3DayCashExpenses + cashAdjustments
  );
  const closingBankBalance = toFixed2(
    openingBank + total3DayBankIncome - total3DayBankExpenses + bankAdjustments
  );

  return {
    day1,
    day2,
    day3,
    startDate:    startDateStr,
    endDate:      endDateStr,
    startDateKey: startDateStr,
    endDateKey:   endDateStr,

    // Starting balance (carry-forward or initial)
    openingCash,
    openingBank,
    startingBalanceSource,
    previousAuditEndDate,

    // 3-Day activity totals
    total3DayCashIncome,
    total3DayBankIncome,
    total3DayCashExpenses,
    total3DayBankExpenses,
    net3DayCashActivity,
    net3DayBankActivity,

    // Additional income and adjustments
    additionalCashIncome: addCash,
    cashAdjustments,
    bankAdjustments,

    // Calculated Three-Day Closing Balances (saved for next audit carry-forward)
    closingCashBalance,
    closingBankBalance,

    // Aliases used by controller + existing code
    expectedCash: closingCashBalance,
    expectedBank: closingBankBalance,
  };
}

module.exports = {
  toFixed2,
  toDateStr,
  calculateDayReconciliation,
  evaluateReconciliation,
  calculateThreeDayAudit,
};
