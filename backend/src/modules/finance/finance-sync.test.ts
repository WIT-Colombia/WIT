import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDailySyncPlan, providerSupportsAutomaticBilling } from './finance-sync.js';

test('daily sync plan is deterministic and idempotent per provider/day', () => {
  const plan = buildDailySyncPlan('AWS', new Date('2026-10-29T12:00:00Z'));
  assert.equal(plan.idempotencyKey, 'AWS:2026-10-28');
  assert.equal(plan.maxAttempts, 3);
  assert.deepEqual(plan.retryDelaysMs, [1000, 5000, 30000]);
});

test('automatic billing is explicit about provider support', () => {
  assert.equal(providerSupportsAutomaticBilling('AWS'), true);
  assert.equal(providerSupportsAutomaticBilling('GOOGLE_MAPS'), false);
  assert.equal(providerSupportsAutomaticBilling('RESEND'), false);
});
