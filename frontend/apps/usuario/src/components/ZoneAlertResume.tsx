import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../services/httpClient';
import {
  clearPendingZoneAlert, readPendingZoneAlert, subscribeZoneAlert, ZONE_ALERT_CHANGED,
} from '../services/zoneAlertService';

/** Completa la suscripción solicitada antes del registro, después del login, Google o verificación. */
export function ZoneAlertResume() {
  const { isAuthenticated, user } = useAuth();
  const lastAttempt = useRef('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (!isAuthenticated || !user) { lastAttempt.current = ''; return; }
    const pending = readPendingZoneAlert();
    if (!pending) return;
    const key = user.id + ':' + pending.code;
    if (lastAttempt.current === key) return;
    lastAttempt.current = key;
    let active = true;
    void subscribeZoneAlert(pending.code).then(() => {
      clearPendingZoneAlert();
      window.dispatchEvent(new Event(ZONE_ALERT_CHANGED));
      if (active) setNotice('¡Notificación activada! Te avisaremos en Xamuko cuando habilitemos ' + pending.city + '.');
    }).catch(error => {
      if (error instanceof ApiError && error.code === 'ZONE_ALREADY_OPEN') {
        clearPendingZoneAlert();
        // La ciudad ya está abierta: no hay aviso pendiente que confirmar.
      }
      // Si la API no existe todavía, conservar la intención sin confirmar falsamente.
    });
    return () => { active = false; };
  }, [isAuthenticated, user?.id]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 8000);
    return () => window.clearTimeout(timer);
  }, [notice]);
  return notice ? <div role="status" aria-live="polite" style={{
    position: 'fixed', zIndex: 10000, right: 16, bottom: 'max(16px, env(safe-area-inset-bottom))',
    maxWidth: 'min(400px, calc(100vw - 32px))', padding: '13px 18px', borderRadius: 14,
    background: '#146c43', boxShadow: '0 12px 28px #146c4333', color: '#fff',
    fontSize: 14, fontWeight: 600,
  }}>{notice}</div> : null;
}
