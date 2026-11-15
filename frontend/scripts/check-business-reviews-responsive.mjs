import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

// Real Business build CSS and representative Opinion markup. No public preview.
const cssDirectory = fileURLToPath(new URL('../apps/negocios/dist/assets/', import.meta.url));
const cssFiles = (await readdir(cssDirectory)).filter(name => name.endsWith('.css')).sort();
assert.ok(cssFiles.length, 'Business CSS build must exist');
const css = (await Promise.all(cssFiles.map(name => readFile(join(cssDirectory, name), 'utf8')))).join('\n');
const source = await readFile(fileURLToPath(new URL('../apps/negocios/src/pages/ReviewsPage.tsx', import.meta.url)), 'utf8');
assert.ok(source.includes('useLayoutEffect(') && source.includes('window.visualViewport'), 'Dialog uses iPhone/iPad visual viewport');
assert.ok(source.includes('createPortal(<div ref={reviewsOverlayRef}'), 'Dialog uses a portal outside the Business header');
assert.ok(source.includes('12 * 60 * 60 * 1000'), 'Existing twelve-hour reply edit rule must remain');
assert.ok(source.includes('businessApi.listReviews(') && source.includes('businessApi.saveReviewResponse(') && source.includes('businessApi.reportReview('), 'Existing review endpoints remain');
assert.ok(source.includes('summary.distribution[String(star)]') && source.includes('summary.average?.toFixed(1)'), 'Ratings remain API-driven');
assert.ok(source.includes('disabled={Boolean(review.response && !canEditResponse(review.response.createdAt))}'), 'Expired response editing stays blocked');

const star = '<svg viewBox="0 0 24 24"><path d="m12 2 3 6 6 1-4.5 5 1 7-5.5-3-5.5 3 1-7L3 9l6-1z"/></svg>';
const long = 'Comentario extenso de experiencia en XAMUKO: un texto de prueba que representa las opiniones reales y evita desbordes en iPad y pantallas estrechas. ' +
  'Largapalabraparaprobarelajustedecontenidoescritosinperderlatarjeta.'; 
function pageMarkup() {
  return '<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head>' +
    '<body class="reviews-dialog-active"><div class="business-app"><div class="app-content"><div class="body-layout"><div class="business-shell-workspace">' +
    '<header class="business-desktop-header">Cabecera XAMUKO Business</header>' +
    '<main class="page-content"><div class="reviews-page"><header class="page-heading reviews-page-heading">' +
    '<div class="reviews-page-heading-copy"><span class="reviews-page-eyebrow">REPUTACIÓN</span><div class="reviews-page-heading-main">' +
    '<span class="reviews-page-heading-icon">' + star + '</span><div><h1>Opiniones y calificaciones</h1><p>Conoce lo que piensan las personas sobre tu negocio.</p></div></div></div></header>' +
    '<div class="reviews-layout"><section class="surface-card review-overview"><div class="reviews-overview-heading">' +
    '<span class="reviews-overview-icon">' + star + '</span><span class="page-eyebrow">CALIFICACIÓN GENERAL</span></div>' +
    '<div class="review-score"><strong>4.6</strong><div><span>★★★★★</span><p>27 calificaciones recibidas</p></div></div>' +
    '<h3 class="reviews-distribution-title">Distribución de calificaciones</h3><div class="rating-bars full">' +
    [5,4,3,2,1].map((n,i) => '<div><span>' + n + ' ★</span><i><b style="width:' + (80-i*15) + '%"></b></i><small>' + (80-i*15) + '%</small></div>').join('') +
    '</div></section><section class="surface-card review-feed"><div class="card-heading"><div><h2>Opiniones escritas</h2>' +
    '<p>Comentarios recientes de la comunidad XAMUKO</p><span class="reviews-feed-count">2 de 2 opiniones</span></div>' +
    '<label class="filter-box"><select aria-label="Filtrar opiniones"><option>Todas</option><option>5 estrellas</option></select></label></div>' +
    '<article class="review-entry"><div class="review-avatar">M</div><div><div class="review-entry-head"><strong>María de los Ángeles Nombre Largo</strong>' +
    '<time>15 de noviembre de 2026</time></div><div class="review-stars" aria-label="5 de 5 estrellas">★★★★★<span></span></div>' +
    '<p>' + long + '</p><div class="review-actions"><button class="review-reply-button">' + star + 'Responder</button>' +
    '<button class="review-report-button">' + star + 'Reportar comentario</button></div>' +
    '<div class="business-response"><strong>Respuesta del negocio</strong><p>' + long + '</p></div></div></article>' +
    '<article class="review-entry"><div class="review-avatar">J</div><div><div class="review-entry-head"><strong>Jorge</strong><time>12 de noviembre de 2026</time></div>' +
    '<div class="review-stars">★★★★<span>☆</span></div><p>Buena experiencia</p><div class="review-actions"><button class="review-reply-button" disabled>Respuesta bloqueada</button>' +
    '<button class="review-report-button">Reportar comentario</button></div></div></article></section></div></div></main></div></div></div>' +
    '<header class="mobile-topbar">Cabecera móvil</header><nav class="mobile-nav">Navegación móvil</nav></div>';
}
function dialogMarkup(mode) {
  const isReply = mode === 'reply';
  const heading = isReply ? 'Responder opinión' : 'Reportar comentario';
  const field = isReply
    ? '<label class="reviews-dialog-field">Tu respuesta<textarea rows="5" placeholder="Escribe una respuesta amable"></textarea></label>'
    : '<label class="reviews-dialog-field">Motivo del reporte<select><option>Contenido ofensivo o acoso</option><option>Otro motivo</option></select></label>' +
      '<label class="reviews-dialog-field">Explicación adicional<textarea rows="4" maxlength="1000"></textarea></label>';
  return pageMarkup() +
    '<div class="reviews-dialog-backdrop" role="presentation"><section class="reviews-dialog" role="dialog" aria-modal="true">' +
    '<header class="reviews-dialog-heading"><span class="reviews-dialog-icon ' + (isReply ? 'reply' : 'report') + '">' + star + '</span>' +
    '<div><span class="reviews-dialog-eyebrow">OPINIONES · XAMUKO BUSINESS</span><h2>' + heading + '</h2>' +
    '<p>Formulario para responder o reportar una opinión.</p></div><button class="reviews-dialog-close" aria-label="Cerrar formulario">×</button></header>' +
    '<div class="reviews-dialog-content"><div class="reviews-dialog-review"><strong>María de los Ángeles</strong><span>★★★★★</span>' +
    '<p>' + long + '</p></div>' + field + '</div>' +
    '<footer class="reviews-dialog-actions"><button class="outline-button reviews-dialog-cancel">Cancelar</button>' +
    '<button class="action-button reviews-dialog-submit ' + (isReply ? '' : 'report') + '">' + (isReply ? 'Guardar respuesta' : 'Enviar a revisión') +
    '</button></footer></section></div></body></html>';
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

const browser = await chromium.launch({ headless:true });
try {
  for (const [sizeName, width, height, mobile] of sizes) {
    const context = await browser.newContext({ viewport:{width,height}, isMobile:mobile, hasTouch:mobile, deviceScaleFactor: mobile?2:1 });
    const page = await context.newPage();
    try {
      // Regression: old shared CSS underlined both links on hover.
      await page.setContent(pageMarkup() + '</body></html>');
      await page.addStyleTag({ content:css });
      const blocked = page.getByRole('button', { name:'Respuesta bloqueada' });
      assert.equal(await blocked.isDisabled(), true, sizeName+': expired reply remains blocked');
      assert.equal(await blocked.evaluate(el => getComputedStyle(el).textDecorationLine), 'none', sizeName+': blocked reply has no underline');
      const report = page.getByRole('button', { name:'Reportar comentario' }).first();
      assert.equal(await report.evaluate(el => getComputedStyle(el).textDecorationLine), 'none', sizeName+': report link has no underline');
      await report.hover();
      assert.equal(await report.evaluate(el => getComputedStyle(el).textDecorationLine), 'none', sizeName+': report link remains without underline on hover');
      for (const mode of ['reply','report']) {
        await page.setContent(dialogMarkup(mode));
        await page.addStyleTag({ content:css });
        await page.evaluate(() => {
          const overlay = document.querySelector('.reviews-dialog-backdrop');
          const viewport = window.visualViewport;
          overlay.style.setProperty('--reviews-viewport-top', (viewport?.offsetTop ?? 0) + 'px');
          overlay.style.setProperty('--reviews-viewport-left', (viewport?.offsetLeft ?? 0) + 'px');
          overlay.style.setProperty('--reviews-viewport-width', (viewport?.width ?? innerWidth) + 'px');
          overlay.style.setProperty('--reviews-viewport-height', (viewport?.height ?? innerHeight) + 'px');
        });
        const before = await page.evaluate(() => {
          const rect = el => {
            const r=el.getBoundingClientRect();
            return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height};
          };
          const visible = el => {
            const r=el.getBoundingClientRect();
            const top=document.elementFromPoint(r.left + r.width/2,r.top+r.height/2);
            return top===el || el.contains(top);
          };
          const dlg=document.querySelector('.reviews-dialog');
          const header=dlg.querySelector('.reviews-dialog-heading');
          const close=dlg.querySelector('.reviews-dialog-close');
          const root=document.querySelector('.reviews-page');
          const cols=document.querySelector('.reviews-layout');
          const overview=document.querySelector('.review-overview');
          const feed=document.querySelector('.review-feed');
          const firstReview=feed.querySelector('.review-entry');
          const replyButton=firstReview.querySelector('.review-reply-button');
          const reportButton=firstReview.querySelector('.review-report-button');
          const visual=window.visualViewport;
          return {
            viewportHeight:visual?.height ?? innerHeight,viewportWidth:visual?.width ?? innerWidth,
            modal:rect(dlg),header:rect(header),close:rect(close),closeAccessible:visible(close),
            root:rect(root),layout:rect(cols),overview:rect(overview),feed:rect(feed),review:rect(firstReview),
            replyButton:rect(replyButton),reportButton:rect(reportButton),
            average:getComputedStyle(document.querySelector('.review-score>strong')).fontSize,
            title:getComputedStyle(document.querySelector('.reviews-page-heading h1')).fontSize,
            eyebrow:getComputedStyle(document.querySelector('.reviews-page-eyebrow')).fontSize,
            description:getComputedStyle(document.querySelector('.reviews-page-heading p')).fontSize,
            appHeader:getComputedStyle(document.querySelector('.business-desktop-header')).visibility,
            mobileHeader:getComputedStyle(document.querySelector('.mobile-topbar')).visibility,
            mobileNav:getComputedStyle(document.querySelector('.mobile-nav')).visibility,
          };
        });
        const label = sizeName+' '+mode;
        assert.ok(before.modal.top >= -2 && before.modal.bottom <= before.viewportHeight+2, label+': entire modal fits visible height '+JSON.stringify(before.modal));
        assert.ok(before.modal.left >= -2 && before.modal.right <= before.viewportWidth+2, label+': modal fits screen width');
        assert.ok(before.header.top >= -2 && before.header.bottom <= before.viewportHeight+2, label+': heading never behind the Business header');
        assert.ok(before.close.top >= -2 && before.close.bottom <= before.viewportHeight+2 && before.closeAccessible, label+': close button visible and click target accessible');
        assert.ok(before.root.left>=-2 && before.root.right<=before.viewportWidth+2, label+': reviews page does not overflow viewport');
        assert.ok(before.overview.left>=before.root.left-2 && before.overview.right<=before.root.right+2, label+': ratings overview contained');
        assert.ok(before.feed.left>=before.root.left-2 && before.feed.right<=before.root.right+2, label+': review feed contained');
        assert.ok(before.review.left>=before.feed.left-2 && before.review.right<=before.feed.right+2, label+': review row contained');
        assert.ok(before.replyButton.height>=42 && before.reportButton.height>=42, label+': action targets remain accessible');
        if(width<=1100){
          assert.ok(before.feed.top>=before.overview.bottom-2, label+': iPad/mobile layout is stacked');
          assert.equal(before.appHeader,'hidden',label+': app header hidden with dialog open');
          assert.equal(before.mobileHeader,'hidden',label+': mobile header hidden with dialog open');
          assert.equal(before.mobileNav,'hidden',label+': mobile nav hidden with dialog open');
        } else {
          assert.ok(before.overview.right<=before.feed.left+2,label+': desktop rating and feed are two columns');
        }
        assert.ok(Math.abs(parseFloat(before.title)-Math.max(28,Math.min(33,width*.024)))<0.15,label+': title matches Inicio size');
        assert.equal(before.eyebrow,width<=700?'10px':'11px',label+': eyebrow matches Inicio');
        assert.equal(before.description,width<=700?'12px':'13px',label+': description matches Inicio');
        await page.locator('.reviews-dialog').evaluate(el => { el.scrollTop=el.scrollHeight; });
        const after=await page.evaluate(() => {
          const dlg=document.querySelector('.reviews-dialog');
          const footer=dlg.querySelector('.reviews-dialog-actions');
          const header=dlg.querySelector('.reviews-dialog-heading');
          const actions=[...footer.querySelectorAll('button')];
          const visual=window.visualViewport;
          return {
            headerTop:header.getBoundingClientRect().top,
            viewportHeight:visual?.height ?? innerHeight,
            buttons:actions.map(b=>{
              const r=b.getBoundingClientRect();
              const top=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
              return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:r.height,accessible:top===b||b.contains(top)};
            }),
          };
        });
        assert.ok(after.headerTop>=-2,label+': sticky modal heading remains visible after scroll');
        for(const [i,b] of after.buttons.entries()){
          assert.ok(b.top>=-2 && b.bottom<=after.viewportHeight+2,label+': action '+i+' not clipped by viewport');
          assert.ok(b.left>=-2 && b.right<=before.viewportWidth+2,label+': action '+i+' fits horizontally');
          assert.ok(b.height>=44 && b.accessible,label+': action '+i+' is tappable');
        }
        console.log('Business Opiniones responsive:',label);
      }
    } finally {await context.close();}
  }
} finally {await browser.close();}
