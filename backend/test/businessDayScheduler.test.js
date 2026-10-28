const test = require('node:test');
const assert = require('node:assert/strict');
const { getLocalParts, OPEN_MINUTE, CLOSE_MINUTE, TIME_ZONE } = require('../src/services/businessDayScheduler');

test('uses Addis Ababa time and maps opening at local midnight', () => {
  assert.equal(TIME_ZONE, 'Africa/Addis_Ababa');
  const beforeMidnight = getLocalParts(new Date('2026-10-13T20:59:00.000Z'));
  const midnight = getLocalParts(new Date('2026-10-13T21:00:00.000Z'));
  assert.equal(beforeMidnight.dateKey, '2026-10-13');
  assert.equal(beforeMidnight.minuteOfDay, 23 * 60 + 59);
  assert.equal(midnight.dateKey, '2026-10-14');
  assert.equal(midnight.minuteOfDay, OPEN_MINUTE);
});

test('maps automatic close to 22:00 Addis Ababa time', () => {
  const beforeClose = getLocalParts(new Date('2026-10-13T18:59:00.000Z'));
  const close = getLocalParts(new Date('2026-10-13T19:00:00.000Z'));
  assert.equal(beforeClose.minuteOfDay, CLOSE_MINUTE - 1);
  assert.equal(close.minuteOfDay, CLOSE_MINUTE);
});
