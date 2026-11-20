import assert from 'node:assert/strict';
import test from 'node:test';
import { plusHoursState, plusLocalDateTime, validatedPlusTimezone } from './user-plus-scheduling.js';

test('Daily summaries follow the configured IANA zone, including local calendar rollover', () => {
  const at = new Date('2026-11-20T04:30:00.000Z');
  assert.deepEqual(plusLocalDateTime(at, 'America/Panama'), {
    day: '2026-11-19', weekday: 4, minuteOfDay: 23 * 60 + 30, hour: 23,
  });
  assert.equal(validatedPlusTimezone('America/Bogota'), 'America/Bogota');
  assert.throws(() => validatedPlusTimezone('Invalid/Planet'));
  assert.throws(() => validatedPlusTimezone('../../../etc/passwd'));
});

test('Public hours distinguish open, closed and unknown, including overnight service', () => {
  const lateFriday = new Date('2026-11-21T02:30:00.000Z'); // Friday 21:30 Panama
  const earlySaturday = new Date('2026-11-21T06:30:00.000Z'); // Saturday 01:30 Panama
  const rows = [{ dayOfWeek: 5, isClosed: false, opensAt: '18:00', closesAt: '02:00' }];
  assert.equal(plusHoursState(rows, 'America/Panama', lateFriday), 'OPEN');
  assert.equal(plusHoursState(rows, 'America/Panama', earlySaturday), 'OPEN');
  assert.equal(plusHoursState(rows, 'America/Panama', new Date('2026-11-21T09:30:00.000Z')), 'UNKNOWN');
  assert.equal(plusHoursState([{ dayOfWeek: 5, isClosed: true, opensAt: null, closesAt: null }],
    'America/Panama', lateFriday), 'CLOSED');
  assert.equal(plusHoursState([], 'America/Panama', lateFriday), 'UNKNOWN');
});
