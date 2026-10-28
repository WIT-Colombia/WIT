import { requestWithSession } from './authService';

export type PublicAnalyticsEvent = 'BUSINESS_VIEW' | 'SEARCH_IMPRESSION' | 'WHATSAPP_CLICK' | 'PHONE_CLICK' | 'DIRECTIONS_CLICK' | 'OFFER_VIEW';
export type AnalyticsContext = { source?: 'search' | 'map' | 'direct' | 'featured' | 'qr'; searchTerm?: string; searchPosition?: number; category?: string; isFeatured?: boolean };

const pendingDedupeKeys = new Set<string>();
const completedDedupeKeys = new Set<string>();
const activeBusinessContexts = new Map<string, AnalyticsContext>();

export function createAnalyticsInteractionId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const visitorStorageKey = 'xamuko:analytics:visitor';
const visitContextKey = (businessId: string) => `xamuko:analytics:visit-context:${businessId}`;
function visitorId(): string {
  try {
    const existing = localStorage.getItem(visitorStorageKey);
    if (existing) return existing;
    const created = createAnalyticsInteractionId();
    localStorage.setItem(visitorStorageKey, created);
    return created;
  } catch { return createAnalyticsInteractionId(); }
}
export function rememberBusinessVisitContext(businessId: string, context: AnalyticsContext): void {
  try { sessionStorage.setItem(visitContextKey(businessId), JSON.stringify(context)); } catch { /* Context is optional. */ }
}
export function consumeBusinessVisitContext(businessId: string): AnalyticsContext {
  try {
    const raw = sessionStorage.getItem(visitContextKey(businessId));
    sessionStorage.removeItem(visitContextKey(businessId));
    const context: AnalyticsContext = raw ? JSON.parse(raw) as AnalyticsContext : { source: 'direct' };
    activeBusinessContexts.set(businessId, context);
    return context;
  } catch {
    const context = { source: 'direct' } as const;
    activeBusinessContexts.set(businessId, context);
    return context;
  }
}

/** Context remains available while the visitor continues through this SPA flow. */
export function activeBusinessContext(businessId: string): AnalyticsContext {
  return activeBusinessContexts.get(businessId) ?? { source: 'direct' };
}

export function recordBusinessEvent(businessId: string, eventType: PublicAnalyticsEvent, scope: string, offerId?: string, context: AnalyticsContext = {}): void {
  // Contact actions are independent interactions. A permanent `click` key would
  // suppress every later WhatsApp/phone click in the same browser session.
  const isContactAction = eventType === 'WHATSAPP_CLICK' || eventType === 'PHONE_CLICK' || eventType === 'DIRECTIONS_CLICK';
  // Cada montaje real de la ficha representa una nueva apertura. El efecto
  // de BusinessDetail se ejecuta una sola vez por montaje, así que BUSINESS_VIEW
  // no necesita la deduplicación de sessionStorage que impediría aperturas
  // posteriores del mismo visitante durante el mismo día.
  const isBusinessView = eventType === 'BUSINESS_VIEW';
  const isSearchImpression = eventType === 'SEARCH_IMPRESSION';
  const isOfferView = eventType === 'OFFER_VIEW';
  if (isOfferView && !offerId) return;
  const interactionId = isContactAction || isBusinessView
    ? (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`)
    : scope;
  const offerScope = offerId ?? 'business';
  const dedupeKey = `xamuko-analytics:${eventType}:${businessId}:${offerScope}:${interactionId}`;
  const storageKey = `xamuko-analytics:${eventType}:${businessId}:${offerScope}:${scope}`;

  // Views and impressions retain their existing render-level deduplication. A
  // contact click is never suppressed by a previous click from this session.
  if (isSearchImpression) {
    if (completedDedupeKeys.has(dedupeKey) || pendingDedupeKeys.has(dedupeKey)) return;
    pendingDedupeKeys.add(dedupeKey);
  } else if (!isContactAction && !isBusinessView) {
    try {
      if (sessionStorage.getItem(storageKey)) return;
    } catch { /* La deduplicación es opcional si el almacenamiento está bloqueado. */ }
    if (pendingDedupeKeys.has(dedupeKey)) return;
    pendingDedupeKeys.add(dedupeKey);
  }

  // Contacts and offer details can follow the initial business view. Reuse its
  // in-memory context when the control itself has no richer context.
  const resolvedContext = Object.keys(context).length ? context : activeBusinessContext(businessId);
  activeBusinessContexts.set(businessId, resolvedContext);
  const body = JSON.stringify({ businessId, eventType, ...(offerId ? { offerId } : {}), dedupeKey, context: { ...resolvedContext, visitorId: visitorId() } });
  const endpoint = '/api/v1/public/analytics/events';

  // Navigation actions may unload the document immediately. Dispatch the
  // beacon synchronously so opening the directions page/app cannot drop the
  // event; the server-side unique dedupeKey still protects against repeats.
  // Keepalive lets the request finish while a contact link opens a new tab.
  // Beacon is used only if fetch cannot be dispatched (for example during an
  // actual document unload); using it first would bypass the Vite same-origin
  // proxy and silently lose the event in development.
  void requestWithSession(endpoint, {
    method: 'POST',
    body,
    keepalive: true,
  }).then(() => {
    if (!isContactAction && !isBusinessView && !isSearchImpression) {
      try { sessionStorage.setItem(storageKey, '1'); } catch { /* optional storage */ }
    }
    pendingDedupeKeys.delete(dedupeKey);
    if (isSearchImpression) completedDedupeKeys.add(dedupeKey);
  }).catch(() => {
    pendingDedupeKeys.delete(dedupeKey);
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon(endpoint, new Blob([body], { type: 'application/json' }));
    }
  });
}
