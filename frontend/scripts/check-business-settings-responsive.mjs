import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

// Validate shipped CSS, and original source behavior; never generate a preview.
const assets=fileURLToPath(new URL('../apps/negocios/dist/assets/',import.meta.url));
const files=(await readdir(assets)).filter(name=>name.endsWith('.css'));
assert.ok(files.length,'Business CSS build required');
const css=(await Promise.all(files.map(file=>readFile(join(assets,file),'utf8')))).join('\n');
const source=await readFile(fileURLToPath(new URL('../apps/negocios/src/pages/SettingsPage.tsx',import.meta.url)),'utf8');
assert.ok(source.includes('createPortal(<div ref={hideOverlayRef}')&&source.includes('createPortal(<div ref={transferOverlayRef}'),'Both confirmations must be in portals');
assert.ok(source.includes('window.visualViewport')&&source.includes('settings-dialog-active'),'Use visible viewport above sticky headers');
assert.ok(source.includes('viewBox="0 0 24 24"')&&source.includes('function SettingsIcon('),'Professional scalable SVGs must remain');
for(const endpoint of [
  'getVisibility','setVisibility','renewVisibility','getVerification',
  'submitVerification','replaceVerification','resolveTransferRecipient',
  'requestOwnershipTransfer','cancelOwnershipTransfer','listSentOwnershipTransfers',
]) assert.ok(source.includes('businessApi.'+endpoint+'('),'Existing settings action must remain: '+endpoint);
assert.ok(source.includes('business.role === "Propietario"')&&source.includes('business.status !== "Eliminado"'),'Transfer permission check retained');
assert.ok(source.includes('accept="application/pdf,.pdf"')&&source.includes('BUSINESS_VISIBILITY_DAYS'),'Existing file/visibility requirements retained');
assert.ok(source.includes('disabled={transferSubmitting}'),'Submitting transfer disables second action');

const svg='<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/></svg>';
const shell=()=>'<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body class="settings-dialog-active">'+
  '<div class="business-app"><div class="app-content"><header class="business-desktop-header">Business header</header><main class="page-content">'+
  '<div class="business-settings-page"><header class="page-heading settings-page-heading"><span class="settings-page-eyebrow">TU ESPACIO</span>'+
  '<div class="settings-page-heading-main"><span class="settings-page-heading-icon">'+svg+'</span><div><h1>Configuración</h1>'+
  '<p>Administra tus preferencias, privacidad y acceso a la cuenta.</p></div></div></header>'+
  '<div class="settings-layout"><div class="content-stack">'+
  '<section class="surface-card settings-section settings-privacy"><div class="card-heading"><span class="settings-card-icon privacy">'+svg+'</span>'+
  '<div><h2>Privacidad</h2><p>Controla la visibilidad de tu información comercial.</p></div></div>'+
  '<div class="visibility-panel"><div><strong class="settings-visibility-title">'+svg+'Mostrar mi negocio en XAMUKO</strong>'+
  '<p>Visible hasta el 15 de diciembre de 2026.</p></div><span class="visibility-status active">Visible</span>'+
  '<div class="visibility-actions"><button class="action-button">'+svg+'Renovar por 30 días desde este momento</button>'+
  '<small class="visibility-renew-note">Los 30 días empiezan desde este momento.</small>'+
  '<button class="outline-button visibility-hide">'+svg+'Ocultar mi negocio</button></div></div>'+
  '<div class="settings-legal-links"><a href="#terms">Términos y condiciones</a><a href="#privacy">Política de privacidad</a></div></section>'+
  '<section class="surface-card settings-section verification-settings"><div class="card-heading"><span class="settings-card-icon verification">'+svg+'</span>'+
  '<div><h2>Verificación del negocio</h2><p>Ayuda a las personas a confiar en la información.</p></div>'+
  '<span class="verification-badge pending">En revisión</span></div>'+
  '<div class="verification-copy"><p>Adjunta un PDF oficial para comprobar el negocio.</p>'+
  '<div class="settings-notice is-info">Solicitud en revisión</div>'+
  '<label class="form-field verification-file-field"><span>Documento PDF (máximo 10 MB)</span>'+
  '<input type="file" accept="application/pdf,.pdf"></label>'+
  '<ul><li>Comprobar nombre comercial</li><li>El negocio seguirá visible</li></ul>'+
  '<button class="action-button verification-submit">'+svg+'Solicitar verificación</button></div></section>'+
  '<section class="surface-card settings-section ownership-settings"><div class="ownership-heading">'+
  '<span class="ownership-icon">'+svg+'</span><div><h2>Transferir propiedad</h2><p>Solicita el cambio de titularidad.</p></div></div>'+
  '<form class="ownership-form"><label class="form-field"><span>Nickname del nuevo propietario</span>'+
  '<input placeholder="Ej. @laura.gomez" required><small>Debe tener cuenta XAMUKO.</small></label>'+
  '<div class="collab-recipient resolved"><span class="collab-recipient-avatar">L</span><span><b>Laura</b><small>@laura</small></span>'+
  '<strong>Cuenta confirmada</strong></div><button class="outline-button ownership-submit">'+svg+'Transferir propiedad</button></form></section>'+
  '</div></div></div></main></div><header class="mobile-topbar">Cabecera móvil</header><nav class="mobile-nav">Menú</nav></div>';
const fixture=kind=>{
  const hide=kind==='hide';
  return shell()+'<div class="settings-dialog-backdrop" role="presentation"><section class="settings-confirm-dialog" role="alertdialog" aria-modal="true">'+
    '<header class="settings-dialog-heading"><span class="settings-dialog-icon warning">'+svg+'</span>'+
    '<div><span class="settings-dialog-eyebrow">'+(hide?'PRIVACIDAD':'PROPIEDAD')+' · XAMUKO BUSINESS</span>'+
    '<h2>'+(hide?'¿Ocultar tu negocio?':'¿Confirmas solicitar la transferencia?')+'</h2></div></header>'+
    (hide?'':'<div class="settings-dialog-copy"><p>Destinatario: <strong>Laura Gómez</strong> (@laura.gomez)</p>')+
    '<p>'+(hide?'Dejará de aparecer para las personas, pero conservarás toda su información.':
      'Dejarás de ser propietario y perderás el acceso y permiso administrativo sobre el negocio.')+'</p>'+
    (hide?'':'</div>')+'<footer class="settings-dialog-actions">'+
    '<button class="outline-button settings-dialog-cancel">Cancelar</button>'+
    '<button class="danger-button settings-dialog-danger">'+svg+(hide?'Sí, ocultar negocio':'Sí, transferir propiedad')+
    '</button></footer></section></div></body></html>';
};
const screens=[
  ['desktop',1440,900,false],['desktop-compact',1200,750,false],
  ['ipad-landscape-wide',1100,820,true],['ipad-landscape',1024,768,true],
  ['ipad-portrait-wide',820,1180,true],['ipad-portrait',768,1024,true],
  ['iphone',390,844,true],['iphone-small',320,568,true],
  ['iphone-landscape',667,375,true],
];
const browser=await chromium.launch({headless:true});
try{
 for(const [name,width,height,mobile] of screens){
  const context=await browser.newContext({viewport:{width,height},isMobile:mobile,hasTouch:mobile,deviceScaleFactor:mobile?2:1});
  const page=await context.newPage();
  try{
   for(const kind of ['hide','transfer']){
    await page.setContent(fixture(kind));
    await page.addStyleTag({content:css});
    await page.evaluate(()=>{
      const el=document.querySelector('.settings-dialog-backdrop'),v=window.visualViewport;
      el.style.setProperty('--settings-viewport-top',(v?.offsetTop??0)+'px');
      el.style.setProperty('--settings-viewport-left',(v?.offsetLeft??0)+'px');
      el.style.setProperty('--settings-viewport-width',(v?.width??innerWidth)+'px');
      el.style.setProperty('--settings-viewport-height',(v?.height??innerHeight)+'px');
    });
    const m=await page.evaluate(()=>{
      const rect=el=>{const r=el.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:r.height};};
      const root=document.querySelector('.business-settings-page');
      const dialog=document.querySelector('.settings-confirm-dialog');
      const vp=window.visualViewport;
      return {
        w:vp?.width??innerWidth,h:vp?.height??innerHeight,root:rect(root),dialog:rect(dialog),
        title:rect(dialog.querySelector('h2')),
        cards:[...root.querySelectorAll('.settings-section')].map(el=>({rect:rect(el),overflow:el.scrollWidth>el.clientWidth+2})),
        icons:[...root.querySelectorAll('.settings-page-heading-icon svg,.settings-card-icon svg,.ownership-icon svg')].every(el=>el instanceof SVGSVGElement&&el.viewBox.baseVal.width===24),
        buttons:[...root.querySelectorAll('button')].map(el=>getComputedStyle(el).textDecorationLine),
        file:rect(root.querySelector('input[type=file]')),nickname:rect(root.querySelector('.ownership-form input')),
        header:getComputedStyle(document.querySelector('.business-desktop-header')).visibility,
        mobileHeader:getComputedStyle(document.querySelector('.mobile-topbar')).visibility,
        nav:getComputedStyle(document.querySelector('.mobile-nav')).visibility,
        titleSize:getComputedStyle(root.querySelector('h1')).fontSize,
        eyebrowSize:getComputedStyle(root.querySelector('.settings-page-eyebrow')).fontSize,
        descriptionSize:getComputedStyle(root.querySelector('.settings-page-heading p')).fontSize,
      };
    });
    const label=name+' '+kind;
    assert.ok(m.root.left>=-2&&m.root.right<=m.w+2,label+': settings root fits viewport');
    assert.equal(m.cards.length,3,label+': privacy, verification and transfer cards present');
    for(const [i,card] of m.cards.entries()){
      assert.ok(card.rect.left>=m.root.left-2&&card.rect.right<=m.root.right+2,label+': card '+i+' fits');
      assert.ok(!card.overflow,label+': card '+i+' must not overflow');
    }
    assert.ok(m.icons,label+': headings use 4K-ready SVG icons');
    assert.ok(m.buttons.every(v=>v==='none'),label+': settings buttons not underlined');
    assert.ok(m.file.right<=m.root.right+2&&m.nickname.right<=m.root.right+2,label+': all form inputs fit');
    assert.ok(Math.abs(parseFloat(m.titleSize)-Math.max(28,Math.min(33,width*.024)))<.2,label+': title matches Inicio');
    assert.equal(m.eyebrowSize,width<=700?'10px':'11px',label+': eyebrow matches Inicio');
    assert.equal(m.descriptionSize,width<=700?'12px':'13px',label+': description matches Inicio');
    assert.ok(m.dialog.left>=-2&&m.dialog.right<=m.w+2,label+': modal fits width');
    assert.ok(m.dialog.top>=-2&&m.dialog.bottom<=m.h+2,label+': modal fits visible height '+JSON.stringify(m.dialog));
    assert.ok(m.title.top>=-2&&m.title.bottom<=m.h+2,label+': modal title not under header');
    if(width<=1100){
      assert.equal(m.header,'hidden',label+': desktop header hidden while confirming');
      assert.equal(m.mobileHeader,'hidden',label+': mobile header hidden while confirming');
      assert.equal(m.nav,'hidden',label+': mobile menu hidden while confirming');
    }
    await page.locator('.settings-confirm-dialog').evaluate(el=>{el.scrollTop=el.scrollHeight;});
    const actions=await page.evaluate(()=>{
      const viewport=window.visualViewport?.height??innerHeight;
      const viewportWidth=window.visualViewport?.width??innerWidth;
      return [...document.querySelectorAll('.settings-dialog-actions button')].map(el=>{
        const r=el.getBoundingClientRect(),top=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
        return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:r.height,
          clickable:top===el||el.contains(top),underline:getComputedStyle(el).textDecorationLine,h:viewport,w:viewportWidth};
      });
    });
    assert.equal(actions.length,2,label+': confirm and cancel exist');
    for(const [i,a] of actions.entries()){
      assert.ok(a.left>=-2&&a.right<=a.w+2,label+': modal action '+i+' width');
      assert.ok(a.top>=-2&&a.bottom<=a.h+2,label+': modal action '+i+' height');
      assert.ok(a.height>=44&&a.clickable,label+': modal action '+i+' is touch accessible');
      assert.equal(a.underline,'none',label+': modal action '+i+' has no underline');
    }
    await page.locator('.settings-dialog-cancel').hover();
    assert.equal(await page.locator('.settings-dialog-cancel').evaluate(el=>getComputedStyle(el).textDecorationLine),'none',label+': no underline on hover');
    console.log('Business Configuración responsive:',label);
   }
  }finally{await context.close();}
 }
}finally{await browser.close();}
