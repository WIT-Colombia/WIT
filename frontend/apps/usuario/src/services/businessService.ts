import { type Business, type Product, type Review, type Service } from "../data/mockData";
import { listPublicBusinesses, getPublicBusiness, listPublicProducts, listPublicServices, searchPublicUniversal } from "./publicBusinessApi";

export type BusinessFilters = { query?: string; category?: string };
export type UniversalSearchResult = { businesses: Business[]; products: Product[]; services: Service[]; pagination?: any };

function normalizeUniversalSearch(value: unknown): string {
  return typeof value === "string" ? value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-CO").replace(/[^\p{L}\p{N}\s]+/gu, " ").replace(/\s+/g, " ").trim() : "";
}

function matchesUniversalQuery(query: string | undefined, fields: unknown[]): boolean {
  const terms = normalizeUniversalSearch(query).split(" ").filter(Boolean);
  if (!terms.length) return true;
  const text = fields.map(normalizeUniversalSearch).filter(Boolean).join(" ");
  return terms.every((term) => text.includes(term));
}

export async function searchUniversal(filters: BusinessFilters & { latitude?: number; longitude?: number; radiusKm?: number; businessPage?: number; productPage?: number; servicePage?: number; businessPageSize?: number; productPageSize?: number; servicePageSize?: number } = {}): Promise<UniversalSearchResult> {
  const result = await searchPublicUniversal(filters);
  if (!filters.query?.trim()) return result;
  // Defensive filtering prevents an older API process or a stale response from
  // displaying records unrelated to the query currently visible in the UI.
  const businesses = result.businesses.filter((item) => matchesUniversalQuery(filters.query, [item.name, item.category, item.address, item.description, ...item.tags]));
  const products = result.products.filter((item) => matchesUniversalQuery(filters.query, [item.name, item.description, item.businessName]));
  const services = result.services.filter((item) => matchesUniversalQuery(filters.query, [item.name, item.description, item.businessName]));
  // The UI applies this final relevance guard, so its tab totals must describe
  // the same collection that is actually rendered, never an older/raw total.
  const pagination = {
    ...result.pagination,
    businesses: { ...result.pagination?.businesses, total: businesses.length, totalPages: businesses.length ? 1 : 0 },
    products: { ...result.pagination?.products, total: products.length, totalPages: products.length ? 1 : 0 },
    services: { ...result.pagination?.services, total: services.length, totalPages: services.length ? 1 : 0 },
  };
  return { businesses, products, services, pagination };
}

const BUSINESS_CACHE_TTL_MS = 30_000;
const businessCache = new Map<string, { expiresAt: number; value: Business[] }>();
const businessRequests = new Map<string, Promise<Business[]>>();

export function prioritizeFeaturedByDistance(items: Business[], featuredLimit = 2): Business[] {
  const byDistance = (a: Business, b: Business) => a.distanceKm - b.distanceKm;
  const featured = items.filter((business) => business.plan === "premium" || business.isFeatured).sort(byDistance);
  // Rotate the eligible Pro businesses by day so the premium slots are not permanent.
  const dayIndex = Math.floor(Date.now() / 86_400_000);
  const offset = featured.length ? dayIndex % featured.length : 0;
  const rotated = featured.length ? [...featured.slice(offset), ...featured.slice(0, offset)] : featured;
  const prioritized = rotated.slice(0, featuredLimit);
  const prioritizedIds = new Set(prioritized.map((business) => business.id));
  const nearby = items.filter((business) => !prioritizedIds.has(business.id)).sort(byDistance);
  return [...prioritized, ...nearby];
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
  try { publicBusinesses = await listPublicBusinesses(); } catch { publicBusinesses = []; }
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

export async function getProductById(id: string): Promise<Product | undefined> {
  const publicBusinesses = await listPublicBusinesses();
  const productsByBusiness = await Promise.all(publicBusinesses.map(item => listPublicProducts(item.id).catch(() => [])));
  return productsByBusiness.flat().find(item => item.id === id);
}

export async function getServicesByBusinessId(businessId: string): Promise<Service[]> {
  return listPublicServices(businessId);
}

export async function getServiceById(id: string): Promise<Service | undefined> {
  const publicBusinesses = await listPublicBusinesses();
  const servicesByBusiness = await Promise.all(publicBusinesses.map(item => listPublicServices(item.id).catch(() => [])));
  return servicesByBusiness.flat().find(item => item.id === id);
}

export async function getReviewsByBusinessId(businessId: string): Promise<Review[]> {
  void businessId;
  return [];
}
