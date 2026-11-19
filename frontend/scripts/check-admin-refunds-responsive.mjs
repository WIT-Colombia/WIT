import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const dist=fileURLToPath(new URL('../apps/admin/dist/',import.meta.url));
const screenshots=fileURLToPath(new URL('../test-results/admin-refunds/',import.meta.url));
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css',
  '.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://fixture.local').pathname);
    const resolved=resolve(dist,'.'+pathname);
    if(resolved!==dist&&!resolved.startsWith(dist.endsWith(sep)?dist:dist+sep)){
      res.writeHead(403).end();return;
    }
    const path=extname(resolved)?resolved:resolve(dist,'index.html');
    const content=await readFile(path);
    res.writeHead(200,{'Content-Type':types[extname(path)]??'application/octet-stream'}).end(content);
  }catch{res.writeHead(404).end();}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,
  ...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
const at='2026-11-18T17:00:00.000Z';
const statuses=['OPEN','IN_REVIEW','NEEDS_INFORMATION','CLOSED'];
const fixture=[
  {id:'rf-one',status:'OPEN',subject:'Revisión de cargo solicitado',contactEmail:'caso1@example.test',
    externalReference:'REF-001',requestedAmountCop:'50000.00',description:'Solicitud bajo revisión en el sistema sin prueba bancaria.',
    createdAt:at,updatedAt:at,createdById:'admin-test',decisionNote:null,lastReviewedById:null,closedAt:null},
  {id:'rf-two',status:'IN_REVIEW',subject:'Seguimiento segunda solicitud',contactEmail:null,
    externalReference:'REF-002',requestedAmountCop:null,description:'Análisis de antecedentes y de soporte administrativo.',
    createdAt:at,updatedAt:at,createdById:'admin-test',decisionNote:'Revisión de datos.',lastReviewedById:'admin-test',closedAt:null},
  {id:'rf-three',status:'NEEDS_INFORMATION',subject:'Revisión sin documento aportado',contactEmail:null,
    externalReference:null,requestedAmountCop:'100000.50',description:'Falta un identificador bancario verificable del reporte.',
    createdAt:at,updatedAt:at,createdById:'admin-test',decisionNote:'Pedir información.',lastReviewedById:'admin-test',closedAt:null},
  {id:'rf-four',status:'CLOSED',subject:'Expediente cerrado sin pago',contactEmail:null,
    externalReference:'REF-CERRADO',requestedAmountCop:null,
    description:'El expediente se cerró sin devolución ni desembolso.',
    createdAt:at,updatedAt:at,createdById:'admin-test',decisionNote:'Caso cerrado.',
    lastReviewedById:'admin-test',closedAt:at},
];
try {
  await mkdir(screenshots,{recursive:true});
  for(const [device,viewport] of [
    ['mobile',{width:390,height:844}],['ipad',{width:768,height:1024}],
    ['ipad-landscape',{width:1024,height:768}],['desktop',{width:1440,height:900}],
  ]){
    const entries=structuredClone(fixture);
    const history=new Map();
    const operations=[];
    let canManage=true;
    const context=await browser.newContext({viewport});
    await context.route('**/*',async route=>{
      const req=route.request(),url=new URL(req.url());
      const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':origin,
        'Access-Control-Allow-Credentials':'true','Access-Control-Allow-Headers':'*'};
      const send=(status,body)=>route.fulfill({status,headers,body:JSON.stringify(body)});
      if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
      if(url.pathname.endsWith('/admin/auth/session'))
        return send(200,{authenticated:true,userId:'admin-test',csrfToken:'fixture-csrf'});
      if(url.pathname.endsWith('/admin/me'))return send(200,{admin:{
        user:{id:'admin-test',publicId:'ADM-01',displayName:'Administrador',
          emailNormalized:'admin@example.test',avatarUrl:null,locale:'es-CO'},
        role:'ADMIN',permissions:canManage?['FINANCE_READ','FINANCE_MANAGE']:['FINANCE_READ'],
      }});
      if(url.pathname.endsWith('/admin/finance/refund-cases')){
        if(req.method()==='GET'){
          const status=url.searchParams.get('status')||'';
          const q=(url.searchParams.get('q')||'').toLowerCase();
          const from=url.searchParams.get('from')||'',to=url.searchParams.get('to')||'';
          const page=Math.max(1,Number(url.searchParams.get('page'))||1);
          const filters=entries.filter(r=>(!status||r.status===status)&&
            (!from||r.createdAt.slice(0,10)>=from)&&(!to||r.createdAt.slice(0,10)<=to)&&
            (!q||[r.subject,r.externalReference??'',r.contactEmail??''].some(x=>x.toLowerCase().includes(q))));
          const counts=Object.fromEntries(statuses.map(x=>[x,entries.filter(r=>r.status===x).length]));
          return send(200,{scope:'ADMIN_REFUND_REVIEW_ONLY',payoutsIntegrated:false,
            verifiedRefunds:null,refundedAmountCop:null,
            counts:{total:entries.length,...counts},cases:filters.slice((page-1)*12,page*12),
            pagination:{page,pageSize:12,total:filters.length,totalPages:Math.ceil(filters.length/12)},
            definition:'Los estados no certifican ninguna devolución de dinero.'});
        }
        if(req.method()==='POST'){
          const input=JSON.parse(req.postData()||'{}');
          if(!canManage||input.subject?.trim().length<8||input.description?.trim().length<20)
            return send(400,{error:{message:'Solicitud inválida'}});
          const row={...input,id:'rf-new-'+entries.length,status:'OPEN',
            createdAt:at,updatedAt:at,createdById:'admin-test',
            decisionNote:null,lastReviewedById:null,closedAt:null,
            requestedAmountCop:input.requestedAmountCop||null};
          entries.unshift(row);operations.push({action:'CREATE',input});
          history.set(row.id,[{id:'audit-create',actorUserId:'admin-test',action:'REFUND_CASE_CREATED',
            reason:'Radicación administrativa de solicitud; sin desembolso.',createdAt:at}]);
          return send(201,{case:row,payoutsIntegrated:false});
        }
      }
      const match=url.pathname.match(/\/admin\/finance\/refund-cases\/(rf-[^/]+)$/);
      if(match){
        const row=entries.find(item=>item.id===match[1]);
        if(!row)return send(404,{error:{message:'No encontrado'}});
        if(req.method()==='GET')return send(200,{case:row,history:history.get(row.id)??[],payoutsIntegrated:false});
        if(req.method()==='PATCH'){
          const data=JSON.parse(req.postData()||'{}');
          if(!canManage||!statuses.includes(data.status)||data.status===row.status||data.reason?.trim().length<12)
            return send(400,{error:{message:'Decisión inválida'}});
          const previous=row.status;row.status=data.status;row.decisionNote=data.reason;
          row.lastReviewedById='admin-test';row.updatedAt=at;
          row.closedAt=data.status==='CLOSED'?at:null;
          const log={id:'audit-'+operations.length,actorUserId:'admin-test',
            action:'REFUND_CASE_STATUS_CHANGED',reason:data.reason,createdAt:at,
            beforeState:{status:previous},afterState:{status:data.status}};
          history.set(row.id,[log,...(history.get(row.id)??[])]);
          operations.push({action:'UPDATE',input:data});
          return send(200,{case:row,payoutsIntegrated:false});
        }
      }
      if(url.origin!==origin||url.pathname.startsWith('/api/'))
        return send(503,{error:{message:'Fuente no configurada en pruebas aisladas'}});
      return route.continue();
    });
    const page=await context.newPage();
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    try {
      await page.goto(origin+'/refunds',{waitUntil:'domcontentloaded'});
      await page.getByRole('heading',{name:'Reembolsos',exact:true}).waitFor({state:'visible',timeout:15000});
      await page.getByText('4 expedientes',{exact:true}).waitFor({state:'visible',timeout:15000});
      const financeNavigation=page.getByRole('navigation',{name:'Pestañas de Finanzas y contabilidad'});
      assert.equal(await financeNavigation.getByRole('link').count(),4,device+': all four finance modules linked');
      assert.equal(await financeNavigation.getByRole('link',{name:'Reembolsos',exact:true}).getAttribute('aria-current'),
        'page',device+': correct active financial tab');
      assert.equal(await page.locator('.arf-kpi').count(),4,device+': four real administrative counts');
      assert.equal(await page.locator('.arf-financial-grid strong').count(),3,
        device+': three monetary metrics explicitly unavailable');
      assert.equal(await page.locator('.arf-financial-grid strong').filter({hasText:'—'}).count(),3,
        device+': never invent actual refunded amounts');
      assert.equal(await page.getByText('Sin pasarela conectada').isVisible(),true,device+': financial scope');
      const geometry=await page.evaluate(()=>{
        const form=document.querySelector('.arf-filters'),main=document.querySelector('.arf-page');
        const search=document.querySelector('.arf-search');
        const controls=[...form.querySelectorAll('input,select')].map(el=>({
          font:parseFloat(getComputedStyle(el).fontSize),height:el.getBoundingClientRect().height,
          type:el.getAttribute('type')??'select',
        }));
        return {viewport:innerWidth,scroll:document.documentElement.scrollWidth,
          formOverflow:form.scrollWidth-form.clientWidth,mainOverflow:main.scrollWidth-main.clientWidth,
          searchHeight:search.getBoundingClientRect().height,controls,
          cardsVisible:getComputedStyle(document.querySelector('.arf-case-cards')).display!=='none',
          tableVisible:getComputedStyle(document.querySelector('.arf-table-wrap')).display!=='none'};
      });
      assert.ok(geometry.scroll<=geometry.viewport+2&&geometry.formOverflow<=2&&geometry.mainOverflow<=2,
        device+': no horizontal overflow '+JSON.stringify(geometry));
      assert.ok(geometry.searchHeight>=49&&geometry.controls.every(c=>c.font>=14&&(c.type==='search'?c.height>=24:c.height>=49)),
        device+': legible 14px fields and 49px hit targets '+JSON.stringify(geometry));
      assert.equal(geometry.cardsVisible,viewport.width<=1080,device+': cards for iPad and mobile');
      assert.equal(geometry.tableVisible,viewport.width>1080,device+': table for desktop');
      await page.getByLabel('Estado de solicitud').selectOption('IN_REVIEW');
      await page.getByText('1 expediente',{exact:true}).waitFor({state:'visible'});
      await page.getByLabel('Estado de solicitud').selectOption('');
      await page.getByText('4 expedientes',{exact:true}).waitFor({state:'visible'});
      await page.getByLabel('Buscar solicitudes de reembolso').fill('REF-001');
      await page.locator('.arf-filters').getByRole('button',{name:'Buscar'}).click();
      await page.getByText('1 expediente',{exact:true}).waitFor({state:'visible'});
      await page.locator('.arf-filters').getByRole('button',{name:'Limpiar'}).click();
      await page.getByText('4 expedientes',{exact:true}).waitFor({state:'visible'});
      await page.getByLabel('Radicación desde').fill('2026-11-19');
      await page.locator('.arf-filters').getByRole('button',{name:'Buscar'}).click();
      await page.getByText('0 expedientes',{exact:true}).waitFor({state:'visible'});
      await page.locator('.arf-filters').getByRole('button',{name:'Limpiar'}).click();
      await page.getByText('4 expedientes',{exact:true}).waitFor({state:'visible'});
      await page.getByRole('button',{name:'Nueva solicitud'}).click();
      let dialog=page.getByRole('dialog');
      await dialog.getByRole('heading',{name:'Registrar solicitud de reembolso'}).waitFor({state:'visible'});
      assert.equal(await dialog.getByRole('button',{name:'Registrar solicitud'}).isDisabled(),true,
        device+': mandatory details before creation');
      await dialog.getByLabel('Asunto de la solicitud').fill('Nueva solicitud trazable');
      await dialog.getByLabel('Descripción y antecedentes').fill('Reclamo documentado para iniciar la revisión administrativa sin desembolso.');
      await dialog.getByLabel('Referencia reportada').fill('RF-PRUEBA-100');
      await dialog.getByLabel('Importe solicitado en COP').fill('25000');
      await dialog.getByRole('button',{name:'Registrar solicitud'}).click();
      await page.getByText('5 expedientes',{exact:true}).waitFor({state:'visible'});
      assert.equal(operations.length,1,device+': one actual create request');
      assert.equal(operations[0].action,'CREATE',device+': only administrative intake');
      const visible=page.locator(viewport.width<=1080?'.arf-case-cards':'.arf-table-wrap');
      await visible.getByRole('button',{name:/Ver expediente/}).first().click();
      dialog=page.getByRole('dialog');
      await dialog.getByRole('heading',{name:'Nueva solicitud trazable'}).waitFor({state:'visible'});
      await dialog.getByRole('heading',{name:'Historial administrativo'}).waitFor({state:'visible'});
      await dialog.getByLabel('Nuevo estado de la solicitud').selectOption('IN_REVIEW');
      assert.equal(await dialog.getByRole('button',{name:'Registrar cambio de estado'}).isDisabled(),true,
        device+': reason required for transitions');
      await dialog.getByLabel('Motivo de cambio de estado').fill('Inicia revisión del expediente con evidencia documental reportada.');
      await dialog.getByRole('button',{name:'Registrar cambio de estado'}).click();
      await page.getByText('Estado actualizado y registrado en la auditoría financiera. Ningún dinero fue transferido.')
        .waitFor({state:'visible'});
      assert.equal(operations.length,2,device+': exactly one audit-safe update');
      assert.equal(operations[1].input.status,'IN_REVIEW',device+': only case statuses allowed');
      assert.ok(operations[1].input.reason.length>=12,device+': mandatory audit reason transmitted');
      assert.equal(operations.some(op=>op.input.status==='REFUNDED'),false,device+': no payout simulation');
      await page.screenshot({path:resolve(screenshots,device+'.png'),fullPage:true});
      assert.equal(errors.length,0,device+': JS errors '+errors.join('; '));
      console.log('Admin Reembolsos: real case intake, filters, permissioned audit, disclosure, responsive OK '+device);
    } finally {await context.close();}
  }
} finally {
  await browser.close();await new Promise(done=>server.close(done));
}
