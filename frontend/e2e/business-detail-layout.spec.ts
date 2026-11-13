import { expect, test } from 'playwright/test';

const fixture = {
  publicId: 'layout-business', name: 'Netstudio', description: 'Servicio de creación de redes locales con usuario administrador para llevar un mejor control de los protocolos.',
  category: { id: 'tech', code: 'tech', name: 'Servicios Técnicos', iconKey: null },
  location: { cityName: 'Santiago de Cali', regionName: 'Valle del Cauca', address: 'Calle 10 # 12-34', latitude: 3.45, longitude: -76.53, visibility: 'PUBLIC' },
  contacts: { phone: '+573001234567', whatsapp: '+573001234567', email: null, website: 'https://example.com' },
  gallery: [], coverPhoto: null, profilePhoto: null, products: [], services: [],
  modalities: [{ type: 'PHYSICAL', hours: Array.from({ length: 7 }, (_, day) => ({ dayOfWeek: String(day), isClosed: day === 0, opensAt: day === 0 ? null : '08:00', closesAt: day === 0 ? null : '23:59' })) }],
};
const products = ['Cámaras de seguridad', 'Redes locales (LAN)', 'Soporte técnico'].map((name, index) => ({
  id: `offer-${index}`, name, description: 'Instalación, configuración y mantenimiento',
  category: fixture.category, price: { amount: String(80000 + index * 70000), currency: 'COP', text: null, negotiable: false }, photos: [],
}));

test('Usuario: ficha de negocio conserva composición y navegación responsive', async ({ page }, testInfo) => {
  await page.route('**/api/v1/public/businesses/layout-business', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ business: fixture }) }));
  await page.route('**/api/v1/public/businesses/layout-business/products', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ products }) }));
  await page.route('**/api/v1/public/businesses/layout-business/services', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ services: [] }) }));
  await page.route('**/api/v1/public/businesses/layout-business/reviews**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ reviews: [], summary: { average: null, total: 0 } }) }));
  await page.goto('/business/layout-business?tab=info');
  await expect(page.getByRole('heading', { name: 'Netstudio', exact: true }).first()).toBeVisible();
  for (const width of [1440, 1169, 1024, 820, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    const metrics = await page.evaluate(() => {
      const rect = (selector: string) => document.querySelector(selector)?.getBoundingClientRect();
      const actionBox = (selector: string) => {
        const box = rect(`.business-detail-actions ${selector}`);
        return box && { x: box.x, y: box.y, right: box.right, bottom: box.bottom, height: box.height };
      };
      return { overflow: document.documentElement.scrollWidth > innerWidth + 1, hero: rect('.business-detail-hero'), tabs: rect('.business-tabs'), hours: rect('.business-aside-block'), card: rect('.public-digital-card'), actions: [actionBox('.business-header-call'), actionBox('.business-header-whatsapp'), actionBox('.business-website-button'), actionBox('.business-primary-action'), actionBox('.business-favorite-action')] };
    });
    expect(metrics.overflow, `${width}px should not scroll horizontally`).toBe(false);
    expect(metrics.hero?.width).toBeGreaterThan(0);
    expect(metrics.tabs?.width).toBeGreaterThan(0);
    expect(metrics.hours?.width).toBeGreaterThan(0);
    expect(metrics.card?.width).toBeGreaterThan(0);
    if (width > 700) expect(metrics.hours!.right).toBeLessThan(metrics.card!.left);
    else expect(metrics.hours!.bottom).toBeLessThan(metrics.card!.top);
    const [call, whatsapp, website, directions, favorite] = metrics.actions;
    expect(call && whatsapp && website && directions && favorite).toBeTruthy();
    expect(metrics.actions.every(action => action!.height >= 44), `${width}px: botones táctiles`).toBe(true);
    expect(call!.x).toBeLessThan(whatsapp!.x);
    if (width > 1150) {
      expect(call!.y).toBe(website!.y);
      expect(call!.y).toBe(directions!.y);
    } else {
      expect(call!.y).toBe(whatsapp!.y);
      expect(website!.y).toBe(directions!.y);
      expect(website!.y).toBeGreaterThan(call!.bottom);
    }
    expect(favorite!.y).toBeGreaterThan(directions!.bottom);
    await page.screenshot({ path: testInfo.outputPath(`business-${width}.png`), fullPage: true });
  }
  await page.getByRole('button', { name: 'Ver todo' }).click();
  await expect(page.getByRole('button', { name: 'Productos', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('link', { name: /Cómo llegar/ }).first()).toHaveAttribute('href', '/directions?businessId=layout-business');

  const photo = (index: number) => ({ id: `photo-${index}`, url: `https://layout.example.invalid/photo-${index}.svg`, altText: null, sortOrder: index, isCover: index === 1 });
  await page.route('**/photo-*.svg', route => route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#dcd5f9"/></svg>' }));
  await page.route('**/api/v1/public/businesses/layout-business', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ business: { ...fixture, pioneerNumber: 4, modalities: [...fixture.modalities, { type: 'DELIVERY', hours: [] }], coverPhoto: photo(1), profilePhoto: photo(4), gallery: [photo(1), photo(2), photo(3)] } }) }));
  await page.route('**/api/v1/public/businesses/layout-business/reviews**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ reviews: [], summary: { average: 5, total: 27 } }) }));
  await page.setViewportSize({ width: 1169, height: 900 });
  await page.goto('/business/layout-business');
  await expect(page.getByRole('button', { name: 'Foto siguiente' })).toBeVisible();
  await page.waitForFunction(() => {
    const image = document.querySelector('.business-detail-photo-trigger img');
    return image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0;
  });
  await page.screenshot({ path: testInfo.outputPath('business-with-gallery-1169.png'), fullPage: true });
  await page.getByRole('button', { name: 'Foto siguiente' }).click();
  await expect(page.locator('.business-header-counter')).toHaveText('2 / 3');

  const longProducts = products.map(product => ({ ...product, name: 'Instalación y mantenimiento especializado de redes empresariales', description: 'Diseño, instalación, configuración y mantenimiento preventivo de redes para empresas en toda la ciudad.', business: { name: 'Establecimiento comercial con nombre extenso' }, isOffer: true, discount: '25% dto.', originalPrice: '1500000', price: { ...product.price, amount: '1125000' } }));
  await page.route('**/api/v1/public/businesses/layout-business/products', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ products: longProducts }) }));
  for (const width of [1169, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/business/layout-business');
    await expect(page.locator('.business-popular-grid .entity-offer-card').first()).toBeVisible();
    const fit = await page.locator('.business-popular-grid .entity-offer-card').first().evaluate(card => {
      const rect = (selector: string) => card.querySelector(selector)?.getBoundingClientRect();
      const description = rect('.entity-offer-description');
      const establishment = rect('.entity-establishment');
      const footer = rect('.entity-offer-footer');
      const bounds = card.getBoundingClientRect();
      return { descriptionBeforeEstablishment: Boolean(description && establishment && description.bottom <= establishment.top + 1), establishmentBeforeFooter: Boolean(establishment && footer && establishment.bottom <= footer.top + 1), footerInsideCard: Boolean(footer && footer.bottom <= bounds.bottom + 1), noPageOverflow: document.documentElement.scrollWidth <= innerWidth + 1 };
    });
    expect(fit, `${width}px: long promoted product must fit`).toEqual({ descriptionBeforeEstablishment: true, establishmentBeforeFooter: true, footerInsideCard: true, noPageOverflow: true });
  }
});
