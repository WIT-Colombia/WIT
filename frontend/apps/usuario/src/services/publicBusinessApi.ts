import type { Business, Product, Service } from "../data/mockData";
import { ApiError } from "./httpClient";
import { requestWithSession } from "./authService";

type PublicPhoto = { id: string; url: string; altText: string | null; sortOrder: number; isCover: boolean };
type PublicCategory = { id: string; code: string; name: string; iconKey: string | null } | null;
type PublicSummary = { isFeatured?: boolean; plan?: "free" | "premium"; publicId: string; name: string; sede: string | null; adultOnly: boolean; description: string | null; category: PublicCategory; secondaryCategories?: PublicCategory[]; location: { cityName: string; regionName: string | null; additionalAddressInfo?: string | null; address: string | null; latitude: number | null; longitude: number | null; visibility: string } | null; coverPhoto: PublicPhoto | null; profilePhoto: PublicPhoto | null };
type PublicDetail = PublicSummary & { gallery: PublicPhoto[]; contacts: { email: string | null; phone: string | null; whatsapp: string | null; website: string | null }; socialNetworks?: { instagram: string | null; facebook: string | null; x: string | null; tiktok: string | null }; modalities?: { type: string; hours: { dayOfWeek: string; isClosed: boolean; opensAt: string | null; closesAt: string | null }[] }[]; products: PublicOffer[]; services: PublicOffer[] };
type PublicOffer = { id: string; name: string; description: string | null; category: PublicCategory; price: { amount: string | null; currency: string | null; text: string | null; negotiable: boolean }; photos: PublicPhoto[] };
type UniversalOffer = PublicOffer & { business: { publicId: string } };

function mapBusiness(value: PublicSummary): Business {
  const rawCategory = value.category?.name ?? value.category?.code ?? "Sin categoría";
  const category = rawCategory.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  const location = value.location;
  const cover = value.coverPhoto?.url ?? value.profilePhoto?.url ?? "";
  return {
    id: value.publicId,
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
    socialNetworks: undefined,
    image: cover,
    logo: value.profilePhoto?.url,
    gallery: [cover, ...(value.profilePhoto?.url && value.profilePhoto.url !== cover ? [value.profilePhoto.url] : [])].filter(Boolean),
    tags: [value.sede ? `Sede ${value.sede.replace(/^sede\s+/i, "")}` : "", ...(value.secondaryCategories ?? []).filter((item): item is Exclude<PublicCategory, null> => Boolean(item)).map((item) => item.name), value.adultOnly ? "+18" : ""].filter(Boolean),
    description: value.description ?? "",
    coordinates: location?.latitude != null && location?.longitude != null ? { lat: location.latitude, lng: location.longitude } : undefined,
    coordinatesVerified: location?.latitude != null && location?.longitude != null,
    isFeatured: Boolean(value.isFeatured),
    plan: value.plan === "premium" ? "premium" : "free",
  };
}

function mapProduct(value: PublicOffer, businessId: string): Product {
  const image = value.photos[0]?.url ?? "";
  const amount = value.price.amount ? Number(value.price.amount) : undefined;
  const currency = value.price.currency ?? "COP";
  const formatAmount = (raw: number) => `${new Intl.NumberFormat("es-CO", { style: "currency", currency, maximumFractionDigits: 0 }).format(raw).replace(/\u00a0/g, " ")} ${currency}`;
  const priceLabel = value.price.negotiable ? "Precio a convenir" : amount !== undefined ? formatAmount(amount) : value.price.text && Number.isFinite(Number(value.price.text)) ? formatAmount(Number(value.price.text)) : "Consultar precio";
  const business = (value as PublicOffer & { business?: { name?: string; location?: { latitude: number | null; longitude: number | null } | null } }).business;
  return { id: value.id, businessId, name: value.name, description: value.description ?? "", image, price: amount, priceLabel, businessName: business?.name, businessCoordinates: business?.location?.latitude != null && business.location.longitude != null ? { lat: business.location.latitude, lng: business.location.longitude } : undefined };
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
  return { id: value.id, businessId, name: value.name, description: value.description ?? "", image: value.photos[0]?.url ?? "", priceLabel: formatServicePrice(value), businessName: business?.name, businessCoordinates: business?.location?.latitude != null && business.location.longitude != null ? { lat: business.location.latitude, lng: business.location.longitude } : undefined };
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
    business.gallery = response.business.gallery.map(item => item.url);
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

export async function searchPublicUniversal(params: Record<string, string | number | undefined>): Promise<{ businesses: Business[]; products: Product[]; services: Service[]; pagination: any }> {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => { if (value !== undefined && value !== "") search.set(key, String(value)); });
  const response = await requestWithSession<{ businesses: PublicSummary[]; products: UniversalOffer[]; services: UniversalOffer[]; pagination: any }>(`/api/v1/public/search?${search.toString()}`);
  const businesses = response.businesses.map(mapBusiness);
  const products = response.products.map((item) => mapProduct(item, item.business.publicId));
  const services = response.services.map((item) => mapService(item, item.business.publicId));
  return { businesses, products, services, pagination: response.pagination };
}
