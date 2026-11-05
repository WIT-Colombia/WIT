// Opt-in integration checks. Never use DATABASE_URL or an existing/project server by default.
import assert from 'node:assert/strict';
import test, { before, after } from 'node:test';
import { randomBytes, createHash } from 'node:crypto';
import { readFileSync, realpathSync, existsSync } from 'node:fs';
import { resolve, dirname, basename, extname } from 'node:path';
import { createRequire } from 'node:module';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';

const database = new URL(process.env.XAMUKO_ISOLATED_DATABASE_URL || 'invalid:');
const datadir = realpathSync(process.env.XAMUKO_ISOLATED_MYSQL_DATADIR || '/missing-isolation-marker');
assert.equal(database.protocol, 'mysql:');
assert.equal(database.hostname, '127.0.0.1');
assert.match(database.pathname, /^\/xamuko_joint_[a-z0-9]+$/);
assert.match(basename(dirname(datadir)), /^xamuko-joint-/);
assert.equal(basename(datadir), 'data');
assert.equal(readFileSync(resolve(datadir, '.xamuko-isolated-password-reset'), 'utf8'), database.pathname.slice(1));
Object.assign(process.env, {
  DATABASE_URL: database.href, NODE_ENV: 'development', EMAIL_MODE: 'development',
  AUTH_ACCESS_TOKEN_SECRET: 'joint-test-only-not-production-0123456789',
  RESEND_API_KEY: '', EMAIL_API_KEY: '',
  AUTH_TRUSTED_ORIGINS: 'https://user.xamuko.com,https://business.xamuko.com,https://admin.xamuko.com',
  PASSWORD_RESET_URL: 'https://user.xamuko.com/reset-password',
  GOOGLE_CLIENT_ID: 'synthetic.apps.googleusercontent.com', GOOGLE_CLIENT_SECRET: 'synthetic-only',
});
const { prisma } = await import('../dist/config/prisma.js');
const { app } = await import('../dist/app.js');
const { consumePasswordResetToken, lockActivePasswordResetUser, finishPasswordReset } = await import('../dist/modules/auth/password-reset.js');
const { resetPassword } = await import('../dist/modules/auth/auth-token.service.js');
const { issueSession, issuePasswordResetSession, getCurrentUser } = await import('../dist/modules/auth/auth.service.js');
const { getDevelopmentEmailMessages } = await import('../dist/shared/email/development-email-sender.js');
const argon2 = (await import('argon2')).default;
const oldPassword = 'synthetic-old-password-123';
const newPassword = 'synthetic-new-password-456';
let oldHash, newHash, server, api;
const ids = [];
before(async () => {
  const [identity] = await prisma.$queryRaw`SELECT @@datadir AS datadir, @@port AS port, DATABASE() AS db, VERSION() AS version`;
  assert.equal(realpathSync(identity.datadir), datadir);
  assert.equal(Number(identity.port), Number(database.port)); assert.equal(identity.db, database.pathname.slice(1));
  console.log(`Isolated integration server: MySQL ${identity.version}; dedicated datadir verified`);
  oldHash = await argon2.hash(oldPassword); newHash = await argon2.hash(newPassword);
  server = app.listen(0, '127.0.0.1'); await once(server, 'listening'); api = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  // Fixtures belong only to the marker-validated disposable schema. Server lifecycle is external.
  if (ids.length) await prisma.user.deleteMany({ where: { id: { in: ids } } });
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  await prisma.$disconnect();
});
async function account(status = 'ACTIVE', admin = false) {
  const tag = randomBytes(8).toString('hex');
  const user = await prisma.user.create({ data: { publicId: `joint-${tag}`, displayName: 'Synthetic integration account', emailNormalized: `${tag}@example.test`, nickname: `joint_${tag}`, status,
    authIdentities: { create: { provider: 'EMAIL', providerSubject: `${tag}@example.test`, passwordHash: oldHash, verifiedAt: new Date() } },
    ...(admin ? { adminRoleAssignments: { create: { role: 'SUPER_ADMIN' } } } : {}),
  } }); ids.push(user.id); return user;
}
async function tokenFor(user, options = {}) {
  const token = randomBytes(48).toString('base64url');
  const record = await prisma.authToken.create({ data: { userId: user.id, type: options.type || 'PASSWORD_RESET', tokenHash: createHash('sha256').update(token).digest('hex'), expiresAt: new Date(Date.now() + (options.expiry ?? 60_000)), ...(options.consumed ? { consumedAt: new Date() } : {}) } });
  return { token, record };
}
async function unchanged(user, record) {
  const identity = await prisma.authIdentity.findFirst({ where: { userId: user.id } });
  assert.equal(identity.passwordHash, oldHash);
  const current = await prisma.authToken.findUnique({ where: { id: record.id } });
  assert.equal(current.consumedAt?.getTime() ?? null, record.consumedAt?.getTime() ?? null);
  assert.equal(await prisma.session.count({ where: { userId: user.id } }), 0);
}
async function post(path, body, extra = {}) {
  return fetch(`${api}/api/v1${path}`, { method: 'POST', headers: { Origin: 'https://user.xamuko.com', 'Content-Type': 'application/json', ...extra }, body: JSON.stringify(body) });
}
async function waitingOnUser() {
  for (let i = 0; i < 100; i++) {
    const [row] = await prisma.$queryRaw`SELECT COUNT(*) AS n FROM performance_schema.data_lock_waits w JOIN performance_schema.data_locks l ON l.ENGINE_LOCK_ID = w.REQUESTING_ENGINE_LOCK_ID WHERE l.OBJECT_SCHEMA = DATABASE() AND l.OBJECT_NAME = 'User'`;
    if (Number(row.n) > 0) return;
    await delay(20);
  }
  assert.fail('Expected a real InnoDB row-lock wait, not a timed approximation');
}
async function withHeldUser(user, work) {
  let release, acquired; const ready = new Promise(resolve => { acquired = resolve; }); const gate = new Promise(resolve => { release = resolve; });
  const holder = prisma.$transaction(async tx => { await tx.$queryRaw`SELECT id FROM User WHERE id = ${user.id} FOR UPDATE`; acquired(); await gate; }, { timeout: 10_000 });
  await ready;
  try { await work(() => release()); } finally { release(); await holder; }
}
test('HTTP active reset: full contract, cookie, new password, revocation and replay', async () => {
  const user = await account(); const previous = await issueSession(user.id); const { token } = await tokenFor(user);
  const response = await post('/auth/password-reset/confirm', { token, password: newPassword, rememberMe: false });
  assert.equal(response.status, 200); const body = await response.json(); assert.equal(body.user.id, user.id); assert(body.accessToken);
  const cookie = response.headers.get('set-cookie'); assert.match(cookie, /HttpOnly/i); assert.match(cookie, /Path=\/api\/v1\/auth/i);
  const me = await fetch(`${api}/api/v1/auth/me`, { headers: { Authorization: `Bearer ${body.accessToken}` } }); assert.equal(me.status, 200);
  const revoked = await fetch(`${api}/api/v1/auth/me`, { headers: { Authorization: `Bearer ${previous.accessToken}` } }); assert.equal(revoked.status, 401);
  const refresh = await post('/auth/refresh', {}, { Cookie: cookie.split(';')[0] }); assert.equal(refresh.status, 200); const refreshed = await refresh.json();
  const replay = await post('/auth/password-reset/confirm', { token, password: oldPassword }); assert.equal(replay.status, 400);
  const identity = await prisma.authIdentity.findFirst({ where: { userId: user.id } }); assert(await argon2.verify(identity.passwordHash, newPassword));
  const admin = await fetch(`${api}/api/v1/admin/me`, { headers: { Authorization: `Bearer ${refreshed.accessToken}` } }); assert.equal(admin.status, 403);
  await prisma.user.update({ where: { id: user.id }, data: { status: 'SUSPENDED' } });
  const suspendedMe = await fetch(`${api}/api/v1/auth/me`, { headers: { Authorization: `Bearer ${refreshed.accessToken}` } }); assert.equal(suspendedMe.status, 401);
  const suspendedRefresh = await post('/auth/refresh', {}, { Cookie: refresh.headers.get('set-cookie').split(';')[0] }); assert.equal(suspendedRefresh.status, 401);
});
for (const status of ['SUSPENDED', 'DELETED']) test(`HTTP ${status}: no credential mutation, consumption or new session`, async () => {
  const user = await account(status); const { token, record } = await tokenFor(user);
  const response = await post('/auth/password-reset/confirm', { token, password: newPassword }); assert.equal(response.status, 400); assert.equal((await response.json()).error.code, 'INVALID_AUTH_TOKEN');
  await unchanged(user, record);
});
for (const [name, options] of [['expired', { expiry: -1000 }], ['reused', { consumed: true }], ['wrong purpose', { type: 'EMAIL_VERIFICATION' }]]) test(`real DB rejects ${name} token`, async () => {
  const user = await account(); const { token, record } = await tokenFor(user, options);
  await assert.rejects(resetPassword(token, newHash), { code: 'INVALID_AUTH_TOKEN' }); await unchanged(user, record);
});
test('real concurrent transactions permit exactly one reset with the same token', async () => {
  const user = await account(); const { token } = await tokenFor(user);
  const results = await Promise.allSettled([resetPassword(token, newHash), resetPassword(token, newHash)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(results.filter(r => r.status === 'rejected').length, 1);
  assert.equal(results.find(r => r.status === 'rejected').reason.code, 'INVALID_AUTH_TOKEN');
});
test('suspension committed while reset waits for User lock prevents reset', async () => {
  const user = await account(); const { token, record } = await tokenFor(user);
  let outcome;
  // Holder changes status before releasing; reset's locking read must see that committed value.
  let release, acquired; const ready = new Promise(resolve => { acquired = resolve; }); const gate = new Promise(resolve => { release = resolve; });
  const holder = prisma.$transaction(async tx => { await tx.user.update({ where: { id: user.id }, data: { status: 'SUSPENDED' } }); acquired(); await gate; }, { timeout: 10_000 });
  await ready;
  const pending = resetPassword(token, newHash).then(value => ({ value }), error => ({ error }));
  try { await waitingOnUser(); } finally { release(); await holder; outcome = await pending; }
  assert.equal(outcome.error?.code, 'INVALID_AUTH_TOKEN'); await unchanged(user, record);
});
test('expiry during an observed InnoDB lock wait is rejected', async () => {
  const user = await account(); const { token, record } = await tokenFor(user, { expiry: 400 }); let result;
  await withHeldUser(user, async release => { const pending = resetPassword(token, newHash).then(value => ({ value }), error => ({ error })); await waitingOnUser(); await delay(500); release(); result = await pending; });
  assert.equal(result.error?.code, 'INVALID_AUTH_TOKEN'); await unchanged(user, record);
});
test('real transaction rolls back identity and token if revocation fails', async () => {
  const user = await account(); const { token, record } = await tokenFor(user);
  await assert.rejects(prisma.$transaction(tx => consumePasswordResetToken(new Proxy(tx, { get(target, property) { if (property === 'session') return { updateMany: async () => { throw new Error('injected revocation failure'); } }; const value = target[property]; return typeof value === 'function' ? value.bind(target) : value; } }), token, newHash)), /injected revocation/);
  await unchanged(user, record);
});
test('suspension after reset prevents optional real session issuance', async () => {
  const user = await account(); const { token } = await tokenFor(user); await resetPassword(token, newHash);
  await prisma.user.update({ where: { id: user.id }, data: { status: 'SUSPENDED' } });
  const result = await finishPasswordReset(user.id, async () => ({ id: user.id }), () => issuePasswordResetSession(user.id));
  assert.deepEqual(result, { user: { id: user.id }, session: null }); assert.equal(await prisma.session.count({ where: { userId: user.id } }), 0);
});
test('HTTP post-commit profile failure returns success without access and clears cookie', async () => {
  const user = await account(); const { token } = await tokenFor(user); const find = prisma.user.findUnique;
  prisma.user.findUnique = async args => { if (args.where.id === user.id) throw new Error('injected post-commit profile failure'); return find.call(prisma.user, args); };
  let response; try { response = await post('/auth/password-reset/confirm', { token, password: newPassword }); } finally { prisma.user.findUnique = find; }
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { user: { id: user.id }, autoLogin: false }); assert.match(response.headers.get('set-cookie'), /Max-Age=0/i);
  assert.equal(await prisma.session.count({ where: { userId: user.id } }), 0);
  const identity = await prisma.authIdentity.findFirst({ where: { userId: user.id } }); assert(await argon2.verify(identity.passwordHash, newPassword));
});

const frontendRoot = process.env.XAMUKO_JOINT_FRONTEND_ROOT;
if (frontendRoot) {
  const { chromium } = createRequire(resolve(frontendRoot, 'package.json'))('playwright');
  async function browserFor(host, appName) {
    const browser = await chromium.launch({ headless: true }); const context = await browser.newContext({ serviceWorkers: 'block' }); context.setDefaultTimeout(8000);
    const errors = []; const calls = [];
    await context.route('**/*', async route => {
      const request = route.request(); const url = new URL(request.url());
      if (url.hostname !== host) return route.abort();
      if (url.pathname.startsWith('/api/v1/')) { calls.push(['start', url.pathname, Boolean(request.headers().cookie)]); const headers = { ...request.headers(), origin: url.origin }; delete headers.host; const response = await route.fetch({ url: api + url.pathname + url.search, headers });
        // route.fetch stores host-only cookies on the loopback API origin. Map the
        // real Set-Cookie attributes back to the intercepted app origin, as a proxy would.
        for (const header of response.headersArray().filter(item => item.name.toLowerCase() === 'set-cookie')) {
          const [pair, ...attributes] = header.value.split(';'); const split = pair.indexOf('=');
          const properties = Object.fromEntries(attributes.map(item => { const parts = item.trim().split('='); return [parts[0].toLowerCase(), parts.slice(1).join('=')]; }));
          await context.addCookies([{ name: pair.slice(0, split), value: pair.slice(split + 1), domain: url.hostname,
            path: properties.path || '/', httpOnly: 'httponly' in properties, secure: 'secure' in properties,
            sameSite: properties.samesite ? properties.samesite[0].toUpperCase() + properties.samesite.slice(1).toLowerCase() : 'Lax',
            ...('max-age' in properties ? { expires: Number(properties['max-age']) === 0 ? 1 : Date.now() / 1000 + Number(properties['max-age']) } : {}),
          }]);
        }
        calls.push([url.pathname, response.status(), Boolean(request.headers().cookie)]); return route.fulfill({ response }); }
      const dist = resolve(frontendRoot, 'apps', appName, 'dist'); const path = request.isNavigationRequest() ? resolve(dist, 'index.html') : resolve(dist, `.${url.pathname}`);
      if (!path.startsWith(dist + '/') || !existsSync(path)) return route.fulfill({ status: 404, body: '' });
      const contentType = { '.js': 'application/javascript', '.html': 'text/html', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' }[extname(path)] || 'application/octet-stream';
      return route.fulfill({ contentType, body: readFileSync(path) });
    });
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    return { browser, context, page, errors, calls };
  }
  for (const [label, host, requestPath, changePath] of [
    ['Usuario', 'user.xamuko.com', '/recover-password', '/change-password'],
    ['Business', 'business.xamuko.com', '/recuperar?mode=email', '/recuperar'],
    ['Admin', 'admin.xamuko.com', '/recover-password', '/change-password'],
  ]) test(`PR8 ${label} + PR9 real API: recovery email, login, change, refresh and logout`, async () => {
    const user = await account('ACTIVE', label === 'Admin');
    const appName = { Usuario: 'usuario', Business: 'negocios', Admin: 'admin' }[label];
    const { browser, context, page, errors, calls } = await browserFor(host, appName);
    try {
      await page.goto(`https://${host}${requestPath}`); await page.locator('input[type=email]').fill(user.emailNormalized); await page.getByRole('button', { name: /Enviar enlace de recuperación/ }).click(); await page.getByText(/Si la cuenta existe y puede recuperar/).waitFor();
      const mail = [...getDevelopmentEmailMessages()].reverse().find(message => message.to === user.emailNormalized && message.eventType === 'password_reset'); assert(mail);
      const match = mail.text.match(/token=([A-Za-z0-9_-]+)/); assert(match); const rawToken = match[1];
      // All apps currently use the common User email destination; exercise that screen separately below.
      const loginPath = label === 'Usuario' ? '/register?mode=login&next=/profile' : '/login';
      await page.goto(`https://${host}${loginPath}`); await page.locator('input[type=email]').fill(user.emailNormalized); await page.locator('input[type=password]').first().fill(oldPassword); await page.locator('form').getByRole('button', { name: /^Iniciar sesión/ }).click();
      await page.waitForURL(label === 'Usuario' ? '**/profile' : label === 'Business' ? '**/mis-negocios' : '**/dashboard');
      if (label !== 'Business') await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).first().waitFor();
      else await page.getByRole('heading').first().waitFor();
      await page.goto(`https://${host}${changePath}`); const fields = page.locator('input[type=password]'); await fields.nth(0).fill(oldPassword); await fields.nth(1).fill(newPassword); await fields.nth(2).fill(newPassword); await page.getByRole('button', { name: 'Guardar nueva contraseña', exact: true }).click(); await page.getByText(/Contraseña actualizada|contraseña se actualizó|actualizada correctamente/).first().waitFor();
      const identity = await prisma.authIdentity.findFirst({ where: { userId: user.id } }); assert(await argon2.verify(identity.passwordHash, newPassword));
      // Capture raw token only in memory; never print it or copy it into test reports.
      assert.equal(rawToken.length, 64);
      await page.goto(`https://${host}${label === 'Usuario' ? '/profile' : label === 'Business' ? '/perfil' : '/settings'}`);
      await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).first().click();
      if (label === 'Admin') await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).last().click(); else await page.getByRole('button', { name: 'Sí, cerrar' }).click();
      await page.waitForURL(label === 'Usuario' ? '**/home' : '**/login*');
      assert.deepEqual(errors, []);
      if (label === 'Admin') assert(calls.filter(c => c[0] === '/api/v1/auth/refresh').every(c => c[1] === 200));
    } catch (error) { console.log('Isolated browser diagnostic', label, new URL(page.url()).pathname, calls); throw error; } finally { await context.close(); await browser.close(); }
  });
  for (const [appName, host, path] of [['usuario', 'user.xamuko.com', '/reset-password'], ['negocios', 'business.xamuko.com', '/recuperar']]) {
    for (const fallback of [false, true]) test(`PR8 ${appName} accepts PR9 real reset ${fallback ? 'minimal success without session' : 'success with automatic session'}`, async () => {
      const user = await account(); const { token } = await tokenFor(user);
      const { browser, context, page, errors } = await browserFor(host, appName);
      const find = prisma.user.findUnique;
      try {
        await page.goto(`https://${host}${path}?token=${token}&next=https://external.invalid`);
        await page.waitForURL(`https://${host}${path}`);
        if (fallback) prisma.user.findUnique = async args => { if (args.where.id === user.id) throw new Error('injected post-commit profile failure'); return find.call(prisma.user, args); };
        const fields = page.locator('input[type=password]'); await fields.nth(0).fill(newPassword); await fields.nth(1).fill(newPassword);
        await page.getByRole('button', { name: 'Guardar nueva contraseña', exact: true }).click();
        await page.getByText(/Contraseña actualizada|contraseña se actualizó|actualizada correctamente/).first().waitFor();
        assert.equal(await page.getByRole('alert').count(), 0); assert.deepEqual(errors, []);
        const identity = await prisma.authIdentity.findFirst({ where: { userId: user.id } }); assert(await argon2.verify(identity.passwordHash, newPassword));
        if (fallback) assert.equal(await prisma.session.count({ where: { userId: user.id, revokedAt: null } }), 0);
      } finally { prisma.user.findUnique = find; await context.close(); await browser.close(); }
    });
    test(`PR8 ${appName} shows PR9 suspended-token rejection without claiming success`, async () => {
      const user = await account('SUSPENDED'); const { token, record } = await tokenFor(user);
      const { browser, context, page } = await browserFor(host, appName);
      try {
        await page.goto(`https://${host}${path}?token=${token}`); const fields = page.locator('input[type=password]'); await fields.nth(0).fill(newPassword); await fields.nth(1).fill(newPassword);
        await page.getByRole('button', { name: 'Guardar nueva contraseña', exact: true }).click(); await page.getByRole('alert').first().waitFor();
        assert.equal(await page.getByText(/Contraseña actualizada|contraseña se actualizó|actualizada correctamente/).count(), 0); await unchanged(user, record);
      } finally { await context.close(); await browser.close(); }
    });
  }

}
