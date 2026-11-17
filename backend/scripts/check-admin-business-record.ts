/** Requires Admin Vite :5198 -> backend :35159 and an isolated migrated MySQL test DB. */
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from '../../frontend/node_modules/playwright/index.mjs';

assert.notEqual(process.env.NODE_ENV, 'production');
assert.match(new URL(process.env.DATABASE_URL!).pathname, /test/i);
const storage = await mkdtemp(join(tmpdir(), 'xamuko-business-record-browser-'));
process.env.PHOTO_STORAGE_BACKEND = 'local'; process.env.PHOTO_STORAGE_DIR = storage;
const { app } = await import('../src/app.js');
const { prisma } = await import('../src/config/prisma.js');
const { createBusinessRecordFixture } = await import('../src/modules/admin/admin-business-record.test-fixture.js');
// A repository-owned logo is used only as a labeled, isolated image fixture.
const image = await readFile(resolve('../frontend/apps/admin/public/brand/xamuko-lockup.png'));
const fixture = await createBusinessRecordFixture(image);
const server = app.listen(35159, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const flowsOnly = process.argv.includes('--flows-only');
const output = resolve(`../frontend/test-results/admin-business-record${flowsOnly ? '-flows' : ''}`); await mkdir(output, { recursive: true });
const base = 'http://localhost:5198', url = `${base}/businesses/${fixture.business.id}`;
const errors: string[] = [], checks: Array<Record<string, unknown>> = [];
let coreRequests = 0, visibilityWrites = 0;
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => { if (response.url().includes('/api/v1/') && response.status() >= 500) errors.push(`HTTP ${response.status()}: ${new URL(response.url()).pathname}`); });
page.on('request', request => { const path = new URL(request.url()).pathname; if (path === `/api/v1/admin/businesses/${fixture.business.id}`) coreRequests++; if (request.method() === 'POST' && path.endsWith('/visibility')) visibilityWrites++; });
async function capture(name: string) { await page.screenshot({ path: join(output, `${name}.png`), fullPage: !(await page.getByRole('dialog').count()) }); }
async function noOverflow(name: string) {
  const size = await page.evaluate(() => ({ viewport: innerWidth, width: document.documentElement.scrollWidth }));
  assert.ok(size.width <= size.viewport + 1, `${name}: ${JSON.stringify(size)}`);
}
async function tab(name: string) {
  await page.getByRole('tab', { name, exact: true }).click();
  await page.getByRole('tabpanel', { name, exact: true }).waitFor();
  await page.getByRole('tabpanel', { name, exact: true }).locator('.bd-loading').waitFor({ state: 'hidden' });
  assert.equal(await page.getByRole('tab', { name, exact: true }).getAttribute('aria-selected'), 'true');
}
async function photoReady(selector: string) { await page.locator(selector).waitFor(); await page.waitForFunction(selector => { const img = document.querySelector(selector) as HTMLImageElement | null; return img && img.complete && img.naturalWidth > 0; }, selector); }
async function restrict(action: string, confirm: string, expected: string) {
  await page.getByRole('button', { name: action, exact: true }).click();
  const dialog = page.getByRole('dialog'); await dialog.waitFor();
  assert.equal(await dialog.getByRole('button', { name: confirm, exact: true }).isDisabled(), true);
  await dialog.getByLabel('Motivo administrativo', { exact: false }).fill('Motivo suficiente de la actuación administrativa de prueba.');
  await noOverflow(`dialog/${action}`); await capture(`action-${action.replaceAll(' ', '-')}`);
  await dialog.getByRole('button', { name: confirm, exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  await page.getByRole('region', { name: 'Indicadores principales' }).getByText(expected, { exact: true }).waitFor();
  await page.locator('.bd-action-list button:not(:disabled)').first().waitFor();
}
try {
  await page.goto(`${base}/login`); await page.getByLabel('Correo electrónico', { exact: true }).fill(fixture.email); await page.getByLabel('Contraseña', { exact: true }).fill(fixture.password); await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click(); await page.waitForURL('**/dashboard');
  await page.goto(url); await page.getByRole('heading', { name: 'Ficha administrativa del negocio' }).waitFor();
  await photoReady('.bd-cover-photo img'); await photoReady('.bd-business-logo img');
  await page.locator('.bd-timeline li').first().waitFor();
  const initialRequests = coreRequests, originalHero = await page.locator('.bd-cover-photo img').getAttribute('src');
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base });
  await page.getByRole('button', { name: 'Copiar ID público', exact: true }).click();
  await page.getByText('ID público copiado.', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), fixture.business.publicId);
  await page.getByRole('button', { name: 'Cerrar aviso', exact: true }).click();
  assert.equal(await page.locator('.bd-indicators>article').count(), 5);
  const labels = ['Resumen', 'Información general', 'Productos y servicios', 'Opiniones', 'Fotografías', 'Actividad del negocio', 'Historial administrativo'];
  const sizes = flowsOnly ? [] : [[1440, 1000], [1920, 1080], [3840, 2160], [768, 1024], [820, 1180], [1024, 768], [1180, 820], [390, 844], [430, 932]];
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    for (const name of labels) {
      await tab(name);
      if (name === 'Fotografías') {
        const pictures = page.locator('#bd-panel-photos .bd-gallery article button');
        for (let index = 0; index < await pictures.count(); index++) { await pictures.nth(index).scrollIntoViewIfNeeded(); await pictures.nth(index).locator('img').waitFor(); }
      }
      await page.evaluate(() => scrollTo(0, 0)); await noOverflow(`${width}/${name}`);
      const noSplit = await page.locator('.bd-identity-copy .bd-location-text>span').evaluate(node => {
        const text = node.firstChild; if (!text) return true;
        const value = text.textContent || '';
        return [...value.matchAll(/\S+/g)].every(match => { const range = document.createRange(); range.setStart(text, match.index!); range.setEnd(text, match.index! + match[0].length); return range.getClientRects().length === 1; });
      });
      assert.ok(noSplit, `${width}: city or department split inside word`);
      await capture(`${width}-${name.replaceAll(' ', '-')}`);
      checks.push({ width, height, tab: name, noOverflow: true, locationWordsIntact: true });
    }
  }
  assert.equal(coreRequests, initialRequests, 'Switching tabs must not reload the business');
  assert.equal(await page.locator('.bd-cover-photo img').getAttribute('src'), originalHero);
  checks.push({ coreStableAcrossTabs: true, heroStableAcrossTabs: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await tab('Productos y servicios');
  const catalog = page.getByRole('tabpanel', { name: 'Productos y servicios', exact: true });
  await catalog.getByRole('button', { name: 'Siguiente', exact: true }).click(); await catalog.getByText('Página 2 de 3', { exact: true }).waitFor();
  await catalog.getByRole('button', { name: 'Servicios', exact: true }).click(); await catalog.getByText('Página 1 de 2', { exact: true }).waitFor();
  await catalog.getByRole('button', { name: 'Productos', exact: true }).click();
  await catalog.getByLabel('Buscar en el catálogo').fill('QA00001'); await catalog.getByRole('button', { name: 'Buscar', exact: true }).click();
  await catalog.getByLabel('Publicación del catálogo', { exact: true }).selectOption('UNPUBLISHED');
  await catalog.getByLabel('Activación del catálogo', { exact: true }).selectOption('INACTIVE');
  await catalog.getByRole('heading', { name: 'Producto de prueba 01', exact: true }).waitFor();
  await catalog.getByRole('button', { name: 'Ver detalle', exact: true }).click();
  await page.getByRole('dialog', { name: 'Producto de prueba 01', exact: true }).waitFor();
  assert.equal(await page.getByRole('dialog').getByRole('button', { name: /Guardar|Eliminar|Editar/ }).count(), 0);
  await capture('catalog-readonly-detail'); await page.keyboard.press('Escape');
  await tab('Opiniones');
  const reviews = page.getByRole('tabpanel', { name: 'Opiniones', exact: true });
  await reviews.getByRole('button', { name: 'Siguiente', exact: true }).click(); await reviews.getByText('Página 2 de 3', { exact: true }).waitFor();
  await reviews.getByLabel('Puntuación', { exact: true }).selectOption('5'); await reviews.getByText('Página 1 de 1', { exact: true }).waitFor();
  assert.equal(await reviews.locator('.bd-review').count(), 2);
  await reviews.getByLabel('Desde', { exact: true }).fill('2050-01-01'); await reviews.getByLabel('Hasta', { exact: true }).fill('2051-01-01'); await reviews.getByRole('button', { name: 'Aplicar fechas', exact: true }).click(); await reviews.getByRole('heading', { name: 'Sin opiniones para estos filtros' }).waitFor();
  await tab('Fotografías');
  const gallery = page.getByRole('tabpanel', { name: 'Fotografías', exact: true });
  await gallery.getByRole('button', { name: 'Siguiente', exact: true }).click(); await gallery.getByText('Página 2 de 2', { exact: true }).waitFor();
  await gallery.getByLabel('Origen de las fotografías', { exact: true }).selectOption('OFFER');
  await gallery.getByText('Página 1 de 1', { exact: true }).waitFor(); assert.equal(await gallery.locator('.bd-gallery article').count(), 6);
  await gallery.locator('.bd-gallery article button').first().click(); await page.getByRole('dialog').locator('img').waitFor(); await capture('gallery-expanded'); await page.keyboard.press('Escape');
  await tab('Actividad del negocio'); const activity = page.getByRole('tabpanel', { name: 'Actividad del negocio', exact: true });
  const chart = activity.getByRole('group', { name: /^Visualizaciones de la ficha/ }); await chart.focus(); await chart.press('Home'); await chart.press('ArrowRight');
  await activity.locator('[data-testid="activity-guide"]').waitFor({ state: 'attached' });
  assert.equal(await activity.locator('[data-testid="activity-guide"]').evaluate(element => getComputedStyle(element).stroke), 'rgb(37, 99, 235)');
  assert.match(await activity.locator('.bd-chart-value').innerText(), /0/);
  await capture('activity-interactive-guide');
  await activity.getByRole('button', { name: 'Tabla', exact: true }).click(); await activity.locator('table tbody tr').first().waitFor(); await activity.getByRole('button', { name: 'Gráfica', exact: true }).click();
  await tab('Historial administrativo'); const history = page.getByRole('tabpanel', { name: 'Historial administrativo', exact: true });
  await history.getByRole('button', { name: 'Siguiente', exact: true }).click(); await history.getByText('Página 2 de 2', { exact: true }).waitFor(); await history.locator('.bd-history-details summary').first().click(); await history.getByRole('heading', { name: 'Estado anterior', exact: true }).first().waitFor();
  assert.equal(await history.getByText('not-a-real-secret-do-not-expose', { exact: false }).count(), 0);
  await tab('Resumen');
  await page.getByRole('button', { name: 'Ocultar negocio', exact: true }).click(); await page.getByRole('dialog').getByRole('button', { name: 'Cancelar', exact: true }).click(); assert.equal(visibilityWrites, 0);
  const expiry = (await prisma.businessVisibilityPeriod.findFirstOrThrow({ where: { businessId: fixture.business.id } })).expiresAt.toISOString();
  await restrict('Ocultar negocio', 'Confirmar ocultamiento', 'Oculto por Admin');
  await restrict('Suspender negocio', 'Confirmar suspensión', 'Suspendido por Admin');
  await restrict('Cambiar a ocultamiento', 'Confirmar ocultamiento', 'Oculto por Admin');
  await restrict('Levantar restricción', 'Confirmar restitución', 'Visible');
  assert.equal((await prisma.businessVisibilityPeriod.findFirstOrThrow({ where: { businessId: fixture.business.id } })).expiresAt.toISOString(), expiry);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Eliminar administrativamente', exact: true }).click(); const deletion = page.getByRole('dialog');
  assert.equal(await deletion.getByRole('button', { name: 'Confirmar eliminación', exact: true }).isDisabled(), true);
  await deletion.getByLabel('Motivo de la eliminación', { exact: false }).fill('Retiro administrativo de la prueba aislada.'); await deletion.locator('input').fill('ELIMINAR'); await noOverflow('mobile deletion'); await capture('390-delete-confirmation');
  await deletion.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.getByRole('button', { name: 'Eliminar administrativamente', exact: true }).click(); await page.getByRole('dialog').getByLabel('Motivo de la eliminación', { exact: false }).fill('Retiro administrativo final de prueba aislada.'); await page.getByRole('dialog').locator('input').fill('ELIMINAR'); await page.getByRole('dialog').getByRole('button', { name: 'Confirmar eliminación', exact: true }).click();
  await page.getByRole('region', { name: 'Indicadores principales' }).getByText('Eliminado', { exact: true }).waitFor();
  assert.equal(await page.locator('.bd-action-list button').count(), 0);
  await page.getByRole('region', { name: 'Indicadores principales' }).getByText('Básico', { exact: true }).waitFor();
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: fixture.user.id } })).status, 'ACTIVE');
  await capture('390-deleted-record');
  await page.evaluate(() => scrollTo(0, 0));
  await page.getByLabel('Menú de administrador', { exact: true }).click(); await page.locator('.bd-account-menu').getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  await page.getByRole('dialog', { name: 'Confirmar cierre de sesión' }).getByRole('button', { name: 'Cancelar', exact: true }).click();
  assert.equal(await page.getByLabel('Menú de administrador', { exact: true }).evaluate(element => element === document.activeElement), true);
  await page.getByLabel('Menú de administrador', { exact: true }).click(); await page.locator('.bd-account-menu').getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  await page.getByRole('dialog', { name: 'Confirmar cierre de sesión' }).getByRole('button', { name: 'Cerrar sesión', exact: true }).click(); await page.waitForURL('**/login'); await page.goto(url); await page.waitForURL('**/login');
  assert.deepEqual(errors, []); checks.push({ copyPublicId: true, catalogFiltersPagination: true, reviewsFiltersPagination: true, galleryPaginationZoom: true, chartKeyboardGuide: true, historyPaginationStates: true, cancelAction: true, hideSuspendRestore: true, expiryPreserved: true, deletionAudit: true, accountPreserved: true, logoutProtected: true });
  await writeFile(join(output, 'results.json'), JSON.stringify({ passed: true, checks, errors }, null, 2)); await rm(join(output, 'failure.png'), { force: true });
  console.log(JSON.stringify({ passed: true, viewports: sizes.length, tabViewports: sizes.length * 7, functionalFlows: true, output }));
} catch (error) { await capture('failure'); await writeFile(join(output, 'results.json'), JSON.stringify({ passed: false, checks, errors, failure: String(error) }, null, 2)); throw error; }
finally { await browser.close(); await fixture.cleanup(); await new Promise<void>(resolve => server.close(() => resolve())); await prisma.$disconnect(); await rm(storage, { recursive: true, force: true }); }
