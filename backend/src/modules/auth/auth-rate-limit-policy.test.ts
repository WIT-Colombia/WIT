import assert from 'node:assert/strict';
import test from 'node:test';
import { LOGIN_ACCOUNT_WINDOW_SECONDS, LOGIN_IP_WINDOW_SECONDS, LOGIN_RATE_LIMIT, REFRESH_RATE_LIMIT_POLICY } from './auth-rate-limit-policy.js';

test('login rate-limit policy keeps ten attempts and separate 60s/15m windows', () => {
  assert.equal(LOGIN_RATE_LIMIT, 10);
  assert.equal(LOGIN_IP_WINDOW_SECONDS, 60);
  assert.equal(LOGIN_ACCOUNT_WINDOW_SECONDS, 900);
});

test('successful session renewals do not count toward a separate refresh abuse limit', () => {
  assert.equal(REFRESH_RATE_LIMIT_POLICY.windowMs, 900_000);
  assert.equal(REFRESH_RATE_LIMIT_POLICY.limit, 120);
  assert.equal(REFRESH_RATE_LIMIT_POLICY.skipSuccessfulRequests, true);
});
