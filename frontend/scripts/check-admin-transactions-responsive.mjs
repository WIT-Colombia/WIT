import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const dist = fileURLToPath(new URL('../apps/admin/dist/', import.meta.url));
const shots = fileURLToPath(new URL('../test-results/admin-transactions/', import.meta.url));
const mime = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.woff2': 'font/woff2',
};
const server = createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://isolated.test').pathname);
    const resolved = resolve(dist, '.' + path);
    if (resolved !== dist && !resolved.startsWith(dist.endsWith(sep) ? dist : dist + sep)) {
      res.writeHead(403).end(); return;
    }
    const target = extname(resolved) ? resolved : resolve(dist,'index.html');
    const contents = await readFile(target);
    res.writeHead(200, { 'Content-Type': mime[extname(target)] || 'application/octet-stream' }).end(contents);
  } catch { res.writeHead(404).end(); }
});
await new Promise(done => server.listen(0,'127.0.0.1',done));
const origin = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch({ headless:true, ...(process.env.CHROMIUM_PATH
  ? { executablePath:process.env.CHROMIUM_PATH } : {}) });
const fixtures = [
  { id:'tx-aws',status:'PAID',amountCop:'140000',reference:'BANCO-001',
    createdAt:'2026-11-18T14:00:00.000Z',paidAt:'2026-11-18T15:00:00.000Z',
    invoice:{id:'inv-aws',invoiceNumber:'AWS-2026-11',externalId:'AWS-EX-01',
      amountCop:'140000',documentUrl:'https://example.org/invoice.pdf',
      provider:{id:'provider-aws',name:'Amazon Web Services'}} },
  { id:'tx-google',status:'PENDING',amountCop:'65000',reference:null,
    createdAt:'2026-11-17T14:00:00.000Z',paidAt:null,
    invoice:{id:'inv-google',invoiceNumber:'GOO-02',externalId:'EX-GOO-02',
      amountCop:'100000',documentUrl:null,
      provider:{id:'provider-google',name:'Google Maps'}} },
  { id:'tx-resend',status:'CANCELLED',amountCop:'30000',reference:'DEV-02',
    createdAt:'2026-11-16T14:00:00.000Z',paidAt:null,
    invoice:{id:'inv-resend',invoiceNumber:null,externalId:'RES-03',
      amountCop:'30000',documentUrl:null,
      provider:{id:'provider-resend',name:'Resend'}} },
  { id:'tx-aws-2',status:'PAID',amountCop:'40000',reference:'TRANSFER-04',
    createdAt:'2026-11-15T14:00:00.000Z',paidAt:null,
    invoice:{id:'inv-aws2',invoiceNumber:'AWS-2026-10',externalId:'AWS-EX-02',
      amountCop:'40000',documentUrl:null,
      provider:{id:'provider-aws',name:'Amazon Web Services'}} },
];
try {
  await mkdir(shots,{recursive:true});
  for (const [device,viewport] of [
    ['mobile',{width:390,height:844}],
    ['ipad',{width:768,height:1024}],
    ['ipad-landscape',{width:1024,height:768}],
    ['desktop',{width:1440,height:900}],
  ]) {
    const entries=structuredClone(fixtures);
    const changes=[];
    const context=await browser.newContext({viewport});
    await context.route('**/*',async route=>{
      const req=route.request(),url=new URL(req.url());
      const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':origin,
        'Access-Control-Allow-Credentials':'true','Access-Control-Allow-Headers':'*'};
      const reply=(status,body)=>route.fulfill({status,headers,body:JSON.stringify(body)});
      if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
      if(url.pathname.endsWith('/admin/auth/session'))
        return reply(200,{authenticated:true,userId:'fixture-admin',csrfToken:'test-csrf'});
      if(url.pathname.endsWith('/admin/me'))return reply(200,{admin:{
        user:{id:'fixture-admin',publicId:'ADM-01',displayName:'Administrador pruebas',
          emailNormalized:'admin@example.test',avatarUrl:null,locale:'es-CO'},
        role:'SUPER_ADMIN',permissions:['FINANCE_READ','FINANCE_MANAGE','BUSINESSES_READ'],
      }});
      if(url.pathname.endsWith('/admin/finance/transactions')&&req.method()==='GET'){
        const status=url.searchParams.get('status')||'';
        const q=(url.searchParams.get('q')||'').toLowerCase();
        const from=url.searchParams.get('from')||'';
        const to=url.searchParams.get('to')||'';
        const page=Math.max(1,Number(url.searchParams.get('page'))||1);
        const limit=Number(url.searchParams.get('pageSize'))||12;
        const filtered=entries.filter(x=>(!status||x.status===status)&&
          (!q||[x.reference??'',x.invoice.provider.name,x.invoice.invoiceNumber??'',
            x.invoice.externalId].some(value=>value.toLowerCase().includes(q)))&&
          (!from||x.createdAt.slice(0,10)>=from)&&(!to||x.createdAt.slice(0,10)<=to));
        const statuses=['PAID','PENDING','CANCELLED'];
        const summary=Object.fromEntries(statuses.map(s=>[s,{
          count:entries.filter(x=>x.status===s).length,
          amountCop:entries.filter(x=>x.status===s).reduce((total,x)=>total+Number(x.amountCop),0),
        }]));
        return reply(200,{scope:'VENDOR_PAYMENTS',currency:'COP',generatedAt:'2026-11-18T17:00:00.000Z',
          definition:'Pagos registrados a proveedores. No son ingresos de clientes.',
          totals:{records:entries.length,...summary},
          transactions:filtered.slice((page-1)*limit,page*limit),
          pagination:{page,pageSize:limit,total:filtered.length,totalPages:Math.ceil(filtered.length/limit)}});
      }
      const edit=url.pathname.match(/\/admin\/finance\/payments\/(tx-[^/]+)$/);
      if(edit&&req.method()==='PATCH'){
        const data=JSON.parse(req.postData()||'{}');
        if(!data.reason?.trim()||!['PAID','PENDING','CANCELLED'].includes(data.status))
          return reply(400,{message:'Corrección inválida'});
        const item=entries.find(e=>e.id===edit[1]);
        if(!item)return reply(404,{message:'Pago no encontrado'});
        item.status=data.status;item.amountCop=String(data.amountCop);item.reference=data.reference;
        changes.push({id:item.id,...data});
        return reply(200,{payment:item});
      }
      if(url.origin!==origin||url.pathname.startsWith('/api/'))
        return reply(503,{error:{code:'ISOLATED_FIXTURE',message:'Consulta no habilitada en pruebas aisladas'}});
      return route.continue();
    });
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    try{
      await page.goto(origin+'/transactions',{waitUntil:'domcontentloaded'});
      await page.getByRole('heading',{name:'Transacciones',exact:true})
        .waitFor({state:'visible',timeout:15000});
      await page.getByText('4 registros',{exact:true}).waitFor({state:'visible',timeout:15000});
      assert.equal(await page.locator('.atx-indicator').count(),4,device+': 4 genuine financial indicators');
      assert.equal(await page.getByText('Transacciones comerciales de clientes: sin integración').isVisible(),true,
        device+': never pass vendor outflows as customer revenue');
      assert.equal(await page.getByText('Registrados como pagados').isVisible(),true,
        device+': recorded PAID status is distinct from bank reconciliation');
      const geometry=await page.evaluate(()=>{
        const form=document.querySelector('.atx-filters'),main=document.querySelector('.atx-page');
        const input=form.querySelector('input[type="search"]');
        const controls=[...form.querySelectorAll('input,select')].map(el=>({
          height:el.getBoundingClientRect().height,font:parseFloat(getComputedStyle(el).fontSize),
        }));
        const table=document.querySelector('.atx-table-scroll'),cards=document.querySelector('.atx-mobile-records');
        return {viewport:innerWidth,scroll:document.documentElement.scrollWidth,
          mainOverflow:main.scrollWidth-main.clientWidth,formOverflow:form.scrollWidth-form.clientWidth,
          controls,searchFont:parseFloat(getComputedStyle(input).fontSize),
          tableVisible:getComputedStyle(table).display!=='none',
          cardsVisible:getComputedStyle(cards).display!=='none'};
      });
      assert.ok(geometry.scroll<=geometry.viewport+2&&geometry.formOverflow<=2&&geometry.mainOverflow<=2,
        device+': no horizontal page or filter overflow '+JSON.stringify(geometry));
      assert.ok(geometry.controls.every(c=>c.height>=47&&c.font>=14),
        device+': desktop and iPad inputs readable '+JSON.stringify(geometry));
      assert.equal(geometry.cardsVisible,viewport.width<=1100,device+': cards for iPad and mobile');
      assert.equal(geometry.tableVisible,viewport.width>1100,device+': table for desktop');
      await page.getByLabel('Filtrar por estado de transacción').selectOption('PENDING');
      await page.getByText('1 registro',{exact:true}).waitFor({state:'visible'});
      await page.getByLabel('Filtrar por estado de transacción').selectOption('');
      await page.getByText('4 registros',{exact:true}).waitFor({state:'visible'});
      await page.getByLabel('Buscar pagos por proveedor, factura o referencia').fill('AWS');
      await page.locator('.atx-filters').getByRole('button',{name:'Buscar'}).click();
      await page.getByText('2 registros',{exact:true}).waitFor({state:'visible'});
      await page.locator('.atx-filters').getByRole('button',{name:'Limpiar'}).click();
      await page.getByText('4 registros',{exact:true}).waitFor({state:'visible'});
      await page.getByLabel('Fecha inicial del registro').fill('2026-11-18');
      await page.locator('.atx-filters').getByRole('button',{name:'Buscar'}).click();
      await page.getByText('1 registro',{exact:true}).waitFor({state:'visible'});
      await page.locator('.atx-filters').getByRole('button',{name:'Limpiar'}).click();
      await page.getByText('4 registros',{exact:true}).waitFor({state:'visible'});
      const visible=page.locator(viewport.width<=1100?'.atx-mobile-records':'.atx-table-scroll');
      await visible.getByRole('button',{name:'Ver detalle'}).first().click();
      const dialog=page.getByRole('dialog',{name:'Detalle del pago a proveedor'});
      await dialog.getByText('Amazon Web Services').first().waitFor({state:'visible'});
      assert.equal(await dialog.getByText('BANCO-001').isVisible(),true,
        device+': backend reference appears in detail');
      await dialog.getByRole('button',{name:'Corregir registro'}).click();
      await dialog.getByRole('heading',{name:'Corregir registro financiero'}).waitFor({state:'visible'});
      assert.equal(await dialog.getByRole('button',{name:'Guardar corrección'}).isDisabled(),true,
        device+': cannot save without reason');
      await dialog.getByLabel('Estado del pago').selectOption('PENDING');
      await dialog.getByLabel('Motivo de la corrección').fill('Corrección de estado con soporte administrativo verificable.');
      await dialog.getByRole('button',{name:'Guardar corrección'}).click();
      await page.getByText('Corrección administrativa registrada en el historial financiero.')
        .waitFor({state:'visible'});
      assert.equal(changes.length,1,device+': exactly one audited correction request');
      assert.equal(changes[0].status,'PENDING',device+': existing backend status changed');
      assert.ok(changes[0].reason.length>=12,device+': mandatory reason sent');
      await page.screenshot({path:resolve(shots,device+'.png'),fullPage:true});
      assert.equal(errors.length,0,device+': JS errors '+errors.join(' | '));
      console.log('Admin Transacciones: real vendor payments, filters, audit correction and responsive OK - '+device);
    }finally{await context.close()}
  }
}finally{
  await browser.close();
  await new Promise(done=>server.close(done));
}
