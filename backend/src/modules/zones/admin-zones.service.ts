import { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';
import type { AdminContext } from '../admin/admin-auth.service.js';
import { effectiveStatus, normalizeTerritory, readZonePolicy, zoneKey, type ZoneLevel, type ZoneStatus } from './zone-policy.service.js';

export type ZoneMutation = {
  level: ZoneLevel; name: string; department?: string;
  status: ZoneStatus; opensAt: string | null; reason: string;
};
function canManage(context: AdminContext) {
  if (context.role !== 'SUPER_ADMIN')
    throw new AppError(403,'ZONE_SUPER_ADMIN_REQUIRED','Solo el administrador principal puede modificar la apertura territorial.');
}
function belongsToZone(
  location: {cityName?:string|null;regionName?:string|null;regionCode?:string|null;countryCode?:string|null}|null,
  zone: {level:string;name:string;department:string|null},
) {
  if(!location || location.countryCode !== 'CO')return false;
  if(zone.level==='COUNTRY')return true;
  const dept=normalizeTerritory(location.regionName||location.regionCode);
  const expected=normalizeTerritory(zone.level==='DEPARTMENT'?zone.name:zone.department);
  const departmentMatches=dept===expected ||
    (expected==='valle del cauca'&&['valle','val','76'].includes(dept)) ||
    (expected==='bogota d.c.'&&['bogota','11'].includes(dept));
  if(!departmentMatches)return false;
  if(zone.level==='DEPARTMENT')return true;
  const actual=normalizeTerritory(location.cityName),wanted=normalizeTerritory(zone.name);
  return actual===wanted || (wanted==='cali'&&actual==='santiago de cali')
    || (actual==='cali'&&wanted==='santiago de cali');
}
function isoDayFromColombia(date:Date) {
  return new Date(date.getTime()-5*3600000).toISOString().slice(0,10);
}
function monthInColombia(date:Date){
  return isoDayFromColombia(date).slice(0,7);
}
export async function getAdminZones(){
  const now=new Date();
  const [zones,audit] = await Promise.all([
    prisma.expansionZone.findMany({orderBy:[{level:'asc'},{name:'asc'}],take:500}),
    prisma.expansionZoneAudit.findMany({orderBy:{createdAt:'desc'},take:80}),
  ]);
  return {
    zones: zones.map(zone=>({...zone,effectiveStatus:effectiveStatus(zone,now)})),
    overview: {
      configured: zones.length,
      active: zones.filter(zone=>effectiveStatus(zone,now)==='OPEN').length,
      scheduled: zones.filter(zone=>effectiveStatus(zone,now)==='SCHEDULED').length,
      paused: zones.filter(zone=>effectiveStatus(zone,now)==='PAUSED').length,
      // Virtual discovery is not restricted by municipal rollout.
      virtualAlwaysAvailable: true,
    },
    audit,serverTime:now.toISOString(),timezone:'America/Bogota',
    policy:'Los registros están permitidos desde cualquier lugar. La exploración física queda limitada a municipios o departamentos abiertos; la modalidad virtual activa está disponible nacionalmente.',
  };
}
export async function setAdminZone(input:ZoneMutation,context:AdminContext) {
  canManage(context);
  const name=input.name.trim(), department=input.department?.trim()||null, reason=input.reason.trim();
  if(reason.length<12||reason.length>500)
    throw new AppError(400,'ZONE_REASON_REQUIRED','El motivo debe tener entre 12 y 500 caracteres.');
  if(name.length<2||name.length>160||(input.level==='MUNICIPALITY' && (!department||department.length<3)))
    throw new AppError(400,'ZONE_LOCATION_INVALID','Indica municipio y departamento válidos.');
  if(input.level==='COUNTRY'&&normalizeTerritory(name)!=='colombia')
    throw new AppError(400,'ZONE_COUNTRY_INVALID','La configuración nacional corresponde exclusivamente a Colombia.');
  if(input.status==='SCHEDULED'){
    const date=new Date(input.opensAt??'');
    if(!input.opensAt||Number.isNaN(date.getTime())||date.getTime()<=Date.now())
      throw new AppError(400,'ZONE_DATE_INVALID','La apertura programada debe tener una fecha y hora futura.');
  }else if(input.opensAt!==null){
    throw new AppError(400,'ZONE_DATE_INVALID','Una apertura no programada no debe incluir una fecha.');
  }
  const key=zoneKey(input.level,name,department);
  const opensAt=input.status==='SCHEDULED'?new Date(input.opensAt!):null;
  return prisma.$transaction(async tx=>{
    const previous=await tx.expansionZone.findUnique({where:{key}});
    const next=await tx.expansionZone.upsert({
      where:{key},
      create:{key,level:input.level,name,department,countryCode:'CO',status:input.status,
        opensAt,updatedById:context.userId},
      update:{name,department,status:input.status,opensAt,updatedById:context.userId},
    });
    await tx.expansionZoneAudit.create({data:{
      zoneId:next.id,actorUserId:context.userId,action:previous?'UPDATED':'CREATED',
      previous:previous?{
        status:previous.status,opensAt:previous.opensAt?.toISOString()??null,
        name:previous.name,department:previous.department,
      }:Prisma.JsonNull,
      current:{status:next.status,opensAt:next.opensAt?.toISOString()??null,
        name:next.name,department:next.department,level:next.level,key},
      reason,
    }});
    return {...next,effectiveStatus:effectiveStatus(next)};
  });
}
export async function getZoneInsights(key:string) {
  const zone=await prisma.expansionZone.findUnique({where:{key}});
  if(!zone)throw new AppError(404,'ZONE_NOT_FOUND','No encontramos esta zona configurada.');
  const [businesses,users]=await Promise.all([
    prisma.business.findMany({
      where:{location:{isNot:null}},
      select:{createdAt:true,lifecycleStatus:true,publicationStatus:true,visibilityStatus:true,
        deletionStatus:true,businessAccount:{select:{status:true}},
        location:{select:{cityName:true,regionName:true,regionCode:true,countryCode:true}},
      },
    }),
    prisma.user.findMany({where:{preferredLocationCity:{not:null}},
      select:{preferredLocationCity:true,preferredLocationRegion:true,preferredLocationCountry:true}}),
  ]);
  const selected=businesses.filter(b=>belongsToZone(b.location,zone));
  const usersInterested=users.filter(u=>belongsToZone({
    cityName:u.preferredLocationCity,regionName:u.preferredLocationRegion,
    countryCode:(u.preferredLocationCountry??'Colombia').toLowerCase()==='colombia'?'CO':u.preferredLocationCountry,
  },zone)).length;
  const ready=selected.filter(b=>b.lifecycleStatus==='ACTIVE'&&b.publicationStatus==='PUBLISHED'&&
    b.visibilityStatus==='VISIBLE'&&b.deletionStatus==='NONE'&&b.businessAccount.status==='ACTIVE');
  const now=new Date(),start=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()-11,1));
  const counts=new Map<string,number>();
  for(const b of selected){const month=monthInColombia(b.createdAt);counts.set(month,(counts.get(month)??0)+1);}
  let totalBefore=selected.filter(b=>b.createdAt<start).length;
  const series=Array.from({length:12},(_,i)=>{
    const date=new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+i,1));
    const month=date.toISOString().slice(0,7);
    const registrations=counts.get(month)??0;
    totalBefore+=registrations;
    return {month,registrations,cumulative:totalBefore};
  });
  return {
    zone:{id:zone.id,key:zone.key,level:zone.level,name:zone.name,department:zone.department,
      effectiveStatus:effectiveStatus(zone)},
    summary:{registeredBusinesses:selected.length,readyBusinesses:ready.length,
      usersWithLocationPreference:usersInterested},
    series,generatedAt:new Date().toISOString(),
    definition:'Negocios registrados: registros con ubicación en esta zona, incluso si no son públicos. Listos: negocios activos, publicados, visibles y sin eliminación. Usuarios: cuentas que eligieron esta zona como ubicación preferida, no su lugar real de residencia. Serie mensual de registros, incluidos los meses con cero. Hora de Colombia.',
  };
}
