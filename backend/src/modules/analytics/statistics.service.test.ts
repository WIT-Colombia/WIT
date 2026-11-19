import assert from 'node:assert/strict';
import test from 'node:test';
import { authorizeStatisticsBusiness, completeCountTrend, statisticsWindow, offerRankingVisibility } from './statistics.service.js';
import { recordAnalyticsEvent } from './analytics.service.js';

test('statistics windows use Bogotá midnight and compare the same elapsed duration', () => {
  const now = new Date('2026-10-24T18:30:00.000Z');
  const day = statisticsWindow('day', now);
  assert.equal(day.start?.toISOString(), '2026-10-24T05:00:00.000Z');
  assert.equal(day.previousStart?.toISOString(), '2026-10-23T05:00:00.000Z');
  assert.equal(day.previousEnd?.toISOString(), '2026-10-23T18:30:00.000Z');
  const week = statisticsWindow('week', now);
  assert.equal(week.start?.toISOString(), '2026-10-19T05:00:00.000Z');
  const month = statisticsWindow('month', now);
  assert.equal(month.start?.toISOString(), '2026-10-01T05:00:00.000Z');
  assert.equal(month.previousStart?.toISOString(), '2026-09-01T05:00:00.000Z');
});

test('all-time has no fabricated comparison, and unequal calendar lengths suppress it', () => {
  const all = statisticsWindow('all', new Date('2026-10-24T18:30:00.000Z'));
  assert.equal(all.start, null);
  assert.equal(all.previousStart, null);
  const late = statisticsWindow('month', new Date('2026-10-31T18:30:00.000Z'));
  assert.equal(late.previousStart, null);
  assert.equal(late.previousEnd, null);
});

test('statistics lookup scopes the requested business to the active member', async () => {
  let query: unknown;
  const db = { business: { findFirst: async (value: unknown) => { query = value; return null; } } } as unknown as NonNullable<Parameters<typeof authorizeStatisticsBusiness>[2]>;
  await assert.rejects(() => authorizeStatisticsBusiness('member-a', 'business-b', db), { statusCode: 404, code: 'BUSINESS_NOT_FOUND' });
  const where = (query as { where: { OR: unknown; memberships: { some: { userId: string; status: string } } } }).where;
  assert.deepEqual(where.OR, [{ id: 'business-b' }, { publicId: 'business-b' }]);
  assert.deepEqual(where.memberships.some, { userId: 'member-a', status: 'ACTIVE' });
});

test('a collaborator without READ_ANALYTICS cannot read business statistics', async () => {
  const db = { business: { findFirst: async () => ({ id: 'business-a', memberships: [{ role: 'COLLABORATOR', permissions: [] }] }) } } as unknown as NonNullable<Parameters<typeof authorizeStatisticsBusiness>[2]>;
  await assert.rejects(() => authorizeStatisticsBusiness('member-a', 'business-a', db), { statusCode: 403, code: 'BUSINESS_PERMISSION_DENIED' });
});

test('un día completo de eventos conserva las horas sin actividad con valor cero en Bogotá', () => {
  const until = new Date('2026-10-24T18:30:00.000Z'); // 13:30 de Colombia
  const first = statisticsWindow('day', until).start!;
  const result = completeCountTrend([
    { label: '2026-10-24 08:00', value: 4 },
    { label: '2026-10-24 10:00', value: 2 },
  ], 'day', first, until);
  assert.equal(result.length, 14);
  assert.deepEqual(result[0], { label: '2026-10-24 00:00', value: 0 });
  assert.deepEqual(result[8], { label: '2026-10-24 08:00', value: 4 });
  assert.deepEqual(result[9], { label: '2026-10-24 09:00', value: 0 });
  assert.deepEqual(result[10], { label: '2026-10-24 10:00', value: 2 });
  assert.deepEqual(result[13], { label: '2026-10-24 13:00', value: 0 });
  assert.equal(result.reduce((sum, point) => sum + point.value, 0), 6);
});

test('semana y mes conservan los días con cero sin añadir días futuros', () => {
  const until = new Date('2026-10-24T18:30:00.000Z');
  const week = completeCountTrend([{ label: '2026-10-20', value: 3 }], 'week', statisticsWindow('week', until).start!, until);
  assert.equal(week.length, 6);
  assert.deepEqual(week[0], { label: '2026-10-19', value: 0 });
  assert.deepEqual(week[1], { label: '2026-10-20', value: 3 });
  assert.deepEqual(week.at(-1), { label: '2026-10-24', value: 0 });
  const month = completeCountTrend([], 'month', statisticsWindow('month', until).start!, until);
  assert.equal(month.length, 24);
  assert.equal(month.every(point => point.value === 0), true);
  assert.equal(month.at(-1)?.label, '2026-10-24');
});

test('año e histórico preservan meses de valor cero para estadísticas de conteo', () => {
  const until = new Date('2026-10-24T18:30:00.000Z');
  const year = completeCountTrend([{ label: '2026-02', value: 7 }], 'year', statisticsWindow('year', until).start!, until);
  assert.equal(year.length, 10);
  assert.deepEqual(year[0], { label: '2026-01', value: 0 });
  assert.deepEqual(year[1], { label: '2026-02', value: 7 });
  assert.deepEqual(year.at(-1), { label: '2026-10', value: 0 });
  const all = completeCountTrend([], 'all', new Date('2024-11-01T05:00:00.000Z'), until);
  assert.equal(all.length, 24);
  assert.equal(all[0].label, '2024-11');
  assert.equal(all.at(-1)?.label, '2026-10');
});

test('Business PRO unlocks advanced rankings; recognition rewards stay independent of paid subscriptions', () => {
  assert.deepEqual(offerRankingVisibility(0, false), { referralRanking: false, proRankings: false });
  assert.deepEqual(offerRankingVisibility(499, false), { referralRanking: false, proRankings: false });
  assert.deepEqual(offerRankingVisibility(500, false), { referralRanking: true, proRankings: false });
  assert.deepEqual(offerRankingVisibility(0, true), { referralRanking: true, proRankings: true });
  assert.deepEqual(offerRankingVisibility(500, true), { referralRanking: true, proRankings: true });
});

test('analytics events are recorded independently of BASIC or PRO status', async () => {
  const businessQueries: unknown[] = [];
  const recorded: Array<{ businessId: string; eventType: string }> = [];
  // Inject an isolated persistence stub. Never patch the Prisma client:
  // its model delegates are proxied and global mutation can leak across tests.
  const db = {
    business: {
      findFirst: async (args: { where: { OR: Array<{ id?: string; publicId?: string }> } }) => {
        businessQueries.push(args.where);
        const id = String(args.where.OR[0].id);
        return { id, publicId: id };
      },
    },
    businessOffer: { findFirst: async () => { throw new Error('Unexpected offer lookup'); } },
    businessAnalyticsEvent: {
      create: async (args: { data: { businessId: string; eventType: string } }) => {
        recorded.push({ businessId: args.data.businessId, eventType: args.data.eventType });
        return {};
      },
    },
  } as unknown as NonNullable<Parameters<typeof recordAnalyticsEvent>[1]>;

  assert.deepEqual(await recordAnalyticsEvent({ businessId: 'business-basic', eventType: 'BUSINESS_VIEW' }, db),
    { recorded: true, businessId: 'business-basic' });
  assert.deepEqual(await recordAnalyticsEvent({ businessId: 'business-pro', eventType: 'BUSINESS_VIEW' }, db),
    { recorded: true, businessId: 'business-pro' });
  assert.deepEqual(recorded, [
    { businessId: 'business-basic', eventType: 'BUSINESS_VIEW' },
    { businessId: 'business-pro', eventType: 'BUSINESS_VIEW' },
  ]);
  for (const where of businessQueries as Array<Record<string, unknown>>) {
    assert.equal(where.publicationStatus, 'PUBLISHED');
    assert.equal(where.visibilityStatus, 'VISIBLE');
    assert.equal(Object.hasOwn(where, 'isPro'), false);
    assert.equal(Object.hasOwn(where, 'businessSubscription'), false);
  }
});
