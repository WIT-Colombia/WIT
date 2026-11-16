import { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';
import type { AdminContext } from '../admin/admin-auth.service.js';
import { colombiaCatalog } from './colombia-catalog.js';

export type ZoneScope = 'MUNICIPALITY' | 'DEPARTMENT';
export type ZoneLaunchState = 'CLOSED' | 'SCHEDULED' | 'OPEN' | 'PAUSED';
export type ZoneRecord = {
  scope: ZoneScope; code: string; state: ZoneLaunchState; opensAt: Date | null;
};
type EffectiveState = 'CLOSED' | 'SCHEDULED' | 'OPEN' | 'PAUSED';
const palmiraCode = '76520';
const catalog = colombiaCatalog;
const colombiaNow = () => new Date();
export function normalizePlace(value: string | undefined | null): string {
  return (value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-CO').trim();
}
const normalizedCity = (value: string) => normalizePlace(value).replace(/^santiago de cali$/, 'cali');
const aliases = (name: string) => name === 'Santiago de Cali' ? ['Santiago de Cali','Cali'] : [name];
const regionCodeAliases = (code: string) =>
  code === '76' ? ['76','VAL'] : [code];
const regionMatch = (code: string): Prisma.BusinessLocationWhereInput => {
  const department = catalog.departments.find(item => item.code === code);
  return { OR: [
    ...(department ? [{ regionName: department.name }] : []),
    { regionCode: { in: regionCodeAliases(code) } },
  ] };
};
function municipality(code: string) { return catalog.municipalities.find(item => item.id === code); }
function department(code: string) { return catalog.departments.find(item => item.code === code); }
function explicitStatus(record: ZoneRecord | undefined, now: Date): EffectiveState | null {
  if (!record) return null;
  if (record.state === 'SCHEDULED' && record.opensAt && record.opensAt <= now) return 'OPEN';
  return record.state;
}
export function zoneState(scope: ZoneScope, code: string, records: ZoneRecord[], now = colombiaNow()) {
  const own = records.find(r => r.scope === scope && r.code === code);
  const direct = explicitStatus(own, now);
  if (direct) return { state: direct, opensAt: direct === 'SCHEDULED' ? own!.opensAt?.toISOString() ?? null : null, source: 'DIRECT' as const };
  if (scope === 'MUNICIPALITY') {
    const item = municipality(code);
    const parent = item && records.find(r => r.scope === 'DEPARTMENT' && r.code === item.departmentCode);
    const inherited = explicitStatus(parent, now);
    if (inherited) return { state: inherited, opensAt: inherited === 'SCHEDULED' ? parent!.opensAt?.toISOString() ?? null : null, source: 'DEPARTMENT' as const };
    if (code === palmiraCode) return { state: 'OPEN' as const, opensAt: null, source: 'INITIAL' as const };
  }
  return { state: 'CLOSED' as const, opensAt: null, source: 'DEFAULT' as const };
}
export function releaseWhere(records: ZoneRecord[], now = colombiaNow()): Prisma.BusinessWhereInput {
  const activeDepartments = catalog.departments.filter(d => zoneState('DEPARTMENT',d.code,records,now).state === 'OPEN');
  const activeCities = catalog.municipalities.filter(m => zoneState('MUNICIPALITY',m.id,records,now).state === 'OPEN');
  const conditions: Prisma.BusinessLocationWhereInput[] = [];
  for (const dep of activeDepartments) {
    const blocked = catalog.municipalities.filter(m => m.departmentCode === dep.code &&
      zoneState('MUNICIPALITY',m.id,records,now).state !== 'OPEN').map(m => ({
        cityName: { in: aliases(m.name) },
      } satisfies Prisma.BusinessLocationWhereInput));
    conditions.push({ AND: [regionMatch(dep.code),...(blocked.length ? [{ NOT: { OR: blocked } }] : [])] });
  }
  for (const city of activeCities) {
    if (activeDepartments.some(dep => dep.code === city.departmentCode)) continue;
    conditions.push({ AND: [
      { cityName: { in: aliases(city.name) } },
      regionMatch(city.departmentCode),
    ] });
  }
  return { OR: [
    { modalities: { some: { type: 'VIRTUAL', status: 'ACTIVE' } } },
    { location: { is: { countryCode: 'CO', OR: conditions } } },
  ] };
}
export async function publicReleaseWhere(now = colombiaNow()) {
  const records = await prisma.zoneLaunch.findMany({ select: {
    scope: true, code: true, state: true, opensAt: true,
  } });
  return releaseWhere(records, now);
}
export async function publicZoneStatus(input: { city: string; region?: string }) {
  const records = await prisma.zoneLaunch.findMany({ select: { scope: true, code: true, state: true, opensAt: true } });
  const city = catalog.municipalities.find(item =>
    normalizedCity(item.name) === normalizedCity(input.city) &&
    (!input.region || normalizePlace(item.context) === normalizePlace(input.region)));
  if (!city) return { city: input.city, region: input.region ?? null,
    state: 'UNKNOWN', opensAt: null, timezone: 'America/Bogota', virtualAvailable: true };
  const result = zoneState('MUNICIPALITY',city.id,records);
  return { code: city.id, city: city.name, region: city.context, ...result,
    timezone: 'America/Bogota', virtualAvailable: true };
}
export async function nextPublicZoneLaunch() {
  const now = colombiaNow();
  const records = await prisma.zoneLaunch.findMany({
    where: { state: 'SCHEDULED', opensAt: { gt: now } },
    select: { scope: true, code: true, state: true, opensAt: true },
    orderBy: [{ opensAt: 'asc' }, { code: 'asc' }],
  });
  const all = await prisma.zoneLaunch.findMany({ select: { scope: true, code: true, state: true, opensAt: true } });
  for(const candidate of records) {
    // Do not announce an inherited department launch when that locality is explicitly closed.
    if(candidate.scope === 'DEPARTMENT'){
      const dep = department(candidate.code);
      if (!dep) continue;
      const hasClosedMun = catalog.municipalities.some(m => m.departmentCode===dep.code &&
        zoneState('MUNICIPALITY',m.id,all,now).state==='CLOSED');
      if(hasClosedMun) { /* Announcement remains valid for the department's other municipalities. */ }
    }
    const effective = zoneState(candidate.scope,candidate.code,all,now);
    if(effective.state !== 'SCHEDULED' || !candidate.opensAt)continue;
    const name = candidate.scope === 'MUNICIPALITY' ? municipality(candidate.code)?.name : department(candidate.code)?.name;
    if (!name) continue;
    return { scope: candidate.scope, code:candidate.code, name, opensAt: candidate.opensAt.toISOString(),
      timezone:'America/Bogota' };
  }
  return null;
}
export async function adminZoneRegistry(context: AdminContext) {
  if(context.role !== 'SUPER_ADMIN') throw new AppError(403,'ZONE_SUPER_ADMIN_REQUIRED','Solo SUPER_ADMIN administra la expansión territorial.');
  const [records, locations, audit] = await Promise.all([
    prisma.zoneLaunch.findMany({ orderBy: [{ updatedAt: 'desc' }, { code: 'asc' }] }),
    prisma.business.findMany({ select: { location: { select: { cityName: true, regionName: true, countryCode: true } },
      lifecycleStatus: true, publicationStatus: true, visibilityStatus: true, deletionStatus: true,
      businessAccount: { select: { status: true } } } }),
    prisma.auditLog.findMany({ where: { entityType: 'ZONE' }, orderBy: [{ createdAt: 'desc' }],
      take: 75, select: { id: true, action: true, reason: true, createdAt: true, entityId: true,
        previousState: true, newState: true, actor: { select: { displayName: true } } } }),
  ]);
  const live = records.map(r => ({scope:r.scope,code:r.code,state:r.state,opensAt:r.opensAt}));
  const cityTotals = new Map<string,{registered:number;ready:number}>();
  for(const business of locations){
    const place=business.location;
    if(!place || place.countryCode!=='CO')continue;
    const city=catalog.municipalities.find(m => normalizedCity(m.name)===normalizedCity(place.cityName)
      && normalizePlace(m.context)===normalizePlace(place.regionName));
    if(!city)continue;
    const stats=cityTotals.get(city.id)??{registered:0,ready:0};
    stats.registered++;
    if(business.lifecycleStatus==='ACTIVE'&&business.publicationStatus==='PUBLISHED'&&
      business.visibilityStatus==='VISIBLE'&&business.deletionStatus==='NONE'&&business.businessAccount.status==='ACTIVE')stats.ready++;
    cityTotals.set(city.id,stats);
  }
  const municipalities=catalog.municipalities.map(m=>({
    ...m,...zoneState('MUNICIPALITY',m.id,live),configured:live.some(r=>r.scope==='MUNICIPALITY'&&r.code===m.id),
    registered:cityTotals.get(m.id)?.registered??0,ready:cityTotals.get(m.id)?.ready??0,
  }));
  const departments=catalog.departments.map(d=>({
    ...d,...zoneState('DEPARTMENT',d.code,live),
    configured:live.some(r=>r.scope==='DEPARTMENT'&&r.code===d.code),
    registered:municipalities.filter(m=>m.departmentCode===d.code).reduce((n,m)=>n+m.registered,0),
    ready:municipalities.filter(m=>m.departmentCode===d.code).reduce((n,m)=>n+m.ready,0),
  }));
  return {municipalities,departments,records,audit,serverTime:new Date().toISOString(),
    nextLaunch:await nextPublicZoneLaunch(),
    summary: {
      municipalitiesActive:municipalities.filter(m=>m.state==='OPEN').length,
      municipalitiesScheduled:municipalities.filter(m=>m.state==='SCHEDULED').length,
      municipalitiesClosed:municipalities.filter(m=>m.state==='CLOSED'||m.state==='PAUSED').length,
      registered:municipalities.reduce((n,m)=>n+m.registered,0),
      ready:municipalities.reduce((n,m)=>n+m.ready,0),
    },
  };
}
export async function decideZone(context:AdminContext,input:{
  scope: ZoneScope; code:string; state:ZoneLaunchState; opensAt?:string|null; reason:string;
}){
  if(context.role!=='SUPER_ADMIN')throw new AppError(403,'ZONE_SUPER_ADMIN_REQUIRED','Solo SUPER_ADMIN puede programar aperturas.');
  const entity=input.scope==='DEPARTMENT'?department(input.code):municipality(input.code);
  if(!entity)throw new AppError(400,'INVALID_ZONE','La zona debe existir en el catálogo oficial colombiano.');
  const reason=input.reason.trim();
  if(reason.length<12||reason.length>500)throw new AppError(400,'ZONE_REASON_REQUIRED','Escribe un motivo de 12 a 500 caracteres.');
  const date=input.state==='SCHEDULED'&&input.opensAt?new Date(input.opensAt):null;
  if(input.state==='SCHEDULED'&&(!date||!Number.isFinite(date.getTime())||date<=new Date()))
    throw new AppError(400,'ZONE_INVALID_SCHEDULE','Selecciona una fecha futura de apertura en hora de Colombia.');
  if(input.state!=='SCHEDULED'&&input.opensAt)throw new AppError(400,'ZONE_INVALID_SCHEDULE','La fecha solo se utiliza cuando la apertura está programada.');
  const name=input.scope==='DEPARTMENT'? (entity as {name:string}).name:(entity as {name:string}).name;
  return prisma.$transaction(async tx=>{
    const previous=await tx.zoneLaunch.findUnique({where:{scope_code:{scope:input.scope,code:input.code}}});
    const record=await tx.zoneLaunch.upsert({
      where:{scope_code:{scope:input.scope,code:input.code}},
      create:{scope:input.scope,code:input.code,name,state:input.state,opensAt:date,updatedById:context.userId},
      update:{name,state:input.state,opensAt:date,updatedById:context.userId},
    });
    await tx.auditLog.create({data:{actorUserId:context.userId,entityType:'ZONE',entityId:record.id,
      action:'ZONE_'+input.state,reason,
      previousState:previous?{scope:previous.scope,code:previous.code,state:previous.state,opensAt:previous.opensAt?.toISOString()??null}:Prisma.JsonNull,
      newState:{scope:record.scope,code:record.code,state:record.state,opensAt:record.opensAt?.toISOString()??null}}});
    return record;
  });
}
