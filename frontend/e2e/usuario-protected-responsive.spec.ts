import { test, expect } from 'playwright/test';
import { installLocalApiMocks } from './fixtures/localApiMocks';

const widths = [375, 430, 768, 1024, 1440];
const routes = ['/profile', '/settings', '/favorites', '/likes', '/reviews', '/notifications', '/change-password', '/account', '/business/panaderia-fixture'];

for (const width of widths) {
  test(`Usuario autenticado no desborda a ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await installLocalApiMocks(page);
    for (const route of routes) {
      await page.goto(`http://127.0.0.1:5185${route}`, { waitUntil: 'domcontentloaded' });
      await expect.poll(async () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await expect(page.locator('body')).not.toContainText('Error de aplicación');
    }
  });
}

test('Usuario restaura la sesión y muestra el perfil ficticio', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installLocalApiMocks(page);
  await page.goto('http://127.0.0.1:5185/profile', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText(/Hola, Laura Martínez/)).toBeVisible();
  await expect(page.getByText('Tu actividad')).toBeVisible();
});
