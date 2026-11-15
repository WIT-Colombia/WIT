import assert from 'node:assert/strict';
import { mkdir, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

// Regression check for the real compiled Business CSS, including the current
// BusinessShell header, both catalog modals, and app navigation surfaces.
const cssDirectory = fileURLToPath(new URL('../apps/negocios/dist/assets/', import.meta.url));
const screenshotDirectory = fileURLToPath(new URL('../test-results/business-product-editor/', import.meta.url));
const cssFiles = (await readdir(cssDirectory)).filter(name => name.endsWith('.css')).sort();
assert.ok(cssFiles.length, 'Business build must contain CSS assets');
const css = (await Promise.all(cssFiles.map(name => readFile(join(cssDirectory, name), 'utf8')))).join('\n');
await mkdir(screenshotDirectory, { recursive: true });

const fields = Array.from({ length: 8 }, (_, index) =>
  '<div class="form-field"><label for="f' + index + '">Información del producto ' + (index + 1) + '</label>' +
  '<input id="f' + index + '" placeholder="Describe el producto" /></div>'
).join('');

function fixture(title) {
  const kind = title.endsWith("servicio") ? "servicio" : "producto";
  const heading = kind === "servicio" ? "Servicios" : "Productos";
  return '<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head>' +
    '<body class="catalog-product-editor-active">' +
    '<div class="business-app"><div class="app-content"><div class="body-layout"><div class="business-shell-workspace">' +
    '<header class="business-desktop-header">Encabezado de XAMUKO Business</header>' +
    '<main class="page-content"><div class="catalog-products-design">' +
    '<header class="page-heading catalog-products-heading"><div class="catalog-products-heading-copy">' +
    '<span class="page-eyebrow">TU OFERTA</span><div class="catalog-products-heading-main">' +
    '<span class="catalog-products-heading-icon">⌑</span><div><h1>' + heading + '</h1>' +
    '<p>Administra lo que las personas pueden descubrir en XAMUKO.</p></div></div></div>' +
    '<button class="action-button catalog-products-add" type="button">Agregar ' + kind + '</button></header>' +
    '<section class="surface-card catalog-surface"><div class="catalog-controls"><div class="catalog-toolbar">' +
    '<label class="search-box"><input placeholder="Buscar ' + kind + 's" /></label></div></div>' +
    '<div class="catalog-list"><article class="catalog-row"><div class="catalog-art">✨</div>' +
    '<div class="catalog-info"><h2>Ejemplo</h2><p>Descripción</p><span>$ 20.000 COP</span></div>' +
    '<div class="catalog-interest"><strong>0</strong><small>me gusta</small></div>' +
    '<span class="state-tag on">Activo</span><div class="row-actions"><button>Editar</button>' +
    '<button>Desactivar</button><button class="danger-link">Eliminar</button></div>' +
    '</article></div></section></div></main>' +
    '</div></div></div>' +
    '<header class="mobile-topbar">Encabezado móvil de XAMUKO Business</header>' +
    '<nav class="mobile-nav">Navegación móvil</nav></div>' +
    '<div class="modal-backdrop catalog-product-editor-backdrop" role="presentation">' +
    '<section class="modal-card product-editor-modal catalog-product-editor-dialog" role="dialog" aria-modal="true">' +
    '<div class="modal-heading"><span class="catalog-editor-heading-icon" aria-hidden="true">＋</span>' +
    '<div><span class="page-eyebrow">TU OFERTA</span><h2>' + title + '</h2>' +
    '<p class="product-editor-intro">Completa la información que verán las personas en XAMUKO.</p></div>' +
    '<button type="button" class="close-button" aria-label="Cerrar">×</button></div>' +
    '<form class="modal-form">' + fields +
    '<fieldset class="adult-classification-field"><legend>Restricción de edad</legend>' +
    '<label><input type="radio" /> Apto para todo público</label>' +
    '<label><input type="radio" /> Exclusivo para mayores de 18 años</label></fieldset>' +
    '<label class="product-image-field">Foto del ' + kind + '<input type="file" /></label>' +
    '<div class="modal-actions"><button class="outline-button" type="button">Cancelar</button>' +
    '<button class="action-button" type="submit">Guardar ' + kind + '</button></div></form></section></div>' +
    '</body></html>';
}

function rect(element) {
  const r = element.getBoundingClientRect();
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
}

const browser = await chromium.launch({ headless: true });
try {
  for (const [name, width, height, mobile] of [
    ['iphone-small', 320, 568, true],
    ['iphone', 390, 844, true],
    ['ipad-portrait', 768, 1024, true],
    ['ipad-portrait-wide', 820, 1180, true],
    ['ipad-landscape', 1024, 768, true],
    ['ipad-landscape-wide', 1100, 820, true],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    try {
      for (const title of ['Agregar producto', 'Editar producto', 'Agregar servicio', 'Editar servicio']) {
        await page.setContent(fixture(title));
        await page.addStyleTag({ content: css });
        await page.evaluate(() => {
          const overlay = document.querySelector('.catalog-product-editor-backdrop');
          const viewport = window.visualViewport;
          overlay.style.setProperty('--catalog-editor-viewport-top', (viewport?.offsetTop ?? 0) + 'px');
          overlay.style.setProperty('--catalog-editor-viewport-left', (viewport?.offsetLeft ?? 0) + 'px');
          overlay.style.setProperty('--catalog-editor-viewport-width', (viewport?.width ?? innerWidth) + 'px');
          overlay.style.setProperty('--catalog-editor-viewport-height', (viewport?.height ?? innerHeight) + 'px');
        });
        const before = await page.evaluate(() => {
          const overlay = document.querySelector('.catalog-product-editor-backdrop');
          const dialog = document.querySelector('.catalog-product-editor-dialog');
          const heading = dialog.querySelector('.modal-heading');
          const close = dialog.querySelector('.close-button');
          const bounds = element => {
            const r = element.getBoundingClientRect();
            return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height };
          };
          const c = close.getBoundingClientRect();
          const target = document.elementFromPoint(c.left + c.width / 2, c.top + c.height / 2);
          return {
            viewportHeight: window.visualViewport?.height ?? innerHeight,
            overlay: bounds(overlay), dialog: bounds(dialog), heading: bounds(heading), close: bounds(close),
            topElementIsClose: target === close || close.contains(target),
            backgroundHeaderVisibility: getComputedStyle(document.querySelector('.mobile-topbar')).visibility,
            desktopHeaderVisibility: getComputedStyle(document.querySelector('.business-desktop-header')).visibility,
            navVisibility: getComputedStyle(document.querySelector('.mobile-nav')).visibility,
            scrollHeight: dialog.scrollHeight, clientHeight: dialog.clientHeight,
          };
        });
        const label = name + ' ' + title;
        const listStyles = await page.evaluate(() => {
          const root = document.querySelector('.catalog-products-design');
          const list = root.querySelector('.catalog-list');
          const row = root.querySelector('.catalog-row');
          const title = root.querySelector('.catalog-info h2');
          const add = root.querySelector('.catalog-products-add');
          const actions = row.querySelector('.row-actions');
          return {
            listRadius: getComputedStyle(list).borderRadius,
            rowLayout: getComputedStyle(row).display,
            titleFont: getComputedStyle(title).fontSize,
            addHeight: add.getBoundingClientRect().height,
            actionsLayout: getComputedStyle(actions).display,
          };
        });
        assert.equal(listStyles.rowLayout, 'grid', label + ': catalog uses Products row design');
        assert.equal(listStyles.titleFont, '13px', label + ': heading uses the shared 13px size');
        assert.ok(listStyles.addHeight >= 41, label + ': add button matches the responsive design');
        assert.ok(listStyles.listRadius !== '0px', label + ': catalog uses shared rounded list');
        assert.ok(before.overlay.top >= -2, label + ': overlay starts within visual viewport');
        assert.ok(before.dialog.top >= -2, label + ': dialog header is not clipped at top');
        assert.ok(before.heading.top >= before.dialog.top - 2, label + ': heading visible at dialog top');
        assert.ok(before.close.top >= -1 && before.close.bottom <= before.viewportHeight + 2, label + ': close button fully visible');
        assert.ok(before.close.left >= -1 && before.close.right <= width + 2, label + ': close button fits screen width');
        assert.ok(before.topElementIsClose, label + ': actual click target for close is not blocked by app header');
        assert.equal(before.backgroundHeaderVisibility, 'hidden', label + ': mobile app header cannot obscure editor');
        assert.equal(before.desktopHeaderVisibility, 'hidden', label + ': desktop/tablet app header cannot obscure editor');
        assert.equal(before.navVisibility, 'hidden', label + ': bottom navigation cannot obscure editor');

        await page.locator('.catalog-product-editor-dialog').evaluate(dialog => { dialog.scrollTop = dialog.scrollHeight; });
        const after = await page.evaluate(() => {
          const dialog = document.querySelector('.catalog-product-editor-dialog');
          const heading = dialog.querySelector('.modal-heading').getBoundingClientRect();
          const cancel = dialog.querySelector('.modal-actions .outline-button').getBoundingClientRect();
          const save = dialog.querySelector('.modal-actions .action-button').getBoundingClientRect();
          const viewportHeight = window.visualViewport?.height ?? innerHeight;
          const at = document.elementFromPoint(save.left + save.width / 2, save.top + save.height / 2);
          return {
            headingTop: heading.top, dialogTop: dialog.getBoundingClientRect().top,
            cancelBottom: cancel.bottom, saveBottom: save.bottom, saveTop: save.top,
            viewportHeight, saveVisible: Boolean(at?.closest('.modal-actions')),
          };
        });
        assert.ok(after.headingTop >= after.dialogTop - 2, label + ': sticky title stays inside dialog when scrolling');
        assert.ok(after.saveTop >= -1 && after.saveBottom <= after.viewportHeight + 2, label + ': Save button never clipped');
        assert.ok(after.cancelBottom <= after.viewportHeight + 2, label + ': Cancel button never clipped');
        assert.ok(after.saveVisible, label + ': Save button not covered by app navigation');
        await page.screenshot({
          path: join(screenshotDirectory, name + '-' + (title.endsWith('servicio') ? 'service' : 'product') + '-' + (title.startsWith('Agregar') ? 'create' : 'edit') + '.png'),
          fullPage: false,
        });
        console.log('Business editor visible: ' + label);
      }
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
