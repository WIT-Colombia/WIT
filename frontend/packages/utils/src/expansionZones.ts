import { buildApiUrl } from './api';

export type ZoneAvailability = {
  city:string;department:string;status:'OPEN'|'SCHEDULED'|'CLOSED'|'PAUSED';
  opensAt:string|null;coveredBy:string|null;virtualAvailable:true;serverTime:string;
};
export type NextZoneOpening = {
  level:'MUNICIPALITY'|'DEPARTMENT'|'COUNTRY';
  name:string;department:string|null;opensAt:string;
};
export type UpcomingZoneResponse = {nextOpening:NextZoneOpening|null;serverTime:string};

async function zoneGet<T>(path:string,signal?:AbortSignal):Promise<T>{
  const response=await fetch(buildApiUrl(path),{cache:'no-store',signal,
    headers:{Accept:'application/json'}});
  if(!response.ok)throw new Error('No se pudo consultar la cobertura territorial.');
  return response.json() as Promise<T>;
}
/** The landing and Usuario use the same authoritative API, never hard-coded launch dates. */
export function getNextZoneOpening(signal?:AbortSignal){
  return zoneGet<UpcomingZoneResponse>('/public/zones/next',signal);
}
export function getZoneAvailability(city:string,department='',signal?:AbortSignal){
  const q=new URLSearchParams({city,department});
  return zoneGet<ZoneAvailability>('/public/zones/availability?'+q,signal);
}
export function remainingUntil(iso:string,serverOffsetMs=0,now=Date.now()){
  const ms=Math.max(0,new Date(iso).getTime()-(now+serverOffsetMs));
  const seconds=Math.floor(ms/1000);
  return {days:Math.floor(seconds/86400),hours:Math.floor(seconds%86400/3600),
    minutes:Math.floor(seconds%3600/60),seconds:seconds%60,done:ms<=0};
}
