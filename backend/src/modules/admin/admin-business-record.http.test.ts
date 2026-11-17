import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const storage = await mkdtemp(join(tmpdir(), 'xamuko-business-record-test-'));
process.env.PHOTO_STORAGE_BACKEND = 'local'; process.env.PHOTO_STORAGE_DIR = storage;
const { app } = await import('../../app.js');
const { prisma } = await import('../../config/prisma.js');
const { env } = await import('../../config/env.js');
const { createBusinessRecordFixture } = await import('./admin-business-record.test-fixture.js');
const { recordActivity, recordDate } = await import('./admin-business-record.service.js');

test('Ficha administrativa: consultas, fotografías privadas y decisiones auditadas reales', async t => {
  const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aV7sAAAAASUVORK5CYII=', 'base64');
  const fixture = await createBusinessRecordFixture(image), id = fixture.business.id;
  const server = app.listen(0); await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/api/v1/admin`, origin = env.trustedOrigins[0] || 'http://localhost:5176';
  let cookie = '', csrf = '';
  const request = (path: string, init: RequestInit = {}, auth = true) => {
    const headers = new Headers(init.headers); headers.set('Origin', origin);
    if (auth) { headers.set('Cookie', cookie); headers.set('X-Admin-CSRF', csrf); }
    if (init.body) headers.set('Content-Type', 'application/json');
    return fetch(base + path, { ...init, headers, signal: AbortSignal.timeout(15000) });
  };
  try {
    const login = await request('/auth/password', { method: 'POST', body: JSON.stringify({ email: fixture.email, password: fixture.password }) }, false);
    assert.equal(login.status, 200); const session = await login.json() as any; csrf = session.csrfToken;
    cookie = login.headers.getSetCookie().find(row => row.startsWith('xamuko_admin_session='))!.split(';')[0];
    await t.test('todas las consultas exigen AdminSession', async () => {
      for (const suffix of ['', '/catalog', '/reviews', '/photos', '/activity', '/history', `/photos/${fixture.photoIds[0]}/content`]) assert.equal((await request(`/businesses/${id}${suffix}`, {}, false)).status, 401);
    });
    await t.test('ficha real, propietario, plan y datos complementarios sin secretos', async () => {
      const response = await request(`/businesses/${fixture.business.publicId}`); assert.equal(response.status, 200);
      const { business } = await response.json() as any;
      assert.equal(business.record.products, 13); assert.equal(business.record.services, 7); assert.equal(business.record.members.length, 2); assert.equal(business.record.rating.count, 13);
      assert.equal(business.record.businessPhotos, 12); assert.equal(business.record.catalogPhotos, 6); assert.equal(business.isPro, true); assert.equal(business.record.effectiveVisibility, 'VISIBLE');
      assert.ok(!JSON.stringify(business).includes('passwordHash')); assert.ok(!JSON.stringify(business).includes('storageKey'));
    });
    await t.test('catálogo separado, filtros y paginación no mezclan negocios', async () => {
      const first = await (await request(`/businesses/${id}/catalog?kind=PRODUCT&page=1`)).json() as any;
      assert.equal(first.pagination.total, 13); assert.equal(first.offers.length, 6);
      const second = await (await request(`/businesses/${id}/catalog?kind=PRODUCT&page=2`)).json() as any;
      assert.ok(!second.offers.some((row: any) => first.offers.some((other: any) => other.id === row.id)));
      const services = await (await request(`/businesses/${id}/catalog?kind=SERVICE`)).json() as any; assert.equal(services.pagination.total, 7);
      const active = await (await request(`/businesses/${id}/catalog?kind=PRODUCT&status=PUBLISHED&activation=ACTIVE`)).json() as any;
      assert.ok(active.offers.length > 0); assert.ok(active.offers.every((row: any) => row.active && row.publicationStatus === 'PUBLISHED'));
      const search = await (await request(`/businesses/${id}/catalog?kind=PRODUCT&q=QA00001`)).json() as any; assert.equal(search.offers[0].priceAmount, '0'); assert.equal(search.pagination.total, 1);
      assert.equal((await request(`/businesses/${id}/catalog?kind=INVALID`)).status, 400);
      assert.equal((await request(`/businesses/${id}/catalog?page=-1`)).status, 400);
      const other = await (await request(`/businesses/${fixture.other.id}/catalog`)).json() as any; assert.equal(other.pagination.total, 0);
    });
    await t.test('opiniones, puntuación, fechas, reportes y privacidad del autor', async () => {
      const rows = await (await request(`/businesses/${id}/reviews`)).json() as any; assert.equal(rows.pagination.total, 14); assert.equal(rows.reviews.length, 6);
      const filtered = await (await request(`/businesses/${id}/reviews?rating=1`)).json() as any; assert.ok(filtered.reviews.every((row: any) => row.rating === 1)); assert.ok(filtered.reviews.some((row: any) => row._count.reports === 1));
      assert.ok(filtered.reviews.every((row: any) => row.user.nickname && !('emailNormalized' in row.user)));
      assert.equal((await request(`/businesses/${id}/reviews?from=2026-02-30`)).status, 400);
      assert.equal((await request(`/businesses/${id}/reviews?rating=6`)).status, 400);
      assert.equal(recordDate('2026-11-01')?.toISOString(), '2026-11-01T05:00:00.000Z');
    });
    await t.test('galería paginada e imágenes autenticadas limitadas al negocio', async () => {
      const response = await request(`/businesses/${id}/photos`); assert.match(response.headers.get('cache-control')!, /no-store/);
      const data = await response.json() as any; assert.equal(data.pagination.total, 18); assert.equal(data.photos.length, 12);
      assert.ok(!JSON.stringify(data).includes('storageKey'));
      const content = await request(`/businesses/${id}/photos/${fixture.photoIds[0]}/content`); assert.equal(content.status, 200); assert.match(content.headers.get('content-type')!, /image\/png/); assert.deepEqual(Buffer.from(await content.arrayBuffer()), image);
      assert.equal((await request(`/businesses/${fixture.other.id}/photos/${fixture.photoIds[0]}/content`)).status, 404);
      const offers = await (await request(`/businesses/${id}/photos?scope=OFFER`)).json() as any; assert.equal(offers.pagination.total, 6);
    });
    await t.test('estadísticas de fuentes reales, ceros y fechas de Bogotá', async () => {
      const date = new Date(fixture.registered); date.setUTCDate(17); date.setUTCHours(18);
      await prisma.businessFavorite.create({ data: { businessId: id, userId: fixture.member.id } });
      await prisma.businessOfferLike.create({ data: { offerId: fixture.offers[0].id, userId: fixture.member.id } });
      await prisma.businessOfferLike.create({ data: { offerId: fixture.offers[1].id, userId: fixture.member.id } });
      const activity = await recordActivity(id, 'month', date);
      assert.equal(activity.current.favorites, 1);
      assert.equal(activity.current.offerLikes, 2);
      const allHistory = await recordActivity(id, 'all', date);
      assert.equal(allHistory.current.favorites, 1);
      assert.equal(allHistory.current.offerLikes, 2);
      assert.equal(activity.totals.views, 2); assert.equal(activity.totals.interactions, 1); assert.equal(activity.totals.offerViews, 1);
      assert.equal(activity.series.length, 17); assert.equal(activity.series[0].views, 2); assert.equal(activity.series[1].views, 0);
      assert.equal(activity.timezone, 'America/Bogota');
      const hourly = await (await request(`/businesses/${id}/activity?period=day`)).json() as any;
      assert.ok(hourly.series.every((row: any) => /^\d{4}-\d{2}-\d{2} \d{2}:00$/.test(row.label)));
      assert.equal((await request(`/businesses/${id}/activity?period=invalid`)).status, 400);
    });
    await t.test('ocultar, suspender, restituir y eliminar mantienen seguridad y auditoría', async () => {
      const endpoint = `/businesses/${id}/visibility`, payload = (action: string) => JSON.stringify({ action, reason: 'Fundamento de la decisión administrativa de prueba.' });
      const noCsrf = await fetch(base + endpoint, { method: 'POST', headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json' }, body: payload('HIDE') }); assert.equal(noCsrf.status, 403);
      assert.equal((await request(endpoint, { method: 'POST', body: JSON.stringify({ action: 'HIDE', reason: 'corto' }) })).status, 400);
      for (const action of ['HIDE', 'SUSPEND', 'HIDE', 'RESTORE']) assert.equal((await request(endpoint, { method: 'POST', body: payload(action) })).status, 200);
      const history = await (await request(`/businesses/${id}/history?page=1&pageSize=12`)).json() as any;
      assert.equal(history.history.length, 12); assert.ok(history.pagination.total >= 22); assert.ok(!JSON.stringify(history).includes('not-a-real-secret-do-not-expose')); assert.ok(history.history.some((row: any) => row.newState?.administrativeRestriction === 'SUSPENDED'));
      await prisma.businessVisibilityPeriod.updateMany({ where: { businessId: id }, data: { expiresAt: new Date(Date.now() - 1000) } });
      const expired = await (await request(`/businesses/${id}`)).json() as any;
      assert.equal(expired.business.record.effectiveVisibility, 'EXPIRED');
      const deletion = `/businesses/${id}/delete`;
      assert.equal((await request(deletion, { method: 'POST', body: JSON.stringify({ reason: 'Fundamento de prueba suficiente', confirmation: '' }) })).status, 400);
      assert.equal((await request(deletion, { method: 'POST', body: JSON.stringify({ reason: 'Baja administrativa de prueba aislada.', confirmation: 'ELIMINAR' }) })).status, 200);
      assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: fixture.user.id } })).status, 'ACTIVE');
      const removed = await (await request(`/businesses/${id}`)).json() as any; assert.equal(removed.business.deletionStatus, 'DELETED'); assert.equal(removed.business.isPro, false);
      assert.equal((await request(endpoint, { method: 'POST', body: payload('HIDE') })).status, 409);
      assert.ok((await prisma.auditLog.count({ where: { entityId: id, action: 'ADMIN_BUSINESS_DELETED' } })) === 1);
    });
  } finally { await fixture.cleanup(); await new Promise<void>(resolve => server.close(() => resolve())); await prisma.$disconnect(); await rm(storage, { recursive: true, force: true }); }
});
