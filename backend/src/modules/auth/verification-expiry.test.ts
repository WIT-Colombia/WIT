import assert from 'node:assert/strict';
import test from 'node:test';
import { verificationDeadline } from './verification-expiry.js';

const ttl = 15 * 60 * 1000;

test('first verification link expires exactly 15 minutes after issuance', () => {
  const issuedAt = new Date('2026-11-08T15:00:00.000Z');
  assert.equal(verificationDeadline(issuedAt, ttl).toISOString(), '2026-11-08T15:15:00.000Z');
});

test('resending during an active window starts a fresh 15 minutes', () => {
  const original = new Date('2026-11-08T15:00:00.000Z');
  const resend = new Date('2026-11-08T15:04:45.000Z');
  const oldExpiry = verificationDeadline(original, ttl);
  const newExpiry = verificationDeadline(resend, ttl);
  assert.equal(oldExpiry.toISOString(), '2026-11-08T15:15:00.000Z');
  assert.equal(newExpiry.toISOString(), '2026-11-08T15:19:45.000Z');
  assert.ok(newExpiry.getTime() > oldExpiry.getTime());
});

test('resending after expiration also starts a new 15-minute window', () => {
  const resend = new Date('2026-11-08T15:16:00.000Z');
  assert.equal(verificationDeadline(resend, ttl).toISOString(), '2026-11-08T15:31:00.000Z');
});
