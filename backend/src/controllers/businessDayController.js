const { query, transaction } = require('../config/database');
const { logAudit } = require('../services/auditLogService');
const { toFixed2 } = require('../services/calculationService');
const { getLocalParts, TIME_ZONE } = require('../services/businessDayScheduler');

// Get active or latest business day
async function getCurrentDay(req, res) {
  try {
    const businessDate = getLocalParts().dateKey;
    const overrides = await query(
      'SELECT override_action FROM business_day_schedule_overrides WHERE business_date = ?',
      [businessDate]
    );
    const overrideAction = overrides[0]?.override_action || null;
    const days = await query(
      `SELECT bd.*, DATE_FORMAT(bd.business_date, '%Y-%m-%d') AS business_date_key,
              DATE_FORMAT(bd.opened_at, '%H:%i') AS opened_time_local,
              DATE_FORMAT(bd.closed_at, '%H:%i') AS closed_time_local,
              u.full_name as opened_by_name, dc.automatically_closed
       FROM business_days bd
       JOIN users u ON bd.opened_by = u.id
       LEFT JOIN daily_closings dc ON dc.business_day_id = bd.id
       WHERE bd.business_date <= ?
       ORDER BY (bd.status = 'OPEN') DESC, bd.business_date DESC LIMIT 1`,
      [getLocalParts().dateKey]
    );

    if (days.length === 0) {
      return res.json({
        success: true,
        currentDay: null,
        schedule: {
          timeZone: TIME_ZONE,
          openTime: '00:00',
          closeTime: '22:00',
          remainingMinutes: 0,
          overrideAction
        }
      });
    }

    return res.json({
      success: true,
      currentDay: days[0],
      schedule: {
        timeZone: TIME_ZONE,
        openTime: '00:00',
        closeTime: '22:00',
        overrideAction,
        remainingMinutes: days[0].status === 'OPEN'
          ? Math.max(0, 22 * 60 - getLocalParts().minuteOfDay)
          : 0
      }
    });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message });
  }
}

// Get list of recent business days (for 3-day audit selection or reports)
async function getBusinessDays(req, res) {
  try {
    const days = await query(
      `SELECT bd.*, 
              uo.full_name as opened_by_name,
              uc.full_name as closed_by_name,
              dc.daily_status, dc.cash_status, dc.bank_status, dc.actual_cash, dc.actual_bank,
              dc.expected_cash, dc.expected_bank, dc.cash_difference, dc.bank_difference
       FROM business_days bd
       LEFT JOIN users uo ON bd.opened_by = uo.id
       LEFT JOIN users uc ON bd.closed_by = uc.id
       LEFT JOIN daily_closings dc ON bd.id = dc.business_day_id
       ORDER BY bd.business_date DESC LIMIT 30`
    );
    return res.json({ success: true, businessDays: days });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

// Open a new business day (enforces auto-carry-forward unless initial genesis day)
async function openBusinessDay(req, res) {
  try {
    const { business_date, opening_cash, opening_bank } = req.body;
    if (!business_date) {
      return res.status(400).json({ success: false, error: 'Business date is required (YYYY-MM-DD).' });
    }

    const today = getLocalParts().dateKey;
    if (business_date !== today) {
      return res.status(400).json({ success: false, error: `Only the current Addis Ababa business date (${today}) can be opened.` });
    }

    const existing = await query(
      'SELECT id, status FROM business_days WHERE business_date = ?',
      [business_date]
    );
    if (existing.length > 0 && existing[0].status === 'OPEN') {
      await query(
        `INSERT INTO business_day_schedule_overrides (business_date, override_action, changed_by)
         VALUES (?, 'OPEN', ?) ON DUPLICATE KEY UPDATE override_action = 'OPEN', changed_by = VALUES(changed_by), changed_at = CURRENT_TIMESTAMP`,
        [business_date, req.user.id]
      );
      await logAudit({
        userId: req.user.id,
        action: 'MANAGER_OVERRIDDEN_BUSINESS_DAY_SCHEDULE',
        entityName: 'business_days',
        entityId: existing[0].id,
        reason: 'Manager manually kept the business day open beyond the automatic closing schedule.',
        req
      });
      return res.json({ success: true, message: 'Business day is already open; automatic closing is overridden for today.' });
    }

    const openDays = await query(
      "SELECT id, DATE_FORMAT(business_date, '%Y-%m-%d') AS business_date FROM business_days WHERE status = 'OPEN' ORDER BY business_date ASC"
    );
    if (openDays.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot open a new day while business day ${openDays[0].business_date} remains open.`
      });
    }

    const lastClosed = await query(
      `SELECT bd.*, dc.actual_cash, dc.actual_bank 
       FROM business_days bd
       JOIN daily_closings dc ON bd.id = dc.business_day_id
       WHERE bd.status IN ('CLOSED', 'AUDITED')
       ORDER BY bd.business_date DESC LIMIT 1`
    );

    if (existing.length > 0) {
      if (existing[0].status === 'AUDITED') {
        return res.status(409).json({ success: false, error: 'An audited business day cannot be reopened.' });
      }
      if (typeof req.body.reason !== 'string' || req.body.reason.trim().length < 10) {
        return res.status(400).json({ success: false, error: 'A reason of at least 10 characters is required to reopen a closed day.' });
      }
      const result = await transaction(async (connection) => {
        const [days] = await connection.execute('SELECT * FROM business_days WHERE id = ? FOR UPDATE', [existing[0].id]);
        if (!days.length || days[0].status === 'OPEN' || days[0].status === 'AUDITED') {
          const error = new Error('This business day is not eligible for reopening.');
          error.status = 409;
          throw error;
        }
        const [auditRows] = await connection.execute(
          `SELECT id FROM three_day_audits WHERE day_1_id = ? OR day_2_id = ? OR day_3_id = ? LIMIT 1`,
          [existing[0].id, existing[0].id, existing[0].id]
        );
        if (auditRows.length) {
          const error = new Error('A business day included in a three-day audit cannot be reopened.');
          error.status = 409;
          throw error;
        }
        const [closings] = await connection.execute(
          'SELECT * FROM daily_closings WHERE business_day_id = ? FOR UPDATE',
          [existing[0].id]
        );
        if (closings.length) {
          await connection.execute(
            `INSERT INTO business_day_reopenings (business_day_id, reopened_by, reason, previous_closing)
             VALUES (?, ?, ?, ?)`,
            [existing[0].id, req.user.id, req.body.reason.trim(), JSON.stringify({ businessDay: days[0], closing: closings[0] })]
          );
          await connection.execute(
            `UPDATE discrepancies SET status = 'CLOSED',
             resolution_notes = CONCAT(COALESCE(resolution_notes, ''), ' | Superseded by Manager reopening.')
             WHERE source_type = 'DAILY_CLOSING' AND source_id = ? AND status <> 'CLOSED'`,
            [closings[0].id]
          );
        }
        await connection.execute(
          `UPDATE business_days SET status = 'OPEN', opened_by = ?, opened_at = ?, open_source = 'MANUAL',
           closed_by = NULL, closed_at = NULL WHERE id = ?`,
          [req.user.id, getLocalParts().localDateTime, existing[0].id]
        );
        await connection.execute(
          `INSERT INTO business_day_schedule_overrides (business_date, override_action, changed_by)
           VALUES (?, 'OPEN', ?) ON DUPLICATE KEY UPDATE override_action = 'OPEN', changed_by = VALUES(changed_by), changed_at = CURRENT_TIMESTAMP`,
          [business_date, req.user.id]
        );
        return days[0];
      });
      await logAudit({
        userId: req.user.id,
        action: 'MANAGER_REOPENED_BUSINESS_DAY',
        entityName: 'business_days',
        entityId: existing[0].id,
        reason: req.body.reason.trim(),
        req
      });
      return res.json({
        success: true,
        message: 'Business day reopened. Changes are recorded; close it again after verification.',
        businessDay: { ...result, status: 'OPEN' }
      });
    }

    if (!lastClosed.length && (
      opening_cash !== undefined && (typeof opening_cash !== 'number' || !Number.isFinite(opening_cash) || opening_cash < 0)
      || opening_bank !== undefined && (typeof opening_bank !== 'number' || !Number.isFinite(opening_bank) || opening_bank < 0)
    )) {
      return res.status(400).json({ success: false, error: 'Genesis opening balances must be valid non-negative numbers.' });
    }
    const carriedCash = lastClosed.length ? toFixed2(lastClosed[0].actual_cash) : toFixed2(opening_cash || 0);
    const carriedBank = lastClosed.length ? toFixed2(lastClosed[0].actual_bank) : toFixed2(opening_bank || 0);
    if (![carriedCash, carriedBank].every((amount) => Number.isFinite(amount) && amount >= 0)) {
      return res.status(400).json({ success: false, error: 'Opening balances must be valid non-negative amounts.' });
    }

    const result = await transaction(async (connection) => {
      const [insert] = await connection.execute(
        `INSERT INTO business_days (business_date, opening_cash, opening_bank, status, opened_by, opened_at, open_source)
         VALUES (?, ?, ?, 'OPEN', ?, ?, 'MANUAL')`,
        [business_date, carriedCash, carriedBank, req.user.id, getLocalParts().localDateTime]
      );
      await connection.execute(
        `INSERT INTO business_day_schedule_overrides (business_date, override_action, changed_by)
         VALUES (?, 'OPEN', ?) ON DUPLICATE KEY UPDATE override_action = 'OPEN', changed_by = VALUES(changed_by), changed_at = CURRENT_TIMESTAMP`,
        [business_date, req.user.id]
      );
      return insert;
    });
    await logAudit({
      userId: req.user.id,
      action: 'OPEN_BUSINESS_DAY',
      entityName: 'business_days',
      entityId: result.insertId,
      newValues: { business_date, opening_cash: carriedCash, opening_bank: carriedBank },
      reason: lastClosed.length > 0 ? 'Manager manually opened; balances carried from previous closing' : 'Initial Manager genesis day setup',
      req
    });

    return res.status(201).json({
      success: true,
      message: `Business day ${business_date} successfully opened.`,
      businessDay: {
        id: result.insertId,
        business_date,
        opening_cash: carriedCash,
        opening_bank: carriedBank,
        status: 'OPEN'
      }
    });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message });
  }
}

module.exports = {
  getCurrentDay,
  getBusinessDays,
  openBusinessDay
};
