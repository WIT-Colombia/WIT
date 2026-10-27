import assert from 'node:assert/strict';
import test from 'node:test';
import { authorizeStatisticsBusiness, statisticsWindow } from './statistics.service.js';

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
