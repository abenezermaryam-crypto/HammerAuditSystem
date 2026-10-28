const { pool, query, transaction } = require('../config/database');
const { logAudit } = require('./auditLogService');
const { toFixed2, evaluateReconciliation } = require('./calculationService');

const TIME_ZONE = 'Africa/Addis_Ababa';
const OPEN_MINUTE = 0;
const CLOSE_MINUTE = 22 * 60;
const pollIntervalMs = 15_000;

function getLocalParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const dateKey = `${values.year}-${values.month}-${values.day}`;
  const minuteOfDay = Number(values.hour) * 60 + Number(values.minute);
  return {
    dateKey,
    minuteOfDay,
    localDateTime: `${dateKey} ${values.hour}:${values.minute}:${values.second}`,
    localTime: `${values.hour}:${values.minute}:${values.second}`
  };
}

async function getScheduleOverride(businessDate) {
  const [rows] = await pool.execute(
    'SELECT override_action FROM business_day_schedule_overrides WHERE business_date = ?',
    [businessDate]
  );
  return rows[0]?.override_action || null;
}

async function calculateExpectedBalances(connection, businessDayId) {
  const [days] = await connection.execute('SELECT * FROM business_days WHERE id = ? FOR UPDATE', [businessDayId]);
  if (!days.length) throw new Error(`Business day ${businessDayId} was not found.`);
  const day = days[0];
  const [[income]] = await connection.execute(
    `SELECT COALESCE(SUM(cash_income), 0) AS total_cash_income,
            COALESCE(SUM(bank_income), 0) AS total_bank_income
     FROM daily_incomes WHERE business_day_id = ?`,
    [businessDayId]
  );
  const [[expense]] = await connection.execute(
    `SELECT COALESCE(SUM(CASE WHEN payment_source = 'CASH' THEN amount ELSE 0 END), 0) AS total_cash_expenses,
            COALESCE(SUM(CASE WHEN payment_source = 'BANK' THEN amount ELSE 0 END), 0) AS total_bank_expenses
     FROM daily_expenses WHERE business_day_id = ?`,
    [businessDayId]
  );
  const [[adjustments]] = await connection.execute(
    `SELECT COALESCE(SUM(CASE WHEN account_type = 'CASH' THEN amount ELSE 0 END), 0) AS cash_adjustments,
            COALESCE(SUM(CASE WHEN account_type = 'BANK' THEN amount ELSE 0 END), 0) AS bank_adjustments
     FROM adjustments WHERE business_day_id = ?`,
    [businessDayId]
  );

  const totalCashIncome = toFixed2(income.total_cash_income);
  const totalBankIncome = toFixed2(income.total_bank_income);
  const totalCashExpenses = toFixed2(expense.total_cash_expenses);
  const totalBankExpenses = toFixed2(expense.total_bank_expenses);
  const cashAdjustments = toFixed2(adjustments.cash_adjustments);
  const bankAdjustments = toFixed2(adjustments.bank_adjustments);
  const openingCash = toFixed2(day.opening_cash);
  const openingBank = toFixed2(day.opening_bank);

  return {
    day,
    totalCashIncome,
    totalBankIncome,
    totalCashExpenses,
    totalBankExpenses,
    cashAdjustments,
    bankAdjustments,
    openingCash,
    openingBank,
    expectedCash: toFixed2(openingCash + totalCashIncome - totalCashExpenses + cashAdjustments),
    expectedBank: toFixed2(openingBank + totalBankIncome - totalBankExpenses + bankAdjustments)
  };
}

async function automaticallyCloseBusinessDay(businessDayId, managerId, closedAt) {
  let closed;
  await transaction(async (connection) => {
    const calculation = await calculateExpectedBalances(connection, businessDayId);
    if (calculation.day.status !== 'OPEN') return;
    const reconciliation = evaluateReconciliation(
      calculation.expectedCash,
      calculation.expectedCash,
      calculation.expectedBank,
      calculation.expectedBank
    );
    const notes =
      'Automatic 22:00 Africa/Addis_Ababa close. Actual balances are ledger estimates, not a physical count; Manager verification is required.';

    const [existingClosings] = await connection.execute(
      'SELECT id FROM daily_closings WHERE business_day_id = ? FOR UPDATE',
      [businessDayId]
    );
    const values = [
      calculation.openingCash,
      calculation.totalCashIncome,
      calculation.totalCashExpenses,
      calculation.cashAdjustments,
      reconciliation.expectedCash,
      reconciliation.actualCash,
      reconciliation.cashDifference,
      reconciliation.cashStatus,
      calculation.openingBank,
      calculation.totalBankIncome,
      calculation.totalBankExpenses,
      calculation.bankAdjustments,
      reconciliation.expectedBank,
      reconciliation.actualBank,
      reconciliation.bankDifference,
      reconciliation.bankStatus,
      reconciliation.dailyStatus,
      notes,
      managerId,
      managerId,
      closedAt,
      businessDayId
    ];
    if (existingClosings.length > 0) {
      await connection.execute(
        `UPDATE daily_closings SET opening_cash = ?, total_cash_income = ?, total_cash_expenses = ?,
         cash_adjustments = ?, expected_cash = ?, actual_cash = ?, cash_difference = ?, cash_status = ?,
         opening_bank = ?, total_bank_income = ?, total_bank_expenses = ?, bank_adjustments = ?,
         expected_bank = ?, actual_bank = ?, bank_difference = ?, bank_status = ?, daily_status = ?,
         notes = ?, closed_by = ?, verified_by = ?, automatically_closed = TRUE, closed_at = ?
         WHERE business_day_id = ?`,
        values
      );
    } else {
      await connection.execute(
        `INSERT INTO daily_closings
         (opening_cash, total_cash_income, total_cash_expenses, cash_adjustments, expected_cash, actual_cash,
          cash_difference, cash_status, opening_bank, total_bank_income, total_bank_expenses, bank_adjustments,
          expected_bank, actual_bank, bank_difference, bank_status, daily_status, notes, closed_by, verified_by,
          automatically_closed, closed_at, business_day_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, ?, ?)`,
        values
      );
    }
    await connection.execute(
      `UPDATE business_days SET status = 'CLOSED', closed_by = ?, closed_at = ? WHERE id = ?`,
      [managerId, closedAt, businessDayId]
    );
    closed = {
      businessDate: calculation.day.business_date,
      expectedCash: calculation.expectedCash,
      expectedBank: calculation.expectedBank
    };
  });

  if (closed) {
    await logAudit({
      userId: managerId,
      action: 'AUTOMATIC_BUSINESS_DAY_CLOSE',
      entityName: 'business_days',
      entityId: businessDayId,
      newValues: closed,
      reason: 'Scheduled close; balances are estimates pending Manager physical verification.'
    });
  }
  return closed;
}

async function openScheduledBusinessDay(businessDate, managerId) {
  const [existing] = await pool.execute('SELECT id FROM business_days WHERE business_date = ?', [businessDate]);
  if (existing.length) return false;

  let activeDays;
  do {
    [activeDays] = await pool.execute(
      `SELECT id, DATE_FORMAT(business_date, '%Y-%m-%d') AS business_date
       FROM business_days
       WHERE status = 'OPEN' AND business_date < ?
       ORDER BY business_date ASC LIMIT 1`,
      [businessDate]
    );
    if (activeDays.length) {
      await automaticallyCloseBusinessDay(
        activeDays[0].id,
        managerId,
        `${activeDays[0].business_date} 22:00:00`
      );
    }
  } while (activeDays.length);

  const [lastClosed] = await pool.execute(
    `SELECT dc.actual_cash, dc.actual_bank
     FROM business_days bd JOIN daily_closings dc ON dc.business_day_id = bd.id
     WHERE bd.status IN ('CLOSED', 'AUDITED')
     ORDER BY bd.business_date DESC, dc.id DESC LIMIT 1`
  );
  try {
    const [opened] = await pool.execute(
      `INSERT INTO business_days
       (business_date, opening_cash, opening_bank, status, opened_by, opened_at, open_source)
       VALUES (?, ?, ?, 'OPEN', ?, ?, 'AUTOMATIC')`,
      [
        businessDate,
        toFixed2(lastClosed[0]?.actual_cash || 0),
        toFixed2(lastClosed[0]?.actual_bank || 0),
        managerId,
        `${businessDate} 00:00:00`
      ]
    );
    await logAudit({
      userId: managerId,
      action: 'AUTOMATIC_BUSINESS_DAY_OPEN',
      entityName: 'business_days',
      entityId: opened.insertId,
      newValues: { businessDate, openingCash: toFixed2(lastClosed[0]?.actual_cash || 0), openingBank: toFixed2(lastClosed[0]?.actual_bank || 0) },
      reason: 'Scheduled opening at 00:00 Africa/Addis_Ababa.'
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return false;
    throw err;
  }
  return true;
}

async function synchronizeBusinessDaySchedule(now = new Date()) {
  const local = getLocalParts(now);
  const [managers] = await pool.execute(
    `SELECT id FROM users
     WHERE role = 'manager' AND is_active = TRUE AND is_approved = TRUE
     ORDER BY id LIMIT 1`
  );
  if (!managers.length) return { ...local, status: 'NO_MANAGER' };

  const managerId = managers[0].id;
  const override = await getScheduleOverride(local.dateKey);
  const [openDays] = await pool.execute(
    `SELECT id, DATE_FORMAT(business_date, '%Y-%m-%d') AS business_date
     FROM business_days WHERE status = 'OPEN' ORDER BY business_date ASC LIMIT 1`
  );

  if (openDays.length && String(openDays[0].business_date).slice(0, 10) < local.dateKey) {
    await automaticallyCloseBusinessDay(
      openDays[0].id,
      managerId,
      `${String(openDays[0].business_date).slice(0, 10)} 22:00:00`
    );
  }

  const [todayRows] = await pool.execute(
    "SELECT id, status FROM business_days WHERE business_date = ?",
    [local.dateKey]
  );
  if (!todayRows.length && override !== 'CLOSED' && local.minuteOfDay >= OPEN_MINUTE) {
    await openScheduledBusinessDay(local.dateKey, managerId);
  }

  const [currentOpen] = await pool.execute(
    "SELECT id, status FROM business_days WHERE business_date = ? AND status = 'OPEN'",
    [local.dateKey]
  );
  if (currentOpen.length && local.minuteOfDay >= CLOSE_MINUTE && override !== 'OPEN') {
    await automaticallyCloseBusinessDay(currentOpen[0].id, managerId, `${local.dateKey} 22:00:00`);
  }

  const [currentDay] = await pool.execute(
    'SELECT status FROM business_days WHERE business_date = ?',
    [local.dateKey]
  );
  return { ...local, status: currentDay[0]?.status || 'CLOSED' };
}

function scheduleSynchronization(req, res, next) {
  synchronizeBusinessDaySchedule()
    .then((status) => {
      if (status.status === 'NO_MANAGER') {
        const error = new Error('Automatic business-day closing is unavailable because no approved Manager account exists.');
        error.status = 503;
        return next(error);
      }
      return next();
    })
    .catch(next);
}

function startBusinessDayScheduler() {
  const poll = () => {
    synchronizeBusinessDaySchedule().catch((err) => {
      console.error('Business-day schedule synchronization failed:', err.message);
    });
  };
  poll();
  const timer = setInterval(poll, pollIntervalMs);
  timer.unref();
  return timer;
}

module.exports = {
  TIME_ZONE,
  OPEN_MINUTE,
  CLOSE_MINUTE,
  getLocalParts,
  synchronizeBusinessDaySchedule,
  scheduleSynchronization,
  startBusinessDayScheduler
};
