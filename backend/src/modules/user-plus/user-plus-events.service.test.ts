import assert from 'node:assert/strict';
import test from 'node:test';

process.env.AUTH_ACCESS_TOKEN_SECRET ??= 'user-plus-opt-in-test-secret-32-characters';
process.env.DATABASE_URL ??= 'mysql://test:test@127.0.0.1:3306/plus_opt_in_test';

const { eligibleUsers, recordPlusPriceChange } = await import('./user-plus-events.service.js');
const { Prisma } = await import('../../generated/prisma/client.js');

function fakeTx(options: {
  switchOn?: boolean; optedIn?: boolean; forPrice?: boolean;
} = {}) {
  const { switchOn = true, optedIn = false, forPrice = false } = options;
  return {
    paidPlanAvailability: { findUnique: async () => ({ enabled: switchOn }) },
    userPlusSubscription: { findMany: async ({ where }: { where: { userId: { in: string[] } } }) =>
      [{ userId: 'member' }, { userId: 'minor' }].filter(row => where.userId.in.includes(row.userId)) },
    userPlusPreference: { findMany: async ({ where }: { where: { userId: { in: string[] } } }) => optedIn ? [
      { userId: 'member', radarEnabled: !forPrice, priceAlertsEnabled: forPrice },
      { userId: 'minor', radarEnabled: !forPrice, priceAlertsEnabled: forPrice },
    ].filter(row => where.userId.in.includes(row.userId)) : [] },
    user: { findMany: async ({ where }: { where: { id: { in: string[] } } }) => [
      { id: 'member', adultContentEnabled: true }, { id: 'minor', adultContentEnabled: false },
    ].filter(row => where.id.in.includes(row.id)) },
  } as any;
}

test('Missing consent never dispatches marketing alerts to Plus members', async () => {
  assert.deepEqual(await eligibleUsers(fakeTx(), ['member', 'minor'], 'radar', false), []);
  assert.deepEqual(await eligibleUsers(fakeTx(), ['member'], 'price', false), []);
});
test('Master switch OFF prevents alerts even with a stored consent', async () => {
  assert.deepEqual(await eligibleUsers(fakeTx({ switchOn: false, optedIn: true }), ['member'], 'radar', false), []);
});
test('Only a matching opt-in receives price or favorite-business notifications', async () => {
  assert.deepEqual(await eligibleUsers(fakeTx({ optedIn: true }), ['member', 'minor'], 'radar', false), ['member', 'minor']);
  assert.deepEqual(await eligibleUsers(fakeTx({ optedIn: true }), ['member'], 'price', false), []);
  assert.deepEqual(await eligibleUsers(fakeTx({ optedIn: true, forPrice: true }), ['member'], 'price', false), ['member']);
  assert.deepEqual(await eligibleUsers(fakeTx({ optedIn: true, forPrice: true }), ['member'], 'radar', false), []);
});
test('Adult-only marketing excludes accounts without adult-content preference', async () => {
  assert.deepEqual(await eligibleUsers(fakeTx({ optedIn: true }), ['minor', 'member'], 'radar', true), ['member']);
});


test('A separately configured objective alerts once on a true price drop without enabling all price notices', async () => {
  const immediate: Array<{ sourceType: string }> = [];
  const queued: Array<{ kind: string }> = [];
  const row = { id: 'watch-1', userId: 'member', targetAmount: new Prisma.Decimal(100),
    targetCurrency: 'COP', targetNotifiedAt: null as Date | null };
  const tx = {
    paidPlanAvailability: { findUnique: async () => ({ enabled: true }) },
    userPlusSubscription: { findMany: async () => [{ userId: 'member' }] },
    userPlusPreference: { findMany: async () => [{ userId: 'member',
      radarEnabled: false, priceAlertsEnabled: false, deliveryMode: 'IMMEDIATE' }] },
    user: { findMany: async () => [{ id: 'member', adultContentEnabled: true }] },
    userPlusPriceWatch: {
      findMany: async () => [row],
      updateMany: async () => { row.targetNotifiedAt = new Date(); return { count: 1 }; },
    },
    offerPriceHistory: { create: async () => ({}) },
    platformNotification: { createMany: async ({ data }: any) => { immediate.push(...data); } },
    userPlusDigestEvent: { createMany: async ({ data }: any) => { queued.push(...data); } },
  } as any;
  const base = { offerId: 'offer-1', businessId: 'business-1', name: 'Pan queso', adultOnly: false,
    publiclyVisible: true, previousCurrency: 'COP', currency: 'COP' };
  await recordPlusPriceChange(tx, { ...base, previousPrice: new Prisma.Decimal(150), newPrice: new Prisma.Decimal(95) });
  assert.deepEqual(immediate.map(notice => notice.sourceType), ['PLUS_PRICE_TARGET']);
  assert.equal(queued.length, 0);
  assert.ok(row.targetNotifiedAt);
  await recordPlusPriceChange(tx, { ...base, previousPrice: new Prisma.Decimal(95), newPrice: new Prisma.Decimal(90) });
  assert.equal(immediate.length, 1, 'same target must not notify twice');
});

test('Daily preference queues price changes instead of publishing an immediate notification', async () => {
  const immediate: any[] = [], queued: any[] = [];
  const tx = {
    paidPlanAvailability: { findUnique: async () => ({ enabled: true }) },
    userPlusSubscription: { findMany: async () => [{ userId: 'member' }] },
    userPlusPreference: { findMany: async () => [{ userId: 'member',
      radarEnabled: false, priceAlertsEnabled: true, deliveryMode: 'DAILY' }] },
    user: { findMany: async () => [{ id: 'member', adultContentEnabled: true }] },
    userPlusPriceWatch: { findMany: async () => [{ id: 'watch-1', userId: 'member',
      targetAmount: null, targetCurrency: null, targetNotifiedAt: null }] },
    offerPriceHistory: { create: async () => ({}) },
    platformNotification: { createMany: async ({ data }: any) => { immediate.push(...data); } },
    userPlusDigestEvent: { createMany: async ({ data }: any) => { queued.push(...data); } },
  } as any;
  await recordPlusPriceChange(tx, { offerId: 'offer-1', businessId: 'business-1', name: 'Pan queso',
    adultOnly: false, publiclyVisible: true, previousCurrency: 'COP', currency: 'COP',
    previousPrice: new Prisma.Decimal(150), newPrice: new Prisma.Decimal(130) });
  assert.deepEqual(immediate, []);
  assert.deepEqual(queued.map(e => e.kind), ['PRICE']);
});
