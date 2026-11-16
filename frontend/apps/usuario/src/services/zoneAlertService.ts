import { requestWithSession } from './authService';

const PENDING_KEY = 'xamuko:zone-launch-intent:v1';
const INTENT_LIFETIME_MS = 48 * 60 * 60 * 1000;
export const ZONE_ALERT_CHANGED = 'xamuko-zone-alert-changed';

export type PendingZoneAlert = { code: string; city: string; expiresAt: number };
const path = (code: string) => '/api/v1/user/zones/alerts/' + encodeURIComponent(code);

export function savePendingZoneAlert(code: string, city: string) {
  if (!/^\\d{5}$/.test(code)) return;
  try {
    window.localStorage.setItem(PENDING_KEY, JSON.stringify({
      code, city: city.slice(0, 160), expiresAt: Date.now() + INTENT_LIFETIME_MS,
    }));
  } catch { /* El registro debe seguir funcionando aun cuando el navegador bloquee storage. */ }
}

export function readPendingZoneAlert(): PendingZoneAlert | null {
  try {
    const value = window.localStorage.getItem(PENDING_KEY);
    if (!value) return null;
    const raw: unknown = JSON.parse(value);
    if (!raw || typeof raw !== 'object') return null;
    const item = raw as Partial<PendingZoneAlert>;
    if (typeof item.code === 'string' && /^\\d{5}$/.test(item.code)
      && typeof item.city === 'string' && item.city.length <= 160
      && typeof item.expiresAt === 'number' && item.expiresAt > Date.now()
      && item.expiresAt <= Date.now() + INTENT_LIFETIME_MS) {
      return item as PendingZoneAlert;
    }
    clearPendingZoneAlert();
  } catch { clearPendingZoneAlert(); }
  return null;
}

export function clearPendingZoneAlert() {
  try { window.localStorage.removeItem(PENDING_KEY); } catch { /* Ignore */ }
}

export function getZoneAlert(code: string) {
  return requestWithSession<{ subscribed: boolean; notified: boolean; city: string }>(path(code));
}
export function subscribeZoneAlert(code: string) {
  return requestWithSession<{ subscribed: boolean; city: string }>(path(code), {
    method: 'POST', body: '{}',
  });
}
export function unsubscribeZoneAlert(code: string) {
  return requestWithSession<{ subscribed: boolean }>(path(code), { method: 'DELETE' });
}
