import { type Prisma, type PrismaClient } from '../../generated/prisma/client.js';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';
import { photoStoragePath } from '../business/photo-storage.js';
import { isSubscriptionEffective } from '../business/recognition.service.js';

type PublicDb = Pick<PrismaClient, 'business' | 'businessOffer' | 'businessReview' | 'photo'> & { user?: PrismaClient['user'] };
type PublicOfferKind = 'PRODUCT' | 'SERVICE';
export type PublicAccessContext = { userId?: string };

export type PublicBusinessListInput = {
  page: number;
  pageSize: number;
};

export type PublicUniversalSearchInput = {
  query: string;
  category?: string;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  businessPage: number;
  businessPageSize: number;
  productPage: number;
  productPageSize: number;
  servicePage: number;
  servicePageSize: number;
};

const PUBLIC_BUSINESS_BASE_WHERE: Prisma.BusinessWhereInput = {
  businessAccount: { status: 'ACTIVE' },
  lifecycleStatus: 'ACTIVE',
  publicationStatus: 'PUBLISHED',
  visibilityStatus: 'VISIBLE',
  deletionStatus: 'NONE',
};

function publicBusinessWhereWithCurrentPeriod(): Prisma.BusinessWhereInput {
  const now = new Date();
  return { ...PUBLIC_BUSINESS_BASE_WHERE, OR: [{ visibilityPeriods: { none: {} } }, { visibilityPeriods: { some: { startsAt: { lte: now }, expiresAt: { gt: now } } } }] };
}

const publicCategorySelect = {
  id: true,
  code: true,
  translations: {
    where: { locale: 'es' },
    select: { name: true, iconKey: true },
    take: 1,
  },
} as const;

const publicPhotoSelect = {
  id: true,
  altText: true,
  sortOrder: true,
  isCover: true,
} as const;

const publicLocationSelect = {
  countryCode: true,
  regionCode: true,
  regionName: true,
  cityName: true,
  zoneName: true,
  address: true,
  additionalAddressInfo: true,
  postalCode: true,
  latitude: true,
  longitude: true,
  visibility: true,
  timezone: true,
} as const;

const publicOfferSelect = {
  id: true,
  kind: true,
  createdAt: true,
  adultOnly: true,
  name: true,
  description: true,
  priceAmount: true,
  currency: true,
  priceText: true,
  negotiable: true,
  category: { select: publicCategorySelect },
  photos: { select: publicPhotoSelect, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
  promotions: { where: { active: true, deletedAt: null, startsAt: { lte: new Date() }, endsAt: { gte: new Date() } }, orderBy: { startsAt: 'asc' }, take: 1, select: { id: true, type: true, conditions: true, originalPrice: true, promotionalPrice: true, startsAt: true, endsAt: true, photos: { select: { id: true, sortOrder: true }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] } } },
} satisfies Prisma.BusinessOfferSelect;

// Select only the commercial fields used by the public contract. Besides avoiding
// accidental exposure when the Business model grows, this keeps the public query
// independent from administrative-only scalar fields.
const publicBusinessDetailSelect = {
  brand: { select: { pioneer: { select: { number: true } } } },
  publicId: true,
  createdAt: true,
  name: true,
  sede: true,
  adultOnly: true,
  description: true,
  website: true,
  instagram: true,
  facebookUrl: true,
  xUrl: true,
  tiktokUrl: true,
  email: true,
  phone: true,
  whatsapp: true,
  category: { select: publicCategorySelect },
  subscriptions: { where: { plan: 'PRO', status: 'ACTIVE' }, select: { plan: true, status: true, startsAt: true, expiresAt: true, specialActivation: true, revokedAt: true }, orderBy: { startsAt: 'desc' }, take: 3 },
  secondaryCategories: { include: { category: { select: publicCategorySelect } }, orderBy: { createdAt: 'asc' } },
  location: { select: publicLocationSelect },
  coverPhoto: { select: publicPhotoSelect },
  profilePhoto: { select: publicPhotoSelect },
  photos: { where: { isGallery: true }, select: publicPhotoSelect, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
  modalities: {
    where: { status: 'ACTIVE' },
    select: {
      type: true,
      hours: { select: { dayOfWeek: true, isClosed: true, opensAt: true, closesAt: true, timezone: true }, orderBy: { dayOfWeek: 'asc' } },
    },
    orderBy: { createdAt: 'asc' },
  },
  offers: {
    where: { active: true, deletedAt: null, publicationStatus: 'PUBLISHED' },
    select: publicOfferSelect,
    orderBy: { updatedAt: 'desc' },
  },
} satisfies Prisma.BusinessSelect;

async function canViewAdultContent(viewer: PublicAccessContext | undefined, db: PublicDb) {
  if (!viewer?.userId || !db.user) return false;
  const user = await db.user.findUnique({ where: { id: viewer.userId }, select: { status: true, adultContentEnabled: true, adultContentAcceptedAt: true, adultContentRevokedAt: true } });
  return Boolean(user?.status === 'ACTIVE' && user.adultContentEnabled && user.adultContentAcceptedAt && !user.adultContentRevokedAt);
}

function publicBusinessWhere(canViewAdult: boolean) {
  const where = publicBusinessWhereWithCurrentPeriod();
  return canViewAdult ? where : { ...where, adultOnly: false };
}

function asNumber(value: unknown) {
  return value === null || value === undefined ? null : Number(value);
}

function hasText(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0;
}

function category(value: any) {
  if (!value) return null;
  const translation = value.translations?.[0] ?? null;
  return { id: value.id, code: value.code, name: translation?.name ?? value.code, iconKey: translation?.iconKey ?? null };
}

function photo(publicId: string, value: any) {
  if (!value) return null;
  return {
    id: value.id,
    createdAt: value.createdAt,
    url: `/api/v1/public/businesses/${encodeURIComponent(publicId)}/photos/${value.id}/content`,
    altText: value.altText ?? null,
    sortOrder: value.sortOrder,
    isCover: value.isCover,
  };
}

function location(value: any) {
  if (!value) return null;
  const isPublic = value.visibility === 'PUBLIC';
  return {
    countryCode: value.countryCode,
    regionCode: value.regionCode ?? null,
    regionName: value.regionName ?? null,
    cityName: value.cityName,
    zoneName: value.zoneName ?? null,
    timezone: value.timezone,
    visibility: value.visibility,
    address: isPublic ? value.address : null,
    additionalAddressInfo: isPublic ? value.additionalAddressInfo ?? null : null,
    postalCode: isPublic ? value.postalCode ?? null : null,
    latitude: isPublic ? asNumber(value.latitude) : null,
    longitude: isPublic ? asNumber(value.longitude) : null,
  };
}

function offer(publicId: string, value: any) {
  const promotion = value.promotions?.[0] ?? null;
  const promotionPrice = promotion?.promotionalPrice === null || promotion?.promotionalPrice === undefined ? null : String(promotion.promotionalPrice);
  return {
    id: value.id,
    createdAt: value.createdAt,
    adultOnly: Boolean(value.adultOnly),
    name: value.name,
    description: value.description ?? null,
    category: category(value.category),
    price: {
      amount: promotionPrice ?? (value.priceAmount === null || value.priceAmount === undefined ? null : String(value.priceAmount)),
      currency: value.currency ?? null,
      text: value.priceText ?? null,
      negotiable: value.negotiable,
    },
    originalPrice: promotion?.originalPrice === null || promotion?.originalPrice === undefined ? null : String(promotion.originalPrice),
    isOffer: Boolean(promotion),
    offerLabel: promotion?.type === 'OFFER' ? 'OFERTA' : promotion ? 'PROMOCIÓN' : null,
    discount: promotion?.originalPrice && promotion?.promotionalPrice ? `${Math.round((1 - Number(promotion.promotionalPrice) / Number(promotion.originalPrice)) * 100)}% dto.` : null,
    offerDeadline: promotion ? promotion.endsAt.toISOString() : null,
    promotion: promotion ? { id: promotion.id, type: promotion.type, conditions: promotion.conditions, startsAt: promotion.startsAt, endsAt: promotion.endsAt, photos: promotion.photos.map((item: any) => ({ id: item.id, sortOrder: item.sortOrder, url: `/api/v1/public/promotions/${promotion.id}/photos/${item.id}` })) } : null,
    photos: promotion?.photos?.length ? promotion.photos.map((item: any) => ({ id: item.id, sortOrder: item.sortOrder, url: `/api/v1/public/promotions/${promotion.id}/photos/${item.id}`, altText: null, isCover: item.sortOrder === 0 })) : (value.photos ?? []).map((item: any) => photo(publicId, item)),
  };
}

async function reviewSummaries(values: any[], db: PublicDb) {
  const ids = values.map((value) => value.id).filter(Boolean);
  if (!ids.length || !db.businessReview) return new Map<string, { average: number | null; count: number }>();
  const rows = await db.businessReview.groupBy({ by: ['businessId'], where: { businessId: { in: ids }, status: 'PUBLISHED' }, _avg: { rating: true }, _count: { _all: true } });
  return new Map(rows.map((row) => [row.businessId, { average: row._avg.rating === null ? null : Number(row._avg.rating), count: row._count._all }]));
}

function summary(value: any, review?: { average: number | null; count: number }) {
  return {
    publicId: value.publicId,
    createdAt: value.createdAt,
    pioneerNumber: Number.isInteger(value.brand?.pioneer?.number) && value.brand.pioneer.number >= 1 && value.brand.pioneer.number <= 20 ? value.brand.pioneer.number : null,
    name: value.name,
    sede: value.sede ?? null,
    adultOnly: value.adultOnly,
    description: value.description ?? null,
    category: category(value.category),
    location: location(value.location),
    coverPhoto: photo(value.publicId, value.coverPhoto),
    profilePhoto: photo(value.publicId, value.profilePhoto),
    isFeatured: (value.subscriptions ?? []).some((subscription: any) => isSubscriptionEffective(subscription)),
    plan: (value.subscriptions ?? []).some((subscription: any) => isSubscriptionEffective(subscription)) ? 'premium' : 'free',
    rating: review?.average ?? null,
    reviewCount: review?.count ?? 0,
  };
}

function detail(value: any, canViewAdult: boolean, review?: { average: number | null; count: number }) {
  const modalities = (value.modalities ?? []).map((modality: any) => ({
    type: modality.type,
    hours: modality.hours.map((hour: any) => ({
      dayOfWeek: hour.dayOfWeek,
      isClosed: hour.isClosed,
      opensAt: hour.opensAt ?? null,
      closesAt: hour.closesAt ?? null,
      timezone: hour.timezone,
    })),
  }));
  const visibleOffers = (value.offers ?? []).filter((item: any) => canViewAdult || !item.adultOnly);
  const products = visibleOffers.filter((item: any) => item.kind === 'PRODUCT').map((item: any) => offer(value.publicId, item));
  const services = visibleOffers.filter((item: any) => item.kind === 'SERVICE').map((item: any) => offer(value.publicId, item));
  return {
    ...summary(value, review),
    secondaryCategories: (value.secondaryCategories ?? []).map((item: any) => category(item.category)),
    gallery: (value.photos ?? []).map((item: any) => photo(value.publicId, item)),
    // Only Business commercial fields; never fall back to the owner or login account.
    contacts: {
      email: hasText(value.email) ? value.email.trim() : null,
      phone: hasText(value.phone) ? value.phone.trim() : null,
      whatsapp: hasText(value.whatsapp) ? value.whatsapp.trim() : null,
      website: value.website ?? null,
    },
    socialNetworks: {
      instagram: value.instagram ?? null,
      facebook: value.facebookUrl ?? null,
      x: value.xUrl ?? null,
      tiktok: value.tiktokUrl ?? null,
    },
    modalities,
    products,
    services,
    // Active promotions are overlaid at serialization time; the original offer remains unchanged.
    offers: [],
  };
}

function validatePositiveInteger(value: unknown, fallback: number, maximum: number, field: string) {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^\d+$/.test(value)) throw new AppError(400, 'INVALID_PUBLIC_QUERY', `${field} debe ser un entero positivo.`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) throw new AppError(400, 'INVALID_PUBLIC_QUERY', `${field} está fuera del rango permitido.`);
  return parsed;
}

export function parsePublicBusinessListInput(query: Record<string, unknown>): PublicBusinessListInput {
  return {
    page: validatePositiveInteger(query.page, 1, 1_000_000, 'page'),
    pageSize: validatePositiveInteger(query.pageSize, 12, 50, 'pageSize'),
  };
}

function optionalNumber(value: unknown, field: string) {
  if (value === undefined || value === '') return undefined;
  if (typeof value !== 'string' || !/^-?\d+(\.\d+)?$/.test(value)) throw new AppError(400, 'INVALID_PUBLIC_QUERY', `${field} debe ser un número válido.`);
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new AppError(400, 'INVALID_PUBLIC_QUERY', `${field} debe ser un número válido.`);
  return parsed;
}

export function parseUniversalSearchInput(query: Record<string, unknown>): PublicUniversalSearchInput {
  const latitude = optionalNumber(query.latitude, 'latitude');
  const longitude = optionalNumber(query.longitude, 'longitude');
  const radiusKm = optionalNumber(query.radiusKm, 'radiusKm');
  if (latitude !== undefined && (latitude < -90 || latitude > 90)) throw new AppError(400, 'INVALID_PUBLIC_QUERY', 'latitude está fuera de rango.');
  if (longitude !== undefined && (longitude < -180 || longitude > 180)) throw new AppError(400, 'INVALID_PUBLIC_QUERY', 'longitude está fuera de rango.');
  if (radiusKm !== undefined && (radiusKm <= 0 || radiusKm > 500)) throw new AppError(400, 'INVALID_PUBLIC_QUERY', 'radiusKm está fuera de rango.');
  return {
    query: typeof query.q === 'string' ? query.q.trim() : '',
    category: typeof query.category === 'string' && query.category.trim() ? query.category.trim() : undefined,
    latitude, longitude, radiusKm,
    businessPage: validatePositiveInteger(query.businessPage, 1, 1_000_000, 'businessPage'),
    businessPageSize: validatePositiveInteger(query.businessPageSize, 12, 50, 'businessPageSize'),
    productPage: validatePositiveInteger(query.productPage, 1, 1_000_000, 'productPage'),
    productPageSize: validatePositiveInteger(query.productPageSize, 12, 50, 'productPageSize'),
    servicePage: validatePositiveInteger(query.servicePage, 1, 1_000_000, 'servicePage'),
    servicePageSize: validatePositiveInteger(query.servicePageSize, 12, 50, 'servicePageSize'),
  };
}

async function findPublicBusinessId(publicId: string, db: PublicDb, canViewAdult: boolean) {
  const business = await db.business.findFirst({ where: { publicId, ...publicBusinessWhere(canViewAdult) }, select: { id: true } });
  if (!business) throw new AppError(404, 'PUBLIC_BUSINESS_NOT_FOUND', 'No encontramos ese establecimiento público.');
  return business.id;
}

function pioneerPriority(value: any) { return Number.isInteger(value?.brand?.pioneer?.number) && value.brand.pioneer.number >= 1 && value.brand.pioneer.number <= 20 ? 1 : 0; }
function featuredPriority(value: any) { return (value?.subscriptions ?? []).some((subscription: any) => isSubscriptionEffective(subscription)) ? 1 : 0; }
function prioritizeBusinesses<T extends { id?: string; publicId?: string }>(items: T[]) { return [...items].sort((a: any, b: any) => pioneerPriority(b) - pioneerPriority(a) || featuredPriority(b) - featuredPriority(a) || String(a.publicId ?? a.id ?? '').localeCompare(String(b.publicId ?? b.id ?? ''))); }

export async function listPublicBusinesses(input: PublicBusinessListInput, db: PublicDb = prisma, viewer?: PublicAccessContext) {
  const canViewAdult = await canViewAdultContent(viewer, db);
  const where = publicBusinessWhere(canViewAdult);
  const [total, businesses] = await Promise.all([
    db.business.count({ where }),
    db.business.findMany({
      where,
      select: {
        publicId: true,
        createdAt: true,
        name: true,
        sede: true,
        adultOnly: true,
        description: true,
        category: { select: publicCategorySelect },
        modalities: { where: { status: 'ACTIVE' }, select: { type: true }, orderBy: { createdAt: 'asc' } },
        subscriptions: { where: { plan: 'PRO', status: 'ACTIVE' }, select: { plan: true, status: true, startsAt: true, expiresAt: true, specialActivation: true, revokedAt: true }, orderBy: { startsAt: 'desc' }, take: 3 },
        location: { select: publicLocationSelect },
        coverPhoto: { select: publicPhotoSelect },
        profilePhoto: { select: publicPhotoSelect },
        brand: { select: { pioneer: { select: { number: true } } } },
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
    }),
  ]);
  const ratings = await reviewSummaries(businesses, db);
  return {
    businesses: prioritizeBusinesses(businesses).map((item) => summary(item, ratings.get(item.id))).slice((input.page - 1) * input.pageSize, input.page * input.pageSize),
    pagination: { page: input.page, pageSize: input.pageSize, total, totalPages: Math.ceil(total / input.pageSize) },
  };
}

function distanceKm(latitude: number, longitude: number, value: any) {
  const lat = value?.location?.latitude === null || value?.location?.latitude === undefined ? null : Number(value.location.latitude);
  const lng = value?.location?.longitude === null || value?.location?.longitude === undefined ? null : Number(value.location.longitude);
  if (lat === null || lng === null) return Number.POSITIVE_INFINITY;
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = radians(lat - latitude); const dLng = radians(lng - longitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(latitude)) * Math.cos(radians(lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function universalPagination<T>(items: T[], page: number, pageSize: number) {
  const total = items.length;
  return { items: items.slice((page - 1) * pageSize, page * pageSize), pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
}

function normalizeSearchText(value: unknown) {
  return typeof value === 'string'
    ? value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-CO').replace(/[^\p{L}\p{N}\s]+/gu, ' ').replace(/\s+/g, ' ').trim()
    : '';
}

function searchTerms(value: unknown) {
  return normalizeSearchText(value).split(' ').filter(Boolean);
}

function matchesSearch(fields: unknown[], terms: string[]) {
  if (!terms.length) return true;
  const haystack = fields.map(normalizeSearchText).filter(Boolean).join(' ');
  return terms.every(term => haystack.includes(term));
}

function searchRank(fields: { name?: unknown; category?: unknown; offer?: unknown; description?: unknown }, terms: string[]) {
  if (!terms.length) return 0;
  const name = normalizeSearchText(fields.name);
  const category = normalizeSearchText(fields.category);
  const offer = normalizeSearchText(fields.offer);
  const description = normalizeSearchText(fields.description);
  if (!matchesSearch([name, category, offer, description], terms)) return 0;
  const query = terms.join(' ');
  if (name === query) return 100;
  if (name.includes(query)) return 80;
  if (category.includes(query)) return 60;
  if (offer.includes(query)) return 40;
  return 20;
}

export async function searchPublicUniversal(input: PublicUniversalSearchInput, db: PublicDb = prisma, viewer?: PublicAccessContext) {
  const canViewAdult = await canViewAdultContent(viewer, db);
  const businessWhere = publicBusinessWhere(canViewAdult);
  const terms = searchTerms(input.query);
  const categoryTerms = searchTerms(input.category);
  const offerWhere: any = {
    active: true, deletedAt: null, publicationStatus: 'PUBLISHED',
    business: businessWhere,
    ...(canViewAdult ? {} : { adultOnly: false }),
  };
  const [businesses, products, services] = await Promise.all([
    db.business.findMany({ where: businessWhere, select: { id: true, publicId: true, createdAt: true, name: true, sede: true, adultOnly: true, description: true, category: { select: publicCategorySelect }, subscriptions: { where: { plan: 'PRO', status: 'ACTIVE' }, select: { plan: true, status: true, startsAt: true, expiresAt: true, specialActivation: true, revokedAt: true }, orderBy: { startsAt: 'desc' }, take: 3 }, location: { select: publicLocationSelect }, coverPhoto: { select: publicPhotoSelect }, profilePhoto: { select: publicPhotoSelect }, brand: { select: { pioneer: { select: { number: true } } } } }, orderBy: { updatedAt: 'desc' } }),
    db.businessOffer.findMany({ where: { ...offerWhere, kind: 'PRODUCT' }, select: { ...publicOfferSelect, business: { select: { publicId: true, name: true, description: true, category: { select: publicCategorySelect }, location: { select: publicLocationSelect } } } }, orderBy: { updatedAt: 'desc' } }),
    db.businessOffer.findMany({ where: { ...offerWhere, kind: 'SERVICE' }, select: { ...publicOfferSelect, business: { select: { publicId: true, name: true, description: true, category: { select: publicCategorySelect }, location: { select: publicLocationSelect } } } }, orderBy: { updatedAt: 'desc' } }),
  ]);
  const categoryMatches = (item: any) => !categoryTerms.length || matchesSearch([item.category?.code, item.category?.translations?.[0]?.name], categoryTerms);
  const inRadius = (value: any) => input.latitude !== undefined && input.longitude !== undefined && input.radiusKm !== undefined ? distanceKm(input.latitude, input.longitude, value) <= input.radiusKm : true;
  const sortNearby = (a: any, b: any) => input.latitude !== undefined && input.longitude !== undefined ? distanceKm(input.latitude, input.longitude, a) - distanceKm(input.latitude, input.longitude, b) : 0;
  const matchingOffers = [...products, ...services].filter((item: any) => categoryMatches(item) && (terms.length ? searchRank({ name: item.name, category: item.category?.translations?.[0]?.name, offer: item.name, description: item.description }, terms) > 0 : true));
  const matchingBusinessIds = new Set(matchingOffers.map((item: any) => item.business.publicId));
  const businessItems = businesses.map((item: any) => ({ item, rank: searchRank({ name: item.name, category: item.category?.translations?.[0]?.name, description: item.description }, terms) }));
  // Cuando el usuario solicita un radio, los negocios sin coordenadas públicas
  // verificables quedan fuera (distanceKm devuelve Infinity). Sin radio, se
  // conserva el comportamiento actual y no se aplica ningún filtro geográfico.
  const ratings = await reviewSummaries(businesses, db);
  const filteredBusinesses = businessItems.filter(({ item, rank }) => categoryMatches(item) && inRadius(item) && (!terms.length || rank > 0 || matchingBusinessIds.has(item.publicId))).sort((a, b) => pioneerPriority(b.item) - pioneerPriority(a.item) || featuredPriority(b.item) - featuredPriority(a.item) || b.rank - a.rank || sortNearby(a.item, b.item) || String(a.item.publicId).localeCompare(String(b.item.publicId))).map(({ item }) => summary(item, ratings.get(item.id)));
  const mapOffer = (item: any) => ({ ...offer(item.business.publicId, item), business: { publicId: item.business.publicId, name: item.business.name, location: location(item.business.location) } });
  const filteredProducts = products.filter((item: any) => categoryMatches(item) && (!terms.length || matchingOffers.includes(item)) && inRadius(item)).sort(sortNearby).map(mapOffer);
  const filteredServices = services.filter((item: any) => categoryMatches(item) && (!terms.length || matchingOffers.includes(item)) && inRadius(item)).sort(sortNearby).map(mapOffer);
  const businessResult = universalPagination(filteredBusinesses, input.businessPage, input.businessPageSize);
  const productResult = universalPagination(filteredProducts, input.productPage, input.productPageSize);
  const serviceResult = universalPagination(filteredServices, input.servicePage, input.servicePageSize);
  return { businesses: businessResult.items, products: productResult.items, services: serviceResult.items, pagination: { businesses: businessResult.pagination, products: productResult.pagination, services: serviceResult.pagination } };
}

export async function getPublicBusiness(publicId: string, db: PublicDb = prisma, viewer?: PublicAccessContext) {
  const canViewAdult = await canViewAdultContent(viewer, db);
  const business = await db.business.findFirst({ where: { publicId, ...publicBusinessWhere(canViewAdult) }, select: publicBusinessDetailSelect });
  if (!business) throw new AppError(404, 'PUBLIC_BUSINESS_NOT_FOUND', 'No encontramos ese establecimiento público.');
  const ratings = await reviewSummaries([business], db);
  return detail(business, canViewAdult, ratings.get(business.id));
}

async function listPublicOffers(publicId: string, kind: PublicOfferKind, db: PublicDb = prisma, viewer?: PublicAccessContext) {
  const canViewAdult = await canViewAdultContent(viewer, db);
  const businessId = await findPublicBusinessId(publicId, db, canViewAdult);
  const offers = await db.businessOffer.findMany({
    where: { businessId, kind, active: true, deletedAt: null, publicationStatus: 'PUBLISHED', ...(canViewAdult ? {} : { adultOnly: false }) },
    select: publicOfferSelect,
    orderBy: { updatedAt: 'desc' },
  });
  return offers.map(item => offer(publicId, item));
}

export const listPublicProducts = (publicId: string, db: PublicDb = prisma, viewer?: PublicAccessContext) => listPublicOffers(publicId, 'PRODUCT', db, viewer);
export const listPublicServices = (publicId: string, db: PublicDb = prisma, viewer?: PublicAccessContext) => listPublicOffers(publicId, 'SERVICE', db, viewer);

export async function listPublicPhotos(publicId: string, db: PublicDb = prisma, viewer?: PublicAccessContext) {
  const canViewAdult = await canViewAdultContent(viewer, db);
  const businessId = await findPublicBusinessId(publicId, db, canViewAdult);
  const photos = await db.photo.findMany({
    where: {
      OR: [
        { businessId, isGallery: true },
        { coverForBusiness: { id: businessId } },
        { profileForBusiness: { id: businessId } },
      ],
    },
    select: publicPhotoSelect,
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  return photos.map(item => photo(publicId, item));
}

export async function listPublicOffersForBusiness(publicId: string, db: PublicDb = prisma, viewer?: PublicAccessContext) {
  const canViewAdult = await canViewAdultContent(viewer, db);
  await findPublicBusinessId(publicId, db, canViewAdult);
  return [] as const;
}

export async function getPublicPhotoContent(publicId: string, photoId: string, db: PublicDb = prisma, viewer?: PublicAccessContext) {
  const canViewAdult = await canViewAdultContent(viewer, db);
  const businessId = await findPublicBusinessId(publicId, db, canViewAdult);
  const value = await db.photo.findFirst({
    where: {
      id: photoId,
      OR: [
        { businessId, isGallery: true },
        { coverForBusiness: { id: businessId } },
        { profileForBusiness: { id: businessId } },
        { offer: { businessId, active: true, deletedAt: null, publicationStatus: 'PUBLISHED', ...(canViewAdult ? {} : { adultOnly: false }) } },
      ],
    },
    select: { storageKey: true },
  });
  if (!value) throw new AppError(404, 'PUBLIC_PHOTO_NOT_FOUND', 'No encontramos esa fotografía pública.');
  return {
    path: photoStoragePath(value.storageKey),
    mimeType: value.storageKey.endsWith('.png') ? 'image/png' : value.storageKey.endsWith('.webp') ? 'image/webp' : 'image/jpeg',
  };
}

export const publicBusinessRules = { PUBLIC_BUSINESS_WHERE: PUBLIC_BUSINESS_BASE_WHERE, summary, detail };
