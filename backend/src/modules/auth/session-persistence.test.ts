import test from 'node:test';
import { createRequire } from 'node:module';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import argon2 from 'argon2';
import { SignJWT } from 'jose';
import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { issueSession, login, logout, refresh } from './auth.service.js';
import { verifyAccessToken, createAccessToken } from '../../shared/auth/tokens.js';
import { setRefreshCookie } from '../../shared/auth/refresh-cookie.js';
import { issueAdminSession, requireAdminSession, revokeAdminSession } from '../admin/admin-session.service.js';
import { requireAuth } from '../../shared/middleware/require-auth.js';
import { app } from '../../app.js';

test('session persistence (mock database; no real users)', async t => {
  const undo: Array<() => void> = [];
  const stub = (model: any, method: string, fn: any) => { const original = model[method]; model[method] = fn; undo.push(() => { model[method] = original; }); };
  const sessions = new Map<string, any>(), admins = new Map<string, any>();
  let offline = false;
  const user = { id: 'fixture', status: 'ACTIVE', displayName: 'Fixture', avatarUrl: null, authIdentities: [{ provider: 'EMAIL', verifiedAt: new Date() }] };
  const find = (map: Map<string, any>, where: any) => [...map.values()].find(x => where.id ? x.id === where.id : x.tokenHash === where.tokenHash);
  for (const [model, rows] of [[prisma.session, sessions], [prisma.adminSession, admins]] as const) {
    stub(model, 'create', async ({ data }: any) => { const row = { ...data, id: `s${rows.size}`, revokedAt: null, createdAt: new Date() }; rows.set(row.id, row); return row; });
    stub(model, 'findUnique', async ({ where }: any) => { if (offline) throw new Error('temporary database outage'); const row = find(rows, where); return row ? { ...row, user } : null; });
    stub(model, 'updateMany', async ({ where, data }: any) => { const row = find(rows, where); if (!row || row.revokedAt || (where.expiresAt && row.expiresAt <= where.expiresAt.gt)) return { count: 0 }; Object.assign(row, data); return { count: 1 }; });
  }
  stub(prisma.user, 'findUnique', async () => user); stub(prisma.user, 'update', async () => user);
  stub(prisma.authIdentity, 'findMany', async () => [{ verifiedAt: new Date() }]);
  const passwordHash = await argon2.hash('fixture-password');
  stub(prisma.authIdentity, 'findUnique', async () => ({ passwordHash, verifiedAt: new Date(), user }));
  stub(prisma.adminRoleAssignment, 'findMany', async () => [{ role: 'SUPER_ADMIN' }]);
  stub(prisma.adminPermissionGrant, 'findMany', async () => []); stub(prisma.financialPermissionGrant, 'findMany', async () => []);
  const request = (raw: string, method = 'GET', csrf = '') => ({ headers: { cookie: `xamuko_admin_session=${raw}` }, method, originalUrl: '/api/v1/admin/auth/logout', header: () => csrf }) as any;
  const response = () => { const cookies: string[] = []; return { cookies, appendHeader: (_: string, value: string) => cookies.push(value) } as any; };
  try {
    let credential = '';
    await t.test('login, short access token and persistent expiry >=15 days', async () => {
      const result = await login({ email: 'fixture@example.test', password: 'fixture-password', rememberMe: true }); credential = result.refreshToken;
      const claims = await verifyAccessToken(result.accessToken);
      assert.ok(sessions.get(claims.sessionId).expiresAt.getTime() - Date.now() >= 15 * 86400000 - 1000);
      const payload = JSON.parse(Buffer.from(result.accessToken.split('.')[1]!, 'base64url').toString()); assert.equal(payload.exp - payload.iat, env.accessTokenTtlSeconds);
    });
    await t.test('30 reload refreshes and 20 concurrent tabs preserve session and access tokens', async () => {
      const results = []; for (let i = 0; i < 30; i++) results.push(await refresh(credential));
      results.push(...await Promise.all(Array.from({ length: 20 }, () => refresh(credential))));
      assert.equal(sessions.size, 1);
      for (const result of results) assert.equal(sessions.get((await verifyAccessToken(result.accessToken)).sessionId).revokedAt, null);
    });
    await t.test('persistent HttpOnly cookie vs browser-session cookie and 8-hour server expiry', async () => {
      for (const persistent of [false, true]) { const res = response(); setRefreshCookie(res, credential, persistent); assert.match(res.cookies[0], /HttpOnly/i); assert.match(res.cookies[0], /Path=\/api\/v1\/auth/i); assert.equal(/Max-Age=/i.test(res.cookies[0]), persistent); }
      const short = await issueSession(user.id); assert.ok(sessions.get((await verifyAccessToken(short.accessToken)).sessionId).expiresAt.getTime() - Date.now() <= 8 * 3600000);
    });
    await t.test('temporary DB outage is not 401; recovery keeps session', async () => {
      offline = true; await assert.rejects(refresh(credential), /temporary database outage/);
      const access = await createAccessToken({ userId: user.id, sessionId: 's0' }); let error: any;
      await requireAuth({ header: () => `Bearer ${access}` } as any, {} as any, value => { error = value; }); assert.equal(error.statusCode, undefined);
      offline = false; assert.ok((await refresh(credential)).accessToken);
    });
    await t.test('expired access token is rejected and renewed against the valid session', async () => {
      const claims = await verifyAccessToken((await refresh(credential)).accessToken);
      const expired = await new SignJWT({ sid: claims.sessionId }).setProtectedHeader({ alg: 'HS256' }).setSubject(user.id).setExpirationTime(Math.floor(Date.now() / 1000) - 1).sign(new TextEncoder().encode(env.accessTokenSecret));
      let error: any; await requireAuth({ header: () => `Bearer ${expired}` } as any, {} as any, value => { error = value; });
      assert.equal(error.statusCode, 401); await verifyAccessToken((await refresh(credential)).accessToken);
    });
    await t.test('revocation rejects old refresh credential and existing access token', async () => {
      const access = (await refresh(credential)).accessToken; await logout(credential); await assert.rejects(refresh(credential), /no es válido/);
      let error: any; await requireAuth({ header: () => `Bearer ${access}` } as any, {} as any, value => { error = value; }); assert.equal(error.statusCode, 401);
    });
    await t.test('Admin: 15 days, 30 restores, session-bound CSRF, sensitive reauth and revocation', async () => {
      const res = response(); const csrf = await issueAdminSession(res, user.id, true); const raw = res.cookies[0].split(';')[0].split('=')[1];
      assert.match(res.cookies[0], /Max-Age=1296000/); assert.ok([...admins.values()][0].expiresAt.getTime() - Date.now() >= 15 * 86400000 - 1000);
      for (let i = 0; i < 30; i++) assert.equal((await requireAdminSession(request(raw))).csrf, csrf);
      await assert.rejects(requireAdminSession(request(raw, 'POST', 'forged')), /CSRF/); await requireAdminSession(request(raw, 'POST', csrf));
      const another = response(); const otherCsrf = await issueAdminSession(another, user.id, false); assert.doesNotMatch(another.cookies[0], /Max-Age=/);
      await assert.rejects(requireAdminSession(request(raw, 'POST', otherCsrf)), /CSRF/);
      [...admins.values()][0].createdAt = new Date(Date.now() - 16 * 60000);
      await assert.rejects(requireAdminSession({ ...request(raw, 'POST', csrf), originalUrl: '/api/v1/admin/administrators' }), /Confirma de nuevo/);
      await revokeAdminSession(request(raw, 'POST', csrf), response()); await assert.rejects(requireAdminSession(request(raw)), /no es válida/);
    });
    await t.test('HTTP: 30 refreshes do not exhaust login rate limit or rewrite cookies', async () => {
      const session = await issueSession(user.id, undefined, true); const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
      const address = server.address() as any;
      try { for (let i = 0; i < 30; i++) { const res = await fetch(`http://127.0.0.1:${address.port}/api/v1/auth/refresh`, { method: 'POST', headers: { cookie: `wit_refresh_token=${session.refreshToken}`, 'content-type': 'application/json' }, body: '{}' }); assert.equal(res.status, 200); assert.equal(res.headers.get('set-cookie'), null); } } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
    });
    await t.test('Chromium: three real apps, 30 reloads, tabs, offline recovery and browser restart', { skip: process.env.SESSION_BROWSER_TEST !== '1' }, async () => {
      const frontendRequire = createRequire(new URL('../../../../frontend/package.json', import.meta.url));
      const { chromium } = frontendRequire('playwright');
      const { createServer } = frontendRequire('vite');
      const backendServer = app.listen(0, '127.0.0.1');
      await new Promise<void>(resolve => backendServer.once('listening', resolve));
      const backendPort = (backendServer.address() as any).port;
      try {
        for (const application of ['usuario', 'negocios', 'admin']) {
          t.diagnostic('Chromium app: ' + application);
          const root = new URL(`../../../../frontend/apps/${application}/`, import.meta.url).pathname;
          const vite = await createServer({ root, server: { host: '127.0.0.1', port: 0, strictPort: false, proxy: { '/api/v1': { target: `http://127.0.0.1:${backendPort}`, changeOrigin: false } } } });
          await vite.listen();
          const url = `http://127.0.0.1:${vite.httpServer.address().port}`;
          env.trustedOrigins.push(url);
          const profile = await mkdtemp(join(tmpdir(), `wit-session-${application}-`));
          const launch = async () => {
            const browserContext = await chromium.launchPersistentContext(profile, { headless: true });
            await browserContext.route('**/api/v1/**', (route: any) => {
              const path = new URL(route.request().url()).pathname;
              if (/^\/api\/v1\/(auth\/(login|refresh|me|logout)|admin\/(auth\/(password|session)|me))$/.test(path)) return route.continue();
              return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { code: 'FIXTURE_AUTH_ONLY', message: 'Authentication-only harness' } }) });
            });
            return browserContext;
          };
          let context = await launch();
          const endpoint = application === 'admin' ? '/admin/auth/session' : '/auth/refresh';
          const open = async () => {
            const page = await context.newPage();
            const restored = page.waitForResponse((res: any) => res.url().endsWith(endpoint), { timeout: 20000 });
            await page.goto(url); assert.equal((await restored).status(), 200); return page;
          };
          try {
            const loginResponse = await context.request.post(`${url}/api/v1${application === 'admin' ? '/admin/auth/password' : '/auth/login'}`, { data: { email: 'fixture@example.test', password: 'fixture-password', rememberMe: true } });
            assert.equal(loginResponse.status(), 200);
            const page = await open();
            for (let i = 0; i < 30; i++) { const restored = page.waitForResponse((res: any) => res.url().endsWith(endpoint)); await page.reload(); assert.equal((await restored).status(), 200); }
            await Promise.all([open(), open(), open()]);
            await context.setOffline(true);
            const disconnected = await page.evaluate(async () => { try { await fetch('/api/v1/auth/refresh', { method: 'POST' }); return false; } catch { return true; } });
            assert.equal(disconnected, true); await context.setOffline(false); await open();
            await context.close();
            context = await launch();
            await open();
            assert.ok((await context.cookies()).some((cookie: any) => cookie.httpOnly && cookie.expires > Date.now() / 1000 + 14 * 86400));
            const nonPersistent = await context.request.post(`${url}/api/v1${application === 'admin' ? '/admin/auth/password' : '/auth/login'}`, { data: { email: 'fixture@example.test', password: 'fixture-password', rememberMe: false } });
            assert.equal(nonPersistent.status(), 200);
            const cookieName = application === 'admin' ? 'xamuko_admin_session' : 'wit_refresh_token';
            assert.equal((await context.cookies()).find((cookie: any) => cookie.name === cookieName).expires, -1);
            await context.close(); context = await launch();
            assert.equal((await context.cookies()).some((cookie: any) => cookie.name === cookieName), false);
          } finally { await context.close(); await vite.close(); }
        }
      } finally { await new Promise<void>(resolve => backendServer.close(() => resolve())); }
    });
  } finally { undo.reverse().forEach(fn => fn()); await prisma.$disconnect(); }
});
