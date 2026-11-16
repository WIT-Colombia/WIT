import { prisma } from '../../config/prisma.js';
import { Prisma } from '../../generated/prisma/client.js';
import { AppError } from '../../shared/errors/app-error.js';
import { isPhotoMissingError, photoMimeType, readPhoto } from '../business/photo-storage.js';

type Filters={q?:string;kind?:string;status?:string;city?:string;categoryId?:string;businessId?:string;order?:string;period?:string;page?:number};
type ModerationAction='HIDE'|'RESTORE';
const categorySelect={id:true,code:true,translations:{select:{locale:true,name:true}}} as const;
const nameOf=(category:{code:string;translations:Array<{locale:string;name:string}>}|null)=>
  category?.translations.find(t=>t.locale==='es-CO')?.name ??
  category?.translations.find(t=>t.locale==='es')?.name ??
  category?.translations[0]?.name ?? category?.code ?? 'Sin categoría';
const text=(s?:string,n=140)=>(s??'').trim().slice(0,n);
const cityParts=(s:string)=>{const index=s.indexOf('|');if(index<0)return null;const country=s.slice(0,index),city=s.slice(index+1);return /^[A-Z]{2}$/.test(country)&&city.length>0&&city.length<=160?{country,city}:null;};
const kindOf=(s?:string):'PRODUCT'|'SERVICE'|null=>s==='PRODUCT'||s==='SERVICE'?s:null;
const statusOf=(s?:string)=>['PUBLISHED','UNPUBLISHED','REVIEW','DELETED','HIDDEN','ADMIN_REVIEW','INACTIVE'].includes(s??'')?s:null;
function whereFor(filters:Filters):Prisma.BusinessOfferWhereInput {
  const parts:Prisma.BusinessOfferWhereInput[]=[];
  const q=text(filters.q,120),kind=kindOf(filters.kind),status=statusOf(filters.status);
  const categoryId=text(filters.categoryId,36),city=cityParts(text(filters.city,200));
  if(q)parts.push({OR:[{name:{contains:q}},{internalCode:{contains:q}},{business:{name:{contains:q}}}]});
  if(kind)parts.push({kind});
  if(status==='DELETED')parts.push({deletedAt:{not:null}});
  else {
    parts.push({deletedAt:null});
    if(status==='HIDDEN')parts.push({administrativeStatus:'HIDDEN'});
    else if(status==='ADMIN_REVIEW')parts.push({administrativeStatus:'REVIEW'});
    else if(status==='INACTIVE')parts.push({active:false,administrativeStatus:'NONE'});
    else if(status)parts.push({publicationStatus:status as 'PUBLISHED'|'UNPUBLISHED'|'REVIEW'});
  }
  if(categoryId)parts.push({OR:[{categoryId},{categoryId:null,business:{categoryId}}]});
  const businessId=text(filters.businessId,64);
  if(businessId)parts.push({businessId});
  if(city)parts.push({business:{location:{is:{countryCode:city.country,cityName:city.city}}}});
  return {AND:parts};
}
const sharedSelect={
  id:true,internalCode:true,kind:true,name:true,description:true,categoryId:true,priceAmount:true,currency:true,priceText:true,
  negotiable:true,active:true,adultOnly:true,publicationStatus:true,administrativeStatus:true,adminRestrictedAt:true,deletedAt:true,createdAt:true,updatedAt:true,
  photos:{take:1,orderBy:[{sortOrder:'asc' as const},{createdAt:'asc' as const}],select:{id:true,altText:true}},
  category:{select:categorySelect},
  business:{select:{id:true,publicId:true,name:true,publicationStatus:true,
    location:{select:{cityName:true,countryCode:true}},category:{select:categorySelect}}},
  _count:{select:{likes:true,reports:true}},
} satisfies Prisma.BusinessOfferSelect;
function compactOffer(item:any) {
  return {
    id:item.id,internalCode:item.internalCode,kind:item.kind,name:item.name,description:item.description,categoryId:item.categoryId,
    priceAmount:item.priceAmount?.toString()??null,currency:item.currency,priceText:item.priceText,
    negotiable:item.negotiable,active:item.active,adultOnly:item.adultOnly,publicationStatus:item.publicationStatus,
    administrativeStatus:item.administrativeStatus,adminRestrictedAt:item.adminRestrictedAt,
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
  const order:Prisma.BusinessOfferOrderByWithRelationInput[]= filters.order==='name'?[{name:'asc'},{id:'asc'}]:
    filters.order==='oldest'?[{createdAt:'asc'},{id:'asc'}]:filters.order==='created'?[{createdAt:'desc'},{id:'asc'}]:[{updatedAt:'desc'},{id:'asc'}];
  const [total,offers]=await Promise.all([
    prisma.businessOffer.count({where}),
    prisma.businessOffer.findMany({where,select:sharedSelect,orderBy:order,
      skip:(page-1)*pageSize,take:pageSize}),
  ]);
  return {offers:offers.map(compactOffer),pagination:{page,pageSize,total,totalPages:Math.ceil(total/pageSize)}};
}
export async function getAdminContentInsights(filters:Filters,now=new Date()){
  const where=whereFor(filters);
  const period=['7d','30d','90d','6m','12m','24m','60m','all'].includes(filters.period??'')?filters.period!:'30d';
  const daily=['7d','30d','90d'].includes(period);
  const [total,products,services,published,inReview,unpublished,deleted,hidden,inactive,first,categories,cities]=await Promise.all([
    prisma.businessOffer.count({where}),
    prisma.businessOffer.count({where:{AND:[where,{kind:'PRODUCT'}]}}),
    prisma.businessOffer.count({where:{AND:[where,{kind:'SERVICE'}]}}),
    prisma.businessOffer.count({where:{AND:[where,{publicationStatus:'PUBLISHED',deletedAt:null,active:true}]}}),
    prisma.businessOffer.count({where:{AND:[where,{publicationStatus:'REVIEW',deletedAt:null}]}}),
    prisma.businessOffer.count({where:{AND:[where,{publicationStatus:'UNPUBLISHED',deletedAt:null}]}}),
    prisma.businessOffer.count({where:{AND:[where,{deletedAt:{not:null}}]}}),
    prisma.businessOffer.count({where:{AND:[where,{administrativeStatus:'HIDDEN',deletedAt:null}]}}),
    prisma.businessOffer.count({where:{AND:[where,{administrativeStatus:'NONE',active:false,deletedAt:null}]}}),
    prisma.businessOffer.findFirst({where,orderBy:{createdAt:'asc'},select:{createdAt:true}}),
    prisma.category.findMany({orderBy:[{sortOrder:'asc'},{code:'asc'}],select:categorySelect,
      where:{OR:[{offers:{some:{}}},{businesses:{some:{offers:{some:{}}}}}]}}),
    prisma.businessLocation.findMany({where:{business:{offers:{some:{}}}},distinct:['countryCode','cityName'],
      select:{countryCode:true,cityName:true},orderBy:[{countryCode:'asc'},{cityName:'asc'}]}),
  ]);
  // Colombia does not observe daylight saving time. Compute local calendar boundaries,
  // query using UTC instants and include empty buckets, including today.
  const shift=5*3600000;
  const local=new Date(now.getTime()-shift);
  const localStart=new Date(Date.UTC(local.getUTCFullYear(),local.getUTCMonth(),local.getUTCDate()));
  let localFrom:Date;
  let localEnd:Date;
  if(daily){
    const days=Number.parseInt(period,10);
    localFrom=new Date(localStart.getTime()-(days-1)*86400000);
    localEnd=new Date(localStart.getTime()+86400000);
  }else{
    const month=new Date(Date.UTC(local.getUTCFullYear(),local.getUTCMonth(),1));
    localFrom=period==='all'?(first?new Date(Date.UTC(first.createdAt.getUTCFullYear(),first.createdAt.getUTCMonth(),1)):month):
      new Date(Date.UTC(month.getUTCFullYear(),month.getUTCMonth()-Number.parseInt(period,10)+1,1));
    localEnd=new Date(Date.UTC(month.getUTCFullYear(),month.getUTCMonth()+1,1));
  }
  const start=new Date(localFrom.getTime()+shift),end=new Date(localEnd.getTime()+shift);
  const fmt=daily?'%Y-%m-%d':'%Y-%m';
  const bucketSql=Prisma.sql`DATE_FORMAT(DATE_SUB(o.createdAt,INTERVAL 5 HOUR),${fmt})`;
  const eventsSql=Prisma.sql`DATE_FORMAT(DATE_SUB(e.createdAt,INTERVAL 5 HOUR),${fmt})`;
  const likesSql=Prisma.sql`DATE_FORMAT(DATE_SUB(l.createdAt,INTERVAL 5 HOUR),${fmt})`;
  const baseSql:Prisma.Sql[]=[];
  const q=text(filters.q,120),likeQ='%'+q+'%';
  if(q)baseSql.push(Prisma.sql`(o.name LIKE ${likeQ} OR o.internalCode LIKE ${likeQ} OR b.name LIKE ${likeQ})`);
  const kind=kindOf(filters.kind),status=statusOf(filters.status),categoryId=text(filters.categoryId,36);
  if(kind)baseSql.push(Prisma.sql`o.kind = ${kind}`);
  if(status==='DELETED')baseSql.push(Prisma.sql`o.deletedAt IS NOT NULL`);
  else {
    baseSql.push(Prisma.sql`o.deletedAt IS NULL`);
    if(status==='HIDDEN')baseSql.push(Prisma.sql`o.administrativeStatus='HIDDEN'`);
    else if(status==='ADMIN_REVIEW')baseSql.push(Prisma.sql`o.administrativeStatus='REVIEW'`);
    else if(status==='INACTIVE')baseSql.push(Prisma.sql`o.administrativeStatus='NONE' AND o.active=FALSE`);
    else if(status)baseSql.push(Prisma.sql`o.publicationStatus = ${status}`);
  }
  if(categoryId)baseSql.push(Prisma.sql`COALESCE(o.categoryId,b.categoryId) = ${categoryId}`);
  const businessId=text(filters.businessId,64);
  if(businessId)baseSql.push(Prisma.sql`o.businessId = ${businessId}`);
  const city=cityParts(text(filters.city,200));
  if(city)baseSql.push(Prisma.sql`EXISTS(SELECT 1 FROM BusinessLocation l WHERE l.businessId=b.id AND l.countryCode=${city.country} AND l.cityName=${city.city})`);
  const conditions=Prisma.join(baseSql,' AND ');
  const [createdRows,viewRows,likeRows,rankingRows]=await Promise.all([
    prisma.$queryRaw<Array<{period:string;products:bigint;services:bigint}>>(Prisma.sql`
      SELECT ${bucketSql} AS period,
        SUM(CASE WHEN o.kind='PRODUCT' THEN 1 ELSE 0 END) AS products,
        SUM(CASE WHEN o.kind='SERVICE' THEN 1 ELSE 0 END) AS services
      FROM BusinessOffer o JOIN Business b ON b.id=o.businessId
      WHERE o.createdAt >= ${start} AND o.createdAt < ${end} AND ${conditions}
      GROUP BY ${bucketSql} ORDER BY period
    `),
    prisma.$queryRaw<Array<{period:string;quantity:bigint}>>(Prisma.sql`
      SELECT ${eventsSql} AS period,COUNT(*) AS quantity
      FROM BusinessAnalyticsEvent e JOIN BusinessOffer o ON o.id=e.offerId JOIN Business b ON b.id=o.businessId
      WHERE e.eventType='OFFER_VIEW' AND e.createdAt>=${start} AND e.createdAt<${end} AND ${conditions}
      GROUP BY ${eventsSql} ORDER BY period
    `),
    prisma.$queryRaw<Array<{period:string;quantity:bigint}>>(Prisma.sql`
      SELECT ${likesSql} AS period,COUNT(*) AS quantity
      FROM BusinessOfferLike l JOIN BusinessOffer o ON o.id=l.offerId JOIN Business b ON b.id=o.businessId
      WHERE l.createdAt>=${start} AND l.createdAt<${end} AND ${conditions}
      GROUP BY ${likesSql} ORDER BY period
    `),
    prisma.$queryRaw<Array<{categoryId:string|null;quantity:bigint}>>(Prisma.sql`
      SELECT COALESCE(o.categoryId,b.categoryId) AS categoryId,COUNT(*) AS quantity
      FROM BusinessOffer o JOIN Business b ON b.id=o.businessId
      WHERE ${conditions} GROUP BY COALESCE(o.categoryId,b.categoryId) ORDER BY quantity DESC LIMIT 8
    `),
  ]);
  const created=new Map(createdRows.map(row=>[row.period,{products:Number(row.products),services:Number(row.services)}]));
  const views=new Map(viewRows.map(row=>[row.period,Number(row.quantity)]));
  const likes=new Map(likeRows.map(row=>[row.period,Number(row.quantity)]));
  const series:Array<{month:string;products:number;services:number;total:number;views:number;likes:number}>=[];
  for(let d=new Date(localFrom);d<localEnd;daily?d.setUTCDate(d.getUTCDate()+1):d.setUTCMonth(d.getUTCMonth()+1)){
    const date=d.toISOString().slice(0,daily?10:7),c=created.get(date)??{products:0,services:0};
    series.push({month:date,products:c.products,services:c.services,total:c.products+c.services,
      views:views.get(date)??0,likes:likes.get(date)??0});
  }
  const lookup=new Map(categories.map(c=>[c.id,nameOf(c)]));
  return {period,granularity:daily?'day':'month',timezone:'America/Bogota',
    totals:{total,products,services,published,inReview,unpublished,deleted,hidden,inactive},
    series,ranking:rankingRows.map(row=>({name:row.categoryId?lookup.get(row.categoryId)??'Categoría no disponible':'Sin categoría',count:Number(row.quantity)})),
    filters:{categories:categories.map(c=>({id:c.id,name:nameOf(c)})),
      cities:cities.map(c=>({value:c.countryCode+'|'+c.cityName,label:c.cityName+' · '+c.countryCode}))},
    definition:'Altas: publicaciones creadas en cada fecha, no el acumulado. Vistas: eventos OFFER_VIEW registrados para productos y servicios. Me gusta: nuevos registros de interés. Los ceros son valores reales sin eventos; no se inventan datos ni se reemplazan períodos vacíos. Las fechas corresponden a America/Bogota. Los estados describen la situación actual y cambian al moderar; los eliminados se consultan con su filtro.'};
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
  const views=await prisma.businessAnalyticsEvent.count({where:{offerId:id,eventType:'OFFER_VIEW'}});
  return {offer:{...compactOffer(offer),views,photos:offer.photos,
    reportsRecent:offer.reports,
    canHide:offer.deletedAt===null&&offer.administrativeStatus!=='HIDDEN',
    canReview:offer.deletedAt===null&&offer.administrativeStatus!=='REVIEW',
    canRelease:offer.deletedAt===null&&['HIDDEN','REVIEW'].includes(offer.administrativeStatus),
    canDelete:offer.deletedAt===null,canRestore:offer.administrativeStatus==='DELETED'&&offer.deletedAt!==null}};
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
