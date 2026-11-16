import { requestWithSession } from './authService';

const PENDING_KEY = 'xamuko:zone-launch-intent:v1';
const INTENT_LIFETIME_MS = 48 * 60 * 60 * 1000;
const AUTO_ATTEMPT_KEY = 'xamuko:zone-launch-auto-attempt:v1';
const AUTO_ATTEMPT_COOLDOWN_MS = 30 * 60 * 1000;
export const ZONE_ALERT_CHANGED = 'xamuko-zone-alert-changed';

export type PendingZoneAlert = { code: string; city: string; expiresAt: number };
const path = (code: string) => '/api/v1/user/zones/alerts/' + encodeURIComponent(code);

export function savePendingZoneAlert(code: string, city: string) {
  if (!/^\d{5}$/.test(code)) return;
  try { window.sessionStorage.removeItem(AUTO_ATTEMPT_KEY); } catch { /* Ignore */ }
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
    if (typeof item.code === 'string' && /^\d{5}$/.test(item.code)
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

/**
 * Claim a pending post-registration auto-subscription at most once in this
 * session's cooldown, even if the app remounts or the user navigates.
 * Explicit button presses are never rate-limited by this client-side guard.
 */
export function claimPendingZoneAlertAttempt(userId: string, code: string): boolean {
  const now = Date.now();
  try {
    const raw = window.sessionStorage.getItem(AUTO_ATTEMPT_KEY);
    if (raw) {
      const value: unknown = JSON.parse(raw);
      if (value && typeof value === 'object') {
        const attempt = value as { userId?: string; code?: string; at?: number };
        if (attempt.userId === userId && attempt.code === code
          && typeof attempt.at === 'number' && attempt.at <= now
          && now - attempt.at < AUTO_ATTEMPT_COOLDOWN_MS) return false;
      }
    }
    window.sessionStorage.setItem(AUTO_ATTEMPT_KEY, JSON.stringify({ userId, code, at: now }));
  } catch { /* A ref guard in ZoneAlertResume still avoids repeats within a mount. */ }
  return true;
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
