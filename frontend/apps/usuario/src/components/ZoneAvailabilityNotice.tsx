import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { buildApiUrl } from '@wit/utils';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../services/httpClient';
import {
  getZoneAlert, savePendingZoneAlert, subscribeZoneAlert, unsubscribeZoneAlert, ZONE_ALERT_CHANGED,
} from '../services/zoneAlertService';
import './ZoneAvailabilityNotice.css';

type ZoneStatus = {
  code?: string; city: string; region: string | null;
  state: 'OPEN' | 'CLOSED' | 'SCHEDULED' | 'PAUSED' | 'UNKNOWN';
  opensAt: string | null; timezone: string; virtualAvailable: boolean;
};
const part = (n: number) => String(n).padStart(2, '0');
function timeParts(date: string, now: number) {
  const seconds = Math.max(0, Math.floor((new Date(date).getTime() - now) / 1000));
  return [Math.floor(seconds / 86400), Math.floor(seconds % 86400 / 3600), Math.floor(seconds % 3600 / 60), seconds % 60];
}
function BellIcon({ active }: { active: boolean }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z"/>
    <path d="M10 21h4M12 2V1"/>
    {active && <path d="m8 11 3 3 5-5" strokeWidth="2"/>}
  </svg>;
}

export function ZoneAvailabilityNotice({ city, region }: { city: string; region?: string | null }) {
  const navigate = useNavigate();
  const { status, isAuthenticated } = useAuth();
  const [data, setData] = useState<ZoneStatus | null>(null);
  const [clock, setClock] = useState(Date.now());
  const [offset, setOffset] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [revision, setRevision] = useState(0);
  const [subscription, setSubscription] = useState<'off' | 'on' | 'checking' | 'unavailable'>('off');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const abort = new AbortController();
    const start = Date.now();
    setData(null);
    const query = new URLSearchParams({ city, ...(region ? { region } : {}) });
    void fetch(buildApiUrl('/public/zones/status?' + query), { signal: abort.signal, cache: 'no-store' })
      .then(async r => { if (!r.ok) throw new Error('Unavailable'); return r.json() as Promise<{ zone: ZoneStatus; serverTime: string }>; })
      .then(result => {
        if (abort.signal.aborted) return;
        const server = new Date(result.serverTime).getTime();
        if (Number.isFinite(server)) setOffset(server - (start + Date.now()) / 2);
        setData(result.zone);
      }).catch(() => { if (!abort.signal.aborted) setData(null); });
    return () => abort.abort();
  }, [city, region, attempt]);

  useEffect(() => {
    if (!data?.code || !isAuthenticated) { setSubscription('off'); return; }
    let active = true;
    setSubscription('checking');
    void getZoneAlert(data.code)
      .then(result => { if (active) setSubscription(result.subscribed ? 'on' : 'off'); })
      .catch(() => {
        // La API aún no desplegada puede responder 404; no mostrar errores técnicos
        // ni confundirlo con una suscripción realmente confirmada.
        if (active) setSubscription('unavailable');
      });
    return () => { active = false; };
  }, [data?.code, isAuthenticated, revision]);

  useEffect(() => {
    const refresh = () => setRevision(v => v + 1);
    window.addEventListener(ZONE_ALERT_CHANGED, refresh);
    return () => window.removeEventListener(ZONE_ALERT_CHANGED, refresh);
  }, []);
  useEffect(() => {
    const tick = window.setInterval(() => setClock(Date.now()), 1000);
    const poll = window.setInterval(() => setAttempt(x => x + 1), 60000);
    return () => { window.clearInterval(tick); window.clearInterval(poll); };
  }, []);
  useEffect(() => {
    if (data?.state === 'SCHEDULED' && data.opensAt && new Date(data.opensAt).getTime() <= clock + offset) {
      setData(null); setAttempt(n => n + 1);
    }
  }, [clock, data, offset]);

  async function toggle() {
    if (!data?.code || busy || subscription === 'checking' || subscription === 'unavailable' || status === 'loading') return;
    if (!isAuthenticated) {
      savePendingZoneAlert(data.code, data.city);
      navigate('/register');
      return;
    }
    setBusy(true);
    try {
      if (subscription === 'on') {
        await unsubscribeZoneAlert(data.code);
        setSubscription('off');
      } else {
        await subscribeZoneAlert(data.code);
        setSubscription('on');
      }
    } catch (caught) {
      // No presentar mensajes técnicos cuando el backend todavía no tiene la ruta.
      // Una suscripción fallida nunca debe mostrarse como activada.
      if (caught instanceof ApiError && (caught.status === 404 || caught.status === 503)) {
        setSubscription('unavailable');
      }
    } finally { setBusy(false); }
  }

  if (!data || data.state === 'OPEN' || data.state === 'UNKNOWN') return null;
  const scheduled = data.state === 'SCHEDULED' && data.opensAt;
  const units = scheduled ? timeParts(data.opensAt!, clock + offset) : null;
  const active = subscription === 'on';
  return <section className="zone-availability-card" aria-labelledby="zone-availability-heading">
    <span className="zone-availability-card__eyebrow">{scheduled ? 'PRÓXIMA APERTURA' : 'EXPANSIÓN TERRITORIAL'}</span>
    <h2 id="zone-availability-heading">{scheduled ? '¡XAMUKO llegará pronto a ' + data.city + '!' :
      data.state === 'PAUSED' ? 'La exploración en ' + data.city + ' está pausada' : 'Pronto estaremos en ' + data.city}</h2>
    <p>Todavía no está habilitada la exploración de negocios físicos en esta zona. Puedes seguir explorando negocios virtuales de toda Colombia.</p>
    <Link className="zone-availability-card__action" to="/results?scope=virtual">Explorar negocios virtuales <span aria-hidden="true">→</span></Link>
    <div className="zone-availability-card__divider" aria-hidden="true" />
    <strong className="zone-availability-card__question">¿Quieres que te avisemos cuando lleguemos?</strong>
    <button className="zone-availability-card__notify" type="button" onClick={() => { void toggle(); }}
      disabled={busy || subscription === 'checking' || subscription === 'unavailable' || status === 'loading' || !data.code}
      aria-pressed={active} title={active ? 'Pulsa para cancelar este aviso' : undefined}>
      <BellIcon active={active}/><span>{busy ? 'Actualizando…' : subscription === 'checking' ? 'Comprobando…' :
        active ? 'Notificación activada' : 'Notificarme cuando lleguen'}</span>
    </button>
    {active && <p className="zone-availability-card__confirmed" role="status">
      <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2">
        <circle cx="12" cy="12" r="9"/><path d="m8 12 2.6 2.6L16.5 9"/>
      </svg>
      <span><strong>¡Notificación activada!</strong> Te avisaremos en Xamuko cuando habilitemos {data.city}.</span>
    </p>}
    {units && <div className="zone-availability-card__countdown" role="timer" aria-label={'Tiempo hasta la apertura de ' + data.city}>
      <span>Abriremos en</span>
      <div>{units.map((n, i) => <span key={i}><b>{i === 0 ? n : part(n)}</b> {['días', 'h', 'min', 's'][i]}</span>)}</div>
    </div>}
  </section>;
}
