import { requestWithSession } from './authService';

export type PlusPurchaseRequest = {
  id: string; status: 'PENDING_PAYMENT' | 'CLOSED'; amountCop: number;
  currency: 'COP'; periodMonths: number; createdAt: string;
};
export type PlusStatus = {
  enabled: boolean; active: boolean;
  subscription: { status: string; startsAt: string; expiresAt: string; revoked: boolean } | null;
};
export type PlusCollection = {
  id: string; title: string;
  items: Array<{ id: string; targetType: 'BUSINESS' | 'OFFER'; targetId: string; name: string; href: string | null; available: boolean; createdAt: string }>;
};
export type PlusSearch = { id: string; title: string; query: string; category: string | null; city: string | null;
  openNow: boolean; minRating: number | null; sort: string };
export type PlusRouteFavorite = { id: string; name: string; lat: number; lng: number };
export type PlusWatch = {
  id: string; offerId: string; kind: 'PRODUCT' | 'SERVICE'; name: string;
  businessName: string; price: string | null; priceText: string | null; currency: string | null;
  available: boolean;
};
export type PlusOverview = PlusStatus & {
  collections: PlusCollection[]; searches: PlusSearch[]; watches: PlusWatch[];
  preferences: { radarEnabled: boolean; priceAlertsEnabled: boolean } | null;
};
export type PlusRadarItem = {
  id: string; title: string; type: 'PRODUCT' | 'SERVICE' | 'PROMOTION'; business: string;
  href: string; createdAt: string;
};
export type PlusCompareOffer = {
  id: string; name: string; description: string | null; kind: 'PRODUCT' | 'SERVICE';
  priceAmount: string | null; priceText: string | null; currency: string | null;
  negotiable: boolean; business: { name: string; publicId: string };
};
export type PriceHistory = {
  offer: { id: string; name: string; price: string | null; currency: string | null };
  history: Array<{ previousPrice: string | null; newPrice: string | null; previousCurrency: string | null; currency: string | null; createdAt: string }>;
};
const base = '/api/v1/user/plus';
const json = (data: unknown) => ({ headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
export const fetchPlusStatus = () => requestWithSession<PlusStatus>(base + '/status');
export const fetchPlusPurchaseRequest = () =>
  requestWithSession<{ request: PlusPurchaseRequest | null }>(base + '/purchase-request');
/**
 * Registers a request for a membership. This does not debit, renew or activate the account.
 * The price and entitlement remain server-verified.
 */
export const requestPlusMembership = (acceptedAmountCop: number) =>
  requestWithSession<{ request: PlusPurchaseRequest; created: boolean }>(base + '/purchase-request',
    { method: 'POST', ...json({ acceptedAmountCop, acceptedTerms: true }) });

export const fetchPlusOverview = () => requestWithSession<PlusOverview>(base + '/overview');
export const fetchPlusRadar = () => requestWithSession<{ items: PlusRadarItem[] }>(base + '/radar');
export const fetchPlusRouteFavorites = () => requestWithSession<{ items: PlusRouteFavorite[] }>(base + '/route-favorites');
export const savePlusPreferences = (data: { radarEnabled?: boolean; priceAlertsEnabled?: boolean }) =>
  requestWithSession(base + '/preferences', { method: 'PUT', ...json(data) });
export const createPlusCollection = (title: string) =>
  requestWithSession(base + '/collections', { method: 'POST', ...json({ title }) });
export const removePlusCollection = (id: string) =>
  requestWithSession(base + '/collections/' + encodeURIComponent(id), { method: 'DELETE' });
export const addPlusCollectionItem = (id: string, item: { targetType: 'BUSINESS' | 'OFFER'; targetId: string }) =>
  requestWithSession(base + '/collections/' + encodeURIComponent(id) + '/items', { method: 'POST', ...json(item) });
export const removePlusCollectionItem = (id: string, itemId: string) =>
  requestWithSession(base + '/collections/' + encodeURIComponent(id) + '/items/' + encodeURIComponent(itemId), { method: 'DELETE' });
export const createPlusSearch = (input: Omit<PlusSearch, 'id'> & { title: string }) =>
  requestWithSession(base + '/searches', { method: 'POST', ...json(input) });
export const removePlusSearch = (id: string) =>
  requestWithSession(base + '/searches/' + encodeURIComponent(id), { method: 'DELETE' });
export const addPlusWatch = (offerId: string) =>
  requestWithSession(base + '/watches', { method: 'POST', ...json({ offerId }) });
export const removePlusWatch = (id: string) =>
  requestWithSession(base + '/watches/' + encodeURIComponent(id), { method: 'DELETE' });
export const fetchPlusPriceHistory = (offerId: string) =>
  requestWithSession<PriceHistory>(base + '/watches/' + encodeURIComponent(offerId) + '/history');
export const comparePlusOffers = (ids: string[]) =>
  requestWithSession<{ offers: PlusCompareOffer[] }>(base + '/compare?ids=' + ids.map(encodeURIComponent).join(','));

/** Only local XAMUKO paths or actual UUIDs are accepted as item targets. */
export function parsePlusTarget(value: string): { targetType: 'BUSINESS' | 'OFFER'; targetId: string } | null {
  const clean = value.trim();
  if (!clean) return null;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (uuid.test(clean)) return { targetType: 'OFFER', targetId: clean };
  try {
    const url = new URL(clean, window.location.origin);
    if (!['http:', 'https:'].includes(url.protocol) || ![window.location.hostname, 'xamuko.com', 'www.xamuko.com'].includes(url.hostname)) return null;
    const match = /^\/(business|product|service)\/([0-9a-f-]{36})\/?$/.exec(url.pathname);
    if (!match || !uuid.test(match[2])) return null;
    return { targetType: match[1] === 'business' ? 'BUSINESS' : 'OFFER', targetId: match[2] };
  } catch { return null; }
}
export function searchHref(search: PlusSearch) {
  const params = new URLSearchParams();
  if (search.query) params.set('q', search.query);
  if (search.category) params.set('category', search.category);
  // Results currently accepts query/category only; do not advertise ignored filters.
  return '/results?' + params.toString();
}
