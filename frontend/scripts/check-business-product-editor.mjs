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


/* Confirmación de Eliminar en los dos catálogos, con el mismo AppShell real
   y sus cabeceras para comprobar que ninguna queda encima del modal. */
function deleteFixture(kind) {
  const markup = fixture('Agregar ' + kind);
  const editorStart = markup.indexOf('<div class="modal-backdrop catalog-product-editor-backdrop" role="presentation">');
  assert.ok(editorStart > 0, 'Catalog fixture must include the editor portal');
  const deleteButton = '<button class="danger-link">Eliminar</button>';
  const withIcon = '<button type="button" class="danger-link"><svg class="catalog-action-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 4h4"/></svg>Eliminar</button>';
  const shell = markup.slice(0, editorStart).replace(deleteButton, withIcon);
  const trashIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 4h4m-7 3 .7 13h8.6L17 7M10 11v6m4-6v6"/></svg>';
  const itemName = 'Servicio de mantenimiento especializado e instalación a domicilio muy extenso para probar el ancho';
  return shell + '<div class="modal-backdrop catalog-delete-backdrop" role="presentation">' +
    '<section class="modal-card confirm-card catalog-delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-title" aria-describedby="delete-copy">' +
    '<div class="catalog-delete-heading"><span class="catalog-delete-heading-icon" aria-hidden="true">' + trashIcon + '</span>' +
    '<span class="catalog-delete-eyebrow">CATÁLOGO XAMUKO BUSINESS</span></div>' +
    '<h2 id="delete-title">¿Eliminar ' + kind + '?</h2>' +
    '<p id="delete-copy" class="catalog-delete-copy">El ' + kind + ' <strong>“' + itemName + '”</strong> se quitará de tu catálogo.</p>' +
    '<div class="modal-actions catalog-delete-actions">' +
    '<button type="button" class="outline-button catalog-delete-cancel">Cancelar</button>' +
    '<button type="button" class="danger-button catalog-delete-confirm">' + trashIcon + 'Eliminar ' + kind + '</button>' +
    '</div></section></div></body></html>';
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
          const eyebrow = root.querySelector('.catalog-products-heading .page-eyebrow');
          const pageTitle = root.querySelector('.catalog-products-heading h1');
          const description = root.querySelector('.catalog-products-heading p');
          const add = root.querySelector('.catalog-products-add');
          const actions = row.querySelector('.row-actions');
          return {
            listRadius: getComputedStyle(list).borderRadius,
            rowLayout: getComputedStyle(row).display,
            titleFont: getComputedStyle(title).fontSize,
            headingEyebrowFont: getComputedStyle(eyebrow).fontSize,
            headingTitleFont: getComputedStyle(pageTitle).fontSize,
            headingDescriptionFont: getComputedStyle(description).fontSize,
            addHeight: add.getBoundingClientRect().height,
            actionsLayout: getComputedStyle(actions).display,
          };
        });
        assert.equal(listStyles.rowLayout, 'grid', label + ': catalog uses Products row design');
        assert.equal(listStyles.titleFont, '13px', label + ': product/service card title remains 13px');
        assert.equal(listStyles.headingEyebrowFont, width <= 700 ? '10px' : '11px', label + ': section eyebrow matches Inicio');
        assert.equal(listStyles.headingTitleFont, '28px', label + ': section title matches Inicio at tested viewports');
        assert.equal(listStyles.headingDescriptionFont, width <= 700 ? '12px' : '13px', label + ': description matches Inicio');
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

  // Eliminar debe funcionar sin recortes del header tanto en Servicios como
  // en Productos: escritorio, seis variantes de iPhone/iPad y altura reducida.
  for (const [name, width, height, mobile] of [
    ['desktop', 1440, 900, false],
    ['iphone-small', 320, 568, true],
    ['iphone', 390, 844, true],
    ['iphone-landscape', 667, 375, true],
    ['ipad-portrait', 768, 1024, true],
    ['ipad-portrait-wide', 820, 1180, true],
    ['ipad-landscape', 1024, 768, true],
    ['ipad-landscape-wide', 1100, 820, true],
  ]) {
    const context = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 });
    const page = await context.newPage();
    try {
      for (const kind of ['producto', 'servicio']) {
        await page.setContent(deleteFixture(kind));
        await page.addStyleTag({ content: css });
        await page.evaluate(() => {
          const overlay = document.querySelector('.catalog-delete-backdrop');
          const viewport = window.visualViewport;
          overlay.style.setProperty('--catalog-editor-viewport-top', (viewport?.offsetTop ?? 0) + 'px');
          overlay.style.setProperty('--catalog-editor-viewport-left', (viewport?.offsetLeft ?? 0) + 'px');
          overlay.style.setProperty('--catalog-editor-viewport-width', (viewport?.width ?? innerWidth) + 'px');
          overlay.style.setProperty('--catalog-editor-viewport-height', (viewport?.height ?? innerHeight) + 'px');
        });
        const measurement = await page.evaluate(() => {
          const box = element => {
            const b = element.getBoundingClientRect();
            return { top: b.top, bottom: b.bottom, left: b.left, right: b.right, width: b.width, height: b.height };
          };
          const overlay = document.querySelector('.catalog-delete-backdrop');
          const dialog = document.querySelector('.catalog-delete-dialog');
          const title = dialog.querySelector('#delete-title');
          const cancel = dialog.querySelector('.catalog-delete-cancel');
          const confirm = dialog.querySelector('.catalog-delete-confirm');
          const item = document.querySelector('.catalog-row');
          const rowButton = item.querySelector('.row-actions button.danger-link');
          const visible = (button) => {
            const r = button.getBoundingClientRect();
            const target = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
            return target === button || button.contains(target);
          };
          const visual = window.visualViewport;
          return {
            viewportWidth: visual?.width ?? innerWidth,
            viewportHeight: visual?.height ?? innerHeight,
            overlay: box(overlay), dialog: box(dialog), title: box(title), cancel: box(cancel), confirm: box(confirm),
            rowButton: box(rowButton), row: box(item),
            cancelClickable: visible(cancel), confirmClickable: visible(confirm),
            rowButtonFont: getComputedStyle(rowButton).fontSize,
            headerVisibility: getComputedStyle(document.querySelector('.mobile-topbar')).visibility,
            ipadHeaderVisibility: getComputedStyle(document.querySelector('.business-desktop-header')).visibility,
            navVisibility: getComputedStyle(document.querySelector('.mobile-nav')).visibility,
            dialogCanScroll: dialog.scrollHeight > dialog.clientHeight,
          };
        });
        const label = name + ' Eliminar ' + kind;
        assert.ok(measurement.overlay.top >= -2, label + ': overlay starts inside viewport');
        assert.ok(measurement.dialog.top >= -2, label + ': dialog is not under the header');
        assert.ok(measurement.dialog.bottom <= measurement.viewportHeight + 2, label + ': dialog bottom not clipped');
        assert.ok(measurement.dialog.left >= -1 && measurement.dialog.right <= measurement.viewportWidth + 2, label + ': dialog fits horizontally');
        assert.ok(measurement.title.top >= -1 && measurement.title.bottom <= measurement.viewportHeight + 2, label + ': title completely visible');
        for (const key of ['cancel', 'confirm']) {
          const r = measurement[key];
          assert.ok(r.left >= -1 && r.right <= measurement.viewportWidth + 2, label + ': ' + key + ' fits horizontally');
          assert.ok(r.top >= -1 && r.bottom <= measurement.viewportHeight + 2, label + ': ' + key + ' fits vertically');
          assert.ok(r.height >= 44, label + ': ' + key + ' has a touch-size button');
        }
        assert.ok(measurement.cancelClickable, label + ': Cancelar is not covered by Business header');
        assert.ok(measurement.confirmClickable, label + ': Eliminar is not covered by Business header');
        assert.ok(measurement.rowButton.height >= 42, label + ': Eliminar in the list has touch-sized height');
        assert.ok(measurement.rowButton.left >= measurement.row.left - 1 && measurement.rowButton.right <= measurement.row.right + 1, label + ': row delete button does not overflow');
        assert.equal(measurement.rowButtonFont, '11px', label + ': delete row typography is consistent');
        if (width <= 1100) {
          assert.equal(measurement.headerVisibility, 'hidden', label + ': mobile Business header hidden while confirming');
          assert.equal(measurement.ipadHeaderVisibility, 'hidden', label + ': tablet Business header hidden while confirming');
          assert.equal(measurement.navVisibility, 'hidden', label + ': mobile navigation hidden while confirming');
        }
        await page.screenshot({
          path: join(screenshotDirectory, name + '-' + kind + '-delete.png'),
          fullPage: false,
        });
        console.log('Business delete dialog visible: ' + label);
      }
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
