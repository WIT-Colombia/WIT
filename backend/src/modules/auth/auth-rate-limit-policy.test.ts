import assert from 'node:assert/strict';
import test from 'node:test';
import { LOGIN_ACCOUNT_WINDOW_SECONDS, LOGIN_IP_WINDOW_SECONDS, LOGIN_RATE_LIMIT } from './auth-rate-limit-policy.js';

test('login rate-limit policy keeps ten attempts and separate 60s/15m windows', () => {
  assert.equal(LOGIN_RATE_LIMIT, 10);
  assert.equal(LOGIN_IP_WINDOW_SECONDS, 60);
  assert.equal(LOGIN_ACCOUNT_WINDOW_SECONDS, 900);
});
