import { requestWithSession } from './authService';

export type PublicAnalyticsEvent = 'BUSINESS_VIEW' | 'SEARCH_IMPRESSION' | 'WHATSAPP_CLICK' | 'PHONE_CLICK';

export function recordBusinessEvent(businessId: string, eventType: PublicAnalyticsEvent, scope: string): void {
  // Contact actions are independent interactions. A permanent `click` key would
  // suppress every later WhatsApp/phone click in the same browser session.
  const isContactAction = eventType === 'WHATSAPP_CLICK' || eventType === 'PHONE_CLICK';
  // Cada montaje real de la ficha representa una nueva apertura. El efecto
  // de BusinessDetail se ejecuta una sola vez por montaje, así que BUSINESS_VIEW
  // no necesita la deduplicación de sessionStorage que impediría aperturas
  // posteriores del mismo visitante durante el mismo día.
  const isBusinessView = eventType === 'BUSINESS_VIEW';
  const interactionId = isContactAction || isBusinessView
    ? (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`)
    : scope;
  const dedupeKey = `xamuko-analytics:${eventType}:${businessId}:${interactionId}`;
  const storageKey = `xamuko-analytics:${eventType}:${businessId}:${scope}`;

  // Views and impressions retain their existing render-level deduplication. A
  // contact click is never suppressed by a previous click from this session.
  if (!isContactAction && !isBusinessView) {
    try {
      if (sessionStorage.getItem(storageKey)) return;
    } catch { /* La deduplicación es opcional si el almacenamiento está bloqueado. */ }
  }

  const body = JSON.stringify({ businessId, eventType, dedupeKey });
  const endpoint = '/api/v1/public/analytics/events';

  // Keepalive lets the request finish while a contact link opens a new tab.
  // Beacon is used only if fetch cannot be dispatched (for example during an
  // actual document unload); using it first would bypass the Vite same-origin
  // proxy and silently lose the event in development.
  void requestWithSession(endpoint, {
    method: 'POST',
    body,
    keepalive: true,
  }).then(() => {
    if (!isContactAction && !isBusinessView) {
      try { sessionStorage.setItem(storageKey, '1'); } catch { /* optional storage */ }
    }
  }).catch(() => {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon(endpoint, new Blob([body], { type: 'application/json' }));
    }
  });
}
