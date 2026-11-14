import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import argon2 from 'argon2';
import { app } from '../../app.js';
import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';

test('Atención y soporte: siete formularios, Admin y sesiones completas (MySQL aislado)', async t => {
  const server = app.listen(0);
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = 'http://127.0.0.1:' + address.port + '/api/v1';
  const origin = env.trustedOrigins[0] ?? 'http://127.0.0.1:5174';
  const seed = randomUUID().slice(0, 8);
  const email = 'support-int-' + seed + '@example.invalid';
  const password = 'Xamuko-' + seed + '-password';
  let userId = '', accountId = '', categoryId = '', businessId = '', offerId = '', reviewId = '';
  let token = '', refreshCookie = '', adminCookie = '', adminCsrf = '';
  const needIds: string[] = [];
  const send = async (path: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    headers.set('Origin', origin);
    if (!headers.has('Accept')) headers.set('Accept', 'application/json');
    if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    const response = await fetch(base + path, { ...init, headers, signal: AbortSignal.timeout(10_000) });
    const text = await response.text();
    let body: any = text;
    if ((response.headers.get('content-type') ?? '').includes('application/json')) {
      body = text ? JSON.parse(text) : null;
    }
    return { response, body };
  };
  const post = (path: string, payload: unknown, headers: Record<string,string> = {}) =>
    send(path, { method: 'POST', headers, body: JSON.stringify(payload) });
  const patch = (path: string, payload: unknown, headers: Record<string,string> = {}) =>
    send(path, { method: 'PATCH', headers, body: JSON.stringify(payload) });
  const cookie = (response: Response, name: string) => {
    const value = response.headers.getSetCookie().find(line => line.startsWith(name + '='));
    assert.ok(value, 'No se emitió cookie ' + name);
    return value.split(';')[0];
  };
  const user = () => ({ Authorization: 'Bearer ' + token });
  const admin = () => ({ Cookie: adminCookie, 'X-Admin-CSRF': adminCsrf });
  try {
    const hashed = await argon2.hash(password);
    const fixture = await prisma.user.create({ data: {
      displayName: 'Prueba soporte ' + seed, emailNormalized: email,
      authIdentities: { create: { provider: 'EMAIL', providerSubject: email, passwordHash: hashed, verifiedAt: new Date() } },
      adminRoleAssignments: { create: { role: 'SUPER_ADMIN', active: true } },
    } });
    userId = fixture.id;
    const category = await prisma.category.create({ data: { code: 'support-int-' + seed } });
    categoryId = category.id;
    const account = await prisma.businessAccount.create({ data: { name: 'Test soporte ' + seed, createdById: userId } });
    accountId = account.id;
    const business = await prisma.business.create({ data: {
      businessAccountId: accountId, createdById: userId, categoryId, slug: 'support-int-' + seed,
      name: 'Negocio soporte ' + seed, lifecycleStatus: 'ACTIVE', publicationStatus: 'PUBLISHED', visibilityStatus: 'VISIBLE',
    } });
    businessId = business.id;
    await prisma.businessMembership.create({ data: { businessId, userId, role: 'OWNER', status: 'ACTIVE' } });
    offerId = (await prisma.businessOffer.create({ data: {
      businessId, internalCode: 'SUP0001', kind: 'PRODUCT', name: 'Producto prueba',
      publicationStatus: 'PUBLISHED', active: true,
    } })).id;
    reviewId = (await prisma.businessReview.create({ data: {
      userId, businessId, rating: 4, comment: 'Opinión de prueba de integración',
    } })).id;

    await t.test('Usuarios y Business: login, refresh y /me sobre MySQL', async () => {
      const login = await post('/auth/login', { email, password, rememberMe: false });
      assert.equal(login.response.status, 200, JSON.stringify(login.body));
      token = login.body.accessToken;
      assert.ok(token);
      refreshCookie = cookie(login.response, 'wit_refresh_token');
      const refresh = await post('/auth/refresh', {}, { Cookie: refreshCookie });
      assert.equal(refresh.response.status, 200, JSON.stringify(refresh.body));
      assert.ok(refresh.body.accessToken);
      const me = await send('/auth/me', { headers: user() });
      assert.equal(me.response.status, 200);
      assert.equal(me.body.user.id, userId);
    });

    await t.test('Admin: login independiente, cookie, CSRF y sesión', async () => {
      const login = await post('/admin/auth/password', { email, password, rememberMe: false });
      assert.equal(login.response.status, 200, JSON.stringify(login.body));
      adminCookie = cookie(login.response, 'xamuko_admin_session');
      adminCsrf = login.body.csrfToken;
      assert.ok(adminCsrf);
      const session = await send('/admin/auth/session', { headers: admin() });
      assert.equal(session.response.status, 200);
      assert.equal(session.body.csrfToken, adminCsrf);
      const me = await send('/admin/me', { headers: admin() });
      assert.equal(me.response.status, 200, JSON.stringify(me.body));
      assert.equal(me.body.admin.user.id, userId);
    });

    await t.test('Necesidades: anónimo, bandeja Admin, permisos y auditoría', async () => {
      assert.equal((await post('/public/needs', { title: '', category: '' })).response.status, 400);
      const submission = await post('/public/needs', { title: 'Clases de cerámica', category: 'Formación', description: 'Busco talleres en Palmira', locationName: 'Palmira' });
      assert.equal(submission.response.status, 201, JSON.stringify(submission.body));
      const id = submission.body.request.id;
      needIds.push(id);
      assert.equal((await send('/admin/support-requests?kind=NEED')).response.status, 401);
      const list = await send('/admin/support-requests?kind=NEED', { headers: admin() });
      assert.equal(list.response.status, 200, JSON.stringify(list.body));
      assert.ok(list.body.requests.some((r: any) => r.id === id));
      assert.equal((await patch('/admin/support-requests/' + id, { status: 'RESOLVED', decisionNote: 'Revisado y cerrado correctamente.' }, { Cookie: adminCookie })).response.status, 403);
      const decision = await patch('/admin/support-requests/' + id, { status: 'RESOLVED', decisionNote: 'Necesidad evaluada y registrada.' }, admin());
      assert.equal(decision.response.status, 200, JSON.stringify(decision.body));
      assert.equal((await prisma.supportRequest.findUniqueOrThrow({ where: { id } })).status, 'RESOLVED');
      assert.ok(await prisma.auditLog.findFirst({ where: { actorUserId: userId, entityId: id, action: 'SUPPORT_REQUEST_STATUS_CHANGED' } }));
    });

    await t.test('Business: soporte y sugerencias separados, sin suplantación', async () => {
      for (const kind of ['SUPPORT', 'SUGGESTION']) {
        const result = await post('/business/support-requests', { kind, businessId, category: 'Mi negocio', title: 'Petición de prueba', description: 'Se solicita revisar este comportamiento del negocio.' }, user());
        assert.equal(result.response.status, 201, JSON.stringify(result.body));
        const list = await send('/admin/support-requests?kind=' + kind, { headers: admin() });
        assert.equal(list.response.status, 200, JSON.stringify(list.body));
        assert.ok(list.body.requests.some((r: any) => r.id === result.body.request.id));
      }
      const forged = await post('/business/support-requests', { kind: 'SUPPORT', businessId: randomUUID(), category: 'Cuenta', title: 'Acceso', description: 'Solicito acceder a otro negocio.' }, user());
      assert.equal(forged.response.status, 403);
    });

    await t.test('Reportes de negocios: formulario, bandeja y decisión', async () => {
      const sent = await post('/public/businesses/' + businessId + '/reports', { reason: 'FALSE_INFORMATION', description: 'Los datos del negocio son incorrectos.' }, user());
      assert.equal(sent.response.status, 201, JSON.stringify(sent.body));
      const id = sent.body.report.id;
      const list = await send('/admin/business-reports', { headers: admin() });
      assert.equal(list.response.status, 200, JSON.stringify(list.body));
      assert.ok(list.body.reports.some((r: any) => r.id === id));
      const decision = await patch('/admin/business-reports/' + id, { status: 'RESOLVED', decisionNote: 'Se revisó y confirmó el contenido.' }, admin());
      assert.equal(decision.response.status, 200, JSON.stringify(decision.body));
      assert.equal((await prisma.businessReport.findUniqueOrThrow({ where: { id } })).status, 'RESOLVED');
    });

    await t.test('Reportes de productos: formulario, bandeja y decisión', async () => {
      const sent = await post('/public/offers/' + offerId + '/reports', { reason: 'WRONG_IMAGE', description: 'La fotografía no coincide con el producto.' }, user());
      assert.equal(sent.response.status, 201, JSON.stringify(sent.body));
      const id = sent.body.report.id;
      const list = await send('/admin/offer-reports?kind=PRODUCT', { headers: admin() });
      assert.equal(list.response.status, 200, JSON.stringify(list.body));
      assert.ok(list.body.reports.some((r: any) => r.id === id));
      const decision = await patch('/admin/offer-reports/' + id, { status: 'RESOLVED', decisionNote: 'La fotografía ya ha sido corregida.' }, admin());
      assert.equal(decision.response.status, 200, JSON.stringify(decision.body));
      assert.equal((await prisma.offerReport.findUniqueOrThrow({ where: { id } })).status, 'RESOLVED');
    });

    await t.test('Reportes de comentarios: cookie Admin sin Bearer y decisión', async () => {
      const sent = await post('/reviews/' + reviewId + '/reports', { reason: 'FALSE_INFORMATION', description: 'Opinión de prueba que requiere atención.' }, user());
      assert.equal(sent.response.status, 201, JSON.stringify(sent.body));
      const id = sent.body.report.id;
      const list = await send('/admin/review-reports', { headers: admin() });
      assert.equal(list.response.status, 200, JSON.stringify(list.body));
      assert.ok(list.body.reports.some((r: any) => r.id === id));
      const decision = await patch('/admin/review-reports/' + id, { status: 'RESOLVED', reviewStatus: 'PUBLISHED', decisionNote: 'Contenido revisado y conservado.' }, admin());
      assert.equal(decision.response.status, 200, JSON.stringify(decision.body));
    });

    await t.test('Verificaciones: PDF Business, Admin y resolución', async () => {
      const form = new FormData();
      form.append('file', new Blob(['%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n'], { type: 'application/pdf' }), 'verificacion.pdf');
      const sent = await send('/businesses/' + businessId + '/verification', { method: 'POST', body: form, headers: user() });
      assert.equal(sent.response.status, 201, JSON.stringify(sent.body));
      const id = sent.body.verification.id;
      const list = await send('/admin/verifications', { headers: admin() });
      assert.equal(list.response.status, 200, JSON.stringify(list.body));
      assert.ok(list.body.requests.some((r: any) => r.id === id));
      const document = await send('/admin/verifications/' + id + '/document', { headers: admin() });
      assert.equal(document.response.status, 200);
      const decision = await post('/admin/verifications/' + id + '/decision', { action: 'APPROVE', nameConfirmed: true, reason: 'Documento contrastado con nombre del negocio.' }, admin());
      assert.equal(decision.response.status, 200, JSON.stringify(decision.body));
      assert.equal((await prisma.business.findUniqueOrThrow({ where: { id: businessId } })).verificationStatus, 'APPROVED');
    });

    await t.test('Cierre de sesión real de Admin y Usuarios/Business', async () => {
      const logoutAdmin = await post('/admin/auth/logout', {}, admin());
      assert.equal(logoutAdmin.response.status, 204);
      assert.equal((await send('/admin/auth/session', { headers: { Cookie: adminCookie } })).response.status, 401);
      const logoutUser = await post('/auth/logout', {}, { Cookie: refreshCookie });
      assert.equal(logoutUser.response.status, 204);
      assert.equal((await post('/auth/refresh', {}, { Cookie: refreshCookie })).response.status, 401);
    });
  } finally {
    // CI uses a disposable MySQL database, never any production records.
    if (needIds.length) await prisma.supportRequest.deleteMany({ where: { id: { in: needIds } } }).catch(() => undefined);
    if (userId) await prisma.auditLog.deleteMany({ where: { actorUserId: userId } }).catch(() => undefined);
    if (businessId) await prisma.business.delete({ where: { id: businessId } }).catch(() => undefined);
    if (accountId) await prisma.businessAccount.delete({ where: { id: accountId } }).catch(() => undefined);
    if (categoryId) await prisma.category.delete({ where: { id: categoryId } }).catch(() => undefined);
    if (userId) {
      await prisma.supportRequest.deleteMany({ where: { userId } }).catch(() => undefined);
      await prisma.adminSession.deleteMany({ where: { userId } }).catch(() => undefined);
      await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
    }
    await new Promise<void>(resolve => server.close(() => resolve()));
    await prisma.$disconnect();
  }
});
