// Serve built files through browser interception. No real DNS, API, Google or AWS requests.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const apps = { 'xamuko.com': 'landing', 'www.xamuko.com': 'landing', 'user.xamuko.com': 'usuario', 'business.xamuko.com': 'negocios', 'admin.xamuko.com': 'admin' };
const user = { id: 'fixture-user', publicId: 'fixture-public', displayName: 'Prueba', nickname: 'prueba', emailNormalized: 'test@example.test', avatarUrl: null, locale: 'es', status: 'ACTIVE', emailVerified: true, authProviders: ['EMAIL', 'GOOGLE'] };
let browser;
before(async () => { browser = await chromium.launch({ headless: true }); });
after(async () => { await browser?.close(); });
async function fixture(t, authenticated = false, isAdmin = true, legacyUser = false, passwordOptions = {}) {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  t.after(() => context.close());
  const requests = [];
  const external = [];
  const errors = [];
  await context.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const app = legacyUser && url.hostname === 'xamuko.com' ? 'usuario' : apps[url.hostname];
    if (!app) { if (request.isNavigationRequest()) external.push(url.origin); return route.abort(); }
    if (url.pathname.startsWith('/api/v1/')) {
      requests.push({ url, method: request.method(), headers: request.headers(), body: request.postDataJSON() });
      const json = (body, status = 200) => route.fulfill({ status, json: body });
      const operation = url.pathname.endsWith('/password-reset/request') ? 'request'
        : url.pathname.endsWith('/password-reset/confirm') ? 'reset'
        : url.pathname.endsWith('/change-password') ? 'change' : null;
      if (operation) {
        if (passwordOptions.gate) await passwordOptions.gate;
        const configured = passwordOptions.response;
        if (configured?.network) return route.abort();
        if (configured?.html) return route.fulfill({ status: 200, contentType: 'text/html', body: '<html>SPA fallback</html>' });
        if (configured) return json(configured.body, configured.status);
        if (operation === 'change') return route.fulfill({ status: 204, body: '' });
        return operation === 'request' ? json({ message: 'Si la cuenta existe, recibirás instrucciones para continuar.' }, 202) : json({ user, autoLogin: false });
      }
      if (url.pathname.endsWith('/google/start')) return route.fulfill({ contentType: 'text/html', body: '<p>OAuth start intercepted</p>' });
      if (url.pathname.endsWith('/auth/register')) return json({ user, verificationEmailSent: true }, 201);
      if (url.pathname.endsWith('/auth/login')) { authenticated = true; return json({ user, accessToken: 'fixture-access-token' }); }
      if (url.pathname.endsWith('/auth/logout')) { authenticated = false; return json({}); }
      if (url.pathname.endsWith('/auth/refresh') || url.pathname.endsWith('/auth/me')) return authenticated ? json({ user, accessToken: 'fixture-access-token' }) : json({ error: { code: 'SESSION_REQUIRED', message: 'Sesión requerida' } }, 401);
      if (url.pathname.endsWith('/admin/me')) return isAdmin ? json({ admin: { user, role: 'SUPER_ADMIN', permissions: [] } }) : json({ error: { code: 'ADMIN_REQUIRED', message: 'Acceso administrativo requerido' } }, 403);
      return json({ businesses: [], notifications: [], transfers: [], reviews: [], reports: [], pagination: { total: 0, totalPages: 0 }, categories: [], cities: [], regions: [], countries: [] });
    }
    const dist = resolve(root, 'apps', app, 'dist');
    let path = resolve(dist, `.${decodeURIComponent(url.pathname)}`);
    if (!path.startsWith(`${dist}/`) && path !== dist) return route.abort();
    if (request.isNavigationRequest()) path = resolve(dist, 'index.html');
    if (!existsSync(path)) return route.fulfill({ status: 404, body: 'Missing fixture asset' });
    const contentType = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' }[extname(path)] || 'application/octet-stream';
    return route.fulfill({ contentType, body: readFileSync(path) });
  });
  context.setDefaultTimeout(5000);
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  t.after(() => { assert.deepEqual(errors, [], 'No frontend runtime errors'); assert.deepEqual(external, [], 'No navigation left the tested origins'); });
  return { page, requests };
}
async function login(page, origin, path) {
  await page.goto(`${origin}${path}`);
  await page.locator('input[type=email]').fill('test@example.test');
  await page.locator('input[type=password]').first().fill('fixture-password-123');
  await page.locator('form').getByRole('button', { name: /^Iniciar sesión/ }).click();
}
for (const host of ['xamuko.com', 'www.xamuko.com']) test(`Landing at ${host} links to User and Business`, async t => {
  const { page } = await fixture(t);
  await page.goto(`https://${host}/`);
  await page.getByRole('main', { name: 'Página principal de XAMUKO' }).waitFor();
  assert.equal(await page.getByRole('link', { name: 'Explorar sin registrarme' }).getAttribute('href'), 'https://user.xamuko.com/home');
  assert.equal(await page.getByRole('link', { name: /Registrar mi negocio/ }).getAttribute('href'), 'https://business.xamuko.com/registro');
});
test('Usuario entry offers registration, login and guest exploration', async t => {
  const { page } = await fixture(t);
  await page.goto('https://user.xamuko.com/');
  await page.waitForURL('**/register');
  await page.getByRole('heading', { name: 'Crea tu cuenta en XAMUKO' }).waitFor();
  await page.getByRole('button', { name: '¿Ya tienes una cuenta? Inicia sesión' }).click();
  await page.getByRole('heading', { name: 'Inicia sesión en XAMUKO' }).waitFor();
  await page.getByRole('link', { name: 'Explorar sin registrarme' }).click();
  await page.waitForURL('**/home');
});
test('Usuario login, refresh and logout use same-origin API and memory token', async t => {
  const { page, requests } = await fixture(t);
  await login(page, 'https://user.xamuko.com', '/register?mode=login&next=/profile');
  await page.waitForURL('**/profile');
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).waitFor();
  await page.reload();
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).waitFor();
  assert(requests.some(r => r.url.pathname === '/api/v1/auth/me' && r.headers.authorization === 'Bearer fixture-access-token'));
  assert(!(await page.evaluate(() => JSON.stringify({ ...localStorage }))).includes('fixture-access-token'));
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  await page.getByRole('button', { name: 'Sí, cerrar' }).click();
  await page.waitForURL('**/home');
  assert(requests.some(r => r.method === 'POST' && r.url.pathname.endsWith('/auth/logout')));
  await page.goto('https://user.xamuko.com/profile');
  await page.waitForURL('**/register?next=*');
});
test('Business entry offers login and registration and preserves a private return route', async t => {
  const { page } = await fixture(t);
  await page.goto('https://business.xamuko.com/');
  await page.waitForURL('**/login?next=*');
  await page.getByRole('button', { name: '¿No tienes una cuenta? Crear cuenta' }).click();
  await page.waitForURL('**/registro');
  await page.getByRole('button', { name: 'Crear mi cuenta', exact: true }).waitFor();
  await login(page, 'https://business.xamuko.com', '/login?next=/perfil');
  await page.waitForURL('**/perfil');
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  await page.getByRole('button', { name: 'Sí, cerrar' }).click();
  await page.waitForURL('**/login*');
});
test('Admin has no public registration and requires admin authorization', async t => {
  const { page } = await fixture(t, false, false);
  await page.goto('https://admin.xamuko.com/');
  await page.waitForURL('**/login');
  assert.equal(await page.getByText(/Crear cuenta|Registrarme|Continuar con Google/).count(), 0);
  await login(page, 'https://admin.xamuko.com', '/login');
  await page.getByText('Acceso administrativo requerido').waitFor();
  assert.equal(new URL(page.url()).pathname, '/login');
  await page.goto('https://admin.xamuko.com/registro');
  await page.waitForURL('**/login');
});
test('Admin login, reload and logout keep administrative routes protected', async t => {
  const { page, requests } = await fixture(t);
  await login(page, 'https://admin.xamuko.com', '/login');
  await page.waitForURL('**/dashboard');
  await page.goto('https://admin.xamuko.com/change-password');
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).last().click();
  await page.waitForURL('**/login');
  assert(requests.some(r => r.url.pathname === '/api/v1/admin/me' && r.headers.authorization === 'Bearer fixture-access-token'));
});
for (const [host, application, loginPath, success] of [
  ['user.xamuko.com', 'usuario', '/register?mode=login', '/home'],
  ['business.xamuko.com', 'negocios', '/login', '/mis-negocios'],
]) {
  test(`${application} Google start uses correct application and same-origin API`, async t => {
    const { page, requests } = await fixture(t);
    await page.goto(`https://${host}${loginPath}`);
    await page.getByRole('button', { name: /Continuar con Google/ }).click();
    await page.waitForURL('**/api/v1/auth/google/start?*');
    const start = requests.find(r => r.url.pathname.endsWith('/google/start'));
    assert.equal(start.url.searchParams.get('application'), application);
    assert.equal(start.url.searchParams.get('consent'), '1');
    assert.equal(start.url.hostname, host);
  });
  test(`${application} Google callback restores session and rejects external next`, async t => {
    const { page } = await fixture(t, true);
    await page.goto(`https://${host}/auth/google/callback?next=https%3A%2F%2Fevil.test`);
    await page.waitForURL(`https://${host}${success}`);
  });
  test(`${application} cancelled Google login returns a recoverable error`, async t => {
    const { page } = await fixture(t);
    await page.goto(`https://${host}/auth/google/callback?error=GOOGLE_AUTH_CANCELLED`);
    await page.getByText('Cancelaste el inicio de sesión con Google.').waitFor();
    await page.getByRole('link', { name: 'Volver a iniciar sesión' }).waitFor();
  });
}

test('current Usuario publication at xamuko.com keeps the public home entry', async t => {
  const { page } = await fixture(t, false, true, true);
  await page.goto('https://xamuko.com/');
  await page.waitForURL('**/home');
});
for (const [host, path, destination] of [
  ['user.xamuko.com', '/register', '/verify-email?pending=1&email=test%40example.test'],
  ['business.xamuko.com', '/registro', '/login?registered=1'],
]) test(`${host} registration waits for email verification without creating a session`, async t => {
  const { page, requests } = await fixture(t);
  await page.goto(`https://${host}${path}`);
  await page.locator('input[autocomplete=name]').fill('Persona de prueba');
  await page.locator('input[type=email]').fill('test@example.test');
  const passwords = page.locator('input[type=password]');
  await passwords.nth(0).fill('fixture-password-123');
  await passwords.nth(1).fill('fixture-password-123');
  await page.locator('input[type=checkbox]').check();
  await page.getByRole('button', { name: /^Crear mi cuenta/ }).click();
  await page.waitForURL(`https://${host}${destination}`);
  assert(requests.some(r => r.method === 'POST' && r.url.pathname.endsWith('/auth/register')));
  assert(!requests.some(r => r.url.pathname.endsWith('/auth/login')));
});

test('restored Usuario session enters home directly on user.xamuko.com', async t => {
  const { page } = await fixture(t, true);
  await page.goto('https://user.xamuko.com/');
  await page.waitForURL('**/home');
});
for (const [host, path, destination] of [
  ['user.xamuko.com', '/register?mode=login', '/profile'],
  ['business.xamuko.com', '/login', '/mis-negocios'],
]) test(`${host} login rejects a browser-normalized external return destination`, async t => {
  const { page } = await fixture(t);
  await login(page, `https://${host}`, `${path}${path.includes('?') ? '&' : '?'}next=%2F%5Cevil.test`);
  await page.waitForURL(`https://${host}${destination}`);
});

const passwordApps = [
  ['Usuario', 'user.xamuko.com', '/recover-password', '/change-password'],
  ['Business', 'business.xamuko.com', '/recuperar?mode=email', '/recuperar'],
  ['Admin', 'admin.xamuko.com', '/recover-password', '/change-password'],
];
for (const [app, host, recovery, change] of passwordApps) {
  test(`${app} recovery accepts an entered email and reports only generic acceptance after 202`, async t => {
    let release; const gate = new Promise(resolve => { release = resolve; }); t.after(() => release());
    const { page, requests } = await fixture(t, false, true, false, { gate });
    await page.goto(`https://${host}${recovery}`);
    await page.locator('input[type=email]').fill('recovery@example.test');
    await page.getByRole('button', { name: /Enviar enlace de recuperación/ }).click();
    assert.equal(await page.getByText(/Si la cuenta existe y puede recuperar/).count(), 0);
    release();
    await page.getByText(/Si la cuenta existe y puede recuperar/).waitFor();
    const request = requests.find(r => r.url.pathname.endsWith('/password-reset/request'));
    assert.equal(request.method, 'POST'); assert.equal(request.body.email, 'recovery@example.test');
    assert.equal(await page.getByText(/Te enviamos un enlace/).count(), 0);
  });
  for (const [name, response] of [
    ['rate limit', { status: 429, body: { error: { code: 'AUTH_RATE_LIMITED', message: 'Espera antes de reintentar.' } } }],
    ['server error', { status: 500, body: { error: { message: 'Servicio no disponible.' } } }],
    ['network failure', { network: true }], ['HTML 200', { html: true }],
  ]) test(`${app} recovery does not confirm ${name}`, async t => {
    const { page } = await fixture(t, false, true, false, { response });
    await page.goto(`https://${host}${recovery}`);
    await page.locator('input[type=email]').fill('recovery@example.test');
    await page.getByRole('button', { name: /Enviar enlace de recuperación/ }).click();
    await page.getByRole('alert').first().waitFor();
    assert.equal(await page.getByText(/Si la cuenta existe y puede recuperar/).count(), 0);
  });
  for (const success of [false, true]) test(`${app} password change ${success ? 'confirms 204 only' : 'rejects a wrong current password without success'}`, async t => {
    let release; const gate = new Promise(resolve => { release = resolve; }); t.after(() => release());
    const response = success ? undefined : { status: 400, body: { error: { code: 'INVALID_CURRENT_PASSWORD', message: 'La contraseña actual no es correcta.' } } };
    const { page, requests } = await fixture(t, true, true, false, { response, gate });
    await page.goto(`https://${host}${change}`);
    const fields = page.locator('input[type=password]');
    await fields.nth(0).fill('old-password-123'); await fields.nth(1).fill('new-password-123'); await fields.nth(2).fill('new-password-123');
    await page.getByRole('button', { name: 'Guardar nueva contraseña', exact: true }).click();
    assert.equal(await page.getByText(/Contraseña actualizada|contraseña se actualizó|actualizada correctamente/).count(), 0);
    release();
    if (success) await page.getByText(/Contraseña actualizada|contraseña se actualizó|actualizada correctamente/).first().waitFor();
    else { await page.getByRole('alert').first().waitFor(); assert.equal(await page.getByText(/Contraseña actualizada|contraseña se actualizó|actualizada correctamente/).count(), 0); }
    const request = requests.find(r => r.url.pathname.endsWith('/change-password'));
    assert.deepEqual(request.body, { currentPassword: 'old-password-123', newPassword: 'new-password-123' });
    assert.equal(request.headers.authorization, 'Bearer fixture-access-token');
  });
}
for (const [app, host, path] of [['Usuario', 'user.xamuko.com', '/reset-password'], ['Business', 'business.xamuko.com', '/recuperar']]) {
  for (const success of [false, true]) test(`${app} token reset ${success ? 'preserves token in memory and confirms backend success' : 'shows expired or reused token without success'}`, async t => {
    const response = success ? undefined : { status: 400, body: { error: { code: 'INVALID_AUTH_TOKEN', message: 'El enlace no es válido o ya expiró.' } } };
    const { page, requests } = await fixture(t, false, true, false, { response });
    const token = 'synthetic-reset-token-'.repeat(3);
    await page.goto(`https://${host}${path}?token=${token}&next=https://evil.test`);
    await page.waitForURL(`https://${host}${path}`);
    const fields = page.locator('input[type=password]');
    await fields.nth(0).fill('new-password-123'); await fields.nth(1).fill('new-password-123');
    await page.getByRole('button', { name: 'Guardar nueva contraseña', exact: true }).click();
    if (success) await page.getByText(/Contraseña actualizada|contraseña se actualizó|actualizada correctamente/).first().waitFor();
    else { await page.getByRole('alert').first().waitFor(); assert.equal(await page.getByText(/Contraseña actualizada|contraseña se actualizó|actualizada correctamente/).count(), 0); }
    assert.equal(requests.find(r => r.url.pathname.endsWith('/password-reset/confirm')).body.token, token);
    if (!success) {
      if (app === 'Business') await page.getByRole('button', { name: '¿No recuerdas tu contraseña? Recupérala por correo' }).click();
      else await page.getByRole('link', { name: 'Solicitar un enlace de recuperación' }).click();
      await page.locator('input[type=email]').waitFor();
    }
  });
}
for (const [app, host, , change] of passwordApps) {
  for (const [name, response] of [
    ['expired session', { status: 401, body: { error: { message: 'Sesión expirada.' } } }],
    ['forbidden', { status: 403, body: { error: { message: 'Origen no autorizado.' } } }],
    ['server error', { status: 500, body: { error: { message: 'Error interno.' } } }],
    ['network failure', { network: true }], ['HTML fallback', { html: true }],
  ]) test(`${app} password change never confirms ${name}`, async t => {
    const { page } = await fixture(t, true, true, false, { response });
    await page.goto(`https://${host}${change}`);
    const fields = page.locator('input[type=password]');
    await fields.nth(0).fill('old-password-123'); await fields.nth(1).fill('new-password-123'); await fields.nth(2).fill('new-password-123');
    await page.getByRole('button', { name: 'Guardar nueva contraseña', exact: true }).click();
    await page.getByRole('alert').first().waitFor();
    assert.equal(await page.getByText(/Contraseña actualizada|contraseña se actualizó|actualizada correctamente/).count(), 0);
  });
}
for (const [app, host, path] of [['Usuario', 'user.xamuko.com', '/reset-password'], ['Business', 'business.xamuko.com', '/recuperar']]) {
  test(`${app} missing token prevents a reset API call`, async t => {
    const { page, requests } = await fixture(t);
    await page.goto(`https://${host}${path}?token=`);
    await page.getByText(/Falta el token/).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Guardar nueva contraseña', exact: true }).isDisabled(), true);
    assert(!requests.some(r => r.url.pathname.endsWith('/password-reset/confirm')));
  });
  test(`${app} confirmed reset stays successful when automatic session restoration fails`, async t => {
    const { page } = await fixture(t, false, true, false, { response: { status: 200, body: { user, accessToken: 'synthetic-reset-access-token' } } });
    await page.goto(`https://${host}${path}?token=${'synthetic-token-'.repeat(4)}`);
    const fields = page.locator('input[type=password]');
    await fields.nth(0).fill('new-password-123'); await fields.nth(1).fill('new-password-123');
    await page.getByRole('button', { name: 'Guardar nueva contraseña', exact: true }).click();
    await page.getByText(/Contraseña actualizada|contraseña se actualizó|actualizada correctamente/).first().waitFor();
    assert.equal(await page.getByRole('alert').count(), 0);
  });
}
for (const [app, host, , change] of passwordApps) test(`${app} mismatched passwords never call the change endpoint`, async t => {
  const { page, requests } = await fixture(t, true);
  await page.goto(`https://${host}${change}`);
  const fields = page.locator('input[type=password]');
  await fields.nth(0).fill('old-password-123'); await fields.nth(1).fill('new-password-123'); await fields.nth(2).fill('different-password-123');
  const button = page.getByRole('button', { name: 'Guardar nueva contraseña', exact: true });
  if (!await button.isDisabled()) { await button.click(); await page.getByRole('alert').first().waitFor(); }
  assert(!requests.some(r => r.url.pathname.endsWith('/change-password')));
  assert.equal(await page.getByText(/Contraseña actualizada|contraseña se actualizó|actualizada correctamente/).count(), 0);
});
