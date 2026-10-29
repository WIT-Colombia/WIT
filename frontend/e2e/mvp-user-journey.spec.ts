import { test, expect } from 'playwright/test';

test.describe('MVP Usuario con API simulada', () => {
  test('busca, abre ficha y ofrece contacto/navegación', async ({ page }) => {
    await page.route('**/api/v1/public/search**', async route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ businesses: [{ publicId: 'b1', name: 'Café Palmira', description: 'Café local', category: { name: 'Cafeterías' }, location: { cityName: 'Palmira', regionName: 'Valle', address: 'Carrera 1', latitude: 3.539, longitude: -76.303 }, contacts: { phone: '+573001234567', whatsapp: '+573001234567' }, coverPhoto: null, profilePhoto: null }], products: [], services: [], pagination: { businesses: { total: 1, totalPages: 1 }, products: { total: 0, totalPages: 0 }, services: { total: 0, totalPages: 0 } } }) }));
    await page.route('**/api/v1/public/businesses/b1', async route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ business: { publicId: 'b1', name: 'Café Palmira', description: 'Café local', category: { name: 'Cafeterías' }, location: { cityName: 'Palmira', regionName: 'Valle', address: 'Carrera 1', latitude: 3.539, longitude: -76.303 }, contacts: { phone: '+573001234567', whatsapp: '+573001234567', email: null, website: null }, gallery: [], products: [], services: [], modalities: [] } }) }));
    await page.goto('/results?q=cafe');
    await expect(page.getByText('Café Palmira')).toBeVisible();
    await page.getByRole('link', { name: 'Ver negocio →', exact: true }).click();
    await expect(page.getByText('Café local')).toBeVisible();
    await expect(page.getByRole('link', { name: /WhatsApp/i })).toHaveAttribute('href', /wa\.me\/573001234567/);
    await expect(page.getByRole('link', { name: /Llamar/i })).toHaveAttribute('href', 'tel:+573001234567');
    await expect(page.getByRole('link', { name: /Cómo llegar/i }).first()).toHaveAttribute('href', /\/directions\?businessId=b1/);
  });
});
