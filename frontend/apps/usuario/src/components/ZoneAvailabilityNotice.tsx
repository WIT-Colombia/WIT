import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { buildApiUrl } from '@wit/utils';
import './ZoneAvailabilityNotice.css';

type ZoneStatus={code?:string;city:string;region:string|null;state:'OPEN'|'CLOSED'|'SCHEDULED'|'PAUSED'|'UNKNOWN';
  opensAt:string|null;timezone:string;virtualAvailable:boolean};
const part=(n:number)=>String(n).padStart(2,'0');
function timeParts(date:string,now:number){
  const seconds=Math.max(0,Math.floor((new Date(date).getTime()-now)/1000));
  return [Math.floor(seconds/86400),Math.floor(seconds%86400/3600),Math.floor(seconds%3600/60),seconds%60];
}
export function ZoneAvailabilityNotice({city,region}:{city:string;region?:string|null}){
  const [data,setData]=useState<ZoneStatus|null>(null);
  const [clock,setClock]=useState(Date.now());
  const [offset,setOffset]=useState(0);
  const [attempt,setAttempt]=useState(0);
  const [email,setEmail]=useState('');
  const [consent,setConsent]=useState(false);
  const [sendStatus,setSendStatus]=useState<'ready'|'sending'|'success'|'error'>('ready');
  const [sendError,setSendError]=useState('');
  const subscribe=async(event:FormEvent)=>{
    event.preventDefault();
    if(!data?.code||!consent||sendStatus==='sending')return;
    setSendStatus('sending');setSendError('');
    try{
      const response=await fetch(buildApiUrl('/public/zones/alerts'),{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({scope:'MUNICIPALITY',code:data.code,email,consent}),
      });
      if(!response.ok)throw new Error('No pudimos registrar el aviso. Inténtalo nuevamente.');
      setSendStatus('success');
    }catch(e){setSendStatus('error');setSendError(e instanceof Error?e.message:'No pudimos registrar el aviso.');}
  };
  useEffect(()=>{setSendStatus('ready');setEmail('');setConsent(false);},[city,region]);
  useEffect(()=>{
    const abort=new AbortController();
    const start=Date.now();setData(null);
    const query=new URLSearchParams({city,...(region?{region}:{})});
    void fetch(buildApiUrl('/public/zones/status?'+query),{signal:abort.signal,cache:'no-store'})
      .then(async r=>{if(!r.ok)throw new Error('Unavailable');return r.json() as Promise<{zone:ZoneStatus;serverTime:string}>;})
      .then(result=>{if(abort.signal.aborted)return;
        const server=new Date(result.serverTime).getTime();
        if(Number.isFinite(server))setOffset(server-(start+Date.now())/2);
        setData(result.zone);
      }).catch(()=>{if(!abort.signal.aborted)setData(null);});
    return()=>abort.abort();
  },[city,region,attempt]);
  useEffect(()=>{
    const tick=window.setInterval(()=>setClock(Date.now()),1000);
    const poll=window.setInterval(()=>setAttempt(x=>x+1),60000);
    return()=>{window.clearInterval(tick);window.clearInterval(poll);};
  },[]);
  useEffect(()=>{
    if(data?.state==='SCHEDULED'&&data.opensAt&&new Date(data.opensAt).getTime()<=clock+offset){
      setData(null);setAttempt(n=>n+1);
    }
  },[clock,data,offset]);
  if(!data || data.state==='OPEN'||data.state==='UNKNOWN')return null;
  const scheduled=data.state==='SCHEDULED'&&data.opensAt;
  const units=scheduled?timeParts(data.opensAt!,clock+offset):null;
  return <section className="zone-availability-card" aria-labelledby="zone-availability-heading">
    <div className="zone-availability-card__intro"><span className="zone-availability-card__eyebrow">{scheduled?'PRÓXIMA APERTURA':'EXPANSIÓN TERRITORIAL'}</span>
      <h2 id="zone-availability-heading">{scheduled?'¡XAMUKO llegará pronto a '+data.city+'!':
        data.state==='PAUSED'?'La exploración en '+data.city+' está pausada':'Pronto estaremos en '+data.city}</h2>
      <p>{scheduled?'Estamos preparando nuevos negocios y experiencias para tu ciudad.':
        'Todavía no está habilitada la exploración de negocios físicos en esta zona.'} Puedes seguir explorando negocios virtuales de toda Colombia.</p>
      <Link className="zone-availability-card__action" to="/results?scope=virtual">Explorar negocios virtuales <span aria-hidden="true">→</span></Link>
      <div className="zone-availability-card__alert">{sendStatus==='success'?<p role="status">Revisa tu correo y confirma tu solicitud. Te avisaremos cuando se abra esta zona.</p>:
        <form onSubmit={subscribe}><strong>¿Quieres que te avisemos cuando lleguemos?</strong>
          <div className="zone-availability-card__alert-row"><label className="sr-only" htmlFor="zone-email">Correo electrónico</label>
            <input id="zone-email" type="email" autoComplete="email" required maxLength={320}
              value={email} onChange={e=>setEmail(e.target.value)} placeholder="Correo electrónico"/>
            <button type="submit" disabled={!consent||sendStatus==='sending'}>{sendStatus==='sending'?'Enviando…':'Avisarme'}</button></div>
          <label className="zone-availability-card__alert-consent"><input type="checkbox" checked={consent} required onChange={e=>setConsent(e.target.checked)}/>
            <span>Autorizo el uso de mi correo solo para este aviso de apertura. <Link to="/legal/privacy">Privacidad</Link>.</span>
          </label>{sendError&&<p className="zone-availability-card__alert-error" role="alert">{sendError}</p>}
        </form>}</div>
    </div>
    <div className="zone-availability-card__timer">
      {units?<><span>ESTAREMOS DISPONIBLES EN</span>
        <div className="zone-availability-card__digits" role="timer" aria-label={'Cuenta regresiva para '+data.city}>
          {units.map((value,index)=><div key={index}><strong>{index===0?value:part(value)}</strong>
            <small>{['Días','Horas','Min','Seg'][index]}</small></div>)}
        </div><small>La fecha se actualiza automáticamente desde XAMUKO.</small></>:
        <><strong className="zone-availability-card__soon">{data.state==='PAUSED'?'Temporalmente no disponible':'Próximamente'}</strong>
        <small>Todavía no hay una fecha de apertura programada.</small></>}
    </div>
  </section>;
}
