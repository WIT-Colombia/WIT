import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

// Built-frontend smoke test: requests are isolated fixtures, never production data.
const root = fileURLToPath(new URL('../apps/admin/dist/', import.meta.url));
const screenshots = fileURLToPath(new URL('../test-results/admin-users/', import.meta.url));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2' };
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://fixture.test').pathname);
    const filename = resolve(root, '.' + pathname);
    if (filename !== resolve(root) && !filename.startsWith(root.endsWith(sep) ? root : root + sep)) {
      res.writeHead(403).end(); return;
    }
    const file = extname(filename) ? filename : resolve(root, 'index.html');
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' }).end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
const at = '2026-11-18T12:00:00.000Z';
const originalUsers = [
  { id: 'fixture-ana', publicId: 'USR-0001', displayName: 'Ana Torres', nickname: null,
    emailNormalized: 'ana@example.test', status: 'ACTIVE', avatarUrl: null, locale: 'es-CO',
    createdAt: at, lastLoginAt: at, ownedBusinesses: 1, collaboratingBusinesses: 0,
    createdBusinesses: 1, isAdmin: false, emailVerified: true, authProviders: ['EMAIL'], city: 'Cali' },
  { id: 'fixture-luis', publicId: 'USR-0002', displayName: 'Luis Pérez', nickname: null,
    emailNormalized: 'luis@example.test', status: 'SUSPENDED', avatarUrl: null, locale: 'es-CO',
    createdAt: at, lastLoginAt: null, ownedBusinesses: 0, collaboratingBusinesses: 0,
    createdBusinesses: 0, isAdmin: false, emailVerified: false, authProviders: ['GOOGLE'], city: 'Palmira' },
  { id: 'fixture-camila', publicId: 'USR-0003', displayName: 'Camila Rojas', nickname: null,
    emailNormalized: 'camila@example.test', status: 'ACTIVE', avatarUrl: null, locale: 'es-CO',
    createdAt: at, lastLoginAt: at, ownedBusinesses: 0, collaboratingBusinesses: 1,
    createdBusinesses: 0, isAdmin: false, emailVerified: true, authProviders: ['EMAIL'], city: 'Cali' },
];

try {
  await mkdir(screenshots, { recursive: true });
  for (const [device, viewport] of [
    ['mobile', { width: 390, height: 844 }],
    ['ipad', { width: 768, height: 1024 }],
    ['desktop', { width: 1440, height: 900 }],
  ]) {
    const users = structuredClone(originalUsers);
    const calls = [];
    const context = await browser.newContext({ viewport });
    await context.route('**/*', async route => {
      const request = route.request();
      const url = new URL(request.url());
      const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Headers': '*' };
      const reply = (status, body) => route.fulfill({ status, headers, body: JSON.stringify(body) });
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
      if (url.pathname.endsWith('/admin/auth/session')) return reply(200, { authenticated: true, userId: 'fixture-admin', csrfToken: 'test-token' });
      if (url.pathname.endsWith('/admin/me')) return reply(200, { admin: {
        user: { id: 'fixture-admin', publicId: 'ADMIN-1', displayName: 'Admin de pruebas', emailNormalized: 'admin@example.test', avatarUrl: null, locale: 'es-CO' },
        role: 'SUPER_ADMIN', permissions: ['ADMINS_MANAGE', 'AUDIT_READ'],
      } });
      if (url.pathname.endsWith('/admin/users/capabilities')) return reply(200, { userManagement: true, canManageStatus: true, analytics: true });
      if (url.pathname.endsWith('/admin/users/overview')) {
        return reply(200, { generatedAt: at, total: users.length, active: users.filter(user => user.status === 'ACTIVE').length,
          suspended: users.filter(user => user.status === 'SUSPENDED').length, deleted: 0,
          owners: 1, collaborators: 1, adminCount: 0, linkedBusinesses: 2, withBusiness: 2,
          active30: 2, dormant90: 0, neverLoggedIn: 1, emailVerified: 2, googleUsers: 1,
          cities: ['Cali', 'Palmira'], series: [{ month: '2026-11', registrations: 3 }],
          definition: 'Valores calculados únicamente con los registros del fixture aislado.' });
      }
      if (url.pathname.endsWith('/admin/users/analytics')) return reply(200, {
        period: '12m', timezone: 'UTC', definition: 'Prueba local sin datos de usuarios reales.',
        series: [{ month: '2026-11', registrations: 3, cumulative: 3 }],
      });
      if (url.pathname.endsWith('/admin/users/fixture-ana/status') && request.method() === 'POST') {
        const input = JSON.parse(request.postData() || '{}');
        calls.push({ action: input.action, reason: input.reason });
        users[0].status = input.action === 'SUSPEND' ? 'SUSPENDED' : 'ACTIVE';
        return reply(200, { id: users[0].id, status: users[0].status,
          message: input.action === 'SUSPEND' ? 'Cuenta suspendida en prueba.' : 'Cuenta reactivada en prueba.' });
      }
      if (url.pathname.endsWith('/admin/users/fixture-ana/sessions/revoke') && request.method() === 'POST') {
        const input = JSON.parse(request.postData() || '{}');
        calls.push({ action: 'REVOKE', reason: input.reason });
        return reply(200, { id: users[0].id, sessionsRevoked: 1, message: 'Sesiones cerradas en prueba.' });
      }
      if (url.pathname.endsWith('/admin/users') && request.method() === 'GET') {
        const q = (url.searchParams.get('q') || '').toLocaleLowerCase('es-CO');
        const status = url.searchParams.get('status') || '';
        const relation = url.searchParams.get('relation') || '';
        const city = url.searchParams.get('city') || '';
        const provider = url.searchParams.get('provider') || '';
        const filtered = users.filter(user =>
          (!q || [user.displayName, user.emailNormalized, user.publicId].some(value => value.toLocaleLowerCase('es-CO').includes(q))) &&
          (!status || user.status === status) && (!city || user.city === city) &&
          (!provider || user.authProviders.includes(provider)) &&
          (relation !== 'ANY' || user.ownedBusinesses + user.collaboratingBusinesses > 0) &&
          (relation !== 'NONE' || user.ownedBusinesses + user.collaboratingBusinesses === 0));
        const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
        const pageSize = 2;
        return reply(200, { users: filtered.slice((page - 1) * pageSize, page * pageSize),
          pagination: { page, pageSize, total: filtered.length, totalPages: Math.ceil(filtered.length / pageSize) } });
      }
      if (url.origin !== origin || url.pathname.startsWith('/api/')) return reply(503, { error: { code: 'FIXTURE', message: 'Sin datos para esta llamada.' } });
      return route.continue();
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      await page.goto(origin + '/users', { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: 'Usuarios', exact: true }).waitFor({ state: 'visible', timeout: 15000 });
      const userHeading = await page.evaluate(() => {
        const icon = document.querySelector('.au-showcase-hero-icon')?.getBoundingClientRect();
        const title = document.querySelector('#au-title')?.getBoundingClientRect();
        return { iconRight: icon?.right ?? Infinity, titleLeft: title?.left ?? 0 };
      });
      assert.ok(userHeading.iconRight < userHeading.titleLeft,
        device + ': Usuarios title must sit immediately to the right of the icon');
      await page.getByText('3 usuarios encontrados').waitFor({ state: 'visible', timeout: 15000 });
      const isMobileLayout = viewport.width <= 900;
      const layout = await page.evaluate(() => {
        const styles = selector => {
          const node = document.querySelector(selector);
          if (!node) return { found: false };
          const css = window.getComputedStyle(node);
          return { found: true, display: css.display, visibility: css.visibility,
            count: node.children.length, offsetWidth: node.getBoundingClientRect().width,
            offsetHeight: node.getBoundingClientRect().height };
        };
        return { viewport: window.innerWidth, shell: Boolean(document.querySelector('.admin-refresh')),
          mobile: styles('.au-mobile-users'), table: styles('.au-table-scroll'),
          cards: document.querySelectorAll('.au-mobile-user-card').length,
          links: document.querySelectorAll('.au-user-cell').length };
      });
      console.log('Admin Usuarios layout ' + device + ': ' + JSON.stringify(layout));
      // React can display the count before responsive CSS finishes settling in Chromium.
      await page.locator('.au-mobile-users').waitFor({ state: isMobileLayout ? 'visible' : 'hidden', timeout: 10000 });
      await page.locator('.au-table-scroll').waitFor({ state: isMobileLayout ? 'hidden' : 'visible', timeout: 10000 });
      assert.equal(await page.locator('.au-mobile-users').isVisible(), isMobileLayout, device + ': tarjetas móviles');
      assert.equal(await page.locator('.au-table-scroll').isVisible(), !isMobileLayout, device + ': tabla escritorio');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2),
        true, device + ': sin desbordamiento horizontal de la página');
      await page.getByRole('button', { name: /Con negocio/ }).click();
      await page.getByText('2 usuarios encontrados').waitFor({ state: 'visible' });
      await page.getByRole('button', { name: /Sin negocio/ }).click();
      await page.getByText('1 usuario encontrado').waitFor({ state: 'visible' });
      await page.getByRole('button', { name: /Todos \(/ }).click();
      await page.getByText('3 usuarios encontrados').waitFor({ state: 'visible' });
      await page.getByLabel('Buscar usuarios').fill('Ana');
      await page.getByRole('button', { name: 'Buscar', exact: true }).click();
      await page.getByText('1 usuario encontrado').waitFor({ state: 'visible' });
      assert.equal(await page.getByRole('button', { name: /Todos \(/ }).getAttribute('aria-pressed'), 'false', device + ': Todos no se selecciona durante búsqueda');
      await page.getByRole('button', { name: 'Limpiar filtros' }).click();
      await page.getByText('3 usuarios encontrados').waitFor({ state: 'visible' });
      await page.getByRole('button', { name: 'Siguiente' }).click();
      await page.getByText('Página 2 de 2').waitFor({ state: 'visible' });
      await page.getByRole('button', { name: 'Anterior' }).click();
      await page.getByText('Página 1 de 2').waitFor({ state: 'visible' });
      const row = page.locator(isMobileLayout ? '.au-mobile-user-card' : '.au-table tbody tr').filter({ hasText: 'Ana Torres' });
      await row.getByRole('button', { name: 'Suspender' }).click();
      let dialog = page.getByRole('dialog', { name: 'Suspender cuenta' });
      assert.equal(await dialog.getByRole('button', { name: 'Confirmar suspensión' }).isDisabled(), true, device + ': motivo obligatorio');
      await dialog.getByLabel('Motivo administrativo obligatorio').fill('Motivo de seguridad válido en prueba funcional.');
      await dialog.getByRole('button', { name: 'Confirmar suspensión' }).click();
      await page.getByText('Cuenta suspendida en prueba.').waitFor({ state: 'visible' });
      await row.getByRole('button', { name: 'Reactivar' }).click();
      dialog = page.getByRole('dialog', { name: 'Reactivar cuenta' });
      await dialog.getByLabel('Motivo administrativo obligatorio').fill('Se revisó y confirmó la reactivación de prueba.');
      await dialog.getByRole('button', { name: 'Confirmar reactivación' }).click();
      await page.getByText('Cuenta reactivada en prueba.').waitFor({ state: 'visible' });
      if (!isMobileLayout) await row.locator('summary').click();
      await row.getByRole('button', { name: 'Cerrar sesiones' }).click();
      dialog = page.getByRole('dialog', { name: 'Cerrar todas las sesiones' });
      await dialog.getByLabel('Motivo administrativo obligatorio').fill('Cierre de sesiones solicitado para prueba de seguridad.');
      await dialog.getByRole('button', { name: 'Cerrar sesiones' }).click();
      await page.getByText('Sesiones cerradas en prueba.').waitFor({ state: 'visible' });
      assert.deepEqual(calls.map(call => call.action), ['SUSPEND', 'RESTORE', 'REVOKE'], device + ': acciones API reales');
      assert.equal(calls.every(call => call.reason.length >= 12), true, device + ': todas las operaciones llevan motivo');
      assert.equal(errors.length, 0, device + ': sin excepciones JS: ' + errors.join(' | '));
      await page.screenshot({ path: resolve(screenshots, device + '.png'), fullPage: true });
      console.log('Admin Usuarios: filtros, acciones y responsive OK - ' + device);
    } finally { await context.close(); }
  }
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
