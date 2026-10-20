import assert from 'node:assert/strict';
import test from 'node:test';
import { catalogLimits, isSubscriptionEffective } from './recognition.service.js';

function fakeDb({ referrals = 0, pro = false, products = 0, services = 0 }: { referrals?: number; pro?: boolean; products?: number; services?: number }) {
  return {
    business: { findUnique: async () => ({ referralCounter: { validReferralCount: referrals } }) },
    $queryRaw: async () => pro ? [{ id: 'subscription' }] : [],
    businessOffer: { count: async ({ where }: { where: { kind: string } }) => where.kind === 'PRODUCT' ? products : services },
  } as any;
}

test('sin Pro aplica el límite del nivel y separa tipos', async () => {
  const result = await catalogLimits(fakeDb({ referrals: 20, products: 25, services: 3 }), 'business-a');
  assert.equal(result.level, 'BRONZE');
  assert.equal(result.plan, 'BASIC');
  assert.deepEqual(result.products, { used: 25, limit: 25, available: 0, unlimited: false });
  assert.equal(result.services.available, 22);
});

test('Pro vigente concede productos y servicios ilimitados', async () => {
  const result = await catalogLimits(fakeDb({ pro: true, products: 200, services: 150 }), 'business-pro');
  assert.equal(result.plan, 'PRO');
  assert.equal(result.products.limit, null);
  assert.equal(result.services.limit, null);
  assert.equal(result.products.unlimited, true);
});

test('Pro no vigente no concede beneficios', async () => {
  const result = await catalogLimits(fakeDb({ referrals: 0, products: 20 }), 'business-basic');
  assert.equal(result.plan, 'BASIC');
  assert.equal(result.products.limit, 20);
  assert.equal(result.products.unlimited, false);
});

test('una suscripción especial vigente puede ser ilimitada', async () => {
  const result = await catalogLimits(fakeDb({ pro: true, products: 76 }), 'business-special');
  assert.equal(result.products.available, null);
  assert.equal(result.services.available, null);
});

test('los establecimientos se evalúan de forma independiente', async () => {
  const pro = await catalogLimits(fakeDb({ pro: true, products: 80 }), 'business-one');
  const basic = await catalogLimits(fakeDb({ products: 4 }), 'business-two');
  assert.equal(pro.plan, 'PRO');
  assert.equal(basic.plan, 'BASIC');
  assert.equal(basic.products.used, 4);
});

const now = new Date('2026-01-01T00:00:00.000Z');
const subscription = { plan: 'PRO', status: 'ACTIVE', startsAt: new Date('2025-01-01T00:00:00.000Z'), expiresAt: new Date('2027-01-01T00:00:00.000Z'), specialActivation: false, revokedAt: null };
test('vigencia distingue cancelación, vencimiento, revocación y activación especial', () => {
  assert.equal(isSubscriptionEffective({ ...subscription }, now), true);
  assert.equal(isSubscriptionEffective({ ...subscription, expiresAt: new Date('2025-12-31T00:00:00.000Z') }, now), false);
  assert.equal(isSubscriptionEffective({ ...subscription, revokedAt: now }, now), false);
  assert.equal(isSubscriptionEffective({ ...subscription, status: 'PENDING' }, now), false);
  assert.equal(isSubscriptionEffective({ ...subscription, startsAt: new Date('2026-02-01T00:00:00.000Z') }, now), false);
  assert.equal(isSubscriptionEffective({ ...subscription, expiresAt: null, specialActivation: true }, now), true);
  assert.equal(isSubscriptionEffective({ ...subscription, expiresAt: null, specialActivation: false }, now), false);
});
