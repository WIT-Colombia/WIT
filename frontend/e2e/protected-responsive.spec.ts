import { test, expect } from 'playwright/test';
import { installLocalApiMocks } from './fixtures/localApiMocks';

const widths = [375, 430, 768, 1024, 1440];
const businessRoutes = ['/','/mi-negocio','/mis-negocios','/mi-negocio/detalle/0','/mi-negocio/modalidades','/productos','/servicios','/ofertas','/opiniones','/estadisticas','/notificaciones','/colaboradores','/configuracion','/perfil','/mas','/ayuda'];
const adminRoutes = ['/dashboard','/businesses','/businesses/fixture-business-001','/reports','/reviews','/pioneers','/verifications','/users','/content','/needs','/zones','/categories','/notifications','/audit','/settings','/change-password'];

for (const width of widths) {
  test(`Business protegido no desborda a ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await installLocalApiMocks(page);
    for (const route of businessRoutes) {
      await page.goto(`http://127.0.0.1:5186${route}`, { waitUntil: 'domcontentloaded' });
      await expect.poll(async () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await expect(page.locator('body')).not.toContainText('Error de aplicación');
    }
  });

  test(`Admin protegido no desborda a ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await installLocalApiMocks(page);
    for (const route of adminRoutes) {
      await page.goto(`http://127.0.0.1:5187${route}`, { waitUntil: 'domcontentloaded' });
      await expect.poll(async () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await expect(page.locator('body')).not.toContainText('Error de aplicación');
    }
  });
}

test('los fixtures desbloquean sesión y muestran datos representativos', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installLocalApiMocks(page);
  await page.goto(`http://127.0.0.1:5186/estadisticas`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Panadería Patico (prueba)')).toBeVisible();
  await expect(page.getByText(/estadística|analítica/i).first()).toBeVisible();
});

test('el detalle de Business conserva la ruta de fixture', async ({ page }) => {
  await installLocalApiMocks(page);
  await page.goto('http://127.0.0.1:5187/businesses/demo-cafe', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('La Arepería de Majo')).toBeVisible();
});
