import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root=fileURLToPath(new URL('../apps/admin/dist/',import.meta.url));
const screenshots=fileURLToPath(new URL('../test-results/admin-pioneers/',import.meta.url));
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.jpg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://fixture.test');
    const filename=resolve(root,'.'+decodeURIComponent(url.pathname));
    if(filename!==resolve(root)&&!filename.startsWith(root.endsWith(sep)?root:root+sep)){
      res.writeHead(403).end();return;
    }
    const file=extname(filename)?filename:resolve(root,'index.html');
    const body=await readFile(file);
    res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream'}).end(body);
  }catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
const assignedAt='2026-11-10T13:00:00.000Z';
const brand={
  id:'fixture-brand-1',legalName:'Marca Sol',verification:'VERIFIED',evidenceSummary:'Verificación de prueba',
  verifiedAt:'2026-11-09T13:00:00.000Z',createdAt:assignedAt,updatedAt:assignedAt,
  businesses:[{id:'fixture-business-1',publicId:'business-fixture',name:'Negocio Sol',
    publicationStatus:'PUBLISHED',lifecycleStatus:'ACTIVE',visibilityStatus:'VISIBLE',deletionStatus:'NONE',
    businessAccount:{status:'ACTIVE'},location:{cityName:'Cali',countryCode:'CO'}}],
  claims:[{id:'fixture-claim-approved',claimantId:'fixture-user',status:'APPROVED',reviewedById:'fixture-admin',reviewedAt:assignedAt}],
  eligibleForPioneer:false,eligibility:{verified:true,approvedClaim:true,visibleBusiness:true,alreadyAssigned:true},
};
const data={
  max:20,available:19,generatedAt:'2026-11-16T13:00:00.000Z',
  definition:'Cupos asignados de forma permanente.',
  assignments:[{id:'fixture-assignment',brandId:brand.id,number:1,assignedAt,
    brand:{id:brand.id,legalName:brand.legalName,verification:'VERIFIED'},
    assignedBy:{publicId:'admin-fixture',displayName:'Administrador de prueba'}}],
  brands:[brand],
  pendingClaims:[{id:'fixture-claim-pending',status:'PENDING',claimantId:'fixture-user',
    brandId:null,evidenceType:'RUT',evidenceNote:'Registro válido de prueba',createdAt:assignedAt,reviewedAt:null,
    claimant:{displayName:'Reclamante de prueba'},
    business:{id:'fixture-business-2',name:'Negocio sin marca',publicId:'business-2',brandId:null,
      publicationStatus:'PUBLISHED',visibilityStatus:'VISIBLE'},brand:null}],
  recentActions:[{id:'fixture-audit',entityId:brand.id,action:'PIONEER_ASSIGNED',
    reason:'Reconocimiento de prueba verificado',createdAt:assignedAt,actor:{displayName:'Administrador de prueba'}}],
};
try{
  await mkdir(screenshots,{recursive:true});
  for(const [device,viewport] of [
    ['mobile',{width:390,height:844}],['ipad',{width:768,height:1024}],
    ['desktop',{width:1440,height:900}],
  ]){
    const context=await browser.newContext({viewport});
    await context.route('**/*',async route=>{
      const url=new URL(route.request().url());
      const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':origin,
        'Access-Control-Allow-Credentials':'true','Access-Control-Allow-Headers':'*'};
      const reply=(status,body)=>route.fulfill({status,headers,body:JSON.stringify(body)});
      if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers});
      if(url.pathname.endsWith('/admin/auth/session'))return reply(200,{authenticated:true,userId:'fixture-admin',csrfToken:'test-token'});
      if(url.pathname.endsWith('/admin/me'))return reply(200,{admin:{
        user:{id:'fixture-admin',publicId:'fixture-admin',displayName:'Administrador de prueba',
          emailNormalized:'admin@example.test',avatarUrl:null,locale:'es-CO'},
        role:'SUPER_ADMIN',permissions:['PIONEER_MANAGE','BUSINESSES_READ']}});
      if(url.pathname.endsWith('/admin/pioneers'))return reply(200,data);
      if(url.origin!==origin||url.pathname.startsWith('/api/'))return reply(503,{error:{code:'FIXTURE',message:'No configurado'}});
      return route.continue();
    });
    const page=await context.newPage();
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    try{
      await page.goto(origin+'/pioneers',{waitUntil:'domcontentloaded'});
      await page.getByRole('heading',{name:'Negocios Pioneros',exact:true}).waitFor({state:'visible'});
      await page.getByText('Marca Sol').first().waitFor({state:'visible',timeout:15000});
      assert.equal(await page.getByText('Marca Sol').first().isVisible(),true,device+': assignment');
      assert.equal(await page.getByRole('heading',{name:'Evolución de Negocios Pioneros'}).isVisible(),true,device+': chart');
      assert.equal(await page.getByRole('button',{name:/Cupos totales/}).textContent().then(v=>v.includes('20')),
        true,device+': real capacity');
      assert.equal(await page.getByRole('button',{name:/Asignados/}).textContent().then(v=>v.includes('1')),
        true,device+': real assigned count');
      assert.equal(await page.getByRole('button',{name:/Disponibles/}).textContent().then(v=>v.includes('19')),
        true,device+': real available count');
      const headingBounds=await page.evaluate(()=>{
        const icon=document.querySelector('.pioneer-premium .admin-page-heading-icon')?.getBoundingClientRect();
        const title=document.querySelector('#pioneer-title')?.getBoundingClientRect();
        return {iconRight:icon?.right??9999,titleLeft:title?.left??0};
      });
      assert.ok(headingBounds.iconRight<headingBounds.titleLeft,device+': icon left of heading');
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+2),
        true,device+': no page horizontal overflow');
      if(viewport.width<=800){
        assert.equal(await page.locator('.pioneer-mobile-item').count(),10,device+': mobile cards');
        assert.equal(await page.locator('.pioneer-table-wrap').count(),0,device+': desktop table not mounted');
      }else{
        assert.equal(await page.locator('.pioneer-table-wrap').count(),1,device+': desktop table');
        assert.equal(await page.locator('.pioneer-mobile-item').count(),0,device+': mobile cards not mounted');
      }
      await page.screenshot({path:resolve(screenshots,device+'.png'),fullPage:true});
      await page.getByRole('button',{name:/Disponibles/}).click();
      await page.getByText('19 de 20 cupos').waitFor({state:'visible'});
      await page.getByRole('button',{name:/Asignados/}).click();
      await page.getByText('1 de 20 cupos').waitFor({state:'visible'});
      await page.getByRole('button',{name:/Cupos totales/}).click();
      await page.getByText('20 de 20 cupos').waitFor({state:'visible'});
      const tabs=page.getByRole('group',{name:'Secciones de Pioneros'});
      await tabs.getByRole('button',{name:/Reclamaciones/}).click();
      await page.getByText('Negocio sin marca').waitFor({state:'visible',timeout:15000});
      assert.equal(await page.getByText('Negocio sin marca').isVisible(),true,device+': brandless claim visible');
      await page.getByRole('button',{name:'Aprobar reclamación'}).click();
      assert.equal(await page.getByRole('dialog',{name:'Aprobar reclamación'}).isVisible(),true,device+': confirmation dialog');
      await page.getByRole('button',{name:'Cerrar',exact:true}).click();
      await tabs.getByRole('button',{name:'Marcas'}).click();
      assert.equal(await page.getByText('Marca Sol').first().isVisible(),true,device+': brands tab');
      await page.getByRole('button',{name:/Marcas elegibles/}).click();
      await page.getByText('0 marcas').waitFor({state:'visible'});
      await tabs.getByRole('button',{name:'Auditoría'}).click();
      await page.getByText('Reconocimiento asignado').waitFor({state:'visible'});
      assert.equal(errors.length,0,device+': JS errors '+errors.join(' | '));
      console.log('Negocios Pioneros responsive OK: '+device);
    }finally{await context.close();}
  }
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
