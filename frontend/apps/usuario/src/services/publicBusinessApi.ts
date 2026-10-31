import type { Business, Product, Service } from "../data/mockData";
import { ApiError } from "./httpClient";
import { requestWithSession } from "./authService";
import { buildApiUrl } from "@wit/utils";

type PublicPhoto = { id: string; url: string; altText: string | null; sortOrder: number; isCover: boolean };
type PublicCategory = { id: string; code: string; name: string; iconKey: string | null } | null;
type PublicSummary = { pioneerNumber?: number | null; isFeatured?: boolean; plan?: "free" | "premium"; createdAt?: string; publicId: string; name: string; sede: string | null; adultOnly: boolean; description: string | null; category: PublicCategory; secondaryCategories?: PublicCategory[]; modalities?: { type: string }[]; location: { cityName: string; regionName: string | null; additionalAddressInfo?: string | null; address: string | null; latitude: number | null; longitude: number | null; visibility: string } | null; coverPhoto: PublicPhoto | null; profilePhoto: PublicPhoto | null };
type PublicDetail = PublicSummary & { gallery: PublicPhoto[]; contacts: { email: string | null; phone: string | null; whatsapp: string | null; website: string | null }; socialNetworks?: { instagram: string | null; facebook: string | null; x: string | null; tiktok: string | null }; modalities?: { type: string; hours: { dayOfWeek: string; isClosed: boolean; opensAt: string | null; closesAt: string | null }[] }[]; products: PublicOffer[]; services: PublicOffer[] };
type PublicOffer = { id: string; name: string; description: string | null; createdAt?: string; isOffer?: boolean; offerLabel?: string | null; discount?: string | null; offerDeadline?: string | null; promotion?: { id: string } | null; category: PublicCategory; price: { amount: string | null; currency: string | null; text: string | null; negotiable: boolean }; photos: PublicPhoto[] };
type UniversalOffer = PublicOffer & { business: { publicId: string } };

function mediaUrl(value: string | null | undefined): string {
  if (!value) return "";
  return /^https?:\/\//i.test(value) ? value : buildApiUrl(value);
}

function mapPhoto(value: PublicPhoto): PublicPhoto {
  return { ...value, url: mediaUrl(value.url) };
}
export type PublicPromotion = { id: string; businessId: string; title: string; description: string; originalPrice: string | null; promotionalPrice: string | null; startsAt: string; endsAt: string; photos: PublicPhoto[]; relatedOfferId: string | null; type: 'OFFER' | 'PROMOTION'; state?: 'ACTIVE' | 'SCHEDULED' | 'FINISHED'; business?: { publicId: string; name: string; category: string | null } };

function formatOfferDeadline(value?: string | null): string | undefined {
  return value ? value.slice(0, 10) : undefined;
}

function mapBusiness(value: PublicSummary): Business {
  const coverPhoto = value.coverPhoto ? mapPhoto(value.coverPhoto) : null;
  const profilePhoto = value.profilePhoto ? mapPhoto(value.profilePhoto) : null;
  const rawCategory = value.category?.name ?? value.category?.code ?? "Sin categoría";
  const category = rawCategory.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  const location = value.location;
  const cover = coverPhoto?.url ?? profilePhoto?.url ?? "";
  return {
    id: value.publicId,
    createdAt: value.createdAt,
    name: value.name,
    category,
    rating: 0,
    reviewCount: 0,
    distanceKm: Number.POSITIVE_INFINITY,
    isOpen: true,
    address: location?.address ?? (location?.cityName ?? "Ubicación no pública"),
    city: location?.cityName,
    regionName: location?.regionName ?? undefined,
    additionalAddressInfo: location?.additionalAddressInfo ?? undefined,
    secondaryCategories: (value.secondaryCategories ?? []).filter((item): item is Exclude<PublicCategory, null> => Boolean(item)).map((item) => item.name),
    modalityTypes: (value.modalities ?? []).map((item) => item.type),
    socialNetworks: undefined,
    image: cover,
    logo: profilePhoto?.url,
    gallery: [cover, ...(profilePhoto?.url && profilePhoto.url !== cover ? [profilePhoto.url] : [])].filter(Boolean),
    tags: [value.sede ? `Sede ${value.sede.replace(/^sede\s+/i, "")}` : "", ...(value.secondaryCategories ?? []).filter((item): item is Exclude<PublicCategory, null> => Boolean(item)).map((item) => item.name), value.adultOnly ? "+18" : ""].filter(Boolean),
    description: value.description ?? "",
    coordinates: location?.latitude != null && location?.longitude != null ? { lat: location.latitude, lng: location.longitude } : undefined,
    coordinatesVerified: location?.latitude != null && location?.longitude != null,
    pioneerNumber: typeof value.pioneerNumber === "number" && Number.isInteger(value.pioneerNumber) && value.pioneerNumber >= 1 && value.pioneerNumber <= 20 ? value.pioneerNumber : null,
    isFeatured: Boolean(value.isFeatured),
    plan: value.plan === "premium" ? "premium" : "free",
  };
}

function mapProduct(value: PublicOffer, businessId: string): Product {
  const image = mediaUrl(value.photos[0]?.url);
  const amount = value.price.amount ? Number(value.price.amount) : undefined;
  const currency = value.price.currency ?? "COP";
  const formatAmount = (raw: number) => `${new Intl.NumberFormat("es-CO", { style: "currency", currency, maximumFractionDigits: 0 }).format(raw).replace(/\u00a0/g, " ")} ${currency}`;
  const priceLabel = value.price.negotiable ? "Precio a convenir" : amount !== undefined ? formatAmount(amount) : value.price.text && Number.isFinite(Number(value.price.text)) ? formatAmount(Number(value.price.text)) : "Consultar precio";
  const business = (value as PublicOffer & { business?: { name?: string; location?: { latitude: number | null; longitude: number | null } | null } }).business;
  const original = (value as PublicOffer & { originalPrice?: string | null }).originalPrice;
  return { id: value.id, businessId, name: value.name, description: value.description ?? "", image, price: amount, priceLabel, originalPriceLabel: original ? formatAmount(Number(original)) : undefined, createdAt: value.createdAt, isOffer: Boolean(value.isOffer), offerLabel: value.offerLabel ?? undefined, discount: value.discount ?? undefined, offerDeadline: formatOfferDeadline(value.offerDeadline), promotionId: value.promotion?.id, businessName: business?.name, businessCoordinates: business?.location?.latitude != null && business.location.longitude != null ? { lat: business.location.latitude, lng: business.location.longitude } : undefined };
}

function formatServicePrice(value: PublicOffer): string {
  if (value.price.negotiable) return "Precio a convenir";
  const currency = value.price.currency ?? "COP";
  const raw = value.price.amount ?? value.price.text;
  const amount = raw ? Number(raw) : NaN;
  if (!Number.isFinite(amount)) return "Consultar precio";
  return `${new Intl.NumberFormat("es-CO", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount).replace(/\u00a0/g, " ")} ${currency}`;
}

function mapService(value: PublicOffer, businessId: string): Service {
  const business = (value as PublicOffer & { business?: { name?: string; location?: { latitude: number | null; longitude: number | null } | null } }).business;
  const original = (value as PublicOffer & { originalPrice?: string | null }).originalPrice;
  const currency = value.price.currency ?? "COP";
  const originalPriceLabel = original ? `${new Intl.NumberFormat("es-CO", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(original)).replace(/\u00a0/g, " ")} ${currency}` : undefined;
  return { id: value.id, businessId, name: value.name, description: value.description ?? "", image: mediaUrl(value.photos[0]?.url), priceLabel: formatServicePrice(value), originalPriceLabel, promotionId: value.promotion?.id, businessName: business?.name, businessCoordinates: business?.location?.latitude != null && business.location.longitude != null ? { lat: business.location.latitude, lng: business.location.longitude } : undefined };
}

export async function listPublicBusinesses(): Promise<Business[]> {
  const response = await requestWithSession<{ businesses: PublicSummary[] }>("/api/v1/public/businesses?page=1&pageSize=50");
  return response.businesses.map(mapBusiness);
}

export async function getPublicBusiness(id: string): Promise<{ business: Business; products: Product[]; services: Service[] } | null> {
  try {
    const response = await requestWithSession<{ business: PublicDetail }>(`/api/v1/public/businesses/${encodeURIComponent(id)}`);
    const business = mapBusiness(response.business);
    const contacts = response.business.contacts;
    if (contacts.phone) business.phone = contacts.phone;
    if (contacts.whatsapp) business.whatsapp = contacts.whatsapp;
    if (contacts.email) business.email = contacts.email;
    if (contacts.website) business.website = contacts.website;
    business.socialNetworks = response.business.socialNetworks;
    business.gallery = response.business.gallery.map(item => mediaUrl(item.url));
    const dayNames = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    const hours = response.business.modalities?.[0]?.hours ?? [];
    business.weeklyHours = hours.map(hour => ({
      day: dayNames[Number(hour.dayOfWeek)] ?? `Día ${hour.dayOfWeek}`,
      isClosed: hour.isClosed,
      hours: hour.isClosed ? "Cerrado" : `${hour.opensAt ?? "—"} – ${hour.closesAt ?? "—"}`,
    }));
    return { business, products: response.business.products.map(item => mapProduct(item, id)), services: response.business.services.map(item => mapService(item, id)) };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export async function listPublicProducts(id: string): Promise<Product[]> {
  const response = await requestWithSession<{ products: PublicOffer[] }>(`/api/v1/public/businesses/${encodeURIComponent(id)}/products`);
  return response.products.map(item => mapProduct(item, id));
}

export async function listPublicServices(id: string): Promise<Service[]> {
  const response = await requestWithSession<{ services: PublicOffer[] }>(`/api/v1/public/businesses/${encodeURIComponent(id)}/services`);
  return response.services.map(item => mapService(item, id));
}

export async function listPublicPromotions(id: string): Promise<PublicPromotion[]> {
  const response = await requestWithSession<{ promotions: PublicPromotion[] }>(`/api/v1/public/businesses/${encodeURIComponent(id)}/promotions`);
  return response.promotions.map(item => ({ ...item, photos: item.photos.map(mapPhoto) }));
}

export async function getPublicPromotion(id: string): Promise<PublicPromotion> {
  const response = await requestWithSession<{ promotion: PublicPromotion }>(`/api/v1/public/promotions/${encodeURIComponent(id)}`);
  return { ...response.promotion, photos: response.promotion.photos.map(mapPhoto) };
}

export async function recordPublicPromotionView(id: string, dedupeKey: string): Promise<void> {
  await requestWithSession(`/api/v1/public/promotions/${encodeURIComponent(id)}/views`, { method: "POST", body: JSON.stringify({ dedupeKey }) });
}

export async function searchPublicUniversal(params: Record<string, string | number | undefined>): Promise<{ businesses: Business[]; products: Product[]; services: Service[]; pagination: any }> {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => { if (value !== undefined && value !== "") search.set(key, String(value)); });
  const response = await requestWithSession<{ businesses: PublicSummary[]; products: UniversalOffer[]; services: UniversalOffer[]; pagination: any }>(`/api/v1/public/search?${search.toString()}`);
  const businesses = response.businesses.map(mapBusiness);
  const products = response.products.map((item) => mapProduct(item, item.business.publicId));
  const services = response.services.map((item) => mapService(item, item.business.publicId));
  return { businesses, products, services, pagination: response.pagination };
}
