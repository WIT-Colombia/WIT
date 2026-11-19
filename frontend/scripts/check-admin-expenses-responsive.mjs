import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,readFile} from 'node:fs/promises';
import {extname,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const dist=fileURLToPath(new URL('../apps/admin/dist/',import.meta.url));
const screenshots=fileURLToPath(new URL('../test-results/admin-expenses/',import.meta.url));
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css',
  '.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
  try{
    const requestPath=decodeURIComponent(new URL(req.url,'http://fixture.example').pathname);
    const file=resolve(dist,'.'+requestPath);
    if(file!==dist&&!file.startsWith(dist.endsWith(sep)?dist:dist+sep)){res.writeHead(403).end();return;}
    const target=extname(file)?file:resolve(dist,'index.html');
    const bytes=await readFile(target);
    res.writeHead(200,{'Content-Type':mime[extname(target)]??'application/octet-stream'}).end(bytes);
  }catch{res.writeHead(404).end();}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,
  ...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
const at='2026-11-18T12:00:00.000Z';
const providerAWS='11111111-1111-1111-1111-111111111111';
const providerMaps='22222222-2222-2222-2222-222222222222';
const p=(id,name)=>({id,name});
const fixture={
  CONSUMPTIONS:[
    {id:'manual1',kind:'CONSUMPTIONS',name:'Consumo de prueba registrado',detail:'MANUAL-001',
      providerName:'Amazon Web Services',providerId:providerAWS,
      amountCop:'35000.00',amountUsd:'8.7500',creditsUsd:'0',status:'MANUAL',
      periodStart:'2026-11-02',periodEnd:'2026-11-02',createdAt:at,canEdit:true},
    {id:'real1',kind:'CONSUMPTIONS',name:'Amazon EC2',detail:'AWS-EC2',
      providerName:'Amazon Web Services',providerId:providerAWS,
      amountCop:'120000.00',amountUsd:'30',creditsUsd:'5',status:'REAL',
      periodStart:'2026-11-01',periodEnd:'2026-11-01',createdAt:at,canEdit:false},
    {id:'estimated1',kind:'CONSUMPTIONS',name:'Mapas proyectados',detail:'MAP-01',
      providerName:'Google Maps',providerId:providerMaps,
      amountCop:'25000.00',amountUsd:'6.25',creditsUsd:'0',status:'ESTIMATED',
      periodStart:'2026-11-05',periodEnd:'2026-11-05',createdAt:at,canEdit:false},
  ],
  INVOICES:[
    {id:'inv1',kind:'INVOICES',name:'AWS-2026-11',detail:'EX-INV-001',
      providerName:'Amazon Web Services',providerId:providerAWS,amountCop:'140000.00',
      amountUsd:'35',status:'REAL',documentUrl:'https://example.org/invoice.pdf',
      periodStart:'2026-11-01',periodEnd:'2026-11-30',createdAt:at,canEdit:true},
  ],
  PAYMENTS:[
    {id:'pay1',kind:'PAYMENTS',name:'AWS-2026-11',detail:'REF-001',reference:'REF-001',
      providerName:'Amazon Web Services',providerId:providerAWS,amountCop:'140000.00',
      amountUsd:null,status:'PAID',createdAt:at,paidAt:at,canEdit:true},
  ],
  BUDGETS:[
    {id:'budget1',kind:'BUDGETS',name:'Infraestructura AWS',detail:'Presupuesto activo',
      providerName:'Amazon Web Services',providerId:providerAWS,amountCop:'210000.00',
      amountUsd:'50',status:'ACTIVE',createdAt:at,periodStart:'2026-11-01',
      periodEnd:'2026-11-30',canEdit:true},
  ],
  PROVIDERS:[
    {id:providerAWS,kind:'PROVIDERS',name:'Amazon Web Services',detail:'AWS',
      providerName:'Amazon Web Services',providerId:providerAWS,amountCop:null,amountUsd:null,
      currency:'USD',status:'ACTIVE',createdAt:at,canEdit:true},
    {id:providerMaps,kind:'PROVIDERS',name:'Google Maps',detail:'GOOGLE_MAPS',
      providerName:'Google Maps',providerId:providerMaps,amountCop:null,amountUsd:null,
      currency:'USD',status:'ACTIVE',createdAt:at,canEdit:true},
  ],
  ALERTS:[
    {id:'alert1',kind:'ALERTS',name:'Presupuesto alcanzó el 75%',detail:'Umbral 75%',
      providerName:null,amountCop:null,amountUsd:null,status:'PENDING',createdAt:at,
      acknowledgedAt:null,canEdit:true},
  ],
  AUDIT:[
    {id:'audit1',kind:'AUDIT',name:'CORRECT',detail:'FinancialBudget',
      providerName:null,amountCop:null,amountUsd:null,status:'FinancialBudget',
      createdAt:at,reason:'Ajuste del presupuesto con soporte.',actorUserId:'admin-test',canEdit:false},
  ],
};
try{
  await mkdir(screenshots,{recursive:true});
  for(const [device,viewport] of [
    ['mobile',{width:390,height:844}],['ipad',{width:768,height:1024}],
    ['ipad-landscape',{width:1024,height:768}],['desktop',{width:1440,height:900}],
  ]){
    const records=structuredClone(fixture);
    const operations=[];
    const context=await browser.newContext({viewport,acceptDownloads:true});
    await context.route('**/*',async route=>{
      const request=route.request(),url=new URL(request.url());
      const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':origin,
        'Access-Control-Allow-Credentials':'true','Access-Control-Allow-Headers':'*'};
      const send=(status,data)=>route.fulfill({status,headers,body:JSON.stringify(data)});
      if(request.method()==='OPTIONS')return route.fulfill({status:204,headers});
      if(url.pathname.endsWith('/admin/auth/session'))
        return send(200,{authenticated:true,userId:'admin-test',csrfToken:'fixture-csrf'});
      if(url.pathname.endsWith('/admin/me'))return send(200,{admin:{
        user:{id:'admin-test',publicId:'ADM-01',displayName:'Administrador Pruebas',
          emailNormalized:'admin@example.test',avatarUrl:null,locale:'es-CO'},
        role:'SUPER_ADMIN',permissions:['FINANCE_READ','FINANCE_MANAGE','BUSINESSES_READ'],
      }});
      if(url.pathname.endsWith('/admin/finance/expenses/overview')){
        const from=url.searchParams.get('from')||'2026-11-01';
        const to=url.searchParams.get('to')||'2026-11-18';
        const start=Date.parse(from+'T00:00:00Z');
        const days=Math.min(366,Math.max(1,Math.floor((Date.parse(to+'T00:00:00Z')-start)/86400000)+1));
        const labels=Array.from({length:days},(_,i)=>
          new Date(start+i*86400000).toISOString().slice(0,10));
        const points=labels.map((date,i)=>({label:date,amountCop:i===0?'120000':i===1?'0':i===4?'25000':'0'}));
        return send(200,{
          scope:'TECHNOLOGY_VENDOR_EXPENSES',currency:'COP',
          period:{from,to,origin:'periodStart para consumos y facturas; createdAt para pagos'},
          totals:{consumptionCop:'180000',consumptionUsd:'45',creditsUsd:'5',
            netConsumptionUsd:'40',consumptionRecords:3,invoicesCop:'140000',
            invoiceRecords:1,markedPaidCop:'140000',markedPaidRecords:1,
            pendingPaymentRecords:0,activeBudgets:1,providers:2},
          originCounts:{REAL:1,MANUAL:1,ESTIMATED:1,PROJECTED:0},
          providers:[p(providerAWS,'Amazon Web Services'),p(providerMaps,'Google Maps')],
          providerBreakdown:[
            {id:providerAWS,name:'Amazon Web Services',amountCop:'155000',records:2},
            {id:providerMaps,name:'Google Maps',amountCop:'25000',records:1},
          ],
          timeline:{unit:days>45?'week':'day',points:days>45?points.slice(0,14):points},
          budgets:[{id:'budget1',name:'Infraestructura AWS',amountCop:'210000',active:true,
            providerName:'Amazon Web Services',periodStart:'2026-11-01',periodEnd:'2026-11-30'}],
          lastSync:{status:'SUCCEEDED',providerName:'Amazon Web Services',
            startedAt:at,finishedAt:at},
          notes:['Consumo COP es la suma registrada y no incluye deducciones con tasas implícitas.',
            'El estado PAID es administrativo y no prueba conciliación bancaria.'],
        });
      }
      if(url.pathname.endsWith('/admin/finance/expenses/ledger')){
        const kind=url.searchParams.get('kind')||'CONSUMPTIONS';
        const q=(url.searchParams.get('q')||'').toLowerCase();
        const providerId=url.searchParams.get('providerId')||'';
        const page=Math.max(1,Number(url.searchParams.get('page'))||1);
        const all=records[kind]??[];
        const filtered=all.filter(r=>(!providerId||r.providerId===providerId)&&
          (!q||[r.name,r.detail,r.providerName??''].some(s=>s.toLowerCase().includes(q))));
        return send(200,{scope:'TECHNOLOGY_VENDOR_EXPENSES',kind,
          period:{from:url.searchParams.get('from'),to:url.searchParams.get('to')},
          records:filtered.slice((page-1)*12,page*12),
          pagination:{page,pageSize:12,total:filtered.length,totalPages:Math.ceil(filtered.length/12)},
          definition:'Consulta paginada de registros existentes. Los pagos no son conciliación bancaria.'});
      }
      if(url.pathname.endsWith('/admin/finance/aws/free-tier'))
        return send(200,{available:false,reason:'AWS_FREE_TIER_NOT_CONFIGURED',
          usages:[],lastUpdatedAt:null});
      const patch=url.pathname.match(/\/admin\/finance\/(providers|budgets|consumptions|invoices|payments)\/([^/]+)$/);
      if(patch&&request.method()==='PATCH'){
        const input=JSON.parse(request.postData()||'{}');
        if(input.reason?.trim().length<12)return send(400,{error:{message:'Falta justificar el cambio.'}});
        const kind={providers:'PROVIDERS',budgets:'BUDGETS',consumptions:'CONSUMPTIONS',
          invoices:'INVOICES',payments:'PAYMENTS'}[patch[1]];
        const row=records[kind]?.find(r=>r.id===patch[2]);
        if(!row)return send(404,{error:{message:'Registro inexistente'}});
        Object.assign(row,input);
        operations.push({action:'PATCH',kind,input});
        return send(200,{updated:row});
      }
      const alert=url.pathname.match(/\/admin\/finance\/alerts\/([^/]+)\/acknowledge$/);
      if(alert&&request.method()==='PATCH'){
        const row=records.ALERTS.find(r=>r.id===alert[1]);
        if(!row)return send(404,{error:{message:'Alerta inexistente'}});
        row.acknowledgedAt=at;row.status='ACKNOWLEDGED';row.canEdit=false;
        operations.push({action:'ALERT_ACK',id:row.id});return send(200,{alert:row});
      }
      if(url.origin!==origin||url.pathname.startsWith('/api/'))
        return send(503,{error:{message:'Sin fixture financiera',code:'TEST_UNSUPPORTED_REQUEST'}});
      return route.continue();
    });
    const page=await context.newPage();
    const errors=[];page.on('pageerror',err=>errors.push(err.message));
    try{
      await page.goto(origin+'/financial-reports',{waitUntil:'domcontentloaded'});
      await page.getByRole('heading',{name:'Gastos y contabilidad',exact:true})
        .waitFor({state:'visible',timeout:18000});
      await page.getByText('3 registros',{exact:true}).waitFor({state:'visible',timeout:16000});
      assert.equal(await page.locator('.afc-kpi').count(),6,device+': six grounded financial indicators');
      assert.equal(await page.getByText('Sin conciliación bancaria',{exact:true}).isVisible(),true,
        device+': no invented banking verification');
      assert.equal(await page.getByText('Evolución de los gastos').isVisible(),true,
        device+': real interactive trend');
      assert.equal(await page.getByRole('slider',{name:'Explorar fecha de consumo'}).isVisible(),true,
        device+': accessible zero-filled date exploration');
      const dimensions=await page.evaluate(()=>{
        const main=document.querySelector('.afc-page'),form=document.querySelector('.afc-filters'),
          dateControls=[...document.querySelectorAll('.afc-period-controls input')];
        const financialSearch=form.querySelector('.afc-search');
        return {
          viewport:innerWidth,scroll:document.documentElement.scrollWidth,
          mainOverflow:main.scrollWidth-main.clientWidth,
          formOverflow:form.scrollWidth-form.clientWidth,
          searchHeight:financialSearch.getBoundingClientRect().height,
          searchFont:parseFloat(getComputedStyle(financialSearch.querySelector('input')).fontSize),
          dateSizes:dateControls.map(x=>({height:x.getBoundingClientRect().height,font:parseFloat(getComputedStyle(x).fontSize)})),
          cardsShown:getComputedStyle(document.querySelector('.afc-record-cards')).display!=='none',
          tableShown:getComputedStyle(document.querySelector('.afc-table-scroll')).display!=='none',
        };
      });
      assert.ok(dimensions.scroll<=dimensions.viewport+2&&dimensions.mainOverflow<=2&&dimensions.formOverflow<=2,
        device+': no horizontal overflow '+JSON.stringify(dimensions));
      assert.ok(dimensions.searchHeight>=49&&dimensions.searchFont>=14&&
        dimensions.dateSizes.every(x=>x.height>=48&&x.font>=14),
        device+': readable inputs on desktop, iPad and mobile '+JSON.stringify(dimensions));
      assert.equal(dimensions.cardsShown,viewport.width<=1100,
        device+': transactions use iPad/mobile cards');
      assert.equal(dimensions.tableShown,viewport.width>1100,
        device+': desktop table visible');
      await page.getByLabel('Buscar registro financiero').fill('MANUAL-001');
      await page.locator('.afc-filters').getByRole('button',{name:'Buscar'}).click();
      await page.getByText('1 registro',{exact:true}).waitFor({state:'visible'});
      await page.locator('.afc-filters').getByRole('button',{name:'Limpiar'}).click();
      await page.getByText('3 registros',{exact:true}).waitFor({state:'visible'});
      const nav=page.getByRole('group',{name:'Secciones del archivo financiero'});
      await nav.getByRole('button',{name:/Facturas/}).click();
      await page.getByText('1 registro',{exact:true}).waitFor({state:'visible'});
      assert.equal(await page.getByRole('link',{name:/documento/i}).count()>0,true,
        device+': HTTPS invoice document remains accessible');
      await nav.getByRole('button',{name:/Pagos/}).click();
      await page.getByText('1 registro',{exact:true}).waitFor({state:'visible'});
      await nav.getByRole('button',{name:/Presupuestos/}).click();
      await page.getByText('1 registro',{exact:true}).waitFor({state:'visible'});
      await nav.getByRole('button',{name:/Proveedores/}).click();
      await page.getByText('2 registros',{exact:true}).waitFor({state:'visible'});
      await page.getByLabel('Filtrar por proveedor').selectOption(providerMaps);
      await page.getByText('1 registro',{exact:true}).waitFor({state:'visible'});
      await nav.getByRole('button',{name:/Alertas/}).click();
      await page.getByText('1 registro',{exact:true}).waitFor({state:'visible'});
      const visible=page.locator(viewport.width<=1100?'.afc-record-cards':'.afc-table-scroll');
      await visible.getByRole('button',{name:/Marcar revisada/}).click();
      await page.getByText('Alerta marcada como revisada y conservada en el registro financiero.')
        .waitFor({state:'visible'});
      assert.equal(operations[0].action,'ALERT_ACK',device+': only existing alert acknowledgement');
      await nav.getByRole('button',{name:/Consumos/}).click();
      await page.getByText('3 registros',{exact:true}).waitFor({state:'visible'});
      await visible.getByRole('button',{name:/Corregir/}).first().click();
      const dialog=page.getByRole('dialog');
      await dialog.getByRole('heading',{name:/Corregir Consumo de prueba registrado/})
        .waitFor({state:'visible'});
      const save=dialog.getByRole('button',{name:'Guardar corrección'});
      assert.equal(await save.isDisabled(),true,device+': mandatory audit reason');
      await dialog.getByLabel('Motivo de la corrección').fill('Ajuste sustentado en comprobante del proveedor registrado.');
      await save.click();
      await page.getByText('Corrección financiera registrada; consulta la pestaña Auditoría.')
        .waitFor({state:'visible'});
      assert.equal(operations.filter(o=>o.action==='PATCH').length,1,device+': one audited correction');
      assert.ok(operations[1].input.reason.length>=12,device+': audit reason transmitted');
      await page.screenshot({path:resolve(screenshots,device+'.png'),fullPage:true});
      assert.equal(errors.length,0,device+': no page JS exceptions '+errors.join('|'));
      console.log('Admin Gastos y contabilidad: six KPIs, trend, suppliers, filtering, alerts, audit correction and viewport OK - '+device);
    }finally{await context.close();}
  }
}finally{
  await browser.close();
  await new Promise(done=>server.close(done));
}
