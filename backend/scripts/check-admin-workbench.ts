/** Local-only browser check. Requires migrated, isolated MySQL and Admin Vite :5197.
 * VITE_ADMIN_BACKEND_URL=http://127.0.0.1:35158 AUTH_TRUSTED_ORIGINS=http://localhost:5197
 * Run from backend with node --import tsx scripts/check-admin-workbench.ts.
 * Never run against production. Fixtures and private test files are removed in finally.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import argon2 from 'argon2';
import { chromium } from '../../frontend/node_modules/playwright/index.mjs';

assert.notEqual(process.env.NODE_ENV, 'production');
assert.match(new URL(process.env.DATABASE_URL!).pathname, /test/i);
const storage = await mkdtemp(join(tmpdir(), 'xamuko-admin-browser-'));
process.env.ADMIN_DOCUMENT_STORAGE_BACKEND = 'local';
process.env.ADMIN_DOCUMENT_STORAGE_DIR = storage;
const { app } = await import('../src/app.js');
const { prisma } = await import('../src/config/prisma.js');
const server = app.listen(35158, '127.0.0.1');
await new Promise<void>(resolve => server.once('listening', resolve));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
const output = resolve('../frontend/test-results/admin-workbench');
await mkdir(output, { recursive: true });
const seed = randomUUID().slice(0, 8), email = `workbench-${seed}@example.invalid`, password = `Browser-${seed}-password`;
const user = await prisma.user.create({ data: { displayName: 'Administración · prueba aislada', emailNormalized: email, authIdentities: { create: { provider: 'EMAIL', providerSubject: email, passwordHash: await argon2.hash(password), verifiedAt: new Date() } }, adminRoleAssignments: { create: { role: 'SUPER_ADMIN', active: true } } } });
let categoryId = '', accountId = '', businessId = '', providerId = '';
const errors: string[] = [], checks: Array<Record<string, unknown>> = [];
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => { if (response.status() >= 500 && response.url().includes('/api/v1/')) errors.push(`HTTP ${response.status()} ${new URL(response.url()).pathname}`); });
const base = 'http://localhost:5197';
async function screenshot(name: string) { await page.screenshot({ path: join(output, `${name}.png`), fullPage: !(await page.getByRole('dialog').count()) }); }
async function noOverflow(label: string) {
  const widths = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: innerWidth }));
  assert.ok(widths.document <= widths.viewport + 1, `${label}: ${JSON.stringify(widths)}`);
}
function pdf() {
  const objects = ['<</Type /Catalog /Pages 2 0 R>>', '<</Type /Pages /Kids [3 0 R] /Count 1>>', '<</Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources <</Font <</F1 4 0 R>>>> /Contents 5 0 R>>', '<</Type /Font /Subtype /Type1 /BaseFont /Helvetica>>'];
  const content = 'BT /F1 20 Tf 72 760 Td (XAMUKO - PDF de prueba aislada) Tj ET';
  objects.push(`<</Length ${Buffer.byteLength(content)}>>\nstream\n${content}\nendstream`);
  let text = '%PDF-1.4\n'; const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(text)); text += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(text);
  text += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<</Size 6 /Root 1 0 R>>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(text);
}
try {
  categoryId = (await prisma.category.create({ data: { code: `browser-${seed}`, translations: { create: { locale: 'es', name: 'Categoría · prueba aislada' } } } })).id;
  accountId = (await prisma.businessAccount.create({ data: { name: 'Cuenta de prueba aislada', createdById: user.id } })).id;
  businessId = (await prisma.business.create({ data: { businessAccountId: accountId, createdById: user.id, categoryId, slug: `browser-${seed}`, name: 'Negocio · prueba aislada de navegación', lifecycleStatus: 'ACTIVE', publicationStatus: 'PUBLISHED', visibilityStatus: 'VISIBLE' } })).id;
  const offer = await prisma.businessOffer.create({ data: { businessId, categoryId, internalCode: 'QA00001', kind: 'PRODUCT', name: 'Producto · prueba aislada', publicationStatus: 'PUBLISHED' } });
  const review = await prisma.businessReview.create({ data: { businessId, userId: user.id, rating: 4, comment: 'Opinión de prueba aislada para comprobar proporciones y legibilidad.' } });
  await prisma.businessReport.create({ data: { businessId, reporterId: user.id, reason: 'OTHER', description: 'Reporte aislado de comprobación visual.' } });
  await prisma.offerReport.create({ data: { offerId: offer.id, reporterId: user.id, reason: 'OTHER', description: 'Reporte aislado de comprobación visual.' } });
  await prisma.businessReviewReport.create({ data: { reviewId: review.id, reporterId: user.id, reason: 'OTHER', description: 'Reporte aislado de comprobación visual.' } });
  await prisma.supportRequest.createMany({ data: (['NEED', 'SUPPORT', 'SUGGESTION'] as const).map(kind => ({ kind, userId: user.id, businessId, title: `Solicitud de prueba ${kind}`, category: 'Comprobación aislada', description: 'Descripción extensa para comprobar que las bandejas se ajustan a pantallas pequeñas y conservan la legibilidad.' })) });
  providerId = (await prisma.financialProvider.create({ data: { name: `Proveedor de prueba ${seed}`, kind: 'OTHER', currency: 'USD' } })).id;
  const periodStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const periodEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
  await prisma.financialBudget.create({ data: { providerId, name: 'Presupuesto de prueba aislada', amountCop: 50000, periodStart, periodEnd } });
  await prisma.financialConsumption.create({ data: { providerId, externalId: `browser-${seed}`, amountCop: 15000, amountUsd: 4, creditsUsd: 0, dataKind: 'MANUAL', periodStart, periodEnd } });
  await page.goto(`${base}/login`);
  await page.getByLabel('Correo electrónico', { exact: true }).fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  await page.waitForURL('**/dashboard');
  await page.locator('.sidebar-profile-copy strong').filter({ hasText: user.displayName }).waitFor();
  assert.equal(await page.locator('.sidebar-profile-copy small').textContent(), 'Administrador principal');
  for (const [path, label, title] of [['corporate', 'Adjuntar estatuto', 'Estatuto de prueba'], ['legal-documents', 'Adjuntar documento', 'Contrato de prueba'], ['legal-cases', 'Adjuntar soporte', 'Expediente de prueba']]) {
    await page.goto(`${base}/${path}`);
    await page.getByRole('button', { name: label, exact: true }).first().click();
    await page.getByLabel('Título del documento', { exact: true }).fill(title);
    await page.getByLabel('Archivo PDF', { exact: true }).setInputFiles({ name: `${path}.pdf`, mimeType: 'application/pdf', buffer: pdf() });
    await noOverflow(`${path} upload`);
    await page.getByRole('button', { name: 'Guardar documento', exact: true }).click();
    await page.getByRole('heading', { name: title, exact: true }).waitFor();
    await page.getByRole('button', { name: 'Consultar', exact: true }).click();
    await page.getByRole('dialog', { name: title, exact: true }).waitFor();
    await page.getByText('XAMUKO - PDF de prueba aislada', { exact: true }).waitFor();
    const pixels = await page.locator('.ad-pdf-stage canvas').evaluate((canvas: HTMLCanvasElement) => {
      const context = canvas.getContext('2d')!;
      const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
      return data.some((value, index) => index % 4 !== 3 && value < 100);
    });
    assert.ok(pixels, `${path}: PDF actually rendered`);
    await noOverflow(`${path} preview`);
    await screenshot(`${path}-preview`);
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Descargar PDF', exact: true }).click();
    assert.equal((await download).suggestedFilename(), `${path}.pdf`);
    await page.getByRole('button', { name: 'Cerrar ventana', exact: true }).click();
    await page.getByRole('button', { name: `Eliminar ${title}`, exact: true }).click();
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await page.getByRole('heading', { name: title, exact: true }).waitFor();
    await page.getByRole('button', { name: `Eliminar ${title}`, exact: true }).click();
    await page.getByLabel('Motivo de eliminación', { exact: true }).fill('Sustituido durante la prueba de navegación.');
    await page.getByRole('button', { name: 'Mover a la papelera', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: 'Papelera', exact: true }).click();
    await page.getByRole('button', { name: 'Restaurar', exact: true }).click();
    await page.getByRole('button', { name: 'Archivo', exact: true }).click();
    await page.getByRole('heading', { name: title, exact: true }).waitFor();
    await page.getByRole('button', { name: 'Vista de lista', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Vista de lista', exact: true }).getAttribute('aria-pressed'), 'true');
    await page.getByLabel('Buscar documentos', { exact: true }).fill('no-existe-aislado');
    await page.getByRole('button', { name: 'Buscar', exact: true }).click();
    await page.getByRole('heading', { name: 'No encontramos documentos con ese criterio', exact: true }).waitFor();
    checks.push({ path, upload: true, preview: true, download: true, cancelDelete: true, trash: true, restore: true, list: true, search: true });
  }
  await page.goto(`${base}/support`);
  await page.getByRole('button', { name: 'Ver y gestionar', exact: true }).click();
  const detail = page.getByRole('region', { name: 'Detalle de solicitud' });
  await detail.getByLabel('Observación administrativa').fill('Comprobado con una sesión real en el entorno aislado.');
  await detail.getByRole('button', { name: 'Resuelto', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'La decisión quedó registrada' }).waitFor();
  checks.push({ supportResolution: true });
  await page.goto(`${base}/financial-reports`);
  await page.getByRole('row').filter({ hasText: `Proveedor de prueba ${seed}` }).getByRole('button', { name: 'Editar', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Nombre', { exact: true }).fill(`Proveedor revisado ${seed}`);
  await page.getByLabel('Motivo de la modificación').fill('Corrección de nombre en la comprobación aislada.');
  await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Cambios guardados y auditados.' }).waitFor();
  checks.push({ financeUpdateWithAdminSession: true });
  const source = await readFile(resolve('../frontend/apps/admin/src/data/navigation.ts'), 'utf8');
  const routes = [...source.matchAll(/path: '(\/[^']+)'/g)].map(match => match[1]);
  assert.equal(routes.length, 33);
  for (const [device, width, height] of [['desktop', 1440, 1000], ['ipad', 820, 1180], ['mobile', 390, 844]] as const) {
    await page.setViewportSize({ width, height });
    for (const path of routes) {
      await page.goto(`${base}${path}`);
      await page.locator('.ad-workspace-context').waitFor();
      // Some integrations keep connections alive. Wait for the document and
      // the private archive instead of a global network-idle condition.
      await page.waitForLoadState('domcontentloaded');
      if (['/corporate', '/legal-documents', '/legal-cases'].includes(path)) await page.locator('.ad-document-card').first().waitFor();
      await page.waitForTimeout(400);
      await noOverflow(`${device} ${path}`);
      if (await page.locator('.ops-inbox>.page-heading').count()) {
        const heading = await page.locator('.ops-inbox>.page-heading').boundingBox();
        const inbox = await page.locator('.ops-inbox').boundingBox();
        assert.ok(heading && inbox && Math.abs(heading.x - inbox.x) < 1, `${path}: aligned heading`);
      }
      assert.equal(await page.locator(`a.nav-item.active[href="${path}"]`).count(), 1);
      const artwork = await page.locator('.ad-workspace-context>img').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0);
      assert.ok(artwork, `${path}: artwork failed`);
      if (await page.getByRole('group', { name: 'Información del módulo' }).count()) {
        await page.getByRole('button', { name: 'Flujo de trabajo', exact: true }).click();
        await page.getByRole('button', { name: 'Conexiones', exact: true }).click();
        await page.getByRole('button', { name: 'Resumen', exact: true }).click();
      }
      if (path === '/financial-reports') {
        for (const label of ['Presupuestos', 'Consumos', 'Facturas', 'Pagos', 'Alertas', 'Historial de cambios', 'Proveedores']) {
          await page.getByRole('navigation', { name: 'Secciones de gastos' }).getByRole('button', { name: label, exact: true }).click();
          await noOverflow(`${device} finance/${label}`);
        }
      }
      await screenshot(`${device}-${path.slice(1)}`);
      checks.push({ device, path, noOverflow: true, activeRoute: true, artLoaded: true });
    }
  }
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto(`${base}/corporate`);
  await page.getByRole('button', { name: 'Consultar', exact: true }).click();
  await page.getByText('XAMUKO - PDF de prueba aislada', { exact: true }).waitFor();
  await noOverflow('320px PDF');
  await screenshot('mobile-320-pdf');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Adjuntar estatuto', exact: true }).first().click();
  await noOverflow('320px upload');
  await screenshot('mobile-320-upload');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Abrir navegación', exact: true }).click();
  await page.getByRole('button', { name: 'Cerrar menú', exact: true }).waitFor();
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('button', { name: 'Abrir navegación', exact: true }).getAttribute('aria-expanded'), 'false');
  await page.getByRole('button', { name: 'Abrir navegación', exact: true }).click();
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  await page.getByRole('dialog', { name: 'Confirmar cierre de sesión' }).waitFor();
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  await page.waitForURL('**/login');
  await page.goto(`${base}/corporate`);
  await page.waitForURL('**/login');
  checks.push({ mobile320: true, keyboardEscape: true, logoutCancel: true, logout: true, protectedRouteDenied: true });
  assert.deepEqual(errors, []);
  await writeFile(join(output, 'results.json'), JSON.stringify({ passed: true, checks, errors }, null, 2));
  await rm(join(output, 'failure.png'), { force: true });
  console.log(JSON.stringify({ passed: true, routeViewports: 99, documentSections: 3, output }));
} catch (error) {
  await screenshot('failure');
  await writeFile(join(output, 'results.json'), JSON.stringify({ passed: false, checks, errors, failure: String(error) }, null, 2));
  throw error;
} finally {
  await browser.close();
  await prisma.auditLog.deleteMany({ where: { actorUserId: user.id } });
  await prisma.adminDocument.deleteMany({ where: { uploadedById: user.id } });
  await prisma.financialAuditEntry.deleteMany({ where: { actorUserId: user.id } });
  if (providerId) {
    await prisma.financialConsumption.deleteMany({ where: { providerId } });
    await prisma.financialBudget.deleteMany({ where: { providerId } });
    await prisma.financialProvider.delete({ where: { id: providerId } });
  }
  await prisma.supportRequest.deleteMany({ where: { userId: user.id } });
  if (businessId) await prisma.business.delete({ where: { id: businessId } });
  if (accountId) await prisma.businessAccount.delete({ where: { id: accountId } });
  if (categoryId) await prisma.category.delete({ where: { id: categoryId } });
  await prisma.user.delete({ where: { id: user.id } });
  await new Promise<void>(resolve => server.close(() => resolve()));
  await prisma.$disconnect(); await rm(storage, { recursive: true, force: true });
}
