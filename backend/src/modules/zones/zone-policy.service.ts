import { prisma } from '../../config/prisma.js';
import type { PrismaClient } from '../../generated/prisma/client.js';

export type ZoneLevel = 'MUNICIPALITY' | 'DEPARTMENT' | 'COUNTRY';
export type ZoneStatus = 'ACTIVE' | 'SCHEDULED' | 'CLOSED' | 'PAUSED';
export type EffectiveStatus = 'OPEN' | 'SCHEDULED' | 'CLOSED' | 'PAUSED';
export type PolicyZone = {
  id: string; key: string; level: string; name: string; department: string | null;
  status: string; opensAt: Date | null; countryCode: string;
};
type PolicyDatabase = { expansionZone?: Pick<PrismaClient['expansionZone'], 'findMany'> };
export type PublicLocality = { cityName?: string | null; regionName?: string | null;
  regionCode?: string | null; countryCode?: string | null } | null | undefined;

export function normalizeTerritory(value: unknown): string {
  return String(value ?? '').trim().toLocaleLowerCase('es-CO').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');
}
function cityKey(value: unknown) {
  const key = normalizeTerritory(value);
  return key === 'santiago de cali' ? 'cali' : key;
}
function departmentKey(value: unknown) {
  const key = normalizeTerritory(value);
  return ({ val: 'valle del cauca', valle: 'valle del cauca', '76': 'valle del cauca',
    'd.c.': 'bogota d.c.', 'bogota': 'bogota d.c.', '11': 'bogota d.c.' } as Record<string,string>)[key] ?? key;
}
export function zoneKey(level: ZoneLevel, name: string, department?: string | null) {
  if (level === 'COUNTRY') return 'co|country';
  if (level === 'DEPARTMENT') return 'co|department|' + departmentKey(name);
  return 'co|municipality|' + departmentKey(department) + '|' + cityKey(name);
}
export function effectiveStatus(zone: Pick<PolicyZone,'status'|'opensAt'>, now = new Date()): EffectiveStatus {
  if (zone.status === 'ACTIVE') return 'OPEN';
  if (zone.status === 'SCHEDULED') return zone.opensAt && zone.opensAt.getTime() <= now.getTime() ? 'OPEN' : 'SCHEDULED';
  return zone.status === 'PAUSED' ? 'PAUSED' : 'CLOSED';
}
export const PALMIRA: PolicyZone = {
  id:'initial-palmira', key:'co|municipality|valle del cauca|palmira',
  level:'MUNICIPALITY', name:'Palmira', department:'Valle del Cauca',
  countryCode:'CO', status:'ACTIVE', opensAt:null,
};

export async function readZonePolicy(db: PolicyDatabase = prisma): Promise<PolicyZone[]> {
  // Fixture databases may have no expansionZone delegate. Production always has it
  // after the schema migration; missing table/query errors must not open all Colombia.
  if (!db.expansionZone) return [PALMIRA];
  const rows = await db.expansionZone.findMany({
    select: { id:true, key:true, level:true, name:true, department:true, status:true,
      opensAt:true, countryCode:true },
  });
  return rows.length ? rows : [PALMIRA];
}
export function resolveLocalityPolicy(
  locality: {city?: string | null; department?: string | null; countryCode?: string | null},
  rows: PolicyZone[], now = new Date(),
) {
  const country=normalizeTerritory(locality.countryCode??'CO');
  if (country !== 'co')return { status:'CLOSED' as EffectiveStatus, zone:null as PolicyZone|null };
  const dept=departmentKey(locality.department),city=cityKey(locality.city);
  const byKey=new Map(rows.map(row=>[row.key,row]));
  let zone:PolicyZone|null=null;
  if (city && dept) zone=byKey.get(zoneKey('MUNICIPALITY',city,dept))??null;
  if (!zone && city && !dept) {
    // A municipality name without a department is acceptable only when unique.
    const matched=rows.filter(row=>row.level==='MUNICIPALITY'&&cityKey(row.name)===city);
    if(matched.length===1)zone=matched[0];
  }
  if(!zone && dept)zone=byKey.get(zoneKey('DEPARTMENT',dept))??null;
  if(!zone)zone=byKey.get(zoneKey('COUNTRY','Colombia'))??null;
  return { status:zone?effectiveStatus(zone,now):'CLOSED' as EffectiveStatus,zone };
}
export function isLocalityOpen(location: PublicLocality, rows: PolicyZone[], now = new Date()): boolean {
  if (!location)return false;
  const country=location.countryCode??'CO';
  return resolveLocalityPolicy({
    city:location.cityName,department:location.regionName || location.regionCode,
    countryCode:country,
  },rows,now).status==='OPEN';
}
export function isBusinessInActiveZone(
  business: {location?: PublicLocality; modalities?: Array<{type:string;status?:string}>},
  rows: PolicyZone[],now=new Date(),
):boolean {
  if(business.modalities?.some(m=>m.type==='VIRTUAL' && (m.status===undefined||m.status==='ACTIVE')))return true;
  return isLocalityOpen(business.location,rows,now);
}
export async function publicZoneAvailability(city:string,department:string){
  const now=new Date(),zones=await readZonePolicy();
  const result=resolveLocalityPolicy({city,department},zones,now);
  return { city, department, status:result.status, opensAt:result.status==='SCHEDULED'?
    result.zone?.opensAt?.toISOString()??null:null,
    coveredBy:result.zone?.level??null, virtualAvailable:true,serverTime:now.toISOString() };
}
export async function publicUpcomingZone(){
  const now=new Date(),zones=await readZonePolicy();
  const upcoming=zones.filter(zone=>zone.status==='SCHEDULED'&&zone.opensAt&&zone.opensAt>now)
    .sort((a,b)=>a.opensAt!.getTime()-b.opensAt!.getTime())[0];
  return { nextOpening:upcoming?{
    level:upcoming.level,name:upcoming.name,department:upcoming.department,
    opensAt:upcoming.opensAt!.toISOString(),
  }:null,serverTime:now.toISOString() };
}
