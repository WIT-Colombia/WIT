import { useEffect, useState } from 'react';
import { getNextZoneOpening, remainingUntil, subscribeZoneOpening, type NextZoneOpening } from '@wit/utils';
import { destinations } from './config/destinations';
import './ExpansionCountdown.css';

export function ExpansionCountdown(){
  const [opening,setOpening]=useState<NextZoneOpening|null>(null);
  const [offset,setOffset]=useState(0);
  const [now,setNow]=useState(Date.now());
  const [revision,setRevision]=useState(0);
  const [email,setEmail]=useState('');
  const [consent,setConsent]=useState(false);
  const [submitting,setSubmitting]=useState(false);
  const [subscriptionMessage,setSubscriptionMessage]=useState('');
  const [subscriptionError,setSubscriptionError]=useState('');
  useEffect(()=>{setSubscriptionMessage('');setSubscriptionError('');setEmail('');setConsent(false);},[opening?.key]);
  const subscribe=async(event:React.FormEvent<HTMLFormElement>)=>{
    event.preventDefault();
    if(!opening||!consent||submitting)return;
    setSubmitting(true);setSubscriptionError('');
    try{
      const result=await subscribeZoneOpening({zoneKey:opening.key,email,consent:true});
      setSubscriptionMessage(result.message);
      setEmail('');setConsent(false);
    }catch(error){setSubscriptionError(error instanceof Error?error.message:'No se pudo registrar el aviso.');}
    finally{setSubmitting(false);}
  };
  useEffect(()=>{
    const controller=new AbortController();
    getNextZoneOpening(controller.signal).then(result=>{
      setOffset(new Date(result.serverTime).getTime()-Date.now());
      setOpening(result.nextOpening);
    }).catch(()=>setOpening(null));
    return()=>controller.abort();
  },[revision]);
  useEffect(()=>{
    if(!opening)return;
    const timer=window.setInterval(()=>setNow(Date.now()),1000);
    return()=>window.clearInterval(timer);
  },[opening]);
  useEffect(()=>{
    if(opening&&remainingUntil(opening.opensAt,offset,now).done)setRevision(value=>value+1);
  },[opening,offset,now]);
  if(!opening)return null;
  const remaining=remainingUntil(opening.opensAt,offset,now);
  if(remaining.done)return null;
  const label=opening.level==='COUNTRY'?'Colombia':opening.name;
  const units=[
    ['Días',remaining.days],['Horas',remaining.hours],
    ['Minutos',remaining.minutes],['Segundos',remaining.seconds],
  ] as const;
  const date=new Date(opening.opensAt).toLocaleString('es-CO',{
    day:'numeric',month:'long',year:'numeric',hour:'numeric',minute:'2-digit',
    hour12:true,timeZone:'America/Bogota',
  });
  return <section className="expansion-countdown" aria-labelledby="expansion-countdown-title">
    <div className="expansion-countdown__halo" aria-hidden="true"/>
    <div className="expansion-countdown__left">
      <span className="expansion-countdown__eyebrow"><span/> PRÓXIMA APERTURA</span>
      <h2 id="expansion-countdown-title">¡XAMUKO llega a <em>{label}</em>!</h2>
      <p>La comunidad XAMUKO está creciendo. Muy pronto podrás descubrir negocios y servicios locales en {label}.</p>
      <p className="expansion-countdown__date">Apertura prevista: <strong>{date} (Colombia)</strong></p>
      <div className="expansion-countdown__actions">
        <a href={destinations.businessRegister} className="expansion-countdown__primary">Registra tu negocio <span aria-hidden="true">↗</span></a>
        <a href={destinations.explore} className="expansion-countdown__secondary">Explorar XAMUKO <span aria-hidden="true">→</span></a>
      </div>
    </div>
    <div className="expansion-countdown__right">
      <span className="expansion-countdown__right-kicker">ESTAREMOS DISPONIBLES EN</span>
      <div className="expansion-countdown__digits" role="timer" aria-label={'Tiempo para el lanzamiento de '+label} aria-live="off">
        {units.map(([unit,value])=><div key={unit} className="expansion-countdown__digit">
          <strong>{String(value).padStart(2,'0')}</strong><span>{unit}</span></div>)}
      </div>
      <p>Desde ya puedes registrarte y explorar negocios virtuales de toda Colombia.</p>
      <form className="expansion-countdown__signup" onSubmit={subscribe}>
        <label htmlFor="launch-alert-email">¿Quieres que te avisemos cuando abramos?</label>
        <div className="expansion-countdown__email-row">
          <input id="launch-alert-email" type="email" autoComplete="email" required maxLength={320}
            value={email} onChange={e=>setEmail(e.target.value)}
            placeholder="Tu correo electrónico" aria-label="Correo para recibir aviso de apertura"/>
          <button type="submit" disabled={submitting||!consent||!email.trim()}>
            {submitting?'Enviando…':'Avísame'}
          </button>
        </div>
        <label className="expansion-countdown__consent">
          <input type="checkbox" checked={consent} required onChange={e=>setConsent(e.target.checked)}/>
          <span>Acepto recibir un correo de confirmación y un aviso sobre esta apertura. Consulta la <a href={destinations.privacy}>política de tratamiento de datos</a>. Podré cancelar el aviso.</span>
        </label>
        {subscriptionMessage&&<p className="expansion-countdown__signup-ok" role="status">{subscriptionMessage}</p>}
        {subscriptionError&&<p className="expansion-countdown__signup-error" role="alert">{subscriptionError}</p>}
      </form>
    </div>
  </section>;
}
