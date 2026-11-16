import assert from 'node:assert/strict';
import test from 'node:test';
import { collaborationDeadline } from './collaboration-notifications.service.js';

const now = new Date('2026-11-16T12:00:00.000Z');
const hours = (value: number) => new Date(now.getTime() + value * 3_600_000);

test('collaboration and transfer notices start at 24 hours, not earlier', () => {
  assert.equal(collaborationDeadline(hours(24.1), now), null);
  assert.equal(collaborationDeadline(hours(24), now), 'ONE_DAY');
  assert.equal(collaborationDeadline(hours(2), now), 'ONE_DAY');
  assert.equal(collaborationDeadline(hours(0), now), 'EXPIRED');
  assert.equal(collaborationDeadline(hours(-2), now), 'EXPIRED');
});

test('deadlines are based on instants, including month changes', () => {
  const before = new Date('2026-12-31T23:00:00.000Z');
  const after = new Date('2027-01-01T20:00:00.000Z');
  assert.equal(collaborationDeadline(after, before), 'ONE_DAY');
});

test('a distant invitation cannot send a premature reminder', () => {
  assert.equal(collaborationDeadline(hours(7 * 24), now), null);
});
