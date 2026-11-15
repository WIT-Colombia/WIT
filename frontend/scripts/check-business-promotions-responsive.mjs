import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

// Check the real compiled Business CSS; do not create public previews.
const cssDirectory = fileURLToPath(new URL('../apps/negocios/dist/assets/', import.meta.url));
const files = (await readdir(cssDirectory)).filter(name => name.endsWith('.css')).sort();
assert.ok(files.length, 'Business CSS build is required');
const css = (await Promise.all(files.map(name => readFile(join(cssDirectory, name), 'utf8')))).join('\n');

const svg = '<svg viewBox="0 0 24 24"><path d="M4 7h16M10 4h4m-7 3 .7 13h8.6L17 7"/></svg>';
function shell() {
  return '<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head>' +
    '<body class="promotions-dialog-active"><div class="business-app"><div class="app-content"><div class="body-layout"><div class="business-shell-workspace">' +
    '<header class="business-desktop-header">XAMUKO Business escritorio</header>' +
    '<main class="page-content"><div class="promotions-page">' +
    '<header class="page-heading promotions-heading"><div class="promotions-heading-copy"><span class="promotions-eyebrow">TU OFERTA</span><div class="promotions-heading-main">' +
    '<span class="promotions-heading-icon">' + svg + '</span><div><h1>Ofertas y promociones</h1><p>Publicaciones de tu negocio en XAMUKO.</p></div></div></div>' +
    '<button class="action-button promotions-new" type="button">' + svg + 'Crear publicación</button></header>' +
    '<div class="promotions-workspace"><section class="promotions-list-panel"><div class="promotions-items"><article class="promotion-row">' +
    '<div class="promotion-row-photos"><span>%</span></div><div class="promotion-row-main"><h2>Oferta de ejemplo</h2><p>Un producto en descuento</p></div>' +
    '<div class="promotion-row-actions"><button>Editar</button><button>Finalizar</button><button class="danger">' + svg + 'Eliminar</button></div>' +
    '</article></div></section></div></div></main></div></div></div>' +
    '<header class="mobile-topbar">XAMUKO Business móvil</header><nav class="mobile-nav">Menú móvil</nav></div>';
}
const fields = Array.from({ length: 10 }, (_, index) =>
  '<label>Campo ' + (index + 1) + '<input placeholder="Información de la publicación" /></label>'
).join('');
function editor(title) {
  return shell() +
    '<div class="promotion-editor-overlay" role="presentation"><aside class="promotion-editor promotion-editor-modal" role="dialog" aria-modal="true">' +
    '<div class="promotion-editor-heading"><div><span>TU OFERTA</span><h2>' + title + '</h2><p>Completa la información que verán las personas en XAMUKO.</p></div>' +
    '<button type="button" aria-label="Cerrar formulario">×</button></div>' +
    '<form class="promotion-form promotion-form-offer">' +
    '<fieldset><legend>Tipo de publicación</legend><div class="promotion-type-picker"><button type="button" class="selected">Oferta</button><button type="button">Promoción</button></div></fieldset>' +
    fields + '<div class="promotion-editor-actions"><button type="button" class="outline-button">Vista previa</button>' +
    '<button type="button" class="outline-button">Cancelar</button><button type="submit" class="action-button">Guardar publicación</button></div>' +
    '</form></aside></div></body></html>';
}
function confirm() {
  return shell() +
    '<div class="promotion-confirm-overlay" role="presentation"><section class="promotion-confirm" role="alertdialog" aria-modal="true">' +
    '<div class="promotion-confirm-icon">' + svg + '</div><h2>¿Eliminar esta publicación?</h2>' +
    '<p>“Publicación muy extensa con texto de ejemplo para probar su ajuste en pantallas pequeñas y horizontales” se eliminará. Esta acción no se puede deshacer.</p>' +
    '<div class="promotion-confirm-actions"><button class="subtle-button promotion-confirm-cancel">Cancelar</button>' +
    '<button class="danger-button">' + svg + 'Eliminar publicación</button></div></section></div></body></html>';
}
const sizes = [
  ['desktop', 1440, 900, false],
  ['desktop-compact', 1200, 750, false],
  ['ipad-landscape-wide', 1100, 820, true],
  ['ipad-landscape', 1024, 768, true],
  ['ipad-portrait-wide', 820, 1180, true],
  ['ipad-portrait', 768, 1024, true],
  ['iphone', 390, 844, true],
  ['iphone-small', 320, 568, true],
  ['iphone-landscape', 667, 375, true],
];

const browser = await chromium.launch({ headless: true });
try {
  for (const [sizeName, width, height, mobile] of sizes) {
    const context = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 });
    const page = await context.newPage();
    try {
      for (const [name, markup] of [['create', editor('Nueva oferta o promoción')], ['edit', editor('Editar publicación')], ['delete', confirm()]]) {
        await page.setContent(markup);
        await page.addStyleTag({ content: css });
        await page.evaluate(() => {
          const overlay = document.querySelector('.promotion-editor-overlay, .promotion-confirm-overlay');
          const visual = window.visualViewport;
          overlay.style.setProperty('--promotions-viewport-top', (visual?.offsetTop ?? 0) + 'px');
          overlay.style.setProperty('--promotions-viewport-left', (visual?.offsetLeft ?? 0) + 'px');
          overlay.style.setProperty('--promotions-viewport-width', (visual?.width ?? innerWidth) + 'px');
          overlay.style.setProperty('--promotions-viewport-height', (visual?.height ?? innerHeight) + 'px');
        });
        const before = await page.evaluate(() => {
          const rect = x => { const r = x.getBoundingClientRect(); return { top:r.top, bottom:r.bottom, left:r.left, right:r.right, height:r.height, width:r.width }; };
          const overlay = document.querySelector('.promotion-editor-overlay, .promotion-confirm-overlay');
          const dialog = overlay.querySelector('[role="dialog"], [role="alertdialog"]');
          const isEditor = dialog.classList.contains('promotion-editor-modal');
          const heading = dialog.querySelector(isEditor ? '.promotion-editor-heading' : 'h2');
          const close = dialog.querySelector(isEditor ? '.promotion-editor-heading>button' : '.promotion-confirm-cancel');
          const row = document.querySelector('.promotion-row');
          const rowDelete = document.querySelector('.promotion-row-actions button.danger');
          const viewport = window.visualViewport;
          const r = close.getBoundingClientRect();
          const center = document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
          return {
            viewportHeight: viewport?.height ?? innerHeight, viewportWidth: viewport?.width ?? innerWidth,
            overlay:rect(overlay), dialog:rect(dialog), heading:rect(heading), close:rect(close),
            closeClickable: center===close||close.contains(center),
            row:rect(row), rowDelete:rect(rowDelete),
            rowDeleteHeight:rowDelete.getBoundingClientRect().height,
            headerVisibility:getComputedStyle(document.querySelector('.business-desktop-header')).visibility,
            mobileVisibility:getComputedStyle(document.querySelector('.mobile-topbar')).visibility,
            navVisibility:getComputedStyle(document.querySelector('.mobile-nav')).visibility,
            pageTitleSize:getComputedStyle(document.querySelector('.promotions-heading h1')).fontSize,
            eyebrowSize:getComputedStyle(document.querySelector('.promotions-eyebrow')).fontSize,
            pageDescriptionSize:getComputedStyle(document.querySelector('.promotions-heading p')).fontSize,
          };
        });
        const label = sizeName + ' ' + name;
        assert.ok(before.dialog.top >= -2 && before.dialog.bottom <= before.viewportHeight+2, label + ': dialog within visible viewport');
        assert.ok(before.dialog.left >= -2 && before.dialog.right <= before.viewportWidth+2, label + ': dialog fits width');
        assert.ok(before.heading.top >= -2 && before.heading.bottom <= before.viewportHeight+2, label + ': heading fully visible');
        assert.ok(before.close.top >= -2 && before.close.bottom <= before.viewportHeight+2, label + ': close/cancel visible');
        assert.ok(before.closeClickable, label + ': header does not block close/cancel');
        assert.ok(before.rowDelete.height >= 42, label + ': Eliminar has touch-sized height');
        assert.ok(before.rowDelete.left >= before.row.left-1 && before.rowDelete.right <= before.row.right+1, label + ': Eliminar stays inside row');
        assert.ok(Math.abs(parseFloat(before.pageTitleSize) - Math.max(28, Math.min(33, width * 0.024))) < 0.15, label + ': title follows Inicio responsive typography');
        assert.equal(before.eyebrowSize, width <= 700 ? '10px' : '11px', label + ': eyebrow follows Inicio typography');
        assert.equal(before.pageDescriptionSize, width <= 700 ? '12px' : '13px', label + ': description follows Inicio typography');
        if (width <= 1100) {
          assert.equal(before.headerVisibility, 'hidden', label + ': desktop/tablet header hidden');
          assert.equal(before.mobileVisibility, 'hidden', label + ': mobile header hidden');
          assert.equal(before.navVisibility, 'hidden', label + ': bottom navigation hidden');
        }
        if (name !== 'delete') {
          await page.locator('.promotion-editor-modal').evaluate(element => { element.scrollTop = element.scrollHeight; });
          const after = await page.evaluate(() => {
            const heading = document.querySelector('.promotion-editor-heading');
            const actions = document.querySelector('.promotion-editor-actions');
            const submit = actions.querySelector('.action-button');
            const r = submit.getBoundingClientRect(), h = heading.getBoundingClientRect();
            const viewport = window.visualViewport?.height ?? innerHeight;
            const hit = document.elementFromPoint(r.left + r.width/2, r.top + r.height/2);
            return { headingTop:h.top, actionsTop:actions.getBoundingClientRect().top, bottom:r.bottom, top:r.top, viewport, submitClickable:hit===submit||submit.contains(hit) };
          });
          assert.ok(after.headingTop >= -2, label + ': heading sticks to top while scrolling');
          assert.ok(after.top >= -2 && after.bottom <= after.viewport+2, label + ': submit fits viewport after scrolling');
          assert.ok(after.submitClickable, label + ': submit button is clickable');
        } else {
          const buttons = await page.evaluate(() => {
            const actions = document.querySelector('.promotion-confirm-actions');
            return [...actions.querySelectorAll('button')].map(button => {
              const r = button.getBoundingClientRect();
              const hit = document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
              return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:r.height,clickable:hit===button||button.contains(hit)};
            });
          });
          for (const [i, b] of buttons.entries()) {
            assert.ok(b.top >= -2 && b.bottom <= before.viewportHeight+2, label + ': confirm action ' + i + ' vertical bounds');
            assert.ok(b.left >= -2 && b.right <= before.viewportWidth+2, label + ': confirm action ' + i + ' horizontal bounds');
            assert.ok(b.height >= 44 && b.clickable, label + ': confirm action ' + i + ' accessible');
          }
        }
        console.log('Promociones responsive verified:', label);
      }
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
