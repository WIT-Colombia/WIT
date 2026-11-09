import assert from 'node:assert/strict';
import test from 'node:test';
import { verificationDeadline } from './verification-expiry.js';

const ttl = 15 * 60 * 1000;
test('initial link expires after 15 minutes', () => {
  const start = new Date('2026-11-08T15:00:00.000Z');
  assert.equal(verificationDeadline(start, ttl).toISOString(), '2026-11-08T15:15:00.000Z');
});
test('resend restarts 15-minute window', () => {
  const start = new Date('2026-11-08T15:00:00.000Z');
  const resend = new Date('2026-11-08T15:05:00.000Z');
  assert.equal(verificationDeadline(resend, ttl).toISOString(), '2026-11-08T15:20:00.000Z');
  assert.notEqual(verificationDeadline(start, ttl).getTime(), verificationDeadline(resend, ttl).getTime());
});
