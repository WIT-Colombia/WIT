import test from 'node:test';
import assert from 'node:assert/strict';
import { adminSubscriptionWhere, normalizeAdminSubscriptionsQuery } from './admin-subscriptions.service.js';

const now = new Date('2026-11-18T12:00:00.000Z');
test('los filtros solo admiten estados persistidos; las vistas no son nuevos estados', () => {
  assert.deepEqual(normalizeAdminSubscriptionsQuery({}), {
    page: 1, pageSize: 12, status: '', q: '', view: 'ALL',
  });
  assert.equal(normalizeAdminSubscriptionsQuery({ page: 4, view: 'expiring_30_days', status: 'active' }).view, 'EXPIRING_30_DAYS');
  assert.throws(() => normalizeAdminSubscriptionsQuery({ status: 'BASIC' }),
    (err: any) => err.code === 'ADMIN_SUBSCRIPTION_STATUS_INVALID');
  assert.throws(() => normalizeAdminSubscriptionsQuery({ view: 'PAID' }),
    (err: any) => err.code === 'ADMIN_SUBSCRIPTION_VIEW_INVALID');
  assert.throws(() => normalizeAdminSubscriptionsQuery({ q: 'x'.repeat(101) }),
    (err: any) => err.code === 'ADMIN_SUBSCRIPTION_SEARCH_TOO_LONG');
});

test('vista de vigentes coincide con la validez efectiva de PRO', () => {
  const where = adminSubscriptionWhere(normalizeAdminSubscriptionsQuery({ view: 'EFFECTIVE' }), now);
  assert.deepEqual(where.AND, [{
    plan: 'PRO', status: 'ACTIVE', revokedAt: null, startsAt: { lte: now },
    OR: [{ expiresAt: { gt: now } }, { expiresAt: null, specialActivation: true }],
  }]);
});

test('vencimientos en 30 días se filtran sobre el conjunto total, antes de paginar', () => {
  const where = adminSubscriptionWhere(normalizeAdminSubscriptionsQuery({
    view: 'EXPIRING_30_DAYS', q: 'Tienda', status: 'ACTIVE',
  }), now);
  const [scope] = where.AND as Array<any>;
  assert.equal(scope.plan, 'PRO');
  assert.equal(scope.status, 'ACTIVE');
  assert.deepEqual(scope.startsAt, { lte: now });
  assert.equal(scope.revokedAt, null);
  assert.deepEqual(scope.expiresAt, {
    gt: now, lte: new Date('2026-12-18T12:00:00.000Z'),
  });
  assert.equal(where.status, 'ACTIVE');
  assert.deepEqual(where.business, { is: { OR: [
    { name: { contains: 'Tienda' } }, { publicId: { contains: 'Tienda' } },
  ] } });
});

test('activaciones especiales vigentes no incluyen revocadas, futuras ni vencidas', () => {
  const where = adminSubscriptionWhere(normalizeAdminSubscriptionsQuery({ view: 'SPECIAL_EFFECTIVE' }), now);
  const [scope] = where.AND as Array<any>;
  assert.equal(scope.specialActivation, true);
  assert.equal(scope.status, 'ACTIVE');
  assert.equal(scope.revokedAt, null);
  assert.deepEqual(scope.startsAt, { lte: now });
  assert.deepEqual(scope.OR, [{ expiresAt: { gt: now } }, { expiresAt: null, specialActivation: true }]);
});

test('todos los registros mantiene histórico sin fingir cobros o plan básico registrado', () => {
  assert.deepEqual(adminSubscriptionWhere(normalizeAdminSubscriptionsQuery({ view: 'ALL' }), now), {});
  assert.deepEqual(adminSubscriptionWhere(normalizeAdminSubscriptionsQuery({ view: 'ALL', status: 'PENDING' }), now), { status: 'PENDING' });
});
