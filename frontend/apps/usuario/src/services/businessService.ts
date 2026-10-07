import { businesses, products, reviews, services, type Business, type Product, type Review, type Service } from "../data/mockData";
import { isBusinessPublished, isOfferPublished } from "./negociosPublicationService";

export type BusinessFilters = { query?: string; category?: string };

export function prioritizeFeaturedByDistance(items: Business[], featuredLimit = 2): Business[] {
  const byDistance = (a: Business, b: Business) => a.distanceKm - b.distanceKm;
  const featured = items.filter((business) => business.plan === "premium" || business.isFeatured).sort(byDistance);
  const prioritized = featured.slice(0, featuredLimit);
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

function isOfferVisible(businessId: string, offerName: string): boolean {
  const business = businesses.find((item) => item.id === businessId);
  return Boolean(business && isBusinessPublished(business.name) && isOfferPublished(business.name, offerName));
}

export async function getBusinesses(filters: BusinessFilters = {}): Promise<Business[]> {
  return businesses.filter((business) => {
    if (!isBusinessPublished(business.name)) return false;
    const matchesCategory = !filters.category || business.category === filters.category;
    const businessProducts = products.filter((product) => product.businessId === business.id && isOfferVisible(product.businessId, product.name)).flatMap((product) => [product.name, product.description]);
    const businessServices = services.filter((service) => service.businessId === business.id && isOfferVisible(service.businessId, service.name)).flatMap((service) => [service.name, service.description]);
    const searchableFields = [business.name, business.category, business.address, business.description ?? "", ...business.tags, ...businessProducts, ...businessServices];
    return matchesCategory && matchesQuery(filters.query, searchableFields);
  });
}

export async function getMatchingProducts(filters: BusinessFilters = {}): Promise<Product[]> {
  if (!filters.query?.trim() && !filters.category) return [];
  const matchedBusinesses = new Set((await getBusinesses(filters)).map((business) => business.id));
  return products.filter((product) => {
    const business = businesses.find((item) => item.id === product.businessId);
    if (!business || !isOfferVisible(product.businessId, product.name)) return false;
    const matchesCategory = !filters.category || business?.category === filters.category;
    return matchesCategory && (matchesQuery(filters.query, [product.name, product.description]) || (Boolean(filters.query) && matchedBusinesses.has(product.businessId)));
  });
}

export async function getMatchingServices(filters: BusinessFilters = {}): Promise<Service[]> {
  if (!filters.query?.trim() && !filters.category) return [];
  const matchedBusinesses = new Set((await getBusinesses(filters)).map((business) => business.id));
  return services.filter((service) => {
    const business = businesses.find((item) => item.id === service.businessId);
    if (!business || !isOfferVisible(service.businessId, service.name)) return false;
    const matchesCategory = !filters.category || business?.category === filters.category;
    return matchesCategory && (matchesQuery(filters.query, [service.name, service.description]) || (Boolean(filters.query) && matchedBusinesses.has(service.businessId)));
  });
}

export async function getBusinessById(id: string): Promise<Business | undefined> {
  return businesses.find((business) => business.id === id && isBusinessPublished(business.name));
}

export async function getProductsByBusinessId(businessId: string): Promise<Product[]> {
  return products.filter((product) => product.businessId === businessId && isOfferVisible(product.businessId, product.name));
}

export async function getProductById(id: string): Promise<Product | undefined> {
  const product = products.find((item) => item.id === id);
  return product && isOfferVisible(product.businessId, product.name) ? product : undefined;
}

export async function getServicesByBusinessId(businessId: string): Promise<Service[]> {
  return services.filter((service) => service.businessId === businessId && isOfferVisible(service.businessId, service.name));
}

export async function getServiceById(id: string): Promise<Service | undefined> {
  const service = services.find((item) => item.id === id);
  return service && isOfferVisible(service.businessId, service.name) ? service : undefined;
}

export async function getReviewsByBusinessId(businessId: string): Promise<Review[]> {
  return reviews.filter((review) => review.businessId === businessId);
}
