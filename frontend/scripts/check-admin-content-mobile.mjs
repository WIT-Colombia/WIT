import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root=fileURLToPath(new URL('../apps/admin/dist/',import.meta.url));
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.jpg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
  try{
    const name=decodeURIComponent(new URL(req.url,'http://fixture.test').pathname);
    const file=resolve(root,'.'+name);
    if(file!==resolve(root)&&!file.startsWith(root.endsWith(sep)?root:root+sep)){
      res.writeHead(403).end();return;
    }
    const target=extname(file)?file:resolve(root,'index.html');
    const bytes=await readFile(target);
    res.writeHead(200,{'Content-Type':types[extname(target)]||'application/octet-stream'}).end(bytes);
  }catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});

const offer={
  id:'fixture-offer-1',internalCode:'P-0001',kind:'PRODUCT',name:'Producto de prueba móvil',
  description:'Prueba de compatibilidad',category:'Tecnología',categoryId:null,
  priceAmount:'29900',currency:'COP',priceText:null,negotiable:false,active:true,
  adultOnly:false,publicationStatus:'PUBLISHED',
  // Simulate a backend that has not deployed the administrativeStatus field yet.
  deletedAt:null,createdAt:'2026-11-15T15:00:00.000Z',updatedAt:'2026-11-16T14:00:00.000Z',
  photoId:null,photoAlt:null,likes:1,reports:0,
  business:{id:'fixture-business',publicId:'fixture-business',name:'Negocio de prueba',city:'Cali',country:'CO',publicationStatus:'PUBLISHED'},
};
try{
  for(const [name,width,height] of [
    ['mobile',390,844],['ipad',768,1024],['desktop',1440,900],
  ]){
    const context=await browser.newContext({viewport:{width,height}});
    const errors=[];
    await context.route('**/*',async route=>{
      const url=new URL(route.request().url());
      const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':origin,
        'Access-Control-Allow-Credentials':'true','Access-Control-Allow-Headers':'*'};
      const reply=(status,body)=>route.fulfill({status,headers,body:JSON.stringify(body)});
      if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers});
      if(url.pathname.endsWith('/admin/auth/session'))
        return reply(200,{authenticated:true,userId:'content-fixture',csrfToken:'test-only'});
      if(url.pathname.endsWith('/admin/me'))
        return reply(200,{admin:{user:{id:'content-fixture',publicId:'fixture',displayName:'Administrador de prueba',
          emailNormalized:'admin@example.test',avatarUrl:null,locale:'es-CO'},role:'SUPER_ADMIN',
          permissions:['CATALOG_READ','CONTENT_MODERATE']}});
      if(url.pathname.endsWith('/admin/content'))
        return reply(200,{offers:[offer],pagination:{page:1,pageSize:20,total:1,totalPages:1}});
      if(url.pathname.endsWith('/admin/content-insights'))
        return reply(503,{error:{code:'OLD_SERVER',message:'Evolución no disponible durante despliegue.'}});
      if(url.pathname.endsWith('/admin/content-capabilities'))
        return reply(404,{error:{code:'NOT_FOUND',message:'Capacidades no disponibles.'}});
      if(url.origin!==origin||url.pathname.startsWith('/api/'))
        return reply(503,{error:{code:'FIXTURE',message:'Respuesta no incluida en prueba.'}});
      return route.continue();
    });
    const page=await context.newPage();
    page.on('pageerror',error=>errors.push(error.message));
    try{
      await page.goto(origin+'/content',{waitUntil:'domcontentloaded'});
      await page.getByText('Producto de prueba móvil').first().waitFor({state:'visible',timeout:15000});
      assert.equal(await page.getByRole('heading',{name:'Contenido',exact:true}).isVisible(),true,name+': sección visible');
      assert.equal(await page.getByText('Estado administrativo no disponible').first().isVisible(),true,name+': incompatibilidad señalada');
      assert.equal(errors.length,0,name+': sin excepciones de React: '+errors.join(' | '));
      if(width<=900){
        assert.equal(await page.locator('.ac-mobile-card').count(),1,name+': tarjeta móvil');
        assert.equal(await page.locator('.ac-table-scroll').count(),0,name+': tabla de escritorio no montada');
      }else{
        assert.equal(await page.locator('.ac-table-scroll').count(),1,name+': tabla de escritorio');
        assert.equal(await page.locator('.ac-mobile-card').count(),0,name+': tarjetas móviles no montadas');
      }
      console.log('Contenido sin pantalla blanca: '+name);
    }finally{await context.close();}
  }
}finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
