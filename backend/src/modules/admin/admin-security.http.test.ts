import assert from 'node:assert/strict';
import argon2 from 'argon2';
import { env } from '../../config/env.js';
import test, { after, before } from 'node:test';
import { app } from '../../app.js';
import { createAdminFixture, createPendingOAuth, createActivation, createAdminSession, createWebAuthnCredential } from './admin-security.fixtures.js';
import { requireAdminSession } from './admin-session.service.js';
import { prisma } from '../../config/prisma.js';
let server: ReturnType<typeof app.listen>; let base = '';
before(async () => { server = app.listen(0); await new Promise<void>(resolve => server.once('listening', () => resolve())); const address = server.address(); if (!address || typeof address === 'string') throw new Error('No se pudo iniciar el harness HTTP.'); base = 'http://127.0.0.1:' + address.port; });
after(async () => { try { if (server.listening) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); } finally { await prisma.$disconnect(); } });
async function request(path: string, init: RequestInit = {}) { return fetch(base + path, { ...init, redirect: 'manual', headers: { accept: 'application/json', ...(init.headers ?? {}) } }); }
test('rechaza activación sin código independiente', async () => { const response = await request('/api/v1/admin/auth/passkey/activation/options'); assert.equal(response.status, 403); assert.equal((await response.json() as any).error.code, 'ADMIN_ACTIVATION_AUTH_REQUIRED'); });
test('rechaza código de activación incorrecto sin revelar el valor', async () => { const response = await request('/api/v1/admin/auth/passkey/activation/options', { headers: { 'x-admin-activation-code': 'incorrecto' } }); assert.notEqual(response.status, 200); const body = await response.text(); assert.equal(body.includes('incorrecto'), false); });
test('rechaza registro WebAuthn sin autorización temporal', async () => { const response = await request('/api/v1/admin/auth/passkey/activation/verify', { method: 'POST', body: JSON.stringify({}), headers: { 'content-type': 'application/json' } }); assert.equal(response.status, 403); });
test('rechaza JWT normal en una ruta Admin', async () => { const response = await request('/api/v1/admin/me', { headers: { authorization: 'Bearer test.jwt.token' } }); assert.equal(response.status, 401); });
test('rechaza acceso Admin sin AdminSession y sin segundo factor', async () => { const response = await request('/api/v1/admin/me'); assert.equal(response.status, 401); });

test('rechaza autorización OAuth expirada y consumida con registros reales', async () => { const fixture = await createAdminFixture(); try { for (const state of ['expired','consumed'] as const) { const pending = await createPendingOAuth(fixture.googleSub, state); const response = await request('/api/v1/admin/auth/webauthn/options', { headers: { cookie: pending.cookie, 'x-admin-activation-code': 'ci-activation-code' } }); assert.equal(response.status, 401); } } finally { await fixture.cleanup(); } });
test('rechaza sesión Admin expirada, revocada y cookie alterada', async () => { const fixture = await createAdminFixture(); try { const expired = await createAdminSession(fixture.userId, 'expired'); const revoked = await createAdminSession(fixture.userId, 'revoked'); for (const cookie of [expired.cookie, revoked.cookie, 'xamuko_admin_session=altered']) { const response = await request('/api/v1/admin/me', { headers: { cookie } }); assert.equal(response.status, 401); } } finally { await fixture.cleanup(); } });
test('el avatar administrativo no acepta acceso anónimo ni la cookie Admin en el endpoint de usuarios', async () => {
  const anonymous = await request('/api/v1/admin/auth/me/avatar');
  assert.equal(anonymous.status, 401);
  const fixture = await createAdminFixture();
  try {
    const session = await createAdminSession(fixture.userId);
    const adminAvatar = await request('/api/v1/admin/auth/me/avatar', { headers: { cookie: session.cookie } });
    assert.equal(adminAvatar.status, 404, 'La sesión es válida, pero el usuario de prueba no tiene fotografía');
    assert.equal(adminAvatar.headers.get('cache-control'), 'no-store');
    const regularAvatar = await request('/api/v1/auth/me/avatar', { headers: { cookie: session.cookie } });
    assert.equal(regularAvatar.status, 401, 'El endpoint normal conserva la exigencia del Bearer');
  } finally { await fixture.cleanup(); }
});

test('rechaza activación expirada y consumida con registros reales', async () => { const fixture = await createAdminFixture(); try { for (const state of ['expired','consumed'] as const) { const activation = await createActivation(fixture.googleSub, state); const response = await request('/api/v1/admin/auth/passkey/activation/verify', { method: 'POST', headers: { cookie: activation.cookie, 'x-admin-activation-code': 'ci-activation-code', 'content-type': 'application/json' }, body: '{}' }); assert.equal(response.status, 401); } } finally { await fixture.cleanup(); } });

test('consume autorización pendiente de forma atómica ante concurrencia', async () => { const fixture = await createAdminFixture(); try { const pending = await createPendingOAuth(fixture.googleSub); const results = await Promise.all([ (async () => (await import('../../config/prisma.js')).prisma.adminPendingOAuth.updateMany({ where: { id: pending.id, consumedAt: null }, data: { consumedAt: new Date() } }))(), (async () => (await import('../../config/prisma.js')).prisma.adminPendingOAuth.updateMany({ where: { id: pending.id, consumedAt: null }, data: { consumedAt: new Date() } }))() ]); assert.equal(results.filter(item => item.count === 1).length, 1); assert.equal(results.filter(item => item.count === 0).length, 1); } finally { await fixture.cleanup(); } });
test('CSRF exige token correcto asociado a la sesión', async () => { const fixture = await createAdminFixture(); try { const session = await createAdminSession(fixture.userId); const base = { headers: { cookie: session.cookie + '; xamuko_admin_csrf=csrf-a' }, method: 'POST', header: () => '' } as any; await assert.rejects(() => requireAdminSession(base), /CSRF/); const csrf = (await requireAdminSession({ ...base, method: 'GET' })).csrf; const valid = { headers: { cookie: session.cookie + '; xamuko_admin_csrf=csrf-a', 'x-admin-csrf': csrf }, method: 'POST', header: (name: string) => name === 'x-admin-csrf' ? csrf : '' } as any; const result = await requireAdminSession(valid); assert.equal(result.userId, fixture.userId); } finally { await fixture.cleanup(); } });
test('impide una segunda activación cuando ya existe passkey activa', async () => { const fixture = await createAdminFixture(); try { await createWebAuthnCredential(fixture.userId); const { prisma } = await import('../../config/prisma.js'); assert.equal(await prisma.adminWebAuthnCredential.count({ where: { userId: fixture.userId, revokedAt: null } }), 1); } finally { await fixture.cleanup(); } });


test('bloquea segunda activación mediante el endpoint HTTP real', async () => { const fixture = await createAdminFixture(); try { await createWebAuthnCredential(fixture.userId); const pending = await createPendingOAuth(fixture.googleSub); const response = await request('/api/v1/admin/auth/passkey/activation/options', { headers: { cookie: pending.cookie, 'x-admin-activation-code': 'ci-activation-code' } }); assert.equal(response.status, 409); assert.equal((await response.json() as any).error.code, 'ADMIN_PASSKEY_ALREADY_REGISTERED'); } finally { await fixture.cleanup(); } });

test('requiere el código también al finalizar la activación HTTP', async () => { const fixture = await createAdminFixture(); try { const pending = await createPendingOAuth(fixture.googleSub); const options = await request('/api/v1/admin/auth/passkey/activation/options', { headers: { cookie: pending.cookie, 'x-admin-activation-code': 'ci-activation-code' } }); assert.equal(options.status, 200); const activationCookie = options.headers.get('set-cookie') ?? ''; const response = await request('/api/v1/admin/auth/passkey/activation/verify', { method: 'POST', headers: { cookie: activationCookie, 'content-type': 'application/json' }, body: '{}' }); assert.equal(response.status, 403); assert.equal((await response.json() as any).error.code, 'ADMIN_ACTIVATION_AUTH_REQUIRED'); } finally { await fixture.cleanup(); } });

test('directorio de usuarios exige sesión Admin, muestra perfiles y protege la baja', async () => {
  const unauthenticated = await request('/api/v1/admin/users/overview');
  assert.equal(unauthenticated.status, 401);
  const fixture = await createAdminFixture();
  const target = await prisma.user.create({ data: { displayName: 'Usuario de integración' }, select: { id: true } });
  try {
    const session = await createAdminSession(fixture.userId);
    const headers = { cookie: session.cookie };
    const overview = await request('/api/v1/admin/users/overview', { headers });
    assert.equal(overview.status, 200);
    const counts = await overview.json() as any;
    assert.equal(counts.series.length, 12);
    assert.ok(counts.total >= 2);

    const listing = await request('/api/v1/admin/users?q=Usuario%20de%20integraci%C3%B3n', { headers });
    assert.equal(listing.status, 200);
    const listData = await listing.json() as any;
    assert.ok(listData.users.some((user: any) => user.id === target.id));

    const details = await request('/api/v1/admin/users/' + target.id, { headers });
    assert.equal(details.status, 200);
    const detail = (await details.json() as any).user;
    assert.equal(detail.deletion.allowed, true);
    assert.deepEqual(detail.businesses, []);
    assert.deepEqual(detail.administrativeRoles, []);

    const csrfResponse = await request('/api/v1/admin/auth/session', { headers });
    assert.equal(csrfResponse.status, 200);
    const csrf = (await csrfResponse.json() as any).csrfToken as string;
    const body = JSON.stringify({ confirmation: 'ELIMINAR', reason: 'Baja administrativa registrada para prueba de integridad.' });

    const noCsrf = await request('/api/v1/admin/users/' + target.id + '/deactivate', {
      method: 'POST', headers: { ...headers, origin: env.trustedOrigins[0]!, 'content-type': 'application/json' }, body,
    });
    assert.equal(noCsrf.status, 403);
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: target.id } })).status, 'ACTIVE');

    const account = await prisma.businessAccount.create({ data: { name: 'Cuenta protegida', createdById: target.id }, select: { id: true } });
    const category = await prisma.category.create({
      data: { code: 'admin-user-deletion-' + target.id }, select: { id: true },
    });
    const linkedBusiness = await prisma.business.create({
      data: { businessAccountId: account.id, createdById: target.id, categoryId: category.id,
        name: 'Negocio que bloquea la baja', slug: 'admin-user-deletion-' + target.id },
      select: { id: true },
    });
    const blocked = await request('/api/v1/admin/users/' + target.id + '/deactivate', {
      method: 'POST', headers: { ...headers, origin: env.trustedOrigins[0]!, 'x-admin-csrf': csrf, 'content-type': 'application/json' }, body,
    });
    assert.equal(blocked.status, 409, 'No debe eliminar personas con cuentas de negocio vinculadas');
    await prisma.business.delete({ where: { id: linkedBusiness.id } });
    await prisma.category.delete({ where: { id: category.id } });
    await prisma.businessAccount.delete({ where: { id: account.id } });

    const self = await request('/api/v1/admin/users/' + fixture.userId + '/deactivate', {
      method: 'POST', headers: { ...headers, origin: env.trustedOrigins[0]!, 'x-admin-csrf': csrf, 'content-type': 'application/json' }, body,
    });
    assert.equal(self.status, 403, 'El administrador no puede eliminarse a sí mismo');

    const removed = await request('/api/v1/admin/users/' + target.id + '/deactivate', {
      method: 'POST', headers: { ...headers, origin: env.trustedOrigins[0]!, 'x-admin-csrf': csrf, 'content-type': 'application/json' }, body,
    });
    assert.equal(removed.status, 200);
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: target.id } })).status, 'DELETED');
    assert.ok(await prisma.auditLog.findFirst({ where: { entityType: 'USER', entityId: target.id, action: 'ADMIN_USER_DEACTIVATED' } }));
    const repeated = await request('/api/v1/admin/users/' + target.id + '/deactivate', {
      method: 'POST', headers: { ...headers, origin: env.trustedOrigins[0]!, 'x-admin-csrf': csrf, 'content-type': 'application/json' }, body,
    });
    assert.equal(repeated.status, 409);
  } finally {
    await prisma.business.deleteMany({ where: { createdById: target.id } });
    await prisma.category.deleteMany({ where: { code: 'admin-user-deletion-' + target.id } });
    await prisma.businessAccount.deleteMany({ where: { createdById: target.id } });
    await prisma.auditLog.deleteMany({ where: { entityType: 'USER', entityId: target.id } });
    await prisma.user.delete({ where: { id: target.id } });
    await fixture.cleanup();
  }
});

test('Contenido de Admin exige permisos y devuelve directorio, filtros y evolución reales', async () => {
  const anonymous = await request('/api/v1/admin/content-insights?period=6m');
  assert.equal(anonymous.status, 401);
  const anonymousPhoto = await request('/api/v1/admin/content-photos/fotografia-privada');
  assert.equal(anonymousPhoto.status, 401);
  const fixture = await createAdminFixture();
  try {
    const session = await createAdminSession(fixture.userId);
    const headers = { cookie: session.cookie };
    const list = await request('/api/v1/admin/content?page=1&kind=PRODUCT', { headers });
    assert.equal(list.status, 200);
    const listing = await list.json() as any;
    assert.ok(Array.isArray(listing.offers));
    assert.equal(listing.pagination.page, 1);
    assert.equal(typeof listing.pagination.total, 'number');
    const response = await request('/api/v1/admin/content-insights?period=6m', { headers });
    assert.equal(response.status, 200);
    const stats = await response.json() as any;
    assert.equal(stats.series.length, 6);
    assert.equal(typeof stats.totals.products, 'number');
    assert.equal(typeof stats.totals.services, 'number');
    assert.ok(Array.isArray(stats.filters.categories));
    assert.ok(Array.isArray(stats.filters.cities));
    const missing = await request('/api/v1/admin/content/' + 'no-existe', { headers });
    assert.equal(missing.status, 404);
    const missingPhoto = await request('/api/v1/admin/content-photos/' + 'no-existe', { headers });
    assert.equal(missingPhoto.status, 404);
  } finally {
    await fixture.cleanup();
  }
});

test('evolución de negocios usa una ruta propia, requiere Admin y entrega meses reales', async () => {
  const anonymous = await request('/api/v1/admin/business-analytics?period=6m');
  assert.equal(anonymous.status, 401);
  const fixture = await createAdminFixture();
  try {
    const session = await createAdminSession(fixture.userId);
    const response = await request('/api/v1/admin/business-analytics?period=6m', {
      headers: { cookie: session.cookie },
    });
    assert.equal(response.status, 200, 'La ruta de evolución no debe resolverse como una ficha de negocio');
    const data = await response.json() as any;
    assert.equal(data.period, '6m');
    assert.equal(data.series.length, 6);
    assert.ok(Array.isArray(data.filters.cities));
    assert.ok(Array.isArray(data.filters.categories));
    assert.equal(typeof data.total, 'number');
    assert.equal(typeof data.totalUsers, 'number');
    assert.equal(typeof data.totalReviews, 'number');
    assert.ok(data.series.every((item: any) => typeof item.month === 'string' &&
      item.month.length === 7 && item.month[4] === '-' &&
      typeof item.registrations === 'number' && typeof item.cumulative === 'number'));
    // Older Admin clients must continue using the compatibility endpoint.
    const legacy = await request('/api/v1/admin/businesses/analytics?period=6m', {
      headers: { cookie: session.cookie },
    });
    assert.equal(legacy.status, 200);
  } finally {
    await fixture.cleanup();
  }
});

test('logout Admin limpia cookies aun con sesión expirada, revocada o ausente', async () => {
  const fixture = await createAdminFixture();
  try {
    for (const state of ['expired', 'revoked'] as const) {
      const session = await createAdminSession(fixture.userId, state);
      const response = await request('/api/v1/admin/auth/logout', {
        method: 'POST',
        headers: { origin: env.trustedOrigins[0]!, cookie: session.cookie },
      });
      assert.equal(response.status, 204, 'Debe poder terminar incluso con una sesión ' + state);
      const cookies = response.headers.getSetCookie();
      assert.ok(cookies.some(value => value.startsWith('xamuko_admin_session=') && /Max-Age=0/i.test(value)),
        'La cookie administrativa debe invalidarse en el navegador');
    }
    const anonymous = await request('/api/v1/admin/auth/logout', {
      method: 'POST', headers: { origin: env.trustedOrigins[0]! },
    });
    assert.equal(anonymous.status, 204, 'El logout repetido debe ser idempotente');
    assert.ok(anonymous.headers.getSetCookie().some(value => value.startsWith('xamuko_admin_session=')));
  } finally {
    await fixture.cleanup();
  }
});

test('password SUPER_ADMIN crea cookies y restaura la sesión sin OAuth ni passkey', async () => {
  const fixture = await createAdminFixture();
  const password = 'ci-only-admin-password-2026';
  try {
    await prisma.authIdentity.create({ data: { userId: fixture.userId, provider: 'EMAIL', providerSubject: fixture.email, passwordHash: await argon2.hash(password), verifiedAt: new Date() } });
    const response = await request('/api/v1/admin/auth/password', { method: 'POST', headers: { origin: env.trustedOrigins[0]!, 'content-type': 'application/json' }, body: JSON.stringify({ email: fixture.email, password }) });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const payload = await response.json() as any;
    assert.equal(payload.admin.role, 'SUPER_ADMIN');
    assert.ok(payload.csrfToken);
    const cookies = response.headers.getSetCookie();
    const sessionCookie = cookies.find(item => item.startsWith('xamuko_admin_session='))!;
    assert.ok(sessionCookie);
    assert.match(sessionCookie, /HttpOnly/i);
    assert.match(sessionCookie, /SameSite=Lax/i);
    assert.match(sessionCookie, /Path=\/api\/v1\/admin/i);
    if (env.nodeEnv === 'production') assert.match(sessionCookie, /Secure/i);
    const cookie = cookies.map(item => item.split(';')[0]).join('; ');
    const restored = await request('/api/v1/admin/auth/session', { headers: { cookie } });
    assert.equal(restored.status, 200);
    assert.equal((await restored.json() as any).csrfToken, payload.csrfToken);
    const me = await request('/api/v1/admin/me', { headers: { cookie } });
    assert.equal(me.status, 200);
    assert.equal((await me.json() as any).admin.user.id, fixture.userId);
    const csrfRejected = await request('/api/v1/admin/auth/logout', { method: 'POST', headers: { cookie } });
    assert.equal(csrfRejected.status, 403);
    const logout = await request('/api/v1/admin/auth/logout', { method: 'POST', headers: { cookie, 'x-admin-csrf': payload.csrfToken } });
    assert.equal(logout.status, 204);
    assert.equal((await request('/api/v1/admin/me', { headers: { cookie } })).status, 401);
  } finally {
    await prisma.session.deleteMany({ where: { userId: fixture.userId } });
    await fixture.cleanup();
  }
});

test('password rechaza contraseña incorrecta y cuenta sin SUPER_ADMIN sin cookie administrativa', async () => {
  const fixture = await createAdminFixture();
  const password = 'ci-only-denied-password-2026';
  try {
    await prisma.authIdentity.create({ data: { userId: fixture.userId, provider: 'EMAIL', providerSubject: fixture.email, passwordHash: await argon2.hash(password), verifiedAt: new Date() } });
    for (const supplied of ['incorrect-password', password]) {
      if (supplied === password) await prisma.adminRoleAssignment.updateMany({ where: { userId: fixture.userId }, data: { role: 'ADMIN' } });
      const response = await request('/api/v1/admin/auth/password', { method: 'POST', headers: { origin: env.trustedOrigins[0]!, 'content-type': 'application/json' }, body: JSON.stringify({ email: fixture.email, password: supplied }) });
      assert.equal(response.status, supplied === password ? 403 : 401);
      assert.equal(response.headers.getSetCookie().some(item => item.startsWith('xamuko_admin_session=')), false);
      assert.equal(await prisma.adminSession.count({ where: { userId: fixture.userId } }), 0);
    }
  } finally {
    await prisma.session.deleteMany({ where: { userId: fixture.userId } });
    await fixture.cleanup();
  }
});

test('preflight administrativo permite CSRF para origen confiable y rechaza origen ajeno', async () => {
  const allowed = await request('/api/v1/admin/auth/logout', { method: 'OPTIONS', headers: { origin: env.trustedOrigins[0]!, 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type,x-admin-csrf' } });
  assert.equal(allowed.status, 204);
  assert.equal(allowed.headers.get('access-control-allow-origin'), env.trustedOrigins[0]);
  assert.equal(allowed.headers.get('access-control-allow-credentials'), 'true');
  assert.match(allowed.headers.get('access-control-allow-headers') ?? '', /X-Admin-CSRF/i);
  const denied = await request('/api/v1/admin/auth/password', { method: 'OPTIONS', headers: { origin: 'https://untrusted.example.test', 'access-control-request-method': 'POST' } });
  assert.equal(denied.status, 403);
  assert.equal(denied.headers.get('access-control-allow-origin'), null);
});


test('dashboard statistics only expose real aggregate counts to an authenticated administrator', async () => {
  const anonymous = await request('/api/v1/admin/dashboard/stats');
  assert.equal(anonymous.status, 401);
  const fixture = await createAdminFixture();
  try {
    const session = await createAdminSession(fixture.userId);
    const response = await request('/api/v1/admin/dashboard/stats', { headers: { cookie: session.cookie } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const result = await response.json() as any;
    assert.ok(result.totals.users >= 1);
    assert.equal(typeof result.totals.businesses, 'number');
    assert.equal(typeof result.totals.businessesVerified, 'number');
    assert.equal(typeof result.totals.reviewsPublished, 'number');
    assert.equal(typeof result.totals.businessProActive, 'number');
    assert.equal(result.monthly.length, 6);
    assert.ok(result.monthly.every((month: any) => /^\d{4}-\d{2}$/.test(month.month)));
    assert.equal(result.revenue, null, 'Do not present expenses as company revenue');
    assert.equal(result.subscriptions.plus, null, 'Do not invent Plus subscriptions');
    assert.equal(Object.hasOwn(result, 'administrators'), false);
  } finally { await fixture.cleanup(); }
});


test('directorios Admin exigen sesion y exponen solo consultas paginadas autorizadas', async () => {
  const routes = [
    '/api/v1/admin/businesses?page=1&pageSize=2&status=active',
    '/api/v1/admin/businesses?page=1&pageSize=2&status=review',
    '/api/v1/admin/businesses?page=1&pageSize=2&status=inactive',
    '/api/v1/admin/categories',
    '/api/v1/admin/users?page=1',
    '/api/v1/admin/content?page=1',
  ];
  for (const path of routes) {
    const anonymous = await request(path);
    assert.equal(anonymous.status, 401, `Ruta sin sesión: ${path}`);
  }
  const fixture = await createAdminFixture();
  try {
    const admin = await createAdminSession(fixture.userId);
    const headers = { cookie: admin.cookie };
    for (const path of routes) {
      const response = await request(path, { headers });
      assert.equal(response.status, 200, `Ruta con SUPER_ADMIN: ${path}`);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      const payload = await response.json() as any;
      if (path.includes('/businesses')) {
        assert.ok(Array.isArray(payload.businesses));
        assert.equal(typeof payload.pagination.total, 'number');
      } else if (path.includes('/categories')) {
        assert.ok(Array.isArray(payload.categories));
      } else if (path.includes('/users')) {
        assert.ok(Array.isArray(payload.users));
        assert.equal(typeof payload.pagination.total, 'number');

        assert.ok(payload.users.every((u: any) => !('passwordHash' in u) && !('authIdentities' in u)));
      } else {
        assert.ok(Array.isArray(payload.offers));
        assert.equal(typeof payload.pagination.total, 'number');
      }
    }
    const filteredUsers = await request(`/api/v1/admin/users?q=${encodeURIComponent(fixture.email)}&page=1`, { headers });
    assert.equal(filteredUsers.status, 200);
    const filteredPayload = await filteredUsers.json() as any;
    assert.ok(filteredPayload.users.some((u: any) => u.id === fixture.userId));
    const nonexistentBusiness = await request(`/api/v1/admin/businesses/${fixture.userId}`, { headers });
    assert.equal(nonexistentBusiness.status, 404);
  } finally { await fixture.cleanup(); }
});
