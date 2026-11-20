import assert from 'node:assert/strict';
import test from 'node:test';

process.env.AUTH_ACCESS_TOKEN_SECRET ??= 'xamuko-plus-digest-test-secret-32-chars';
process.env.DATABASE_URL ??= 'mysql://test:test@127.0.0.1:3306/xamuko_plus_digest_test';

const { dispatchDuePlusDigests } = await import('./user-plus-digest.service.js');
const { Prisma } = await import('../../generated/prisma/client.js');

const at = new Date('2026-11-20T13:10:00.000Z'); // 08:10 in America/Panama
function fakeDb(options: {
  adult?: boolean; mode?: 'IMMEDIATE' | 'DAILY'; subscribed?: boolean; category?: 'RADAR' | 'PRICE' | 'TARGET';
  opts?: { radarEnabled: boolean; priceAlertsEnabled: boolean };
} = {}) {
  const delivered: any[] = [];
  const uniqueDays = new Set<string>();
  const queue: Array<any> = [{ id: 'alert-1', userId: 'member', kind: options.category ?? 'RADAR',
    adultOnly: options.adult ?? false, createdAt: new Date('2026-11-20T12:00:00.000Z') }];
  const preferences = { deliveryMode: options.mode ?? 'DAILY', digestTimeZone: 'America/Panama',
    digestHour: 8, radarEnabled: options.opts?.radarEnabled ?? true,
    priceAlertsEnabled: options.opts?.priceAlertsEnabled ?? true };
  const db: any = {
    paidPlanAvailability: { findUnique: async () => ({ enabled: true }) },
    userPlusDigestEvent: {
      findMany: async ({ distinct }: { distinct?: string[] }) =>
        distinct ? (queue.length ? [{ userId: 'member' }] : []) : [...queue],
      deleteMany: async ({ where }: any) => {
        const ids: string[] = where.id.in;
        for (let i = queue.length - 1; i >= 0; i--) if (ids.includes(queue[i].id)) queue.splice(i, 1);
        return { count: ids.length };
      },
    },
    userPlusPreference: { findUnique: async () => preferences },
    userPlusSubscription: { findUnique: async () => options.subscribed === false ? null :
      { status: 'ACTIVE', startsAt: new Date('2026-11-01T00:00:00.000Z'),
        expiresAt: new Date('2026-12-01T00:00:00.000Z'), revokedAt: null } },
    user: { findUnique: async () => ({ status: 'ACTIVE', adultContentEnabled: false }) },
    userPlusDigestDispatch: { create: async ({ data }: any) => {
      const key = data.userId + ':' + data.localDay;
      if (uniqueDays.has(key)) throw new Prisma.PrismaClientKnownRequestError('already sent',
        { code: 'P2002', clientVersion: '7.10.1' });
      uniqueDays.add(key);
    } },
    platformNotification: { create: async ({ data }: any) => { delivered.push(data); } },
  };
  db.$transaction = async (fn: (tx: typeof db) => Promise<unknown>) => fn(db);
  return { db, delivered, queue, preferences };
}

test('Only delivers a digest at the chosen local hour and suppresses repeat sends on one day', async () => {
  const fx = fakeDb();
  assert.equal((await dispatchDuePlusDigests(new Date('2026-11-20T12:10:00.000Z'), fx.db)).sent, 0);
  assert.equal((await dispatchDuePlusDigests(at, fx.db)).sent, 1);
  assert.equal(fx.delivered.length, 1);
  assert.equal(fx.delivered[0].sourceType, 'PLUS_DAILY_DIGEST');
  fx.queue.push({ id: 'alert-2', userId: 'member', kind: 'RADAR', adultOnly: false, createdAt: at });
  assert.equal((await dispatchDuePlusDigests(at, fx.db)).sent, 0);
  assert.equal(fx.delivered.length, 1);
});

test('Does not send to expired Plus accounts or users without permitted adult content', async () => {
  const unsubscribed = fakeDb({ subscribed: false });
  assert.equal((await dispatchDuePlusDigests(at, unsubscribed.db)).sent, 0);
  assert.equal(unsubscribed.delivered.length, 0);
  const adults = fakeDb({ adult: true });
  assert.equal((await dispatchDuePlusDigests(at, adults.db)).sent, 0);
  assert.equal(adults.delivered.length, 0);
});

test('A personally requested target can appear in the daily digest with generic price alerts disabled', async () => {
  const fx = fakeDb({ category: 'TARGET', opts: { radarEnabled: false, priceAlertsEnabled: false } });
  assert.equal((await dispatchDuePlusDigests(at, fx.db)).sent, 1);
  assert.match(fx.delivered[0].message, /1 precios objetivo alcanzados/);
  assert.equal(fx.queue.length, 0);
});

test('Changing delivery to immediate prevents delivery of an old daily queue', async () => {
  const fx = fakeDb({ mode: 'IMMEDIATE' });
  assert.equal((await dispatchDuePlusDigests(at, fx.db)).sent, 0);
  assert.equal(fx.delivered.length, 0);
});
