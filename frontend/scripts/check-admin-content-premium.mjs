import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

// Browser fixtures verify UI behavior only; production continues consuming live APIs.
const root=fileURLToPath(new URL('../apps/admin/dist/',import.meta.url));
const screenshots=fileURLToPath(new URL('../test-results/admin-content-premium/',import.meta.url));
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png',
  '.svg':'image/svg+xml','.jpg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
  try{
    const name=decodeURIComponent(new URL(req.url,'http://fixture.test').pathname);
    const file=resolve(root,'.'+name);
    if(file!==resolve(root)&&!file.startsWith(root.endsWith(sep)?root:root+sep)){
      res.writeHead(403).end();return;
    }
    const target=extname(file)?file:resolve(root,'index.html');
    res.writeHead(200,{'Content-Type':types[extname(target)]||'application/octet-stream'}).end(await readFile(target));
  }catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});

const business=(id,name,city)=>({id,publicId:id,name,city,country:'CO',publicationStatus:'PUBLISHED'});
const offers=[
  {id:'fixture-product',internalCode:'P-001',kind:'PRODUCT',name:'Zapatillas deportivas',
    description:'Catálogo de prueba',categoryId:'cat-1',category:'Moda',priceAmount:'120000',
    currency:'COP',priceText:null,negotiable:false,active:true,adultOnly:false,
    publicationStatus:'PUBLISHED',administrativeStatus:'NONE',adminRestrictedAt:null,
    deletedAt:null,createdAt:'2026-11-15T15:00:00Z',updatedAt:'2026-11-18T13:00:00Z',
    photoId:null,photoAlt:null,likes:3,views:8,reports:0,business:business('business-1','Calzado del Valle','Cali')},
  {id:'fixture-service',internalCode:'S-001',kind:'SERVICE',name:'Reparación de celulares',
    description:'Catálogo de prueba',categoryId:null,category:'Tecnología',priceAmount:null,
    currency:null,priceText:'Consultar tarifa',negotiable:false,active:true,adultOnly:false,
    publicationStatus:'REVIEW',administrativeStatus:'NONE',adminRestrictedAt:null,
    deletedAt:null,createdAt:'2026-11-16T15:00:00Z',updatedAt:'2026-11-17T13:00:00Z',
    photoId:null,photoAlt:null,likes:1,views:2,reports:1,business:business('business-2','Tecnología Norte','Palmira')},
];

function filterOffers(params) {
  const q=(params.get('q')||'').toLocaleLowerCase('es-CO');
  const kind=params.get('kind')||'';
  const status=params.get('status')||'';
  return offers.filter(offer=>(!kind||offer.kind===kind)&&
    (!status||offer.publicationStatus===status)&&
    (!q||[offer.name,offer.internalCode,offer.business.name].some(x=>x.toLocaleLowerCase('es-CO').includes(q))));
}
function insights(params){
  const selected=filterOffers(params);
  const total=selected.length;
  return {period:params.get('period')||'30d',granularity:'day',timezone:'America/Bogota',
    totals:{total,products:selected.filter(x=>x.kind==='PRODUCT').length,
      services:selected.filter(x=>x.kind==='SERVICE').length,
      published:selected.filter(x=>x.publicationStatus==='PUBLISHED').length,
      inReview:selected.filter(x=>x.publicationStatus==='REVIEW').length,
      unpublished:0,deleted:0,deletedOverall:0,hidden:0,inactive:0},
    series:[{month:'2026-11-17',total:0,products:0,services:0,views:0,likes:0},
      {month:'2026-11-18',total,products:selected.filter(x=>x.kind==='PRODUCT').length,
        services:selected.filter(x=>x.kind==='SERVICE').length,views:10,likes:4}],
    ranking:[{name:'Moda',count:1},{name:'Tecnología',count:1}],
    filters:{cities:[{value:'CO|Cali',label:'Cali'},{value:'CO|Palmira',label:'Palmira'}],
      categories:[{id:'cat-1',name:'Moda'}]},
    definition:'Prueba aislada: todas las cifras provienen del fixture de la API.'};
}
try{
  await mkdir(screenshots,{recursive:true});
  for(const [name,width,height] of [['mobile',390,844],['ipad',768,1024],['desktop',1440,900]]){
    const context=await browser.newContext({viewport:{width,height}});
    const errors=[];
    await context.route('**/*',async route=>{
      const request=route.request(),url=new URL(request.url());
      const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':origin,
        'Access-Control-Allow-Credentials':'true','Access-Control-Allow-Headers':'*'};
      const reply=(status,body)=>route.fulfill({status,headers,body:JSON.stringify(body)});
      if(request.method()==='OPTIONS')return route.fulfill({status:204,headers});
      if(url.pathname.endsWith('/admin/auth/session'))
        return reply(200,{authenticated:true,userId:'fixture-admin',csrfToken:'test-csrf'});
      if(url.pathname.endsWith('/admin/me'))
        return reply(200,{admin:{user:{id:'fixture-admin',publicId:'A-1',displayName:'Administrador de pruebas',
          emailNormalized:'admin@example.test',avatarUrl:null,locale:'es-CO'},
          role:'SUPER_ADMIN',permissions:['CATALOG_READ','CONTENT_MODERATE']}});
      if(url.pathname.endsWith('/admin/content-capabilities'))
        return reply(200,{canModerate:true,canDelete:false});
      if(url.pathname.endsWith('/admin/content-insights'))
        return reply(200,insights(url.searchParams));
      if(url.pathname.endsWith('/admin/content')){
        const filtered=filterOffers(url.searchParams);
        return reply(200,{offers:filtered,pagination:{page:1,pageSize:20,total:filtered.length,totalPages:filtered.length?1:0}});
      }
      if(url.origin!==origin||url.pathname.startsWith('/api/'))
        return reply(503,{error:{code:'FIXTURE_ONLY',message:'Ruta fuera del test aislado.'}});
      return route.continue();
    });
    const page=await context.newPage();
    page.on('pageerror',error=>errors.push(error.message));
    try{
      await page.goto(origin+'/content',{waitUntil:'domcontentloaded'});
      await page.getByText('2 publicaciones').first().waitFor({state:'visible',timeout:15000});
      await page.getByRole('button',{name:/Contenido del segmento/}).waitFor({state:'visible'});
      const mobile=width<=900;
      const cards=page.locator('.ac-mobile-grid');
      const table=page.locator('.ac-table-scroll');
      if(mobile){
        await cards.waitFor({state:'visible'});
        assert.equal(await table.count(),0,name+': no render desktop table');
        assert.equal(await page.locator('.ac-mobile-card').count(),2,name+': business cards');
      }else{
        await table.waitFor({state:'visible'});
        assert.equal(await cards.count(),0,name+': no render mobile cards');
        assert.equal(await page.locator('.ac-table tbody tr').count(),2,name+': business rows');
      }
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+2),
        true,name+': no horizontal overflow');
      assert.equal(await page.getByRole('button',{name:/Publicados/}).textContent().then(x=>x.includes('1')),
        true,name+': published data');
      assert.equal(await page.getByText('Programados').count(),0,name+': no invented scheduled state');
      assert.equal(await page.getByText('Crear contenido').count(),0,name+': no fake create action');
      await page.screenshot({path:resolve(screenshots,name+'.png'),fullPage:true});

      await page.getByRole('button',{name:'Servicios',exact:true}).click();
      await page.getByText('1 publicación').first().waitFor({state:'visible'});
      assert.equal(await page.getByRole('button',{name:'Servicios',exact:true}).getAttribute('aria-pressed'),
        'true',name+': services filter');
      await page.getByRole('button',{name:'Todos',exact:true}).click();
      await page.getByText('2 publicaciones').first().waitFor({state:'visible'});
      await page.getByPlaceholder('Buscar publicación, código o negocio').fill('Zapatillas');
      await page.getByRole('button',{name:'Buscar',exact:true}).click();
      await page.getByText('1 publicación').first().waitFor({state:'visible'});
      await page.getByRole('button',{name:'Limpiar',exact:true}).click();
      await page.getByText('2 publicaciones').first().waitFor({state:'visible'});
      await page.getByRole('button',{name:/Ocultos por Admin/}).click();
      await page.getByText('0 publicaciones').first().waitFor({state:'visible'});
      await page.getByRole('button',{name:/Contenido del segmento/}).click();
      await page.getByText('2 publicaciones').first().waitFor({state:'visible'});
      assert.equal(errors.length,0,name+': no runtime exceptions: '+errors.join(' | '));
      console.log('Admin Contenido Premium: catálogo, filtros y responsive OK - '+name);
    }finally{await context.close();}
  }
}finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
