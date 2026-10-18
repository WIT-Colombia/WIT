import { type Prisma, type PrismaClient } from '../../generated/prisma/client.js';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';
import { photoStoragePath } from '../business/photo-storage.js';

type PublicDb = Pick<PrismaClient, 'business' | 'businessOffer' | 'photo'> & { user?: PrismaClient['user'] };
type PublicOfferKind = 'PRODUCT' | 'SERVICE';
export type PublicAccessContext = { userId?: string };

export type PublicBusinessListInput = {
  page: number;
  pageSize: number;
};

const PUBLIC_BUSINESS_WHERE = {
  businessAccount: { status: 'ACTIVE' },
  lifecycleStatus: 'ACTIVE',
  publicationStatus: 'PUBLISHED',
  visibilityStatus: 'VISIBLE',
  deletionStatus: 'NONE',
} as const;

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
  adultOnly: true,
  name: true,
  description: true,
  priceAmount: true,
  currency: true,
  priceText: true,
  negotiable: true,
  category: { select: publicCategorySelect },
  photos: { select: publicPhotoSelect, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
} satisfies Prisma.BusinessOfferSelect;

// Select only the commercial fields used by the public contract. Besides avoiding
// accidental exposure when the Business model grows, this keeps the public query
// independent from administrative-only scalar fields.
const publicBusinessDetailSelect = {
  publicId: true,
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
    where: { active: true, publicationStatus: 'PUBLISHED' },
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
  return canViewAdult ? PUBLIC_BUSINESS_WHERE : { ...PUBLIC_BUSINESS_WHERE, adultOnly: false };
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
  return {
    id: value.id,
    adultOnly: Boolean(value.adultOnly),
    name: value.name,
    description: value.description ?? null,
    category: category(value.category),
    price: {
      amount: value.priceAmount === null || value.priceAmount === undefined ? null : String(value.priceAmount),
      currency: value.currency ?? null,
      text: value.priceText ?? null,
      negotiable: value.negotiable,
    },
    photos: (value.photos ?? []).map((item: any) => photo(publicId, item)),
  };
}

function summary(value: any) {
  return {
    publicId: value.publicId,
    name: value.name,
    sede: value.sede ?? null,
    adultOnly: value.adultOnly,
    description: value.description ?? null,
    category: category(value.category),
    location: location(value.location),
    coverPhoto: photo(value.publicId, value.coverPhoto),
    profilePhoto: photo(value.publicId, value.profilePhoto),
  };
}

function detail(value: any, canViewAdult: boolean) {
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
    ...summary(value),
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
    // Products and services are represented by BusinessOffer. A separate promotions model does not exist yet.
    offers: [],
    rating: null,
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

async function findPublicBusinessId(publicId: string, db: PublicDb, canViewAdult: boolean) {
  const business = await db.business.findFirst({ where: { publicId, ...publicBusinessWhere(canViewAdult) }, select: { id: true } });
  if (!business) throw new AppError(404, 'PUBLIC_BUSINESS_NOT_FOUND', 'No encontramos ese establecimiento público.');
  return business.id;
}

export async function listPublicBusinesses(input: PublicBusinessListInput, db: PublicDb = prisma, viewer?: PublicAccessContext) {
  const canViewAdult = await canViewAdultContent(viewer, db);
  const where = publicBusinessWhere(canViewAdult);
  const [total, businesses] = await Promise.all([
    db.business.count({ where }),
    db.business.findMany({
      where,
      select: {
        publicId: true,
        name: true,
        sede: true,
        adultOnly: true,
        description: true,
        category: { select: publicCategorySelect },
        location: { select: publicLocationSelect },
        coverPhoto: { select: publicPhotoSelect },
        profilePhoto: { select: publicPhotoSelect },
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    }),
  ]);
  return {
    businesses: businesses.map(summary),
    pagination: { page: input.page, pageSize: input.pageSize, total, totalPages: Math.ceil(total / input.pageSize) },
  };
}

export async function getPublicBusiness(publicId: string, db: PublicDb = prisma, viewer?: PublicAccessContext) {
  const canViewAdult = await canViewAdultContent(viewer, db);
  const business = await db.business.findFirst({ where: { publicId, ...publicBusinessWhere(canViewAdult) }, select: publicBusinessDetailSelect });
  if (!business) throw new AppError(404, 'PUBLIC_BUSINESS_NOT_FOUND', 'No encontramos ese establecimiento público.');
  return detail(business, canViewAdult);
}

async function listPublicOffers(publicId: string, kind: PublicOfferKind, db: PublicDb = prisma, viewer?: PublicAccessContext) {
  const canViewAdult = await canViewAdultContent(viewer, db);
  const businessId = await findPublicBusinessId(publicId, db, canViewAdult);
  const offers = await db.businessOffer.findMany({
    where: { businessId, kind, active: true, publicationStatus: 'PUBLISHED', ...(canViewAdult ? {} : { adultOnly: false }) },
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
        { offer: { businessId, active: true, publicationStatus: 'PUBLISHED', ...(canViewAdult ? {} : { adultOnly: false }) } },
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

export const publicBusinessRules = { PUBLIC_BUSINESS_WHERE, summary, detail };
