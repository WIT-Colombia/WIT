import assert from 'node:assert/strict';
import { mkdir, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const assets = fileURLToPath(new URL('../apps/usuario/dist/assets/', import.meta.url));
const screenshots = fileURLToPath(new URL('../test-results/offer-cards/', import.meta.url));
const cssFiles = (await readdir(assets)).filter(name => name.endsWith('.css')).sort();
assert.ok(cssFiles.length, 'Usuario build must include at least one compiled CSS asset');
const styles = (await Promise.all(cssFiles.map(name => readFile(join(assets, name), 'utf8')))).join('\n');
await mkdir(screenshots, { recursive: true });

function card(kind, promo) {
  const title = kind === 'product'
    ? 'Martillo profesional reforzado de larga duración para trabajos exigentes'
    : 'Instalación y mantenimiento especializado de equipos industriales';
  return '<article class="entity-card entity-offer-card' + (kind === 'service' ? ' entity-service-card' : '') + '" data-kind="' + kind + '">' +
    '<div class="entity-card__image"><span class="entity-offer-badge">25% dto.</span></div>' +
    '<div class="entity-card__content">' +
      '<span class="entity-offer-type">' + (kind === 'product' ? 'Producto' : 'Servicio') + '</span>' +
      '<h3>' + title + '</h3>' +
      '<p class="entity-offer-description">Descripción extensa de las características, materiales, disponibilidad y condiciones del producto o servicio para comprobar que no cambia la altura.</p>' +
      '<a class="entity-establishment" href="#">En Ferretería don Mocho y Servicios Especializados de Palmira →</a>' +
      '<div class="entity-offer-footer"><strong class="entity-offer-price"><span>' + (promo ? '$ 11.250 COP' : '$ 15.000 COP') + '</span>' +
      (promo ? '<del>$ 15.000 COP</del>' : '') +
      '</strong><span class="entity-like-count"><button class="entity-action entity-like entity-product-like" aria-label="Me gusta" type="button">♥</button>5</span></div>' +
    '</div></article>';
}
const markup = {
  home: '<main class="home-page home-v2"><section class="new-products"><div class="new-products__list">' +
    '<div class="new-products__item">' + card('product', true) + '</div>' +
    '<div class="new-products__item">' + card('service', false) + '</div>' +
    '</div></section></main>',
  results: '<main class="results-page"><section class="results-offers results-offer-group"><div class="results-offer-grid">' +
    card('product', true) + card('service', false) + '</div></section></main>',
  business: '<main class="business-detail-page"><div class="business-home-offers-view"><section class="business-offer-grid business-products-grid">' +
    card('product', true) + card('service', false) + '</section></div></main>',
};
const browser = await chromium.launch({ headless: true });
try {
  for (const [device, width, expectedHeight, expectedImage] of [
    ['iphone', 390, 232, 68],
    ['ipad-portrait', 820, 282, 106],
    ['ipad-landscape', 1180, 282, 106],
  ]) {
    const context = await browser.newContext({ viewport: { width, height: 850 } });
    const page = await context.newPage();
    try {
      for (const [scope, html] of Object.entries(markup)) {
        // Home uses a deliberately shorter card; results and business keep their own size.
        const cardHeight = scope === 'home' || scope === 'business'
          ? (device === 'iphone' ? 220 : 270)
          : expectedHeight;
        await page.setContent('<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>' + html + '</body></html>');
        await page.addStyleTag({ content: styles });
        await page.evaluate(() => document.fonts.ready);
        const metrics = await page.locator('.entity-offer-card').evaluateAll(cards => cards.map(card => {
          const box = element => {
            const r = element.getBoundingClientRect();
            return { top: r.top, bottom: r.bottom, height: r.height };
          };
          const image = card.querySelector('.entity-card__image');
          const description = card.querySelector('.entity-offer-description');
          const business = card.querySelector('.entity-establishment');
          const footer = card.querySelector('.entity-offer-footer');
          const like = card.querySelector('.entity-product-like');
          return {
            card: box(card), image: box(image), business: box(business),
            footer: box(footer), like: box(like),
            descriptionDisplay: getComputedStyle(description).display,
            titleClamp: getComputedStyle(card.querySelector('h3')).webkitLineClamp,
            descriptionClamp: getComputedStyle(description).webkitLineClamp,
            establishmentClamp: getComputedStyle(business).webkitLineClamp,
          };
        }));
        assert.equal(metrics.length, 2, device + ' ' + scope + ': both cards rendered');
        for (const [idx, item] of metrics.entries()) {
          const label = device + ' ' + scope + ' card ' + (idx + 1);
          assert.ok(Math.abs(item.card.height - cardHeight) <= 1, label + ': height ' + item.card.height + 'px; expected ' + cardHeight);
          assert.ok(Math.abs(item.image.height - expectedImage) <= 1, label + ': image height ' + item.image.height + 'px; expected ' + expectedImage);
          assert.notEqual(item.descriptionDisplay, 'none', label + ': description remains visible');
          assert.equal(item.titleClamp, '2', label + ': title 2-line clamp');
          assert.equal(item.descriptionClamp, '2', label + ': description 2-line clamp');
          assert.equal(item.establishmentClamp, '2', label + ': establishment 2-line clamp');
          assert.ok(item.business.bottom <= item.footer.top + 1, label + ': business above separator');
          assert.ok(item.footer.bottom <= item.card.bottom + 1, label + ': price and likes inside card');
          assert.ok(item.like.height >= 28, label + ': like button accessible');
        }
        await page.screenshot({ path: join(screenshots, device + '-' + scope + '.png'), fullPage: true });
        console.log('Usuario offer cards OK: ' + device + ' ' + scope + ', ' + cardHeight + 'px');
      }
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
