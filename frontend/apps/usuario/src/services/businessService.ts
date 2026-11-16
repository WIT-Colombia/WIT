import { type Business, type Product, type Review, type Service } from "../data/mockData";
import { listPublicBusinesses, getPublicBusiness, listPublicProducts, listPublicServices, searchPublicUniversal } from "./publicBusinessApi";
import { ApiError } from "./httpClient";

export type BusinessFilters = { query?: string; category?: string };
export type UniversalSearchResult = { businesses: Business[]; products: Product[]; services: Service[]; pagination?: any };

/**
 * The public API uses `q` (not `query`) and performs filtering BEFORE
 * pagination. Do not filter page-sized responses again here: doing so loses
 * matches on later pages and corrupts total counts.
 */
export async function searchUniversal(filters: BusinessFilters & {
  latitude?: number; longitude?: number; radiusKm?: number;
  scope?: "city" | "virtual"; city?: string; region?: string;
  businessPage?: number; productPage?: number; servicePage?: number;
  businessPageSize?: number; productPageSize?: number; servicePageSize?: number;
} = {}): Promise<UniversalSearchResult> {
  const { query, ...apiFilters } = filters;
  return searchPublicUniversal({ ...apiFilters, q: query?.trim() });
}

const BUSINESS_CACHE_TTL_MS = 30_000;
const businessCache = new Map<string, { expiresAt: number; value: Business[] }>();
const businessRequests = new Map<string, Promise<Business[]>>();

export function prioritizeFeaturedByDistance(items: Business[], featuredLimit = 3): Business[] {
  const byDistance = (a: Business, b: Business) => a.distanceKm - b.distanceKm || a.id.localeCompare(b.id);
  const nearbyPioneers = items
    .filter((business) => typeof business.pioneerNumber === "number" && business.distanceKm <= 3)
    .sort(byDistance);
  const pioneerIds = new Set(items.filter((business) => typeof business.pioneerNumber === "number").map((business) => business.id));
  const eligibleFeatured = items
    .filter((business) => !pioneerIds.has(business.id) && (business.plan === "premium" || business.isFeatured))
    .sort(byDistance);
  // Rotate the eligible highlighted businesses by day so the privileged slots are shared fairly.
  const dayIndex = Math.floor(Date.now() / 86_400_000);
  const offset = eligibleFeatured.length ? dayIndex % eligibleFeatured.length : 0;
  const rotatedFeatured = eligibleFeatured.length ? [...eligibleFeatured.slice(offset), ...eligibleFeatured.slice(0, offset)] : eligibleFeatured;
  const prioritized = [...nearbyPioneers, ...rotatedFeatured.slice(0, featuredLimit)];
  const prioritizedIds = new Set(prioritized.map((business) => business.id));
  const remaining = items.filter((business) => !prioritizedIds.has(business.id)).sort(byDistance);
  return [...prioritized, ...remaining];
}

function normalize(value: string): string {
  return value.toLocaleLowerCase("es-CO").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, " ").trim();
}

function wordForms(value: string): Set<string> {
  const word = normalize(value).replace(/\s+/g, "");
  const forms = new Set([word]);
  if (word.length > 5 && word.endsWith("eria")) forms.add(word.slice(0, -4));
  if (word.length > 5 && word.endsWith("erias")) forms.add(word.slice(0, -5));
  if (word.length > 5 && word.endsWith("es")) forms.add(word.slice(0, -2));
  if (word.length > 4 && word.endsWith("s")) forms.add(word.slice(0, -1));
  for (const form of [...forms]) {
    let shortened = form;
    for (let index = 0; index < 2 && shortened.length > 4 && /[aeiou]$/.test(shortened); index += 1) {
      shortened = shortened.slice(0, -1);
      forms.add(shortened);
    }
  }
  return forms;
}

const ignoredWords = new Set(["a", "al", "con", "de", "del", "el", "en", "la", "las", "los", "por", "para", "un", "una", "y"]);

function matchesQuery(query: string | undefined, fields: string[]): boolean {
  const terms = normalize(query ?? "").split(/\s+/).filter((term) => term && !ignoredWords.has(term));
  if (!terms.length) return true;
  const fieldWords = fields.flatMap((field) => normalize(field).split(/\s+/)).filter(Boolean);
  return terms.every((term) => {
    const termForms = wordForms(term);
    return fieldWords.some((fieldWord) => [...wordForms(fieldWord)].some((form) => termForms.has(form)) || fieldWord.startsWith(term));
  });
}

function matchesCategory(value: string, selectedCategory: string): boolean {
  return normalize(value) === normalize(selectedCategory);
}

export async function getBusinesses(filters: BusinessFilters = {}): Promise<Business[]> {
  const cacheKey = `${normalize(filters.query ?? "")}::${normalize(filters.category ?? "")}`;
  const cached = businessCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const pending = businessRequests.get(cacheKey);
  if (pending) return pending;
  const request = getBusinessesUncached(filters).then((value) => {
    businessCache.set(cacheKey, { expiresAt: Date.now() + BUSINESS_CACHE_TTL_MS, value });
    businessRequests.delete(cacheKey);
    return value;
  }).catch((error) => { businessRequests.delete(cacheKey); throw error; });
  businessRequests.set(cacheKey, request);
  return request;
}

async function getBusinessesUncached(filters: BusinessFilters = {}): Promise<Business[]> {
  let publicBusinesses: Business[];
  // Preserve transport failures so the screen can distinguish an unavailable
  // catalog from a valid empty result and offer a retry to the user.
  publicBusinesses = await listPublicBusinesses();
  return publicBusinesses.filter((business) => {
    const categoryMatches = !filters.category || matchesCategory(business.category, filters.category);
    const businessProducts: string[] = [];
    const businessServices: string[] = [];
    const searchableFields = [business.name, business.category, business.address, business.description ?? "", ...business.tags, ...businessProducts, ...businessServices];
    return categoryMatches && matchesQuery(filters.query, searchableFields);
  });
}

export async function getMatchingProducts(filters: BusinessFilters = {}): Promise<Product[]> {
  if (!filters.query?.trim() && !filters.category) return [];
  const businesses = await getBusinesses(filters); const results = await Promise.all(businesses.map(item => listPublicProducts(item.id).catch(() => [])));
  return results.flat().filter(product => !filters.query || matchesQuery(filters.query, [product.name, product.description]));
}

export async function getMatchingServices(filters: BusinessFilters = {}): Promise<Service[]> {
  if (!filters.query?.trim() && !filters.category) return [];
  const businesses = await getBusinesses(filters); const results = await Promise.all(businesses.map(item => listPublicServices(item.id).catch(() => [])));
  return results.flat().filter(service => !filters.query || matchesQuery(filters.query, [service.name, service.description]));
}

export async function getBusinessById(id: string): Promise<Business | undefined> {
  const result = await getPublicBusiness(id); return result?.business;
}

export async function getProductsByBusinessId(businessId: string): Promise<Product[]> {
  return listPublicProducts(businessId);
}

/**
 * Existing links without a business hint require a compatibility lookup.
 * Limit concurrency and preserve HTTP errors: a 429 is NOT an empty catalog.
 */
async function findOfferWithoutBusinessHint<T extends Product | Service>(
  id: string, load: (businessId: string) => Promise<T[]>,
): Promise<T | undefined> {
  const publicBusinesses = await listPublicBusinesses();
  let firstError: unknown = null;
  const batchSize = 3;
  for (let index = 0; index < publicBusinesses.length; index += batchSize) {
    const batch = publicBusinesses.slice(index, index + batchSize);
    const settled = await Promise.allSettled(batch.map(business => load(business.id)));
    for (const result of settled) {
      if (result.status === "fulfilled") {
        const match = result.value.find(offer => offer.id === id);
        if (match) return match;
      } else {
        if (result.reason instanceof ApiError && result.reason.status === 429) throw result.reason;
        if (firstError === null) firstError = result.reason;
      }
    }
  }
  if (firstError !== null) throw firstError;
  return undefined;
}

export function getProductById(id: string): Promise<Product | undefined> {
  return findOfferWithoutBusinessHint(id, listPublicProducts);
}

export async function getServicesByBusinessId(businessId: string): Promise<Service[]> {
  return listPublicServices(businessId);
}

export function getServiceById(id: string): Promise<Service | undefined> {
  return findOfferWithoutBusinessHint(id, listPublicServices);
}

/** New product/service links load the correct business in ONE public request. */
export async function getOfferPageDetail(kind: "product" | "service", id: string, businessId?: string):
  Promise<{ offer: Product | Service; business: Business } | null> {
  if (businessId) {
    const result = await getPublicBusiness(businessId);
    if (!result) return null;
    const offer = (kind === "product" ? result.products : result.services).find(item => item.id === id);
    return offer ? { offer, business: result.business } : null;
  }
  // Support existing shared links without a business query parameter.
  const offer = kind === "product" ? await getProductById(id) : await getServiceById(id);
  if (!offer) return null;
  const business = await getBusinessById(offer.businessId);
  return business ? { offer, business } : null;
}

export async function getReviewsByBusinessId(businessId: string): Promise<Review[]> {
  void businessId;
  return [];
}
