import assert from 'node:assert/strict';
import test from 'node:test';

process.env.AUTH_ACCESS_TOKEN_SECRET ??= 'promotion-entitlement-test-secret-with-32-characters';
process.env.DATABASE_URL ??= 'mysql://test:test@127.0.0.1:3306/promotion_entitlement_test';

const { getPromotionLimits } = await import('./promotion.service.js');

function fakeDb({ pro = true, enabled = true, existing = 3 }: { pro?: boolean; enabled?: boolean; existing?: number } = {}) {
  const start = new Date(Date.now() - 3600000);
  const end = new Date(Date.now() + 3600000);
  return {
    $queryRaw: async () => pro ? [{ id: 'old-pro-subscription' }] : [],
    paidPlanAvailability: { findUnique: async () => ({ enabled }) },
    businessPromotion: { findMany: async () => Array.from({ length: existing }, () => ({
      active: true, startsAt: start, endsAt: end, recurrence: 'NONE', recurrenceUntil: null,
    })) },
    businessPromotionView: { count: async () => 0 },
  } as unknown as Parameters<typeof getPromotionLimits>[0];
}

test('plan PRO deshabilitado aplica una sola oferta/promoción activa sin borrar publicaciones existentes', async () => {
  const result = await getPromotionLimits(fakeDb({ pro: true, enabled: false, existing: 3 }), 'business-patico');
  assert.equal(result.plan, 'BASIC');
  assert.equal(result.maxActive, 1);
  assert.equal(result.activeCount, 3);
  assert.equal(result.summary.active, 3);
  assert.equal(result.maxPhotos, 1);
  assert.equal(result.canSchedule, false);
  assert.equal(result.canRecur, false);
  assert.equal(result.detailedAnalytics, false);
});

test('sin suscripción vigente corresponde plan Básico aunque el interruptor esté habilitado', async () => {
  const result = await getPromotionLimits(fakeDb({ pro: false, enabled: true, existing: 0 }), 'business-expired');
  assert.equal(result.plan, 'BASIC');
  assert.equal(result.maxActive, 1);
  assert.equal(result.activeCount, 0);
});

test('PRO vigente y globalmente habilitado conserva el límite de diez publicaciones', async () => {
  const result = await getPromotionLimits(fakeDb({ pro: true, enabled: true, existing: 3 }), 'business-pro');
  assert.equal(result.plan, 'PRO');
  assert.equal(result.maxActive, 10);
  assert.equal(result.activeCount, 3);
  assert.equal(result.canSchedule, true);
});
