import test from 'node:test';
import assert from 'node:assert/strict';

process.env.AUTH_ACCESS_TOKEN_SECRET ??= 'xamuko-plus-test-secret-with-32-characters';
process.env.DATABASE_URL ??= 'mysql://test:test@127.0.0.1:3306/xamuko_plus_test';
const { hasPlusEntitlement, requirePlus } = await import('./user-plus.service.js');
const { assignAdminPlusSubscription } = await import('./user-plus-admin.service.js');
const now = new Date('2026-11-19T12:00:00.000Z');
const active = { status: 'ACTIVE', startsAt: new Date('2026-11-01T00:00:00.000Z'),
  expiresAt: new Date('2026-12-01T00:00:00.000Z'), revokedAt: null };

test('Plus needs an enabled master switch and a valid, non-revoked membership', () => {
  assert.equal(hasPlusEntitlement(true, active, now), true);
  assert.equal(hasPlusEntitlement(false, active, now), false);
  assert.equal(hasPlusEntitlement(true, null, now), false);
  assert.equal(hasPlusEntitlement(true, { ...active, status: 'INACTIVE' }, now), false);
  assert.equal(hasPlusEntitlement(true, { ...active, startsAt: new Date('2026-11-20T00:00:00.000Z') }, now), false);
  assert.equal(hasPlusEntitlement(true, { ...active, expiresAt: new Date('2026-11-18T00:00:00.000Z') }, now), false);
  assert.equal(hasPlusEntitlement(true, { ...active, revokedAt: now }, now), false);
});

test('Only the superadministrator may grant an individual Plus membership', async () => {
  await assert.rejects(
    assignAdminPlusSubscription({ userId: 'user-a', role: 'ADMIN' }, 'user-b',
      { enabled: true, expiresAt: '2026-12-01T00:00:00.000Z', reason: 'Manual test grant authorized' }),
    { statusCode: 403 },
  );
});

test('Malformed Plus grant reason is rejected before the database transaction', async () => {
  await assert.rejects(
    assignAdminPlusSubscription({ userId: 'user-a', role: 'SUPER_ADMIN' }, 'user-b',
      { enabled: true, expiresAt: '2026-12-01T00:00:00.000Z', reason: 'short' }),
    { statusCode: 400 },
  );
});
