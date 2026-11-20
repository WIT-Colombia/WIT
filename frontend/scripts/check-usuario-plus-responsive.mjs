import assert from 'node:assert/strict';
import { mkdir, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

// Inspect the production-built Usuario CSS, not hand-picked mock CSS.
// Fixtures are deliberately static: these checks validate visual geometry,
// typography, focus and horizontal overflow; the React behavior is covered by Vitest.
const assets = fileURLToPath(new URL('../apps/usuario/dist/assets/', import.meta.url));
const output = fileURLToPath(new URL('../test-results/usuario-plus/', import.meta.url));
const cssFiles = (await readdir(assets)).filter(file => file.endsWith('.css')).sort();
assert.ok(cssFiles.length > 0, 'Usuario compiled CSS is required');
const stylesheet = (await Promise.all(cssFiles.map(file => readFile(join(assets, file), 'utf8')))).join('\n');
assert.ok(stylesheet.includes('plus-panel'), 'Plus section styles must exist in the Usuario build');
assert.ok(!stylesheet.includes('plus-spotlight'), 'Legacy oversized featured cards must not remain in compiled CSS');
await mkdir(output, { recursive: true });

const fixture = `<!doctype html><html lang="es"><head><meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>*,*::before,*::after{box-sizing:border-box}html,body{margin:0}body{font-family:Arial,sans-serif}</style>
  </head><body><div class="user-content-page plus-page"><main class="user-content-main">
    <a class="plus-back" href="#inicio">← Volver al perfil</a>
    <header class="plus-hero">
      <span class="plus-kicker">MEMBRESÍA XAMUKO · PRUEBA VISUAL</span>
      <h1><span class="plus-hero-crown">♛</span> Xamuko Plus</h1>
      <p>Descubre oportunidades, organiza tus favoritos y aprovecha mejor tu ciudad.</p>
      <div class="plus-hero-state">Tu membresía Plus está activa · Ejemplo</div>
    </header>
    <div class="plus-welcome">
      <div class="plus-welcome-copy">
        <span class="plus-overline">TU ESPACIO PERSONAL</span>
        <h2>Todo lo que te interesa, en un solo lugar.</h2>
        <p>Explora novedades, sigue precios y organiza tus próximas visitas.</p>
      </div>
      <span class="plus-welcome-icon" aria-hidden="true">♛</span>
    </div>
    <div class="plus-overview" aria-label="Indicadores de demostración">
      ${[['5','Novedades recientes'],['3','Precios seguidos'],['2','Colecciones'],['1','Búsquedas guardadas']].map(([n,label])=>
        `<a href="#radar" class="plus-overview-card"><span class="plus-overview-icon">☆</span><strong>${n}</strong><span>${label}</span><span class="plus-overview-arrow">↗</span></a>`).join('')}
    </div>
    <nav class="plus-section-nav" aria-label="Herramientas Plus">
      <a href="#radar">Novedades</a><a href="#prices">Precios</a>
      <a href="#compare">Comparador</a><a href="#collections">Colecciones</a>
      <a href="#searches">Búsquedas</a><a href="#routes">Rutas</a>
    </nav>
    <section class="plus-panel" id="radar" tabindex="-1">
      <div class="plus-heading"><div><span>01 · DESCUBRIMIENTO</span>
        <h2>Tu radar de novedades</h2><p>Promociones recientes de negocios favoritos.</p></div>
        <label class="plus-toggle"><input type="checkbox"> Recibir avisos</label></div>
      <div class="plus-delivery-controls"><label>¿Cómo quieres recibir los avisos?
        <select><option>Avisos inmediatos</option><option>Un resumen diario</option></select></label>
        <div class="plus-digest-schedule"><label>Zona horaria
          <input value="America/Bogota" readonly></label>
          <label>Hora del resumen<select><option>08:00</option></select></label>
          <button class="plus-button plus-button-secondary" type="button">Guardar horario</button>
        </div><p>Los avisos se reciben dentro de Xamuko.</p></div>
    </section>
    <section class="plus-panel" id="prices" tabindex="-1">
      <div class="plus-heading"><div><span>02 · AHORRO</span><h2>Seguimiento de precios</h2>
        <p>Recibe avisos cuando los precios bajen.</p></div></div>
      <div class="plus-list"><div class="plus-list-row">
        <span class="plus-row-symbol">◇</span>
        <span><strong>Producto de ejemplo con descripción extendida para comprobar el ajuste</strong>
          <small>Negocio de prueba · COP $4.950</small></span>
        <div class="plus-row-buttons"><button type="button">Historial</button>
          <button type="button">Cambiar objetivo</button><button type="button">Quitar</button></div>
        <p class="plus-target-summary">Objetivo: COP $4.200 · Alerta pendiente</p>
      </div></div>
      <div class="plus-target-editor"><label>Precio objetivo (COP)
        <input type="number" value="4200" readonly></label>
        <button class="plus-button" type="button">Guardar objetivo</button>
        <button class="plus-button plus-button-secondary" type="button">Quitar objetivo</button>
      </div>
    </section>
    <section class="plus-panel" id="routes" tabindex="-1">
      <div class="plus-heading"><div><span>05 · EXPLORACIÓN</span><h2>Rutas con varios negocios</h2>
        <p>Organiza tu recorrido por cercanía geográfica.</p></div></div>
      <div class="plus-routes-list">
        <label><input type="checkbox" checked readonly> Negocio de ejemplo A</label>
        <label><input type="checkbox" checked readonly> Negocio de ejemplo B</label>
      </div>
      <div class="plus-route-actions">
        <label>Transporte<select><option>En vehículo</option></select></label>
        <label>Salida prevista<input type="datetime-local" value="2026-11-20T10:00" readonly></label>
        <button type="button" class="plus-button plus-button-secondary">Optimizar recorrido</button>
        <a class="plus-button" href="#routes">Abrir ruta en Google Maps</a>
      </div>
      <div class="plus-route-itinerary"><strong>Recorrido optimizado por cercanía</strong>
        <ol><li>Negocio A <small>Abierto según horario publicado</small></li>
          <li>Negocio B <small class="plus-closed-warning">Advertencia: posiblemente cerrado</small></li></ol>
      </div>
    </section>
    <section class="plus-panel" id="compare" tabindex="-1"><h2>Comparador</h2></section>
    <section class="plus-panel" id="collections" tabindex="-1"><h2>Colecciones</h2></section>
    <section class="plus-panel" id="searches" tabindex="-1"><h2>Búsquedas</h2></section>
  </main></div></body></html>`;

const browser = await chromium.launch({ headless: true });
try {
  for (const [name, width, height] of [
    ['iphone-small',360,780],['iphone',390,844],['ipad-portrait',820,1180],
    ['ipad-landscape',1180,820],['desktop',1440,900],
  ]) {
    const context = await browser.newContext({ viewport:{width,height}, deviceScaleFactor:1 });
    const page = await context.newPage();
    try {
      await page.setContent(fixture);
      await page.addStyleTag({content:stylesheet});
      await page.evaluate(() => document.fonts.ready);
      const actual = await page.evaluate(() => {
        const bounds = node => node.getBoundingClientRect();
        const panels = [...document.querySelectorAll('.plus-panel')];
        const three = ['radar','prices','routes'].map(id => document.getElementById(id));
        const buttons = [...document.querySelectorAll('.plus-button,.plus-row-buttons button')];
        const fields = [...document.querySelectorAll(
          '.plus-delivery-controls input:not([type="checkbox"]),.plus-delivery-controls select,' +
          '.plus-target-editor input,.plus-target-editor select,.plus-route-actions input,.plus-route-actions select'
        )];
        return {
          docWidth:document.documentElement.scrollWidth,
          viewport:document.documentElement.clientWidth,
          spotlightCount:document.querySelectorAll('.plus-spotlight,.plus-spotlight-card').length,
          panelCount:panels.length,
          targetCount:three.filter(Boolean).length,
          panelTop:three.map(node=>bounds(node).top),
          panelWidth:three.map(node=>bounds(node).width),
          panelBackground:three.map(node=>getComputedStyle(node).backgroundColor),
          panelRadius:three.map(node=>getComputedStyle(node).borderRadius),
          headingSizes:three.map(node=>parseFloat(getComputedStyle(node.querySelector('h2')).fontSize)),
          buttonHeights:buttons.map(node=>bounds(node).height),
          fieldHeights:fields.map(node=>bounds(node).height),
          fieldFontSizes:fields.map(node=>parseFloat(getComputedStyle(node).fontSize)),
          fieldWidths:fields.map(node=>bounds(node).width),
          heroBackground:getComputedStyle(document.querySelector('.plus-hero')).backgroundImage,
          overflowing:panels.filter(node=>bounds(node).right > document.documentElement.clientWidth+1).map(node=>node.id),
        };
      });
      const prefix = name+': ';
      assert.equal(actual.spotlightCount,0,prefix+'no oversized featured cards');
      assert.equal(actual.panelCount,6,prefix+'six peer tools in same visual hierarchy');
      assert.equal(actual.targetCount,3,prefix+'three updated tools in the usual panels');
      assert.ok(actual.docWidth<=actual.viewport+1,prefix+'no horizontal scroll ('+actual.docWidth+' > '+actual.viewport+')');
      assert.deepEqual(actual.overflowing,[],prefix+'all panels inside the viewport');
      assert.ok(actual.panelTop[0]<actual.panelTop[1] && actual.panelTop[1]<actual.panelTop[2],
        prefix+'panels appear in the normal vertical sequence');
      assert.ok(actual.headingSizes.every(size=>size>=19),prefix+'legible panel titles');
      assert.ok(actual.buttonHeights.every(h=>h>=44),prefix+'touch targets at least 44px high');
      assert.ok(actual.fieldHeights.length>=5,prefix+'textbox and select controls included');
      assert.ok(actual.fieldHeights.every(h=>h>=46),prefix+'textbox and selects at least 46px high');
      assert.ok(Math.max(...actual.fieldHeights)-Math.min(...actual.fieldHeights)<=1,
        prefix+'textbox and select heights are harmonious');
      assert.ok(actual.fieldWidths.every(w=>w>150 && w<=actual.viewport),
        prefix+'fields fit their parent and remain usable');
      assert.ok(actual.fieldFontSizes.every(size=>size>=(width<=700?16:14)),
        prefix+'inputs are readable without mobile browser zoom');
      assert.equal(new Set(actual.panelBackground).size,1,prefix+'same panel background');
      assert.equal(new Set(actual.panelRadius).size,1,prefix+'same panel corners');
      assert.ok(actual.heroBackground.includes('gradient'),prefix+'brand gradient preserved');
      await page.locator('.plus-section-nav a[href="#routes"]').click();
      assert.equal(new URL(page.url()).hash,'#routes',prefix+'existing route navigation works');
      await page.screenshot({ path:join(output,name+'.png'),fullPage:true });
      console.log('Xamuko Plus responsive OK: '+name+' '+width+'px');
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
