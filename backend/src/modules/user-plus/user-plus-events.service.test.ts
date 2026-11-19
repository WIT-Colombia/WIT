import assert from 'node:assert/strict';
import test from 'node:test';

process.env.AUTH_ACCESS_TOKEN_SECRET ??= 'user-plus-opt-in-test-secret-32-characters';
process.env.DATABASE_URL ??= 'mysql://test:test@127.0.0.1:3306/plus_opt_in_test';

const { eligibleUsers } = await import('./user-plus-events.service.js');

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
