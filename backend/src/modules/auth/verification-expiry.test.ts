import assert from 'node:assert/strict';
import test from 'node:test';
import { verificationDeadline } from './verification-expiry.js';

const ttl = 15 * 60 * 1000;

test('first verification link expires after exactly 15 minutes', () => {
  const now = new Date('2026-11-08T15:00:00.000Z');
  assert.equal(verificationDeadline(now, null, ttl).toISOString(), '2026-11-08T15:15:00.000Z');
});

test('resending before expiry keeps original deadline and never extends it', () => {
  const expiry = new Date('2026-11-08T15:15:00.000Z');
  const resend = new Date('2026-11-08T15:14:40.000Z');
  assert.equal(verificationDeadline(resend, expiry, ttl).getTime(), expiry.getTime());
});

test('expired window may be renewed separately for an existing unverified account', () => {
  const expiry = new Date('2026-11-08T15:15:00.000Z');
  const now = new Date('2026-11-08T15:15:00.000Z');
  assert.equal(verificationDeadline(now, expiry, ttl).toISOString(), '2026-11-08T15:30:00.000Z');
});
