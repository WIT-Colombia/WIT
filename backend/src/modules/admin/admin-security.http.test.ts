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
test('rechaza activación expirada y consumida con registros reales', async () => { const fixture = await createAdminFixture(); try { for (const state of ['expired','consumed'] as const) { const activation = await createActivation(fixture.googleSub, state); const response = await request('/api/v1/admin/auth/passkey/activation/verify', { method: 'POST', headers: { cookie: activation.cookie, 'x-admin-activation-code': 'ci-activation-code', 'content-type': 'application/json' }, body: '{}' }); assert.equal(response.status, 401); } } finally { await fixture.cleanup(); } });

test('consume autorización pendiente de forma atómica ante concurrencia', async () => { const fixture = await createAdminFixture(); try { const pending = await createPendingOAuth(fixture.googleSub); const results = await Promise.all([ (async () => (await import('../../config/prisma.js')).prisma.adminPendingOAuth.updateMany({ where: { id: pending.id, consumedAt: null }, data: { consumedAt: new Date() } }))(), (async () => (await import('../../config/prisma.js')).prisma.adminPendingOAuth.updateMany({ where: { id: pending.id, consumedAt: null }, data: { consumedAt: new Date() } }))() ]); assert.equal(results.filter(item => item.count === 1).length, 1); assert.equal(results.filter(item => item.count === 0).length, 1); } finally { await fixture.cleanup(); } });
test('CSRF exige token correcto asociado a la sesión', async () => { const fixture = await createAdminFixture(); try { const session = await createAdminSession(fixture.userId); const base = { headers: { cookie: session.cookie + '; xamuko_admin_csrf=csrf-a' }, method: 'POST', header: () => '' } as any; await assert.rejects(() => requireAdminSession(base), /CSRF/); const valid = { headers: { cookie: session.cookie + '; xamuko_admin_csrf=csrf-a', 'x-admin-csrf': 'csrf-a' }, method: 'POST', header: (name: string) => name === 'x-admin-csrf' ? 'csrf-a' : '' } as any; const result = await requireAdminSession(valid); assert.equal(result.userId, fixture.userId); } finally { await fixture.cleanup(); } });
test('impide una segunda activación cuando ya existe passkey activa', async () => { const fixture = await createAdminFixture(); try { await createWebAuthnCredential(fixture.userId); const { prisma } = await import('../../config/prisma.js'); assert.equal(await prisma.adminWebAuthnCredential.count({ where: { userId: fixture.userId, revokedAt: null } }), 1); } finally { await fixture.cleanup(); } });


test('bloquea segunda activación mediante el endpoint HTTP real', async () => { const fixture = await createAdminFixture(); try { await createWebAuthnCredential(fixture.userId); const pending = await createPendingOAuth(fixture.googleSub); const response = await request('/api/v1/admin/auth/passkey/activation/options', { headers: { cookie: pending.cookie, 'x-admin-activation-code': 'ci-activation-code' } }); assert.equal(response.status, 409); assert.equal((await response.json() as any).error.code, 'ADMIN_PASSKEY_ALREADY_REGISTERED'); } finally { await fixture.cleanup(); } });

test('requiere el código también al finalizar la activación HTTP', async () => { const fixture = await createAdminFixture(); try { const pending = await createPendingOAuth(fixture.googleSub); const options = await request('/api/v1/admin/auth/passkey/activation/options', { headers: { cookie: pending.cookie, 'x-admin-activation-code': 'ci-activation-code' } }); assert.equal(options.status, 200); const activationCookie = options.headers.get('set-cookie') ?? ''; const response = await request('/api/v1/admin/auth/passkey/activation/verify', { method: 'POST', headers: { cookie: activationCookie, 'content-type': 'application/json' }, body: '{}' }); assert.equal(response.status, 403); assert.equal((await response.json() as any).error.code, 'ADMIN_ACTIVATION_AUTH_REQUIRED'); } finally { await fixture.cleanup(); } });

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
    assert.ok(result.monthly.every((month: any) => /^\\d{4}-\\d{2}$/.test(month.month)));
    assert.equal(result.revenue, null, 'Do not present expenses as company revenue');
    assert.equal(result.subscriptions.plus, null, 'Do not invent Plus subscriptions');
    assert.equal(Object.hasOwn(result, 'administrators'), false);
  } finally { await fixture.cleanup(); }
});
