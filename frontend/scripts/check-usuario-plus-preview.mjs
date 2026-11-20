import assert from 'node:assert/strict';
import { mkdir, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

// Check the production-built CSS. The React deep link and navigation state
// are tested separately with Vitest; this fixture validates real layout.
const assets = fileURLToPath(new URL('../apps/usuario/dist/assets/', import.meta.url));
const output = fileURLToPath(new URL('../test-results/usuario-plus-preview/', import.meta.url));
const cssFiles = (await readdir(assets)).filter(file => file.endsWith('.css')).sort();
assert.ok(cssFiles.length > 0, 'Compiled Usuario stylesheet is required');
const css = (await Promise.all(cssFiles.map(file => readFile(join(assets, file), 'utf8')))).join('\n');
assert.ok(css.includes('plus-tool-workspace'), 'The new preview workspace must be bundled');
await mkdir(output, { recursive: true });

const sectionNames = ['Novedades','Precios','Comparador','Colecciones','Búsquedas','Rutas','Sin anuncios'];
const nav = sectionNames.map((name, index) => `<a href="#${['radar','prices','compare','collections','searches','routes','adfree'][index]}"
  ${index === 1 ? 'aria-current="location"' : ''}>
  <span class="plus-tool-menu-number">0${index+1}</span><svg width="19" height="19" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/></svg><span>${name}</span>
  ${index===1?'<span class="plus-tool-current">✓</span>':''}</a>`).join('');
const fixture = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <style>*,*::before,*::after{box-sizing:border-box}html,body{margin:0}body{font-family:Arial,sans-serif}</style>
  </head><body><div class="user-content-page plus-page plus-preview-page"><main class="user-content-main">
  <a class="plus-back" href="#inicio">← Salir de la vista previa</a>
  <header class="plus-hero"><span class="plus-kicker">DEMOSTRACIÓN VISUAL · XAMUKO PLUS</span>
    <h1>Xamuko Plus</h1><p>Recorre las herramientas Plus con datos de demostración, sin modificar tu cuenta.</p>
    <div class="plus-hero-state">Vista previa autorizada · No es una membresía activa</div></header>
  <div class="plus-preview-warning"><strong>Prueba visual con datos de ejemplo</strong>
    <p>Los precios, negocios y novedades de esta página son ficticios y no generan pagos.</p></div>
  <div class="plus-overview">
    ${[['2','Novedades de ejemplo'],['1','Precios de ejemplo'],['1','Colecciones de ejemplo'],['1','Búsquedas de ejemplo']].map(([value,label])=>`
      <a class="plus-overview-card" href="#prices"><span class="plus-overview-icon">◇</span><strong>${value}</strong><span>${label}</span><span class="plus-overview-arrow">↗</span></a>`).join('')}
  </div>
  <div class="plus-tool-workspace" id="plus-tools-workspace">
   <aside class="plus-tool-sidebar">
     <span class="plus-tool-eyebrow">TU RECORRIDO PLUS</span><h2>Elige qué quieres probar</h2>
     <p>Siete herramientas. Una a la vez, sin perder tu lugar.</p>
     <nav class="plus-tool-menu" aria-label="Navegación de herramientas Plus de prueba">${nav}</nav>
   </aside>
   <div class="plus-tool-content">
     <div class="plus-tool-picker"><label for="plus-tool-select">¿Qué herramienta quieres probar?</label>
       <select id="plus-tool-select" aria-label="Elegir herramienta de demostración">
         ${sectionNames.map((name,i)=>`<option ${i===1?'selected':''}>0${i+1} · ${name}</option>`).join('')}
       </select>
     </div>
     <div class="plus-tool-position"><span>HERRAMIENTA 02 DE 07</span><strong>Precios</strong></div>
     <div class="plus-tool-stage">
       <section class="plus-panel" id="radar" hidden><h2>Tu radar de novedades</h2></section>
       <section class="plus-panel" id="prices" tabindex="-1">
        <div class="plus-heading"><div><span>02 · AHORRO · EJEMPLO</span><h2>Seguimiento de precios</h2>
        <p>Prueba el seguimiento de precios, fija un objetivo y consulta un historial de ejemplo.</p></div>
        <label class="plus-toggle"><input type="checkbox"> Avisar cuando bajen</label></div>
        <div class="plus-follow-guide"><span class="plus-follow-guide-icon">◇</span>
          <div><strong>Un botón en cada ficha de producto</strong><p>Abre un producto con precio y pulsa Seguir precio.</p></div>
          <a class="plus-button plus-button-secondary" href="#prices">Explorar productos</a></div>
        <div class="plus-list"><div class="plus-list-row">
          <span class="plus-row-symbol">◇</span><span><strong>Producto de muestra A</strong><small>Negocio de ejemplo A · $32.900 COP</small></span>
          <div class="plus-row-buttons"><button>Historial</button><button>Fijar objetivo</button><button>Quitar</button></div>
          <form class="plus-target-editor"><label>Precio objetivo de ejemplo<input aria-label="Precio objetivo demo" type="number" value="25000"></label>
            <button class="plus-button">Guardar objetivo</button></form>
        </div></div>
       </section>
       <section class="plus-panel" id="compare" hidden><h2>Comparador</h2></section>
       <section class="plus-panel" id="collections" hidden><h2>Colecciones</h2></section>
       <section class="plus-panel" id="searches" hidden><h2>Búsquedas</h2></section>
       <section class="plus-panel" id="routes" hidden><h2>Rutas</h2></section>
       <section class="plus-panel" id="adfree" hidden><h2>Sin anuncios</h2></section>
     </div>
     <nav class="plus-tool-pager" aria-label="Avanzar entre herramientas Plus">
      <button class="plus-tool-previous">‹ Anterior</button><span>2 de 7</span>
      <button class="plus-tool-next">Siguiente: Comparador →</button></nav>
   </div>
  </div></main></div></body></html>`;

const browser = await chromium.launch({ headless: true });
try {
  for (const [name,width,height] of [
    ['iphone-small',360,780],['iphone',390,844],['ipad',820,1180],
    ['desktop',1440,900],
  ]) {
    const context = await browser.newContext({ viewport: {width,height}, deviceScaleFactor:1 });
    const page = await context.newPage();
    try {
      await page.setContent(fixture);
      await page.addStyleTag({content:css});
      await page.evaluate(() => document.fonts.ready);
      const actual = await page.evaluate(() => {
        const $=q=>document.querySelector(q), bounds=q=>$(q).getBoundingClientRect();
        const sidebar=$('.plus-tool-sidebar'), picker=$('.plus-tool-picker');
        const stages=[...document.querySelectorAll('.plus-tool-stage>.plus-panel')];
        const buttons=[...document.querySelectorAll('.plus-tool-pager button')];
        const stats=[...document.querySelectorAll('.plus-overview-card')];
        return {
          documentWidth:document.documentElement.scrollWidth,
          viewportWidth:document.documentElement.clientWidth,
          sidebarVisible:getComputedStyle(sidebar).display!=='none',
          pickerVisible:getComputedStyle(picker).display!=='none',
          pickerHeight:bounds('#plus-tool-select').height,
          pickerFont:parseFloat(getComputedStyle($('#plus-tool-select')).fontSize),
          sidebarWidth:bounds('.plus-tool-sidebar').width,
          mainWidth:bounds('.plus-tool-content').width,
          panelWidth:bounds('#prices').width,
          panelRight:bounds('#prices').right,
          visibleStages:stages.filter(node=>getComputedStyle(node).display!=='none').map(node=>node.id),
          pagerHeights:buttons.map(b=>b.getBoundingClientRect().height),
          menuMinHeight:Math.min(...[...document.querySelectorAll('.plus-tool-menu a')].map(a=>a.getBoundingClientRect().height)),
          statHeights:stats.map(x=>x.getBoundingClientRect().height),
          headingSize:parseFloat(getComputedStyle($('#prices h2')).fontSize),
          heroBackground:getComputedStyle($('.plus-hero')).backgroundImage,
        };
      });
      const prefix=name+': ';
      const compact=width<=970;
      assert.equal(actual.sidebarVisible,!compact,prefix+'desktop sidebar instead of horizontal scrolling');
      assert.equal(actual.pickerVisible,compact,prefix+'mobile and iPad tool selector');
      assert.deepEqual(actual.visibleStages,['prices'],prefix+'one tool visible at a time');
      assert.ok(actual.documentWidth<=actual.viewportWidth+1,prefix+'no horizontal overflow');
      assert.ok(actual.panelRight<=actual.viewportWidth+1&&actual.panelWidth>0,prefix+'panel fits viewport');
      assert.ok(actual.pagerHeights.every(x=>x>=44),prefix+'touch-friendly previous and next');
      if (compact) {
        assert.ok(actual.pickerHeight>=46&&actual.pickerFont>=16,prefix+'legible dropdown for mobile');
      } else {
        assert.ok(actual.menuMinHeight>=44,prefix+'desktop navigation is clickable');
      }
      assert.ok(actual.headingSize>=19,prefix+'legible active section heading');
      assert.ok(Math.max(...actual.statHeights)<108,prefix+'compact, secondary summary indicators');
      assert.ok(actual.heroBackground.includes('gradient'),prefix+'Xamuko purple theme preserved');
      await page.screenshot({path:join(output,name+'.png'),fullPage:true});
      console.log('Xamuko Plus preview navigation OK: '+name+' '+width+'px');
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
