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
assert.ok(stylesheet.includes('plus-spotlight'), 'Plus professional styles must exist in the Usuario build');
await mkdir(output, { recursive: true });

const feature = (icon, title, message, detail, hash, action) => `
  <a class="plus-spotlight-card" href="#${hash}">
    <span class="plus-spotlight-icon" aria-hidden="true">${icon}</span>
    <h3>${title}</h3>
    <p>${message}</p>
    <span class="plus-spotlight-detail"><strong>${detail}</strong> · Dato de demostración</span>
    <span class="plus-spotlight-action">${action} →</span>
  </a>`;
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
    <section class="plus-spotlight" aria-labelledby="plus-spotlight-heading">
      <div class="plus-spotlight-heading">
        <span class="plus-overline">HERRAMIENTAS DESTACADAS</span>
        <h2 id="plus-spotlight-heading">Aprovecha más tu membresía</h2>
        <p>Configura alertas, decide cuándo recibir avisos y prepara recorridos.</p>
      </div>
      <div class="plus-spotlight-grid">
        ${feature('◇','Precio objetivo','Fija el valor que quieres pagar por un producto y recibe el aviso al alcanzarlo.','3 objetivos configurados','prices','Gestionar precios')}
        ${feature('♧','Notificaciones inteligentes','Recibe avisos inmediatos o un resumen diario en tu zona horaria.','Resumen diario','radar','Configurar avisos')}
        ${feature('➰','Rutas optimizadas','Organiza hasta cuatro negocios por cercanía y revisa horarios antes de salir.','4 negocios','routes','Planear recorrido')}
      </div>
    </section>
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
        const cards = [...document.querySelectorAll('.plus-spotlight-card')];
        const bounds = node => node.getBoundingClientRect();
        const buttons = [...document.querySelectorAll('.plus-button,.plus-row-buttons button')];
        return {
          docWidth:document.documentElement.scrollWidth,
          viewport:document.documentElement.clientWidth,
          cardTop:cards.map(node=>bounds(node).top),
          cardWidth:cards.map(node=>bounds(node).width),
          titleSizes:cards.map(node=>parseFloat(getComputedStyle(node.querySelector('h3')).fontSize)),
          buttonHeights:buttons.map(node=>bounds(node).height),
          heroBackground:getComputedStyle(document.querySelector('.plus-hero')).backgroundImage,
          cardCount:cards.length,
          targetCount:document.querySelectorAll('#prices,#radar,#routes').length,
          overflowing:[...document.querySelectorAll('.plus-page .plus-spotlight-card,.plus-page .plus-panel')]
            .filter(node=>bounds(node).right > document.documentElement.clientWidth+1).map(node=>node.className),
        };
      });
      const prefix = name+': ';
      assert.equal(actual.cardCount,3,prefix+'exactly three featured cards');
      assert.equal(actual.targetCount,3,prefix+'all three navigation targets');
      assert.ok(actual.docWidth <= actual.viewport+1,prefix+'no page-wide horizontal overflow ('+actual.docWidth+' > '+actual.viewport+')');
      assert.deepEqual(actual.overflowing,[],prefix+'panels remain inside the viewport');
      assert.ok(actual.titleSizes.every(value=>value>=17),prefix+'legible feature titles');
      assert.ok(actual.buttonHeights.every(value=>value>=44),prefix+'touch targets at least 44px high');
      assert.ok(actual.heroBackground.includes('gradient'),prefix+'violet hero background preserved');
      assert.ok(actual.cardWidth.every(value=>value>150),prefix+'usable card width');
      if(width<=700){
        assert.ok(actual.cardTop[0]<actual.cardTop[1] && actual.cardTop[1]<actual.cardTop[2],
          prefix+'mobile feature cards stack vertically');
      } else if(width<=1000){
        assert.ok(Math.abs(actual.cardTop[0]-actual.cardTop[1])<=2 && actual.cardTop[2]>actual.cardTop[1],
          prefix+'iPad portrait uses two cards plus a full-width card');
      } else {
        assert.ok(actual.cardTop.every(top=>Math.abs(top-actual.cardTop[0])<=2),
          prefix+'desktop feature cards align on one row');
      }
      await page.locator('.plus-spotlight-card').last().click();
      assert.equal(new URL(page.url()).hash,'#routes',prefix+'route navigation works');
      await page.screenshot({ path:join(output,name+'.png'),fullPage:true });
      console.log('Xamuko Plus responsive OK: '+name+' '+width+'px');
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
