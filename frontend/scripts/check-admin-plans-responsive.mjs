import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

// Isolated browser fixtures, never calls real Admin/API accounts.
const root = fileURLToPath(new URL('../apps/admin/dist/', import.meta.url));
const screenshots = fileURLToPath(new URL('../test-results/admin-plans/', import.meta.url));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2' };
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://fixture.local').pathname);
    const resolved = resolve(root, '.' + pathname);
    if (resolved !== resolve(root) && !resolved.startsWith(root.endsWith(sep) ? root : root + sep)) {
      res.writeHead(403).end(); return;
    }
    const target = extname(resolved) ? resolved : resolve(root, 'index.html');
    const body = await readFile(target);
    res.writeHead(200, { 'Content-Type': types[extname(target)] || 'application/octet-stream' }).end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch({ headless: true,
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
const at = '2026-11-18T17:00:00.000Z';
const items = [
  { id:'fixture-pro', publicId:'NEG-001', name:'Panadería del Valle', isPro:true,
    createdAt:at, location:{cityName:'Cali',countryCode:'CO'},
    visibilityStatus:'VISIBLE',administrativeRestriction:null },
  { id:'fixture-basic', publicId:'NEG-002', name:'Café La Ceiba', isPro:false,
    createdAt:at, location:{cityName:'Palmira',countryCode:'CO'},
    visibilityStatus:'REVIEW',administrativeRestriction:null },
  { id:'fixture-basic-2', publicId:'NEG-003', name:'Tienda Lirio', isPro:false,
    createdAt:at, location:{cityName:'Cali',countryCode:'CO'},
    visibilityStatus:'VISIBLE',administrativeRestriction:null },
];
try {
  await mkdir(screenshots,{recursive:true});
  for (const [device,viewport] of [
    ['mobile',{width:390,height:844}],
    ['ipad',{width:768,height:1024}],
    ['ipad-landscape',{width:1024,height:768}],
    ['desktop',{width:1440,height:900}],
  ]) {
    const records = structuredClone(items);
    const posts = [];
    const subscriptions = [
      { id:'sub-active',businessId:'fixture-pro',plan:'PRO',status:'ACTIVE',effective:true,
        startsAt:at,expiresAt:null,autoRenew:false,specialActivation:true,revokedAt:null,revocationReason:null,createdAt:at,updatedAt:at },
      { id:'sub-expiring',businessId:'fixture-pro',plan:'PRO',status:'ACTIVE',effective:true,
        startsAt:at,expiresAt:'2026-12-07T17:00:00.000Z',autoRenew:true,specialActivation:false,
        revokedAt:null,revocationReason:null,createdAt:at,updatedAt:at },
      { id:'sub-pending',businessId:'fixture-basic',plan:'PRO',status:'PENDING',effective:false,
        startsAt:at,expiresAt:null,autoRenew:true,specialActivation:false,revokedAt:null,revocationReason:null,createdAt:at,updatedAt:at },
      { id:'sub-expired',businessId:'fixture-basic-2',plan:'PRO',status:'EXPIRED',effective:false,
        startsAt:at,expiresAt:at,autoRenew:false,specialActivation:false,revokedAt:null,revocationReason:null,createdAt:at,updatedAt:at },
      { id:'sub-revoked',businessId:'fixture-basic',plan:'PRO',status:'REVOKED',effective:false,
        startsAt:at,expiresAt:at,autoRenew:false,specialActivation:false,revokedAt:at,
        revocationReason:'Cambio administrativo registrado en prueba.',createdAt:at,updatedAt:at },
    ];
    let businessReadAllowed = true;
    let deniedBusinessReads = 0;
    const context = await browser.newContext({viewport});
    await context.route('**/*', async route => {
      const request = route.request();
      const url = new URL(request.url());
      const headers = { 'Content-Type':'application/json','Access-Control-Allow-Origin':origin,
        'Access-Control-Allow-Credentials':'true','Access-Control-Allow-Headers':'*' };
      const reply = (status,body) => route.fulfill({status,headers,body:JSON.stringify(body)});
      if (request.method()==='OPTIONS') return route.fulfill({status:204,headers});
      if (url.pathname.endsWith('/admin/auth/session'))
        return reply(200,{authenticated:true,userId:'fixture-admin',csrfToken:'fixture-csrf'});
      if (url.pathname.endsWith('/admin/me')) return reply(200,{admin:{
        user:{id:'fixture-admin',publicId:'A-1',displayName:'Super Admin',emailNormalized:'admin@example.test',avatarUrl:null,locale:'es-CO'},
        role:'SUPER_ADMIN',permissions:businessReadAllowed
          ? ['BUSINESSES_READ','AUDIT_READ','CATALOG_READ','FINANCE_READ']
          : ['FINANCE_READ'],
      }});
      if (url.pathname.endsWith('/admin/businesses/overview')) return reply(200,{
        generatedAt:at,total:records.length,visible:2,hidden:0,expired:0,adminHidden:0,
        suspended:0,verified:0,pro:records.filter(b=>b.isPro).length,reported:0,review:1,deleted:0,expiring:0,
      });
      if (!businessReadAllowed &&
          (url.pathname.endsWith('/admin/dashboard/stats') || url.pathname.endsWith('/admin/subscriptions'))) {
        deniedBusinessReads++;
        return reply(403,{error:{message:'BUSINESSES_READ requerido'}});
      }
      if (url.pathname.endsWith('/admin/dashboard/stats')) return reply(200,{
        generatedAt:at,subscriptions:{proActive:records.filter(b=>b.isPro).length,
          proPending:1,proExpiring30Days:1,plus:null},revenue:null,
      });
      if (url.pathname.endsWith('/admin/subscriptions')) {
        const q=(url.searchParams.get('q')||'').toLowerCase();
        const status=url.searchParams.get('status')||'';
        const view=url.searchParams.get('view')||'ALL';
        const page=Math.max(1,Number(url.searchParams.get('page'))||1);
        const pageSize=Number(url.searchParams.get('pageSize'))||12;
        const matches=subscriptions.filter(s=>{
          const b=records.find(b=>b.id===s.businessId);
          return (!status||s.status===status)&&
            (view==='ALL'||(view==='EFFECTIVE'&&s.effective)||
              (view==='EXPIRING_30_DAYS'&&s.effective&&s.expiresAt&&s.expiresAt>'2026-11-18T12:00:00.000Z'&&s.expiresAt<='2026-12-18T12:00:00.000Z')||
              (view==='SPECIAL_EFFECTIVE'&&s.effective&&s.specialActivation))&&
            (!q||(b&&[b.name,b.publicId].some(value=>value.toLowerCase().includes(q))));
        });
        return reply(200,{generatedAt:at,definition:'Suscripciones reales simuladas en fixture aislado.',
          subscriptions:matches.slice((page-1)*pageSize,page*pageSize).map(s=>({
            ...s,business:(()=>{
              const b=records.find(b=>b.id===s.businessId);
              return {id:b.id,publicId:b.publicId,name:b.name,deletionStatus:'NONE'};
            })(),
          })),
          pagination:{page,pageSize,total:matches.length,totalPages:Math.ceil(matches.length/pageSize)}});
      }
      if (url.pathname.endsWith('/admin/businesses/filters')) return reply(200,{
        categories:[],cities:[{value:'CO|Cali',label:'Cali'},{value:'CO|Palmira',label:'Palmira'}],
      });
      if (url.pathname.endsWith('/admin/audit/visibility')) return reply(200,{
        entries:posts.map((post,i)=>({
          id:'audit-'+i,entityId:post.id,action:'ADMIN_BUSINESS_PLAN_CHANGED',reason:post.reason,comment:null,
          createdAt:at,actor:{displayName:'Super Admin'},
          previousState:{plan:post.plan==='PRO'?'BASIC':'PRO'},newState:{plan:post.plan},
          business:{id:post.id,name:records.find(b=>b.id===post.id)?.name ?? 'Negocio',publicId:'NEG-002'},
        })),
        pagination:{page:1,pageSize:15,total:posts.length,totalPages:posts.length?1:0},
      });
      if (url.pathname.endsWith('/admin/businesses') && request.method()==='GET') {
        const q=(url.searchParams.get('q')??'').toLowerCase();
        const plan=url.searchParams.get('plan')??'';
        const city=url.searchParams.get('city')??'';
        const order=url.searchParams.get('order')??'';
        let filtered=records.filter(b=>(!q||[b.name,b.publicId].some(s=>s.toLowerCase().includes(q))) &&
          (!plan||(plan==='pro'?b.isPro:!b.isPro)) &&
          (!city||city===b.location.countryCode+'|'+b.location.cityName));
        if(order==='name')filtered=[...filtered].sort((a,b)=>a.name.localeCompare(b.name));
        const page=Math.max(1,Number(url.searchParams.get('page'))||1);
        const pageSize=Math.max(1,Number(url.searchParams.get('pageSize'))||15);
        return reply(200,{businesses:filtered.slice((page-1)*pageSize,page*pageSize),
          pagination:{page,pageSize,total:filtered.length,totalPages:Math.ceil(filtered.length/pageSize)}});
      }
      const planMatch=url.pathname.match(/\/admin\/businesses\/(fixture-[^/]+)\/plan$/);
      if(planMatch&&request.method()==='POST'){
        const data=JSON.parse(request.postData()||'{}');
        if(data.confirmation!==data.plan||data.reason?.trim().length<12) return reply(400,{error:{message:'Confirmación inválida'}});
        const found=records.find(b=>b.id===planMatch[1]);
        if(!found) return reply(404,{error:{message:'No encontrado'}});
        found.isPro=data.plan==='PRO';
        posts.push({id:found.id,plan:data.plan,reason:data.reason});
        if(data.plan==='PRO')subscriptions.unshift({id:'sub-manual',businessId:found.id,plan:'PRO',
          status:'ACTIVE',effective:true,startsAt:at,expiresAt:null,autoRenew:false,
          specialActivation:true,revokedAt:null,revocationReason:null,createdAt:at,updatedAt:at});
        return reply(200,{plan:data.plan,message:'Plan actualizado y propietarios notificados.'});
      }
      if(url.origin!==origin||url.pathname.startsWith('/api/'))
        return reply(503,{error:{code:'ISOLATED_FIXTURE',message:'No hay datos para esta consulta en pruebas.'}});
      return route.continue();
    });
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    try {
      await page.goto(origin+'/plans',{waitUntil:'domcontentloaded'});
      await page.getByRole('heading',{name:'Planes y suscripciones'}).waitFor({state:'visible',timeout:15000});
      await page.getByText('3 negocios encontrados').waitFor({state:'visible',timeout:15000});
      await page.getByRole('heading',{name:'Suscripciones registradas'}).waitFor({state:'visible'});
      await page.getByText('5 registros', { exact: true }).waitFor({state:'visible'});
      const subscriptionCards = page.locator('.aps-subscription-cards');
      assert.equal(await subscriptionCards.isVisible(),viewport.width<=980,
        device+': subscription cards on mobile and tablets');
      const subscriptionTable = page.locator('.aps-subscription-table-wrap');
      assert.equal(await subscriptionTable.isVisible(),viewport.width>980,
        device+': subscription table on desktop');
      await page.getByLabel('Estado de suscripción').selectOption('PENDING');
      await page.getByText('1 registro',{exact:true}).waitFor({state:'visible'});
      await page.getByLabel('Estado de suscripción').selectOption('');
      await page.getByText('5 registros',{exact:true}).waitFor({state:'visible'});
      await page.getByLabel('Buscar suscripciones').fill('Ceiba');
      await page.locator('.aps-subscription-filters').getByRole('button',{name:'Buscar'}).click();
      await page.getByText('2 registros',{exact:true}).waitFor({state:'visible'});
      await page.locator('.aps-subscription-filters').getByRole('button',{name:'Limpiar'}).click();
      await page.getByText('5 registros',{exact:true}).waitFor({state:'visible'});
      const layout=await page.evaluate(()=>{
        const input=document.querySelector('.aps-search-wrap input');
        const select=document.querySelector('.aps-filters select');
        const field=document.querySelector('.aps-filters');
        const main=document.querySelector('.aps-page');
        return {width:innerWidth,scroll:document.documentElement.scrollWidth,
          inputFont:parseFloat(getComputedStyle(input).fontSize),
          selectFont:parseFloat(getComputedStyle(select).fontSize),
          inputHeight:input.getBoundingClientRect().height,
          selectHeight:select.getBoundingClientRect().height,
          formOverflow:field.scrollWidth-field.clientWidth,
          mainOverflow:main.scrollWidth-main.clientWidth};
      });
      assert.ok(layout.scroll<=layout.width+2,device+': no page horizontal overflow '+JSON.stringify(layout));
      assert.ok(layout.formOverflow<=2&&layout.mainOverflow<=2,device+': form fits viewport '+JSON.stringify(layout));
      assert.ok(layout.inputFont>=14&&layout.selectFont>=14&&layout.inputHeight>=26&&layout.selectHeight>=49,
        device+': desktop/iPad/mobile input readability '+JSON.stringify(layout));
      assert.equal(await page.getByText('Business PRO vigente').count()>0,true,device+': existing plan indicator');
      assert.equal(await page.getByText('PRO pendiente').count()>0,true,device+': actual pending indicator');
      await page.getByRole('button',{name:/Ver negocios/}).first().click();
      await page.getByText('2 negocios encontrados').waitFor({state:'visible'});
      await page.locator('.aps-filters').getByRole('button',{name:'Limpiar'}).click();
      await page.getByText('3 negocios encontrados').waitFor({state:'visible'});
      await page.getByLabel('Buscar negocios por nombre o identificador').fill('Ceiba');
      await page.locator('.aps-filters').getByRole('button',{name:'Buscar',exact:true}).click();
      await page.getByText('1 negocio encontrado').waitFor({state:'visible'});
      await page.locator('.aps-filters').getByRole('button',{name:'Limpiar'}).click();
      await page.getByText('3 negocios encontrados').waitFor({state:'visible'});
      await page.getByLabel('Filtrar por plan').selectOption('pro');
      await page.getByText('1 negocio encontrado').waitFor({state:'visible'});
      await page.getByLabel('Filtrar por plan').selectOption('');
      await page.getByText('3 negocios encontrados').waitFor({state:'visible'});
      const row=page.locator('.aps-table tbody tr').filter({hasText:'Café La Ceiba'});
      await row.getByRole('button',{name:'Cambiar plan'}).click();
      let dialog=page.getByRole('dialog',{name:'Cambiar plan de negocio'});
      assert.equal(await dialog.getByRole('button',{name:'Confirmar cambio de plan'}).isDisabled(),true,
        device+': administrative change requires reason and token');
      await dialog.getByLabel(/Motivo administrativo obligatorio/).fill('Decisión administrativa justificada en prueba aislada.');
      await dialog.getByLabel(/Escribe PRO para confirmar/).fill('PRO');
      await dialog.getByRole('button',{name:'Confirmar cambio de plan'}).click();
      await page.getByText('Plan actualizado y propietarios notificados.').waitFor({state:'visible'});
      await page.getByText('6 registros',{exact:true}).waitFor({state:'visible'});
      assert.equal(posts.length,1,device+': exactly one authorized request');
      assert.equal(posts[0].plan,'PRO',device+': assigned existing PRO plan');
      assert.ok(posts[0].reason.length>=12,device+': reason persisted in API request');
      await page.getByText('Cambios administrativos de plan').waitFor({state:'visible'});
      await page.getByText('Decisión administrativa justificada en prueba aislada.').waitFor({state:'visible'});
      await page.screenshot({path:resolve(screenshots,device+'.png'),fullPage:true});
      await page.goto(origin+'/business-pro',{waitUntil:'domcontentloaded'});
      await page.getByRole('heading',{name:'Business PRO',exact:true}).waitFor({state:'visible'});
      await page.getByText('3 registros encontrados',{exact:true}).waitFor({state:'visible'});
      const tabs=page.getByRole('group',{name:'Vistas de Business PRO'});
      await tabs.getByRole('button',{name:'Por vencer'}).click();
      await page.getByText('1 registro encontrado',{exact:true}).waitFor({state:'visible'});
      await tabs.getByRole('button',{name:'Activaciones especiales'}).click();
      await page.getByText('2 registros encontrados',{exact:true}).waitFor({state:'visible'});
      await tabs.getByRole('button',{name:'Pendientes'}).click();
      await page.getByText('1 registro encontrado',{exact:true}).waitFor({state:'visible'});
      await tabs.getByRole('button',{name:'Todo el historial'}).click();
      await page.getByText('6 registros encontrados',{exact:true}).waitFor({state:'visible'});
      await page.getByLabel('Buscar negocios Business PRO').fill('Ceiba');
      await page.locator('.abp-filters').getByRole('button',{name:'Buscar'}).click();
      await page.getByText('3 registros encontrados',{exact:true}).waitFor({state:'visible'});
      const layouts=await page.evaluate(()=>{
        const form=document.querySelector('.abp-filters'),input=form.querySelector('input');
        const tabs=document.querySelector('.abp-view-tabs');
        const main=document.querySelector('.abp-page');
        return { scroll:document.documentElement.scrollWidth,width:innerWidth,
          formOverflow:form.scrollWidth-form.clientWidth,mainOverflow:main.scrollWidth-main.clientWidth,
          inputSize:parseFloat(getComputedStyle(input).fontSize),
          tabsScroll:tabs.scrollWidth-tabs.clientWidth,
          tableShown:getComputedStyle(document.querySelector('.aps-subscription-table-wrap')).display!=='none',
          cardsShown:getComputedStyle(document.querySelector('.aps-subscription-cards')).display!=='none' };
      });
      assert.ok(layouts.scroll<=layouts.width+2&&layouts.formOverflow<=2&&layouts.mainOverflow<=2,
        device+': Business PRO no horizontal overflow '+JSON.stringify(layouts));
      assert.ok(layouts.inputSize>=14,device+': Business PRO search legible');
      assert.equal(layouts.cardsShown,viewport.width<=980,device+': Business PRO cards for iPad and mobile');
      assert.equal(layouts.tableShown,viewport.width>980,device+': Business PRO table for desktop');
      assert.equal(await page.locator('.abp-register a[href^="/plans?q="]').count()>0,true,
        device+': Manage plan is linked to real admin workflow');
      await page.screenshot({path:resolve(screenshots,'business-pro-'+device+'.png'),fullPage:true});
      await page.goto(origin+'/billing',{waitUntil:'domcontentloaded'});
      await page.getByRole('heading',{name:'Ingresos y facturación',exact:true}).waitFor({state:'visible'});
      await page.getByText('6 registros',{exact:true}).waitFor({state:'visible'});
      await page.getByRole('heading',{name:'Ingresos y facturación comercial'}).waitFor({state:'visible'});
      const financeNavigation=page.getByRole('navigation',{name:'Pestañas de Finanzas y contabilidad'});
      assert.equal(await financeNavigation.getByRole('link').count(),4,device+': all four finance modules linked');
      assert.equal(await financeNavigation.getByRole('link',{name:'Ingresos y facturación',exact:true}).getAttribute('aria-current'),
        'page',device+': correct active financial tab');
      assert.equal(await page.locator('.abill-money-card').count(),4,
        device+': all monetary categories explicitly distinguish unavailable sources');
      assert.equal(await page.locator('.abill-money-card').filter({hasText:'No disponible'}).count(),4,
        device+': no invented monetary numbers or artificial zeros');
      assert.equal(await page.getByText('Registro de ingresos comerciales aún no integrado').isVisible(),
        true,device+': billing scope clearly disclosed');
      assert.equal(await page.locator('.abill-commercial-card').count(),3,
        device+': existing PRO operational indicators');
      assert.equal((await page.getByRole('link',{name:/Consultar gastos tecnológicos/}).filter({visible:true}).count()) > 0,
        true,device+': supplier invoices linked to actual expense module');
      await page.getByLabel('Filtrar suscripciones por estado').selectOption('PENDING');
      await page.getByText('1 registro',{exact:true}).waitFor({state:'visible'});
      await page.getByLabel('Filtrar suscripciones por estado').selectOption('');
      await page.getByText('6 registros',{exact:true}).waitFor({state:'visible'});
      await page.getByLabel('Buscar registro comercial').fill('Ceiba');
      await page.locator('.abill-filters').getByRole('button',{name:'Buscar'}).click();
      await page.getByText('3 registros',{exact:true}).waitFor({state:'visible'});
      await page.locator('.abill-filters').getByRole('button',{name:'Limpiar'}).click();
      await page.getByText('6 registros',{exact:true}).waitFor({state:'visible'});
      const billingGeometry=await page.evaluate(()=>{
        const form=document.querySelector('.abill-filters'),input=form.querySelector('input');
        const dropdown=form.querySelector('select'),main=document.querySelector('.abill-page');
        const table=document.querySelector('.abill-table-scroll'),cards=document.querySelector('.abill-mobile-records');
        return {viewport:innerWidth,scroll:document.documentElement.scrollWidth,
          formOverflow:form.scrollWidth-form.clientWidth,mainOverflow:main.scrollWidth-main.clientWidth,
          fontSize:parseFloat(getComputedStyle(input).fontSize),
          selectFont:parseFloat(getComputedStyle(dropdown).fontSize),
          selectHeight:dropdown.getBoundingClientRect().height,
          cardsShown:getComputedStyle(cards).display!=='none',
          tableShown:getComputedStyle(table).display!=='none'};
      });
      assert.ok(billingGeometry.scroll<=billingGeometry.viewport+2&&
        billingGeometry.formOverflow<=2&&billingGeometry.mainOverflow<=2,
        device+': billing no horizontal overflow '+JSON.stringify(billingGeometry));
      assert.ok(billingGeometry.fontSize>=14&&billingGeometry.selectFont>=14&&billingGeometry.selectHeight>=49,
        device+': readable billing filters '+JSON.stringify(billingGeometry));
      assert.equal(billingGeometry.cardsShown,viewport.width<=1100,device+': tablet/mobile billing cards');
      assert.equal(billingGeometry.tableShown,viewport.width>1100,device+': desktop billing table');
      await page.screenshot({path:resolve(screenshots,'billing-'+device+'.png'),fullPage:true});
      if (device==='desktop') {
        businessReadAllowed=false;
        await page.reload({waitUntil:'domcontentloaded'});
        await page.getByText('Consulta de negocios restringida').waitFor({state:'visible'});
        await page.locator('.abill-inline-error').getByText(/Los indicadores de negocios requieren adicionalmente BUSINESSES_READ/).waitFor({state:'visible'});
        assert.equal(deniedBusinessReads,0,'Finance-only admin must not request protected Business PRO records');
        assert.equal(await page.locator('.abill-commercial-card strong').filter({hasText:'—'}).count(),3,
          'Business PRO statistics remain unavailable without business permission');
      }
      assert.equal(errors.length,0,device+': no JS errors '+errors.join('; '));
      console.log('Admin Planes y suscripciones: indicadores, filtros, plan confirmation, audit, responsive OK '+device);
    } finally { await context.close(); }
  }
} finally {
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
