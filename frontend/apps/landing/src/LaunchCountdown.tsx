import { useEffect, useState } from 'react';
import { apiBaseUrl } from './config/publicUrls';
import { destinations } from './config/destinations';
import './LaunchCountdown.css';

type Launch={scope:'MUNICIPALITY'|'DEPARTMENT';code:string;name:string;opensAt:string;timezone:string};
const pad=(n:number)=>String(n).padStart(2,'0');
function remaining(iso:string,at:number){
  const seconds=Math.max(0,Math.floor((new Date(iso).getTime()-at)/1000));
  return [Math.floor(seconds/86400),Math.floor(seconds%86400/3600),
    Math.floor(seconds%3600/60),seconds%60];
}
export function LaunchCountdown(){
  const [next,setNext]=useState<Launch|null>(null);
  const [stamp,setStamp]=useState(Date.now());
  const [delta,setDelta]=useState(0);
  const [refresh,setRefresh]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();
    const started=Date.now();
    void fetch(apiBaseUrl+'/public/zones/next-launch',{signal:controller.signal,cache:'no-store'})
      .then(async response=>{if(!response.ok)throw new Error('Consulta no disponible');
        return response.json() as Promise<{next:Launch|null;serverTime:string}>;})
      .then(value=>{if(controller.signal.aborted)return;
        const serverDate=new Date(value.serverTime).getTime();
        if(Number.isFinite(serverDate))setDelta(serverDate-(Date.now()+started)/2);
        setNext(value.next??null);
      }).catch(()=>{if(!controller.signal.aborted)setNext(null);});
    return()=>controller.abort();
  },[refresh]);
  useEffect(()=>{
    const timer=window.setInterval(()=>setStamp(Date.now()),1000);
    const poll=window.setInterval(()=>setRefresh(x=>x+1),60000);
    return()=>{window.clearInterval(timer);window.clearInterval(poll);};
  },[]);
  useEffect(()=>{
    if(next&&new Date(next.opensAt).getTime()<=stamp+delta){
      setNext(null);setRefresh(x=>x+1);
    }
  },[next,stamp,delta]);
  if(!next)return null;
  const segments=remaining(next.opensAt,stamp+delta);
  const starts=new Date(next.opensAt).toLocaleString('es-CO',{
    timeZone:'America/Bogota',dateStyle:'long',timeStyle:'short',
  });
  return <section className="landing-launch" aria-labelledby="landing-launch-title">
    <div className="landing-launch__copy"><span className="landing-launch__eyebrow"><span className="landing-launch__pulse" aria-hidden="true"/> PRÓXIMA APERTURA</span>
      <h2 id="landing-launch-title">¡XAMUKO llega a <span>{next.name}</span>!</h2>
      <p>Estamos preparando una nueva etapa para conectar más personas y negocios. La cuenta regresiva ya comenzó.</p>
      <small>Apertura programada: {starts} (Colombia)</small>
      <div className="landing-launch__actions"><a className="landing-launch__main" href={destinations.businessRegister}>
        Registra tu negocio <span aria-hidden="true">→</span></a>
        <a className="landing-launch__secondary" href={destinations.explore}>Explora opciones virtuales</a></div>
    </div>
    <div className="landing-launch__timer" role="timer" aria-label={'Tiempo hasta la apertura de '+next.name}>
      <p>ESTAREMOS DISPONIBLES EN</p>
      <div className="landing-launch__digits">{segments.map((value,index)=><div key={index} className="landing-launch__digit">
        <strong>{index===0?value:pad(value)}</strong>
        <small>{['Días','Horas','Minutos','Segundos'][index]}</small>
      </div>)}</div>
      <span>Crece con XAMUKO, desde cualquier lugar de Colombia.</span>
    </div>
  </section>;
}
