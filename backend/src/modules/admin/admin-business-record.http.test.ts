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
      assert.equal(business.record.referrals, 0, 'Sin referidos válidos debe mostrar cero real');
      await prisma.businessReferralCounter.create({ data: { businessId: id, validReferralCount: 7 } });
      const withReferrals = await (await request(`/businesses/${fixture.business.publicId}`)).json() as any;
      assert.equal(withReferrals.business.record.referrals, 7, 'Debe usar el contador de referidos validado de este negocio');
      const unrelated = await (await request(`/businesses/${fixture.other.publicId}`)).json() as any;
      assert.equal(unrelated.business.record.referrals, 0, 'No puede mezclar referidos entre negocios');
      assert.equal(business.record.products, 13); assert.equal(business.record.services, 7); assert.equal(business.record.members.length, 2); assert.equal(business.record.rating.count, 13);
      assert.equal(business.record.businessPhotos, 12); assert.equal(business.record.catalogPhotos, 6); assert.equal(business.isPro, true); assert.equal(business.record.effectiveVisibility, 'VISIBLE');
      assert.ok(!JSON.stringify(business).includes('passwordHash')); assert.ok(!JSON.stringify(business).includes('storageKey'));
    });
    await t.test('Reportes: cifras reales, filtros de cada negocio, fechas de Bogotá y trazabilidad', async () => {
      const first = await request('/businesses/' + id + '/reports');
      assert.equal(first.status, 200);
      assert.match(first.headers.get('cache-control') ?? '', /no-store/);
      const initial = await first.json() as any;
      assert.equal(initial.summary.total, 1);
      assert.equal(initial.summary.pending, 1);
      const pending = await prisma.businessReport.findFirstOrThrow({ where: { businessId: id } });
      await prisma.businessReport.update({ where: { id: pending.id }, data: { status: 'UNDER_REVIEW' } });
      const resolved = await prisma.businessReport.create({ data: {
        businessId: id, reporterId: fixture.member.id, status: 'RESOLVED', reason: 'FALSE_INFORMATION',
        description: 'Reporte revisado con evidencia suficiente.', decisionNote: 'Resultado fundamentado del proceso.',
      } });
      await prisma.businessReport.create({ data: {
        businessId: id, status: 'REJECTED', reason: 'IMPERSONATION',
        description: 'Denuncia de suplantación desestimada.', decisionNote: 'No se encontraron elementos.',
      } });
      await prisma.auditLog.create({ data: {
        actorUserId: fixture.user.id, entityType: 'BUSINESS', entityId: id, action: 'BUSINESS_REPORT_MODERATED',
        previousState: { reportId: resolved.id, status: 'UNDER_REVIEW' },
        newState: { reportId: resolved.id, status: 'RESOLVED' },
        reason: 'Revisión sustentada del expediente.',
      } });
      const counts = await (await request('/businesses/' + id + '/reports?status=RESOLVED')).json() as any;
      assert.equal(counts.summary.total, 3);
      assert.deepEqual([counts.summary.pending, counts.summary.reviewing, counts.summary.finalized], [0, 1, 2]);
      assert.equal(counts.summary.resolved, 1); assert.equal(counts.summary.rejected, 1);
      assert.equal(counts.pagination.total, 1);
      assert.equal(counts.reports[0].id, resolved.id);
      const reasonFiltered = await (await request('/businesses/' + id + '/reports?reason=IMPERSONATION')).json() as any;
      assert.equal(reasonFiltered.pagination.total, 1);
      const searched = await (await request('/businesses/' + id + '/reports?q=evidencia')).json() as any;
      assert.equal(searched.pagination.total, 1);
      assert.equal((await (await request('/businesses/' + fixture.other.id + '/reports')).json() as any).summary.total, 0);
      // Query by the full local date range, not the UTC day: Bogotá is UTC-5.
      assert.equal((await (await request('/businesses/' + id + '/reports?from=2020-01-01&to=2099-12-31')).json() as any).pagination.total, 3);
      assert.equal((await request('/businesses/' + id + '/reports?from=2026-02-30')).status, 400);
      assert.equal((await request('/businesses/' + id + '/reports?reason=INVALID')).status, 400);
      assert.equal((await request('/businesses/' + id + '/reports?status=INVALID')).status, 400);
      assert.equal((await request('/businesses/' + id + '/reports?from=2026-12-10&to=2026-11-10')).status, 400);
      const incident = await request('/business-reports/' + resolved.id);
      assert.equal(incident.status, 200);
      const detail = await incident.json() as any;
      assert.equal(detail.report.id, resolved.id);
      assert.equal(detail.history.length, 1);
      assert.equal(detail.history[0].actor.displayName, fixture.user.displayName);
      assert.equal(detail.history[0].previousStatus, 'UNDER_REVIEW');
      assert.equal(detail.history[0].newStatus, 'RESOLVED');
      assert.equal((await request('/business-reports/' + resolved.id, {}, false)).status, 401);
    });
    await t.test('historial conserva descripciones existentes sin exponer campos privados', async () => {
      await prisma.auditLog.create({ data: {
        actorUserId: fixture.user.id, entityType: 'BUSINESS', entityId: id,
        action: 'BUSINESS_UPDATED',
        previousState: { name: 'Negocio real', description: 'Texto anterior', phone: '+57-private-number' },
        newState: { name: 'Negocio real', description: 'Texto actualizado', changedFields: 'Descripción, Teléfono', phone: '+57-private-number-2' },
      } });
      const response = await request('/businesses/' + id + '/history?search=BUSINESS_UPDATED');
      assert.equal(response.status, 200);
      const body = await response.json() as any;
      const event = body.history.find((entry: any) => entry.newState?.description === 'Texto actualizado');
      assert.ok(event, 'Debe conservar la descripción del cambio histórico');
      assert.equal(event.previousState.description, 'Texto anterior');
      assert.equal(event.newState.changedFields, 'Descripción, Teléfono');
      assert.ok(!('phone' in event.previousState) && !('phone' in event.newState), 'No revelar el teléfono privado de la auditoría');
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
    await t.test('un único filtro de estado incluye Todos, Activos, Desactivados y Eliminados', async () => {
      for (const state of ['ALL', 'ACTIVE', 'INACTIVE', 'DELETED']) {
        const response = await request('/businesses/' + id + '/catalog?kind=PRODUCT&state=' + state);
        assert.equal(response.status, 200);
        const data = await response.json() as any;
        assert.ok(data.offers.every((row: any) => state === 'DELETED' ? row.deletedAt
          : state === 'ACTIVE' ? !row.deletedAt && row.active
            : state === 'INACTIVE' ? !row.deletedAt && !row.active : true));
      }
      assert.equal((await request('/businesses/' + id + '/catalog?state=OTHER')).status, 400);
    });
    await t.test('acciones del catálogo exigen CSRF, motivo y guardan auditoría e historial', async () => {
      const first = fixture.offers[0], second = fixture.offers[1], third = fixture.offers[2];
      const endpoint = (offerId: string) => '/businesses/' + id + '/catalog/' + offerId + '/state';
      const payload = (action: string) => JSON.stringify({ action, reason: 'Justificación administrativa suficiente para prueba.' });
      const missingCsrf = await fetch(base + endpoint(first.id), {
        method: 'POST', headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json' },
        body: payload('ACTIVATE') });
      assert.equal(missingCsrf.status, 403);
      assert.equal((await request(endpoint(first.id), { method: 'POST', body: payload('UNKNOWN') })).status, 400);
      assert.equal((await request(endpoint(first.id), { method: 'POST', body: JSON.stringify({ action: 'ACTIVATE', reason: 'muy corto' }) })).status, 400);
      assert.equal((await request(endpoint(fixture.other.id), { method: 'POST', body: payload('ACTIVATE') })).status, 404);
      assert.equal((await request(endpoint(first.id), { method: 'POST', body: payload('ACTIVATE') })).status, 200);
      assert.equal((await prisma.businessOffer.findUniqueOrThrow({ where: { id: first.id } })).active, true);
      assert.equal((await request(endpoint(first.id), { method: 'POST', body: payload('ACTIVATE') })).status, 409);
      assert.equal((await request(endpoint(second.id), { method: 'POST', body: payload('DEACTIVATE') })).status, 200);
      assert.equal((await prisma.businessOffer.findUniqueOrThrow({ where: { id: second.id } })).active, false);
      assert.equal((await request(endpoint(third.id), { method: 'POST', body: payload('DELETE') })).status, 200);
      const removed = await prisma.businessOffer.findUniqueOrThrow({ where: { id: third.id } });
      assert.ok(removed.deletedAt); assert.equal(removed.active, false);
      const removedPage = await (await request('/businesses/' + id + '/catalog?state=DELETED')).json() as any;
      assert.ok(removedPage.offers.some((entry: any) => entry.id === third.id));
      assert.equal((await request(endpoint(third.id), { method: 'POST', body: payload('ACTIVATE') })).status, 409);
      const history = await (await request('/businesses/' + id + '/history')).json() as any;
      assert.ok(history.history.some((entry: any) => entry.action === 'ADMIN_OFFER_ACTIVATED'));
      assert.ok(history.history.some((entry: any) => entry.action === 'ADMIN_OFFER_DEACTIVATED'));
      assert.ok(history.history.some((entry: any) => entry.action === 'ADMIN_OFFER_DELETED'));
      assert.equal((await prisma.auditLog.count({ where: { entityType: 'OFFER', entityId: first.id, action: 'ADMIN_OFFER_ACTIVATED' } })), 1);
      assert.ok((await prisma.businessNotification.count({ where: { businessId: id } })) >= 3);

      const filtered = await (await request('/businesses/' + id + '/history?kind=OFFER')).json() as any;
      assert.equal(filtered.pagination.total, 3, 'Tres cambios de publicaciones del negocio, sin duplicar logs de OFFER');
      assert.ok(filtered.history.every((entry: any) => entry.action.startsWith('ADMIN_OFFER_')));
      assert.equal(filtered.history[0].action, 'ADMIN_OFFER_DELETED');
      const byOwner = await (await request('/businesses/' + id + '/history?kind=OFFER&search=Administraci%C3%B3n')).json() as any;
      assert.equal(byOwner.pagination.total, 3, 'Busca por responsable antes de paginar');
      const byAct = await (await request('/businesses/' + id + '/history?search=servicios')).json() as any;
      assert.ok(byAct.history.some((entry: any) => entry.action.startsWith('ADMIN_OFFER_')));
      const two = await (await request('/businesses/' + id + '/history?kind=OFFER&page=2&pageSize=2')).json() as any;
      assert.equal(two.pagination.total, 3);
      assert.equal(two.history.length, 1);
      assert.equal(two.pagination.totalPages, 2);
      const otherHistory = await (await request('/businesses/' + fixture.other.id + '/history?kind=OFFER')).json() as any;
      assert.equal(otherHistory.pagination.total, 0, 'Aislamiento de negocio');
      assert.equal((await request('/businesses/' + id + '/history?kind=BAD')).status, 400);

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
