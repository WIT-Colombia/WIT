import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('../apps/admin/dist/', import.meta.url));
const output = fileURLToPath(new URL('../test-results/admin-sidebar/', import.meta.url));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2' };
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://fixture.test').pathname);
    const file = resolve(root, '.' + pathname);
    if (file !== resolve(root) && !file.startsWith(root.endsWith(sep) ? root : root + sep)) {
      response.writeHead(403).end(); return;
    }
    const target = extname(file) ? file : resolve(root, 'index.html');
    const body = await readFile(target);
    response.writeHead(200, { 'Content-Type': types[extname(target)] || 'application/octet-stream' }).end(body);
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch({ headless: true });
await mkdir(output, { recursive: true });

try {
  for (const [device, viewport] of [['desktop', { width: 1440, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport });
    // All API responses are fixtures. This check never contacts a real account or backend.
    await context.route('**/*', async route => {
      const request = route.request();
      const url = new URL(request.url());
      const headers = { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Headers': '*', 'Content-Type': 'application/json' };
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
      if (url.pathname.endsWith('/admin/auth/session')) {
        return route.fulfill({ status: 200, headers, body: JSON.stringify({ authenticated: true, userId: 'sidebar-fixture', csrfToken: 'fixture-only' }) });
      }
      if (url.pathname.endsWith('/admin/me')) {
        return route.fulfill({ status: 200, headers, body: JSON.stringify({ admin: { user: { id: 'sidebar-fixture', publicId: 'fixture', displayName: 'Perfil de prueba', emailNormalized: 'admin@example.test', avatarUrl: null, locale: 'es-CO' }, role: 'SUPER_ADMIN', permissions: ['ADMINS_MANAGE'] } }) });
      }
      if (url.origin !== origin || url.pathname.startsWith('/api/')) {
        return route.fulfill({ status: 503, headers, body: JSON.stringify({ error: { code: 'SIDEBAR_FIXTURE', message: 'Datos de página no incluidos en esta comprobación visual.' } }) });
      }
      return route.continue();
    });
    const page = await context.newPage();
    try {
    for (const path of ['/businesses', '/dashboard', '/verifications']) {
      await page.goto(origin + path);
      const sidebar = page.locator('#admin-navigation');
      if (device === 'mobile') {
        await page.getByRole('button', { name: 'Abrir navegación', exact: true }).click();
      }
      await page.waitForFunction(() => {
        const image = document.querySelector('.sidebar-brand .xa-brand-logo img');
        return image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0;
      });
      const logo = sidebar.locator('.xa-brand-logo > img').first();
      assert.equal(await logo.isVisible(), true, device + path + ': logo visible');
      assert.equal(await logo.getAttribute('alt'), 'XAMUKO · Descubre · Apoya · Disfruta');
      assert.equal(await sidebar.locator('.xa-brand-wordmark').isVisible(), true, device + path + ': nombre y eslogan visibles');
      assert.equal(await sidebar.getByText('ADMIN', { exact: true }).isVisible(), true);
      assert.equal(await sidebar.locator('.nav-item[aria-current="page"] > span').isVisible(), true, device + path + ': nombre de ruta visible');
      assert.equal(await sidebar.locator('.xa-nav-section[open] > summary .xa-group-label').isVisible(), true, device + path + ': grupo visible');
      assert.equal(await sidebar.locator('.sidebar-profile-copy').isVisible(), true, device + path + ': perfil visible');
      assert.equal(await sidebar.getByRole('button', { name: 'Cerrar sesión', exact: true }).isVisible(), true);
      const bounds = await sidebar.boundingBox();
      const brandBounds = await sidebar.locator('.sidebar-brand .brand').boundingBox();
      const logoBounds = await logo.boundingBox();
      assert.ok(bounds.width >= 260 && bounds.width <= 300, device + path + ': ancho compartido del menú');
      assert.ok(logoBounds.width >= 120 && logoBounds.height >= 35, device + path + ': proporciones horizontales del logo');
      assert.ok(logoBounds.x >= brandBounds.x - 1 && logoBounds.x + logoBounds.width <= brandBounds.x + brandBounds.width + 1, device + path + ': logo sin recorte');
      assert.ok(brandBounds.x >= bounds.x && brandBounds.x + brandBounds.width <= bounds.x + bounds.width, device + path + ': marca dentro de la barra');
      const closedItems = sidebar.locator('.xa-nav-section:not([open]) .nav-item').first();
      assert.equal(await closedItems.isVisible(), false, device + path + ': grupos cerrados ocultos');
      if (device === 'desktop') {
        const main = await page.locator('.admin-main').boundingBox();
        assert.ok(main.x >= bounds.x + bounds.width - 1, path + ': contenido separado de la barra lateral');
      }
      await sidebar.screenshot({ path: resolve(output, path.slice(1) + '-' + device + '.png') });
      console.log('Admin sidebar OK: ' + device + ' ' + path);
      if (device === 'mobile') {
        await sidebar.getByRole('button', { name: 'Cerrar menú', exact: true }).click();
        await page.waitForFunction(() => document.querySelector('#admin-navigation').getBoundingClientRect().right <= 0);
        const main = await page.locator('.admin-main').boundingBox();
        assert.ok(main.x === 0 && main.width <= viewport.width, path + ': contenido móvil sin margen de barra');
      }
    }
    } catch (error) {
      await page.screenshot({ path: resolve(output, 'failure-' + device + '.png'), fullPage: false });
      throw error;
    }
    await context.close();
  }
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
