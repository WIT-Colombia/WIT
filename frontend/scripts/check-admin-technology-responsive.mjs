import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,readFile} from 'node:fs/promises';
import {extname,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const dist=fileURLToPath(new URL('../apps/admin/dist/',import.meta.url));
const captures=fileURLToPath(new URL('../test-results/admin-technology/',import.meta.url));
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css',
  '.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
  try {
    const parsed=decodeURIComponent(new URL(req.url,'http://local.test').pathname);
    const path=resolve(dist,'.'+parsed);
    if(path!==dist&&!path.startsWith(dist.endsWith(sep)?dist:dist+sep)){
      res.writeHead(403).end();return;
    }
    const file=extname(path)?path:resolve(dist,'index.html');
    const bytes=await readFile(file);
    res.writeHead(200,{'Content-Type':mime[extname(file)]??'application/octet-stream'}).end(bytes);
  }catch{res.writeHead(404).end();}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,
  ...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
const at='2026-11-19T12:00:00.000Z';
const known=[
  {id:'incident-1',kind:'INCIDENT',status:'OPEN',severity:'HIGH',
    title:'Degradación de la API',description:'Incidencia comunicada y en proceso de revisión administrativa.',
    component:'API',scheduledStartAt:null,scheduledEndAt:null,completedAt:null,
    createdAt:at,updatedAt:at,createdById:'admin-test',updatedById:null},
  {id:'maintenance-1',kind:'MAINTENANCE',status:'PLANNED',severity:'MEDIUM',
    title:'Actualización programada',description:'Ventana de mantenimiento planificada con comunicación y seguimiento.',
    component:'MySQL',scheduledStartAt:'2026-11-22T10:00:00.000Z',scheduledEndAt:'2026-11-22T11:00:00.000Z',
    completedAt:null,createdAt:at,updatedAt:at,createdById:'admin-test',updatedById:null},
  {id:'need-1',kind:'NEED',status:'OPEN',severity:'MEDIUM',
    title:'Necesidad de respaldos',description:'Evaluar mejoras de respaldo y recuperación para datos y archivos.',
    component:'S3',scheduledStartAt:null,scheduledEndAt:null,completedAt:null,
    createdAt:at,updatedAt:at,createdById:'admin-test',updatedById:null},
];
const workflows=[
  {id:101,title:'XAMUKO production deploy',kind:'RELEASE',branch:'integration/preserve-all-20261029',
    commit:'abc123def456',createdAt:at,updatedAt:at,workflowStatus:'completed',
    workflowConclusion:'success',deploymentStatus:'SKIPPED',url:'https://github.com/WIT-Colombia/WIT/actions/runs/101',runNumber:101},
  {id:102,title:'XAMUKO frontend validation',kind:'CI',branch:'integration/preserve-all-20261029',
    commit:'abc123def456',createdAt:at,updatedAt:at,workflowStatus:'completed',
    workflowConclusion:'success',deploymentStatus:'NOT_APPLICABLE',url:'https://github.com/WIT-Colombia/WIT/actions/runs/102',runNumber:102},
  {id:103,title:'XAMUKO production deploy',kind:'RELEASE',branch:'main',
    commit:'fedabc987654',createdAt:at,updatedAt:at,workflowStatus:'completed',
    workflowConclusion:'success',deploymentStatus:'CONFIRMED',url:'https://github.com/WIT-Colombia/WIT/actions/runs/103',runNumber:103},
];
try {
  await mkdir(captures,{recursive:true});
  for(const [label,viewport] of [
    ['mobile',{width:390,height:844}],['ipad',{width:768,height:1024}],
    ['ipad-landscape',{width:1024,height:768}],['desktop',{width:1440,height:900}],
  ]){
    const cases=structuredClone(known);
    const events=new Map(cases.map(c=>[c.id,[{
      id:'event-'+c.id,caseId:c.id,actorUserId:'admin-test',action:'CREATED',
      fromStatus:null,toStatus:c.status,reason:'Radicación administrativa; sin ejecución técnica.',createdAt:at,
    }]]));
    const writes=[];
    const context=await browser.newContext({viewport});
    await context.route('**/*',async route=>{
      const req=route.request(),url=new URL(req.url());
      const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':origin,
        'Access-Control-Allow-Credentials':'true','Access-Control-Allow-Headers':'*'};
      const send=(code,obj)=>route.fulfill({status:code,headers,body:JSON.stringify(obj)});
      if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
      if(url.pathname.endsWith('/admin/auth/session'))
        return send(200,{authenticated:true,userId:'admin-test',csrfToken:'fixture-csrf'});
      if(url.pathname.endsWith('/admin/me'))return send(200,{admin:{
        user:{id:'admin-test',publicId:'ADM-01',displayName:'Administrador',
          emailNormalized:'admin@example.test',avatarUrl:null,locale:'es-CO'},
        role:'SUPER_ADMIN',permissions:['AUDIT_READ','ADMINS_MANAGE'],
      }});
      if(url.pathname.endsWith('/admin/technology/status')){
        const incidents=cases.filter(c=>c.kind==='INCIDENT');
        const maintenance=cases.filter(c=>c.kind==='MAINTENANCE');
        const needs=cases.filter(c=>c.kind==='NEED');
        return send(200,{
          scope:'LIVE_PROBES_ONLY',checkedAt:at,
          components:[
            {id:'api',name:'API (backend)',detail:'Respondió esta solicitud autenticada',
              status:'HEALTHY',source:'Respuesta HTTP actual',latencyMs:null,checkedAt:at},
            {id:'database',name:'Base de datos MySQL',detail:'SELECT 1 confirmado',
              status:'HEALTHY',source:'Comprobación SQL actual',latencyMs:22,checkedAt:at},
            ...['frontend','storage','aws'].map(id=>({
              id,name:id==='frontend'?'Plataforma web (frontend)':id==='storage'?'Almacenamiento de archivos':'Infraestructura AWS',
              detail:'Sin sonda externa',status:'UNMONITORED',source:null,latencyMs:null,checkedAt:null,
            })),
          ],
          live:{checked:2,healthy:2,unavailable:0},uptime30Days:null,processUptimeSeconds:7200,
          caseDataAvailable:true,
          counts:{registeredIncidents30d:incidents.length,
            openIncidents:incidents.filter(c=>c.status!=='RESOLVED').length,
            upcomingMaintenance:maintenance.filter(c=>c.status==='PLANNED').length,
            openNeeds:needs.filter(c=>c.status==='OPEN').length,
            totalIncidents:incidents.length,totalMaintenance:maintenance.length,totalNeeds:needs.length},
          incidentTrend:Array.from({length:30},(_,index)=>({
            date:new Date(Date.UTC(2026,9,21+index)).toISOString().slice(0,10),
            count:index===29?incidents.length:0,
          })),
          incidents:incidents.slice(-5),upcomingMaintenance:maintenance.filter(c=>c.status==='PLANNED'),
          recentEvents:[],description:'Comprobación puntual, sin SLA histórico.',
        });
      }
      if(url.pathname.endsWith('/admin/technology/deployments'))
        return send(200,{connected:true,source:'GITHUB_ACTIONS',
          branch:'integration/preserve-all-20261029',checkedAt:at,
          actionsUrl:'https://github.com/WIT-Colombia/WIT/actions',
          items:workflows,summary:{runs:3,ciPassed:1,ciFailed:0,
            confirmedDeployments:1,skippedDeployments:1},
          limitation:'Solo el trabajo deploy terminado correctamente confirma despliegue.'});
      if(url.pathname.endsWith('/admin/technology/cases')){
        if(req.method()==='GET'){
          const kind=url.searchParams.get('kind')||'',status=url.searchParams.get('status')||'';
          const q=(url.searchParams.get('q')||'').toLowerCase();
          const page=Math.max(1,Number(url.searchParams.get('page')||1));
          const matches=cases.filter(c=>(!kind||c.kind===kind)&&(!status||c.status===status)&&
            (!q||[c.title,c.component??'',c.description].some(v=>v.toLowerCase().includes(q))));
          return send(200,{scope:'ADMIN_TECHNOLOGY_CASES',
            cases:matches.slice((page-1)*12,page*12),pagination:{page,pageSize:12,total:matches.length,
              totalPages:Math.ceil(matches.length/12)}});
        }
        if(req.method()==='POST'){
          const input=JSON.parse(req.postData()||'{}');
          if(input.title?.trim().length<8||input.description?.trim().length<20)
            return send(400,{error:{message:'Datos insuficientes.'}});
          const row={...input,id:'new-'+cases.length,
            status:input.kind==='MAINTENANCE'?'PLANNED':'OPEN',
            createdAt:at,updatedAt:at,createdById:'admin-test',updatedById:null,
            completedAt:null,component:input.component||null,
            scheduledStartAt:input.scheduledStartAt||null,
            scheduledEndAt:input.scheduledEndAt||null};
          cases.unshift(row);writes.push({type:'CREATE',kind:input.kind});
          events.set(row.id,[{id:'create-'+row.id,caseId:row.id,actorUserId:'admin-test',
            action:'CREATED',fromStatus:null,toStatus:row.status,
            reason:'Radicación administrativa; sin operación de infraestructura.',createdAt:at}]);
          return send(201,{case:row});
        }
      }
      const match=url.pathname.match(/\/admin\/technology\/cases\/([^/]+)(\/status|\/notes)?$/);
      if(match){
        const record=cases.find(c=>c.id===match[1]);
        if(!record)return send(404,{error:{message:'Expediente no encontrado'}});
        if(req.method()==='GET')return send(200,{case:record,history:events.get(record.id)??[]});
        const input=JSON.parse(req.postData()||'{}');
        if(match[2]==='/status'&&req.method()==='PATCH'){
          if(input.reason?.trim().length<12)return send(400,{error:{message:'Motivo insuficiente'}});
          const prev=record.status;record.status=input.status;
          writes.push({type:'STATUS',id:record.id,reason:input.reason});
          events.get(record.id).unshift({id:'changed-'+writes.length,caseId:record.id,
            actorUserId:'admin-test',action:'STATUS_CHANGED',fromStatus:prev,toStatus:input.status,
            reason:input.reason,createdAt:at});
          return send(200,{case:record});
        }
        if(match[2]==='/notes'&&req.method()==='POST'){
          if(input.reason?.trim().length<12)return send(400,{error:{message:'Motivo insuficiente'}});
          const ev={id:'note-'+writes.length,caseId:record.id,actorUserId:'admin-test',
            action:'NOTE',fromStatus:record.status,toStatus:record.status,reason:input.reason,createdAt:at};
          events.get(record.id).unshift(ev);writes.push({type:'NOTE',id:record.id});
          return send(201,{event:ev});
        }
      }
      if(url.origin!==origin||url.pathname.startsWith('/api/'))
        return send(503,{error:{message:'Fixture no disponible'}});
      return route.continue();
    });
    const page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    try{
      await page.goto(origin+'/service-status',{waitUntil:'domcontentloaded'});
      await page.getByText('5 componentes registrados').waitFor({state:'visible',timeout:18000});
      assert.equal(await page.locator('.ato-kpi').count(),4,label+': KPIs de servicios');
      const tabs=page.getByRole('navigation',{name:'Pestañas de Operación tecnológica'});
      assert.equal(await tabs.getByRole('link').count(),2,label+': 2 tabs only');
      assert.equal(await tabs.getByRole('link',{name:'Estado de servicios'}).getAttribute('aria-current'),
        'page',label+': active status page');
      assert.equal(await page.locator('.ato-services-table tbody tr').count(),5,label+': 5 grounded services');
      assert.equal(await page.locator('.ato-status-unmonitored').count(),3,label+': 3 unmonitored services');
      assert.equal(await page.locator('.ato-kpi').filter({hasText:'Disponibilidad (30 días)'})
        .getByText('—').count(),1,label+': no synthetic uptime');
      const geom=await page.evaluate(()=>{
        const main=document.querySelector('.ato-page'),tabs=document.querySelector('.ato-tabs');
        return {viewport:innerWidth,scroll:document.documentElement.scrollWidth,
          overflow:main.scrollWidth-main.clientWidth,tabsOverflow:tabs.scrollWidth-tabs.clientWidth};
      });
      assert.ok(geom.scroll<=geom.viewport+2&&geom.overflow<=2&&geom.tabsOverflow<=2,
        label+': no overflow in service status '+JSON.stringify(geom));
      await page.screenshot({path:resolve(captures,label+'-servicios.png'),fullPage:true});
      await page.getByRole('button',{name:'Registrar incidente'}).click();
      let dialog=page.getByRole('dialog');
      await dialog.getByLabel('Título del expediente').fill('Incidencia de prueba');
      await dialog.getByLabel('Descripción del expediente').fill('Se registra el evento y se adjuntan antecedentes sin realizar cambios.');
      await dialog.getByRole('button',{name:'Registrar expediente'}).click();
      await page.getByText('Incidente registrado con trazabilidad administrativa.')
        .waitFor({state:'visible'});
      assert.equal(writes.some(x=>x.kind==='INCIDENT'),true,label+': persisted incident');
      await tabs.getByRole('link',{name:'Despliegues y mantenimiento'}).click();
      await page.getByRole('heading',{name:'Ejecuciones de GitHub Actions'}).waitFor({state:'visible'});
      assert.equal(await page.getByText('Sin despliegue').count()>0,true,label+': skipped != deployed');
      assert.equal(await page.getByText('Desplegado').count()>0,true,label+': successful deploy job is grounded');
      const geom2=await page.evaluate(()=>{
        const main=document.querySelector('.ato-page'),filters=document.querySelector('.ato-work-filters');
        return {viewport:innerWidth,scroll:document.documentElement.scrollWidth,
          overflow:main.scrollWidth-main.clientWidth,
          filtersOverflow:filters.scrollWidth-filters.clientWidth};
      });
      assert.ok(geom2.scroll<=geom2.viewport+2&&geom2.overflow<=2&&geom2.filtersOverflow<=2,
        label+': no horizontal overflow in deployments '+JSON.stringify(geom2));
      await page.getByRole('button',{name:'Programar mantenimiento'}).first().click();
      dialog=page.getByRole('dialog');
      await dialog.getByLabel('Título del expediente').fill('Verificación de respaldo nocturno');
      await dialog.getByLabel('Descripción del expediente').fill('Ventana programada para revisar las copias y políticas de restauración.');
      await dialog.getByLabel('Inicio del mantenimiento').fill('2026-11-24T09:00');
      await dialog.getByLabel('Fin del mantenimiento').fill('2026-11-24T10:00');
      await dialog.getByRole('button',{name:'Registrar expediente'}).click();
      await page.getByText('Mantenimiento programado; no se han ejecutado cambios en AWS.')
        .waitFor({state:'visible'});
      await page.getByRole('button',{name:'Necesidades técnicas'}).click();
      await page.getByText('Necesidad de respaldos').waitFor({state:'visible'});
      await page.getByRole('button',{name:'Nueva necesidad'}).click();
      dialog=page.getByRole('dialog');
      await dialog.getByLabel('Título del expediente').fill('Plan de restauración documentado');
      await dialog.getByLabel('Descripción del expediente').fill('Se necesita formalizar un procedimiento probado de recuperación tecnológica.');
      await dialog.getByRole('button',{name:'Registrar expediente'}).click();
      await page.getByText('Necesidad tecnológica registrada en el plan de trabajo.')
        .waitFor({state:'visible'});
      const firstNeed=page.locator('.ato-work-item').first();
      await firstNeed.click();
      dialog=page.getByRole('dialog');
      await dialog.getByLabel('Nuevo estado del expediente').selectOption('IN_PROGRESS');
      const save=dialog.getByRole('button',{name:'Registrar cambio'});
      assert.equal(await save.isDisabled(),true,label+': audit reason required');
      await dialog.getByLabel('Motivo del estado')
        .fill('Se inició la revisión con soporte técnico y responsable asignado.');
      await save.click();
      await page.getByText('Cambio de estado registrado con motivo y responsable en la auditoría del expediente.')
        .waitFor({state:'visible'});
      assert.equal(writes.some(x=>x.type==='STATUS'&&x.reason.length>=12),true,label+': reason audited');
      await page.screenshot({path:resolve(captures,label+'-despliegues.png'),fullPage:true});
      assert.equal(errors.length,0,label+': no JS page exceptions '+errors.join(' | '));
      console.log('Admin tecnologia OK: '+label+', comprobaciones reales, CI vs deploy, incidencias, mantenimiento, necesidades y auditoría');
    }finally{await context.close();}
  }
}finally{
  await browser.close();await new Promise(done=>server.close(done));
}
