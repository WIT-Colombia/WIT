import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getZoneAvailability, remainingUntil, type ZoneAvailability } from '@wit/utils';
import './ZoneLaunchNotice.css';

export function ZoneLaunchNotice({city,department}:{city:string|null|undefined;department?:string|null}){
  const [result,setResult]=useState<{key:string;data:ZoneAvailability}|null>(null);
  const [offset,setOffset]=useState(0);
  const [clock,setClock]=useState(Date.now());
  const [reload,setReload]=useState(0);
  const key=(city||'').trim()+'|'+(department||'').trim();
  useEffect(()=>{
    if(!city){setResult(null);return;}
    const controller=new AbortController();
    setResult(null);
    getZoneAvailability(city,department??'',controller.signal).then(data=>{
      setOffset(new Date(data.serverTime).getTime()-Date.now());
      setResult({key,data});
    }).catch(()=>setResult(null));
    return()=>controller.abort();
  },[key,reload]);
  useEffect(()=>{
    if(result?.data.status!=='SCHEDULED')return;
    const id=window.setInterval(()=>setClock(Date.now()),1000);
    return()=>clearInterval(id);
  },[result]);
  const availability=result?.key===key?result.data:null;
  const remaining=availability?.opensAt?remainingUntil(availability.opensAt,offset,clock):null;
  useEffect(()=>{
    if(availability?.status==='SCHEDULED'&&remaining?.done)setReload(n=>n+1);
  },[availability?.status,availability?.opensAt,remaining?.done]);
  if(!availability||availability.status==='OPEN')return null;
  const name=availability.city;
  const isScheduled=availability.status==='SCHEDULED'&&availability.opensAt&&remaining&&!remaining.done;
  return <section className="zone-launch-notice" aria-label={'Disponibilidad de XAMUKO en '+name}>
    <div className="zone-launch-notice__icon" aria-hidden="true">⌖</div>
    <div className="zone-launch-notice__copy">
      <span>EXPANSIÓN XAMUKO</span>
      <h2>{availability.status==='PAUSED'?'La exploración local está temporalmente pausada en '+name:
        isScheduled?'¡XAMUKO llega pronto a '+name+'!':'XAMUKO llegará próximamente a '+name}</h2>
      <p>Ya puedes registrarte desde cualquier ciudad y descubrir negocios virtuales de toda Colombia.</p>
      {isScheduled&&<><strong className="zone-launch-notice__label">Estaremos disponibles en:</strong>
        <div className="zone-launch-notice__countdown" role="timer" aria-live="off">
          {([['Días',remaining.days],['Horas',remaining.hours],['Minutos',remaining.minutes],['Segundos',remaining.seconds]] as const).map(([label,value])=>
            <span key={label}><b>{String(value).padStart(2,'0')}</b><small>{label}</small></span>)}
        </div>
        <small className="zone-launch-notice__date">Apertura: {new Date(availability.opensAt!).toLocaleString('es-CO',{dateStyle:'long',timeStyle:'short',timeZone:'America/Bogota'})} (Colombia)</small>
      </>}
      <div className="zone-launch-notice__actions">
        <Link to="/results?scope=virtual">Explorar negocios virtuales <span aria-hidden="true">→</span></Link>
        <Link to="/location">Elegir otra ciudad</Link>
      </div>
    </div>
  </section>;
}
