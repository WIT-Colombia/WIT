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
      if (active) setNotice('Notificación activada para ' + pending.city + '.');
    }).catch(error => {
      if (error instanceof ApiError && error.code === 'ZONE_ALREADY_OPEN') {
        clearPendingZoneAlert();
        if (active) setNotice('XAMUKO ya está disponible en ' + pending.city + '.');
      } else if (active) {
        setNotice('No pudimos activar el aviso para ' + pending.city + '. Puedes intentarlo desde esa ciudad.');
      }
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
    background: '#282e64', boxShadow: '0 12px 28px #1f244533', color: '#fff',
    fontSize: 14, fontWeight: 600,
  }}>{notice}</div> : null;
}
