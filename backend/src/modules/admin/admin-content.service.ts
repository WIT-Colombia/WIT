import { prisma } from '../../config/prisma.js';
import { Prisma } from '../../generated/prisma/client.js';
import { AppError } from '../../shared/errors/app-error.js';
import { isPhotoMissingError, photoMimeType, readPhoto } from '../business/photo-storage.js';
import { notifyBusinessOwners } from '../notifications/platform-notifications.service.js';

type Filters={q?:string;kind?:string;status?:string;city?:string;categoryId?:string;period?:string;page?:number};
type ModerationAction='HIDE'|'RESTORE';
const categorySelect={id:true,code:true,translations:{select:{locale:true,name:true}}} as const;
const nameOf=(category:{code:string;translations:Array<{locale:string;name:string}>}|null)=>
  category?.translations.find(t=>t.locale==='es-CO')?.name ??
  category?.translations.find(t=>t.locale==='es')?.name ??
  category?.translations[0]?.name ?? category?.code ?? 'Sin categoría';
const text=(s?:string,n=140)=>(s??'').trim().slice(0,n);
const cityParts=(s:string)=>{const index=s.indexOf('|');if(index<0)return null;const country=s.slice(0,index),city=s.slice(index+1);return /^[A-Z]{2}$/.test(country)&&city.length>0&&city.length<=160?{country,city}:null;};
const kindOf=(s?:string):'PRODUCT'|'SERVICE'|null=>s==='PRODUCT'||s==='SERVICE'?s:null;
const statusOf=(s?:string)=>['PUBLISHED','UNPUBLISHED','REVIEW','DELETED'].includes(s??'')?s:null;
function whereFor(filters:Filters):Prisma.BusinessOfferWhereInput {
  const parts:Prisma.BusinessOfferWhereInput[]=[];
  const q=text(filters.q,120),kind=kindOf(filters.kind),status=statusOf(filters.status);
  const categoryId=text(filters.categoryId,36),city=cityParts(text(filters.city,200));
  if(q)parts.push({OR:[{name:{contains:q}},{internalCode:{contains:q}},{business:{name:{contains:q}}}]});
  if(kind)parts.push({kind});
  if(status==='DELETED')parts.push({deletedAt:{not:null}});
  else {parts.push({deletedAt:null});if(status)parts.push({publicationStatus:status as 'PUBLISHED'|'UNPUBLISHED'|'REVIEW'});}
  if(categoryId)parts.push({OR:[{categoryId},{categoryId:null,business:{categoryId}}]});
  if(city)parts.push({business:{location:{is:{countryCode:city.country,cityName:city.city}}}});
  return {AND:parts};
}
const sharedSelect={
  id:true,internalCode:true,kind:true,name:true,description:true,priceAmount:true,currency:true,priceText:true,
  negotiable:true,active:true,adultOnly:true,publicationStatus:true,deletedAt:true,createdAt:true,updatedAt:true,
  photos:{take:1,orderBy:[{sortOrder:'asc' as const},{createdAt:'asc' as const}],select:{id:true,altText:true}},
  category:{select:categorySelect},
  business:{select:{id:true,publicId:true,name:true,publicationStatus:true,
    location:{select:{cityName:true,countryCode:true}},category:{select:categorySelect}}},
  _count:{select:{likes:true,reports:true}},
} satisfies Prisma.BusinessOfferSelect;
function compactOffer(item:any) {
  return {
    id:item.id,internalCode:item.internalCode,kind:item.kind,name:item.name,description:item.description,
    priceAmount:item.priceAmount?.toString()??null,currency:item.currency,priceText:item.priceText,
    negotiable:item.negotiable,active:item.active,adultOnly:item.adultOnly,publicationStatus:item.publicationStatus,
    deletedAt:item.deletedAt,createdAt:item.createdAt,updatedAt:item.updatedAt,
    category:nameOf(item.category??item.business.category),
    photoId:item.photos[0]?.id??null,photoAlt:item.photos[0]?.altText??null,
    business:{id:item.business.id,publicId:item.business.publicId,name:item.business.name,
      city:item.business.location?.cityName??null,country:item.business.location?.countryCode??null,
      publicationStatus:item.business.publicationStatus},
    likes:item._count.likes,reports:item._count.reports,
  };
}
export async function listAdminContent(filters:Filters){
  const page=Number.isFinite(filters.page)?Math.max(1,Math.min(100000,Math.floor(filters.page!))):1,pageSize=20,where=whereFor(filters);
  const [total,offers]=await Promise.all([
    prisma.businessOffer.count({where}),
    prisma.businessOffer.findMany({where,select:sharedSelect,orderBy:[{updatedAt:'desc'},{id:'asc'}],
      skip:(page-1)*pageSize,take:pageSize}),
  ]);
  return {offers:offers.map(compactOffer),pagination:{page,pageSize,total,totalPages:Math.ceil(total/pageSize)}};
}
export async function getAdminContentInsights(filters:Filters,now=new Date()){
  const where=whereFor(filters), period=['6m','12m','24m','60m','all'].includes(filters.period??'')?filters.period!:'12m';
  const [total,products,services,published,inReview,unpublished,deleted,first,categories,cities]=await Promise.all([
    prisma.businessOffer.count({where}),
    prisma.businessOffer.count({where:{AND:[where,{kind:'PRODUCT'}]}}),
    prisma.businessOffer.count({where:{AND:[where,{kind:'SERVICE'}]}}),
    prisma.businessOffer.count({where:{AND:[where,{publicationStatus:'PUBLISHED',deletedAt:null}]}}),
    prisma.businessOffer.count({where:{AND:[where,{publicationStatus:'REVIEW',deletedAt:null}]}}),
    prisma.businessOffer.count({where:{AND:[where,{publicationStatus:'UNPUBLISHED',deletedAt:null}]}}),
    prisma.businessOffer.count({where:{AND:[where,{deletedAt:{not:null}}]}}),
    prisma.businessOffer.findFirst({where,orderBy:{createdAt:'asc'},select:{createdAt:true}}),
    prisma.category.findMany({orderBy:[{sortOrder:'asc'},{code:'asc'}],select:categorySelect,
      where:{OR:[{offers:{some:{}}},{businesses:{some:{offers:{some:{}}}}}]}}),
    prisma.businessLocation.findMany({where:{business:{offers:{some:{}}}},distinct:['countryCode','cityName'],
      select:{countryCode:true,cityName:true},orderBy:[{countryCode:'asc'},{cityName:'asc'}]}),
  ]);
  const current=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),1));
  const start=period==='all'?(first?new Date(Date.UTC(first.createdAt.getUTCFullYear(),first.createdAt.getUTCMonth(),1)):current):
    new Date(Date.UTC(current.getUTCFullYear(),current.getUTCMonth()-parseInt(period,10)+1,1));
  const end=new Date(Date.UTC(current.getUTCFullYear(),current.getUTCMonth()+1,1));
  const whereSql:Prisma.Sql[]=[Prisma.sql`o.createdAt >= ${start}`,Prisma.sql`o.createdAt < ${end}`];
  const baseSql:Prisma.Sql[]=[];
  const q=text(filters.q,120),likeQ='%'+q+'%';
  if(q)baseSql.push(Prisma.sql`(o.name LIKE ${likeQ} OR o.internalCode LIKE ${likeQ} OR b.name LIKE ${likeQ})`);
  const kind=kindOf(filters.kind),status=statusOf(filters.status),categoryId=text(filters.categoryId,36);
  if(kind)baseSql.push(Prisma.sql`o.kind = ${kind}`);
  if(status==='DELETED')baseSql.push(Prisma.sql`o.deletedAt IS NOT NULL`);
  else {baseSql.push(Prisma.sql`o.deletedAt IS NULL`);if(status)baseSql.push(Prisma.sql`o.publicationStatus = ${status}`);}
  if(categoryId)baseSql.push(Prisma.sql`COALESCE(o.categoryId,b.categoryId) = ${categoryId}`);
  const city=cityParts(text(filters.city,200));
  if(city)baseSql.push(Prisma.sql`EXISTS(SELECT 1 FROM BusinessLocation l WHERE l.businessId=b.id AND l.countryCode=${city.country} AND l.cityName=${city.city})`);
  const [monthly,top]=await Promise.all([
    prisma.$queryRaw<Array<{month:string;products:bigint;services:bigint}>>(Prisma.sql`
      SELECT DATE_FORMAT(o.createdAt,'%Y-%m') AS month,
        SUM(CASE WHEN o.kind='PRODUCT' THEN 1 ELSE 0 END) AS products,
        SUM(CASE WHEN o.kind='SERVICE' THEN 1 ELSE 0 END) AS services
      FROM BusinessOffer o INNER JOIN Business b ON b.id=o.businessId
      WHERE ${Prisma.join([...whereSql,...baseSql],' AND ')}
      GROUP BY DATE_FORMAT(o.createdAt,'%Y-%m') ORDER BY month
    `),
    prisma.$queryRaw<Array<{categoryId:string|null;quantity:bigint}>>(Prisma.sql`
      SELECT COALESCE(o.categoryId,b.categoryId) AS categoryId,COUNT(*) AS quantity
      FROM BusinessOffer o INNER JOIN Business b ON b.id=o.businessId
      WHERE ${Prisma.join(baseSql,' AND ')}
      GROUP BY COALESCE(o.categoryId,b.categoryId) ORDER BY quantity DESC LIMIT 8
    `),
  ]);
  const bucket=new Map(monthly.map(m=>[m.month,{products:Number(m.products),services:Number(m.services)}]));
  const series:Array<{month:string;products:number;services:number;total:number}>=[];
  for(let d=new Date(start);d<end;d.setUTCMonth(d.getUTCMonth()+1)){
    const month=d.toISOString().slice(0,7),item=bucket.get(month)??{products:0,services:0};
    series.push({month,products:item.products,services:item.services,total:item.products+item.services});
  }
  const lookup=new Map(categories.map(c=>[c.id,nameOf(c)]));
  return {period,totals:{total,products,services,published,inReview,unpublished,deleted},
    series,ranking:top.map(c=>({name:c.categoryId?lookup.get(c.categoryId)??'Categoría no disponible':'Sin categoría',count:Number(c.quantity)})),
    filters:{categories:categories.map(c=>({id:c.id,name:nameOf(c)})),
      cities:cities.map(c=>({value:c.countryCode+'|'+c.cityName,label:c.cityName+' · '+c.countryCode}))},
    definition:'Las altas se agrupan por fecha de creación. Los estados reflejan la situación actual. Los eliminados solo se incluyen al aplicar ese filtro.'};
}
export async function getAdminContentDetail(id:string){
  const offer=await prisma.businessOffer.findUnique({where:{id},include:{
    category:{select:categorySelect},photos:{orderBy:[{sortOrder:'asc'},{createdAt:'asc'}],select:{id:true,altText:true}},
    business:{select:{id:true,publicId:true,name:true,publicationStatus:true,lifecycleStatus:true,deletionStatus:true,
      businessAccount:{select:{status:true}},location:{select:{cityName:true,countryCode:true}},category:{select:categorySelect}}},
    _count:{select:{likes:true,reports:true}},
    reports:{take:8,orderBy:{createdAt:'desc'},select:{id:true,reason:true,status:true,createdAt:true,description:true}},
  }});
  if(!offer)throw new AppError(404,'ADMIN_OFFER_NOT_FOUND','No encontramos este producto o servicio.');
  const basicRestore=offer.deletedAt===null && offer.publicationStatus==='UNPUBLISHED' &&
    offer.business.publicationStatus==='PUBLISHED' && offer.business.lifecycleStatus==='ACTIVE' &&
    offer.business.deletionStatus==='NONE' && offer.business.businessAccount.status==='ACTIVE';
  const lastHide=basicRestore ? await prisma.auditLog.findFirst({
    where:{entityType:'OFFER',entityId:id,action:'ADMIN_CONTENT_HIDDEN'},
    orderBy:{createdAt:'desc'},select:{createdAt:true},
  }) : null;
  const canRestore=Boolean(basicRestore && lastHide &&
    offer.updatedAt<=new Date(lastHide.createdAt.getTime()+2000));
  return {offer:{...compactOffer(offer),photos:offer.photos,
    reportsRecent:offer.reports,canHide:offer.deletedAt===null&&offer.publicationStatus==='PUBLISHED',canRestore}};
}
export async function getAdminContentPhoto(photoId:string){
  const photo=await prisma.photo.findFirst({where:{id:photoId,offerId:{not:null}},select:{storageKey:true}});
  if(!photo)throw new AppError(404,'ADMIN_CONTENT_PHOTO_NOT_FOUND','No encontramos la fotografía.');
  try{return {buffer:await readPhoto(photo.storageKey),mimeType:photoMimeType(photo.storageKey)};}
  catch(error){
    if(isPhotoMissingError(error)||(error instanceof Error && (error as NodeJS.ErrnoException).code==='ENOENT'))
      throw new AppError(404,'ADMIN_CONTENT_PHOTO_MISSING','La fotografía ya no está disponible.');
    throw new AppError(503,'ADMIN_CONTENT_PHOTO_STORAGE_UNAVAILABLE','El almacenamiento de fotografías no está disponible temporalmente.');
  }
}
export async function moderateAdminContent(id:string,actorId:string,action:ModerationAction,note:string){
  const reason=note.trim();
  if(action!=='HIDE'&&action!=='RESTORE')throw new AppError(400,'ADMIN_CONTENT_ACTION_INVALID','Selecciona una acción válida.');
  if(reason.length<12||reason.length>500)throw new AppError(400,'ADMIN_CONTENT_REASON_REQUIRED','El motivo debe tener entre 12 y 500 caracteres.');
  return prisma.$transaction(async tx=>{
    const before=await tx.businessOffer.findUnique({where:{id},include:{business:{select:{
      publicationStatus:true,lifecycleStatus:true,deletionStatus:true,businessAccount:{select:{status:true}}}}}});
    if(!before)throw new AppError(404,'ADMIN_OFFER_NOT_FOUND','No encontramos este contenido.');
    if(before.deletedAt)throw new AppError(409,'ADMIN_CONTENT_DELETED','No se puede moderar contenido eliminado.');
    if(action==='HIDE'&&before.publicationStatus!=='PUBLISHED')
      throw new AppError(409,'ADMIN_CONTENT_NOT_PUBLISHED','Solo puedes ocultar contenido publicado.');
    if(action==='RESTORE'){
      if(before.publicationStatus!=='UNPUBLISHED')throw new AppError(409,'ADMIN_CONTENT_NOT_HIDDEN','Esta publicación no está oculta.');
      if(before.business.publicationStatus!=='PUBLISHED'||before.business.lifecycleStatus!=='ACTIVE'||
        before.business.deletionStatus!=='NONE'||before.business.businessAccount.status!=='ACTIVE')
        throw new AppError(409,'ADMIN_CONTENT_BUSINESS_INACTIVE','El negocio debe estar activo y publicado para restaurar su contenido.');
      const last=await tx.auditLog.findFirst({where:{entityType:'OFFER',entityId:id,action:'ADMIN_CONTENT_HIDDEN'},
        orderBy:{createdAt:'desc'},select:{createdAt:true}});
      if(!last||before.updatedAt>new Date(last.createdAt.getTime()+2000))
        throw new AppError(409,'ADMIN_CONTENT_NOT_ADMIN_HIDDEN','No se puede restaurar contenido que el negocio modificó posteriormente.');
    }
    const publicationStatus=action==='HIDE'?'UNPUBLISHED':'PUBLISHED';
    await tx.businessOffer.update({where:{id},data:{publicationStatus}});
    await tx.auditLog.create({data:{actorUserId:actorId,entityType:'OFFER',entityId:id,
      action:action==='HIDE'?'ADMIN_CONTENT_HIDDEN':'ADMIN_CONTENT_RESTORED',
      previousState:{publicationStatus:before.publicationStatus},newState:{publicationStatus},reason}});
    await notifyBusinessOwners(tx, before.businessId,
      action === 'HIDE' ? 'Publicación retirada por moderación' : 'Publicación restaurada por XAMUKO',
      action === 'HIDE'
        ? 'XAMUKO retiró de la vista pública «' + before.name + '». Consulta el estado de tu catálogo y solicita una revisión a soporte si es necesario.'
        : 'La publicación «' + before.name + '» volvió a estar disponible tras una revisión de XAMUKO.');
    return {id,publicationStatus,message:action==='HIDE'?'La publicación quedó oculta y la decisión registrada.':'La publicación volvió a estar visible y la decisión registrada.'};
  });
}
