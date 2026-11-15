import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

// Real compiled XAMUKO Business CSS. No public previews/screenshots.
const directory = fileURLToPath(new URL('../apps/negocios/dist/assets/', import.meta.url));
const files = (await readdir(directory)).filter(name => name.endsWith('.css')).sort();
assert.ok(files.length, 'Business build is required before collaborators responsive test');
const css = (await Promise.all(files.map(name => readFile(join(directory, name), 'utf8')))).join('\n');
const source = await readFile(fileURLToPath(new URL('../apps/negocios/src/pages/CollaboratorsPage.tsx', import.meta.url)), 'utf8');
for (const endpoint of [
  'businessApi.listCollaborators(', 'businessApi.resolveCollaboratorRecipient(',
  'businessApi.inviteCollaborator(', 'businessApi.updateCollaboratorPermissions(',
  'businessApi.suspendCollaborator(', 'businessApi.reactivateCollaborator(',
  'businessApi.revokeCollaborator(', 'businessApi.cancelCollaboratorInvitation(',
]) assert.ok(source.includes(endpoint), 'Membership API preserved: ' + endpoint);
for (const permission of ['MANAGE_CATALOG','MANAGE_PROMOTIONS','READ_ANALYTICS','EDIT_BUSINESS'])
  assert.ok(source.includes('"' + permission + '"'), 'Permission preserved: ' + permission);
assert.ok(source.includes('isOwner = business.role === "Propietario"'), 'Only owners manage collaborators');
assert.ok(source.includes('createPortal(<div ref={editOverlayRef}') && source.includes('window.visualViewport'), 'Edit dialog is portalled and aligned to visual viewport');
assert.ok(source.includes('document.body.classList.add("collab-dialog-active")'), 'Business header hidden while editing');
assert.ok(source.includes('PersistedPhoto src={membership.user.avatarUrl}') && source.includes('src={recipient.avatarUrl}'), 'Real account photos preserved');
assert.ok(source.includes('function CollabIcon(') && source.includes('viewBox="0 0 24 24"'), 'Professional scale-independent SVG icons present');

const svg = '<svg viewBox="0 0 24 24"><path d="M4 4h16v16H4zM8 12h8"/></svg>';
const makePeople = (kind) =>
  '<tr><td data-label="Persona"><div class="collab-person"><i>L</i><span><b>Laura Nombre Muy Extenso de Ejemplo</b>' +
  '<small>@laura.cuenta-larga-de-pruebas</small></span></div></td>' +
  '<td data-label="' + (kind === 'invite' ? 'Enviada el' : 'Rol') + '">' +
  (kind === 'invite' ? '15/11/2026' : '<em>Colaborador</em>') + '</td>' +
  '<td data-label="' + (kind === 'invite' ? 'Expira el' : 'Permisos') + '">' +
  (kind === 'invite' ? '22/11/2026' : 'Productos y servicios, Promociones, Información del negocio') + '</td>' +
  '<td data-label="' + (kind === 'invite' ? 'Permisos' : 'Estado') + '">' +
  (kind === 'invite' ? 'Promociones y Productos y servicios' : '<em class="state active">Activo</em>') + '</td>' +
  (kind === 'invite' ? '<td data-label="Estado"><em class="state invited">' + svg + 'Pendiente</em></td>'
    : '<td data-label="Última actividad">15/11/2026 09:36</td>') +
  '<td data-label="Acciones">' + (kind === 'invite'
    ? '<button class="cancel" type="button">' + svg + 'Cancelar</button>'
    : '<div class="collab-actions"><button type="button">' + svg + 'Editar</button>' +
      '<select aria-label="Acciones de colaborador"><option>Acciones</option><option>Suspender</option></select></div>') +
  '</td></tr>';

function pageMarkup() {
  const cards = [
    ['violet','Personas con acceso','3'],
    ['pink','Invitación pendiente','2'],
    ['blue','Colaboradores activos','2'],
    ['orange','Suspendidos','1'],
  ].map(([color,label,count]) =>
    '<article><span class="collab-stat-icon ' + color + '">' + svg + '</span><div><b>' + count +
    '</b><strong>' + label + '</strong><small>Datos y accesos del negocio</small></div></article>').join('');
  const permissions = ['Productos y servicios','Promociones','Estadísticas','Información del negocio']
    .map((name,i) => '<button type="button"' + (i===0 ? ' class="selected"' : '') +
      '><span class="collab-permission-icon">' + svg + '</span>' + name + '</button>').join('');
  return '<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head>' +
    '<body class="collab-dialog-active"><div class="business-app"><div class="app-content"><div class="business-shell-workspace">' +
    '<header class="business-desktop-header">Cabecera XAMUKO Business</header>' +
    '<main class="page-content"><section class="collab-page">' +
    '<header class="collab-heading"><div class="collab-heading-copy"><span class="collab-eyebrow">GESTIÓN DE ACCESOS</span>' +
    '<div class="collab-heading-main"><span class="collab-heading-icon">' + svg + '</span><div><h1>Colaboradores</h1>' +
    '<p>Administra las personas con acceso a este establecimiento.</p><small>Nexstudio</small></div></div></div>' +
    '<button class="collab-guide" type="button">' + svg + '<span>Guía de colaboradores</span></button></header>' +
    '<section class="collab-stats" aria-label="Resumen de colaboradores">' + cards + '</section>' +
    '<form class="collab-invite"><div class="collab-invite-title"><span class="collab-invite-icon">' + svg +
    '</span><div><h2>Invitar colaborador</h2><p>Escribe su nickname único y define los permisos de acceso.</p></div></div>' +
    '<div class="collab-invite-controls"><label class="collab-nickname-field"><span>Nickname único</span>' +
    '<input placeholder="Ej. @laura.gomez"></label><button type="submit" disabled>' + svg + 'Enviar invitación</button></div>' +
    '<div class="collab-recipient resolved"><span class="collab-recipient-avatar">L</span><span><b>Laura</b><small>@laura</small></span>' +
    '<strong>Cuenta confirmada</strong></div>' +
    '<div class="collab-permissions"><b>Permisos:</b>' + permissions + '</div></form>' +
    '<section class="collab-table-card"><div class="collab-table-heading"><h2>Personas con acceso (3)</h2>' +
    '<label class="collab-search">' + svg + '<input placeholder="Buscar por nombre, correo o nickname"></label></div>' +
    '<div class="collab-scroll"><table><thead><tr><th>Persona</th><th>Rol</th><th>Permisos</th>' +
    '<th>Estado</th><th>Última actividad</th><th>Acciones</th></tr></thead><tbody>' +
    makePeople('active') + '</tbody></table></div></section>' +
    '<section class="collab-table-card"><div class="collab-table-heading"><h2>Invitaciones (2)</h2></div>' +
    '<div class="collab-scroll"><table><thead><tr><th>Persona</th><th>Enviada el</th><th>Expira el</th>' +
    '<th>Permisos</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>' + makePeople('invite') +
    '</tbody></table></div></section></section></main></div></div>' +
    '<header class="mobile-topbar">Cabecera móvil</header><nav class="mobile-nav">Navegación móvil</nav></div>';
}
function editorMarkup() {
  return pageMarkup() +
    '<div class="collab-modal-backdrop" role="presentation"><section class="collab-modal" role="dialog" aria-modal="true">' +
    '<header class="collab-modal-header"><span class="collab-modal-heading-icon">' + svg + '</span><div>' +
    '<span class="collab-modal-eyebrow">GESTIÓN DE ACCESOS</span><h2>Editar permisos</h2>' +
    '<p>Define los permisos de Laura Nombre Muy Extenso de Ejemplo.</p></div>' +
    '<button class="collab-modal-close" aria-label="Cerrar formulario">' + svg + '</button></header>' +
    '<div class="collab-modal-content"><p class="collab-modal-intro">Selecciona los permisos que podrá utilizar este colaborador en XAMUKO Business.</p>' +
    '<div class="collab-modal-permission-list">' +
    ['Productos y servicios','Promociones','Estadísticas','Información del negocio'].map((name,i) =>
      '<label class="collab-modal-permission"><span class="collab-modal-permission-icon">' + svg + '</span>' +
      '<span>' + name + '</span><input type="checkbox"' + (i===0 ? ' checked' : '') + '></label>').join('') +
    '</div></div><footer class="collab-modal-actions"><button type="button" class="outline-button">Cancelar</button>' +
    '<button type="button" class="action-button">' + svg + 'Guardar cambios</button></footer></section></div></body></html>';
}
const sizes=[
  ['desktop',1440,900,false],['desktop-compact',1200,750,false],
  ['ipad-landscape-wide',1100,820,true],['ipad-landscape',1024,768,true],
  ['ipad-portrait-wide',820,1180,true],['ipad-portrait',768,1024,true],
  ['iphone',390,844,true],['iphone-small',320,568,true],
  ['iphone-landscape',667,375,true],
];
const browser=await chromium.launch({headless:true});
try{
  for(const [name,width,height,mobile] of sizes){
    const context=await browser.newContext({viewport:{width,height},isMobile:mobile,hasTouch:mobile,deviceScaleFactor:mobile?2:1});
    const page=await context.newPage();
    try{
      await page.setContent(pageMarkup()+'</body></html>');
      await page.addStyleTag({content:css});
      const list=await page.evaluate(()=>{
        const rect=e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
        const root=document.querySelector('.collab-page');
        const stats=[...document.querySelectorAll('.collab-stats article')].map(card=>{
          const icon=card.querySelector('.collab-stat-icon');
          const pictogram=icon.querySelector('svg');
          const a=rect(card),b=rect(icon),c=rect(pictogram);
          return {card:a,icon:b,vector:pictogram instanceof SVGSVGElement,
            iconContained:b.left>=a.left-1 && b.right<=a.right+1 && b.top>=a.top-1 && b.bottom<=a.bottom+1,
            svgContained:c.left>=b.left-1 && c.right<=b.right+1,gradient:getComputedStyle(icon).backgroundImage.includes('linear-gradient'),
            cardOverflow:card.scrollWidth>card.clientWidth+2};
        });
        const buttons=[...root.querySelectorAll('button')].map(button=>{
          const r=rect(button);return {label:button.textContent,underline:getComputedStyle(button).textDecorationLine,inside:r.left>=-2 && r.right<=(window.visualViewport?.width??innerWidth)+2};
        });
        const tables=[...document.querySelectorAll('.collab-table-card')].map(card=>{
          const r=rect(card),rows=[...card.querySelectorAll('tbody tr')].map(rect);
          return {card:r,rows,scrollWidth:card.scrollWidth,clientWidth:card.clientWidth};
        });
        return {page:rect(root),viewportWidth:window.visualViewport?.width??innerWidth,stats,buttons,tables,
          headingFont:getComputedStyle(document.querySelector('.collab-heading h1')).fontSize,
          eyebrowFont:getComputedStyle(document.querySelector('.collab-eyebrow')).fontSize,
          subtitleFont:getComputedStyle(document.querySelector('.collab-heading p')).fontSize,
          invite:rect(document.querySelector('.collab-invite')),
          inviteButton:rect(document.querySelector('.collab-invite-controls>button'))};
      });
      assert.ok(list.page.left>=-2&&list.page.right<=list.viewportWidth+2,name+': collaborators page fits screen horizontally '+JSON.stringify(list.page));
      assert.equal(list.stats.length,4,name+': four access indicators');
      for(const [i,stat] of list.stats.entries()){
        assert.ok(stat.vector&&stat.gradient,name+': indicator '+i+' uses professional vector icon and XAMUKO gradient');
        assert.ok(stat.iconContained&&stat.svgContained&&!stat.cardOverflow,name+': indicator '+i+' fits its card');
      }
      for(const [i,b] of list.buttons.entries()){
        assert.equal(b.underline,'none',name+': button '+i+' ('+b.label+') must never be underlined');
        assert.ok(b.inside,name+': button '+i+' fits horizontally');
      }
      assert.ok(list.inviteButton.height>=44,name+': invitation CTA is touch-sized');
      assert.ok(list.invite.left>=list.page.left-1&&list.invite.right<=list.page.right+1,name+': invitation form fully inside page');
      for(const [i,table] of list.tables.entries()){
        assert.ok(table.card.left>=list.page.left-1&&table.card.right<=list.page.right+1,name+': table '+i+' card fits viewport');
        if(width<=1100){
          assert.ok(table.scrollWidth<=table.clientWidth+2,name+': table '+i+' becomes responsive cards without horizontal scroll');
          for(const [k,r] of table.rows.entries())
            assert.ok(r.left>=table.card.left-1&&r.right<=table.card.right+1,name+': table '+i+' row '+k+' fits');
        }
      }
      assert.ok(Math.abs(parseFloat(list.headingFont)-Math.max(28,Math.min(33,width*.024)))<.2,name+': title matches Inicio typography');
      assert.equal(list.eyebrowFont,width<=700?'10px':'11px',name+': eyebrow matches Inicio');
      assert.equal(list.subtitleFont,width<=700?'12px':'13px',name+': subtitle matches Inicio');
      const guide=page.locator('.collab-guide');
      await guide.hover();
      assert.equal(await guide.evaluate(e=>getComputedStyle(e).textDecorationLine),'none',name+': guide button no underline on hover');
      await page.setContent(editorMarkup());
      await page.addStyleTag({content:css});
      await page.evaluate(()=>{
        const overlay=document.querySelector('.collab-modal-backdrop');
        const v=window.visualViewport;
        overlay.style.setProperty('--collab-viewport-top',(v?.offsetTop??0)+'px');
        overlay.style.setProperty('--collab-viewport-left',(v?.offsetLeft??0)+'px');
        overlay.style.setProperty('--collab-viewport-width',(v?.width??innerWidth)+'px');
        overlay.style.setProperty('--collab-viewport-height',(v?.height??innerHeight)+'px');
      });
      const initial=await page.evaluate(()=>{
        const rect=e=>{const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height};};
        const hit=e=>{const r=e.getBoundingClientRect(),target=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return target===e||e.contains(target);};
        const dialog=document.querySelector('.collab-modal');
        const header=dialog.querySelector('.collab-modal-header');
        const close=dialog.querySelector('.collab-modal-close');
        const visual=window.visualViewport;
        return {dialog:rect(dialog),header:rect(header),close:rect(close),closeClickable:hit(close),
          viewportWidth:visual?.width??innerWidth,viewportHeight:visual?.height??innerHeight,
          appHeader:getComputedStyle(document.querySelector('.business-desktop-header')).visibility,
          mobileHeader:getComputedStyle(document.querySelector('.mobile-topbar')).visibility,
          nav:getComputedStyle(document.querySelector('.mobile-nav')).visibility,
          checkboxes:dialog.querySelectorAll('input[type="checkbox"]').length};
      });
      assert.ok(initial.dialog.top>=-2&&initial.dialog.bottom<=initial.viewportHeight+2,name+': edit permissions dialog fits visible height '+JSON.stringify(initial.dialog));
      assert.ok(initial.dialog.left>=-2&&initial.dialog.right<=initial.viewportWidth+2,name+': edit dialog fits width');
      assert.ok(initial.header.top>=-2&&initial.header.bottom<=initial.viewportHeight+2,name+': modal header not obscured by Business');
      assert.ok(initial.close.top>=-2&&initial.close.bottom<=initial.viewportHeight+2&&initial.closeClickable,name+': modal close accessible');
      assert.equal(initial.checkboxes,4,name+': all four existing permission controls present');
      if(width<=1100){
        assert.equal(initial.appHeader,'hidden',name+': Business desktop header hidden during editing');
        assert.equal(initial.mobileHeader,'hidden',name+': mobile header hidden during editing');
        assert.equal(initial.nav,'hidden',name+': bottom nav hidden during editing');
      }
      await page.locator('.collab-modal').evaluate(el=>{el.scrollTop=el.scrollHeight;});
      const scrolled=await page.evaluate(()=>{
        const dialog=document.querySelector('.collab-modal');
        const header=dialog.querySelector('.collab-modal-header');
        const footer=dialog.querySelector('.collab-modal-actions');
        const buttons=[...footer.querySelectorAll('button')];
        const v=window.visualViewport?.height??innerHeight;
        return {headerTop:header.getBoundingClientRect().top,buttons:buttons.map(b=>{
          const r=b.getBoundingClientRect(),target=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
          return {top:r.top,bottom:r.bottom,height:r.height,clickable:target===b||b.contains(target),underline:getComputedStyle(b).textDecorationLine};
        }),viewport:v};
      });
      assert.ok(scrolled.headerTop>=-2,name+': modal title stays visible after scrolling');
      for(const [i,b] of scrolled.buttons.entries()){
        assert.ok(b.top>=-2&&b.bottom<=scrolled.viewport+2,name+': modal action '+i+' fully visible');
        assert.ok(b.height>=44&&b.clickable,name+': modal action '+i+' has accessible click target');
        assert.equal(b.underline,'none',name+': modal action '+i+' not underlined');
      }
      console.log('Business Colaboradores responsive verified: '+name);
    }finally{await context.close();}
  }
}finally{await browser.close();}
