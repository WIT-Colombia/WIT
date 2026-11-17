import { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';
import { completeCountTrend, statisticsWindow, type StatisticsPeriod } from '../analytics/statistics.service.js';
import { isPhotoMissingError, photoMimeType, readPhoto } from '../business/photo-storage.js';

const category = { id: true, code: true, translations: { select: { locale: true, name: true } } } as const;
type Query = Record<string, unknown>;
const text = (value: unknown) => typeof value === 'string' ? value.trim().slice(0, 100) : '';
function pageOf(value: unknown) {
  const page = Number(value ?? 1);
  if (!Number.isInteger(page) || page < 1 || page > 100000) throw new AppError(400, 'INVALID_PAGE', 'La página solicitada no es válida.');
  return page;
}
export function recordDate(value: unknown, end = false) {
  if (value === undefined || value === '') return undefined;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new AppError(400, 'INVALID_DATE', 'Revisa las fechas de consulta.');
  const date = new Date(value + 'T05:00:00.000Z');
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new AppError(400, 'INVALID_DATE', 'La fecha indicada no existe.');
  if (end) date.setUTCDate(date.getUTCDate() + 1);
  return date;
}
export async function recordBusiness(identifier: string) {
  const business = await prisma.business.findFirst({ where: { OR: [{ id: identifier }, { publicId: identifier }] }, select: { id: true } });
  if (!business) throw new AppError(404, 'ADMIN_BUSINESS_NOT_FOUND', 'No encontramos este negocio.');
  return business.id;
}
const pagination = (page: number, total: number, pageSize: number) => ({ page, pageSize, total, totalPages: Math.ceil(total / pageSize) });

export async function recordCatalog(identifier: string, query: Query) {
  const businessId = await recordBusiness(identifier), page = pageOf(query.page), pageSize = 6;
  const kind = text(query.kind) || 'PRODUCT', status = text(query.status), activation = text(query.activation), q = text(query.q);
  if (!['PRODUCT', 'SERVICE'].includes(kind) || !['', 'PUBLISHED', 'REVIEW', 'UNPUBLISHED', 'DELETED'].includes(status) || !['', 'ACTIVE', 'INACTIVE'].includes(activation)) throw new AppError(400, 'INVALID_CATALOG_FILTER', 'Revisa los filtros del catálogo.');
  const where: Prisma.BusinessOfferWhereInput = { businessId, kind: kind as 'PRODUCT' | 'SERVICE',
    ...(q ? { OR: [{ name: { contains: q } }, { internalCode: { contains: q } }] } : {}),
    ...(status === 'DELETED' ? { deletedAt: { not: null } } : status ? { publicationStatus: status as 'PUBLISHED' | 'REVIEW' | 'UNPUBLISHED', deletedAt: null } : {}),
    ...(activation ? { active: activation === 'ACTIVE' } : {}),
  };
  const [total, offers] = await prisma.$transaction([
    prisma.businessOffer.count({ where }),
    prisma.businessOffer.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * pageSize, take: pageSize,
      select: { id: true, internalCode: true, kind: true, name: true, description: true, priceAmount: true, currency: true, priceText: true, negotiable: true,
        publicationStatus: true, administrativeStatus: true, active: true, deletedAt: true, createdAt: true, updatedAt: true,
        category: { select: category }, business: { select: { category: { select: category } } },
        photos: { take: 1, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }], select: { id: true, altText: true } } },
    }),
  ]);
  return { offers: offers.map(({ business, ...offer }) => ({ ...offer, category: offer.category ?? business.category })), pagination: pagination(page, total, pageSize) };
}

export async function recordReviews(identifier: string, query: Query) {
  const businessId = await recordBusiness(identifier), page = pageOf(query.page), pageSize = 6;
  const rating = text(query.rating), from = recordDate(query.from), until = recordDate(query.to, true);
  if ((rating && !/^[1-5]$/.test(rating)) || (from && until && from >= until)) throw new AppError(400, 'INVALID_REVIEW_FILTER', 'Revisa la puntuación y el intervalo de fechas.');
  const where: Prisma.BusinessReviewWhereInput = { businessId, ...(rating ? { rating: Number(rating) } : {}),
    ...(from || until ? { createdAt: { ...(from ? { gte: from } : {}), ...(until ? { lt: until } : {}) } } : {}) };
  const [total, reviews] = await prisma.$transaction([
    prisma.businessReview.count({ where }),
    prisma.businessReview.findMany({ where, skip: (page - 1) * pageSize, take: pageSize, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { id: true, rating: true, comment: true, status: true, createdAt: true, updatedAt: true,
        user: { select: { displayName: true, nickname: true } }, _count: { select: { reports: true } },
        reports: { take: 3, orderBy: { createdAt: 'desc' }, select: { id: true, reason: true, status: true, createdAt: true } } } }),
  ]);
  return { reviews, pagination: pagination(page, total, pageSize) };
}

export async function recordPhotos(identifier: string, query: Query, catalogAllowed: boolean) {
  const businessId = await recordBusiness(identifier), page = pageOf(query.page), pageSize = 12;
  const scope = text(query.scope);
  if (!['', 'BUSINESS', 'OFFER'].includes(scope)) throw new AppError(400, 'INVALID_PHOTO_FILTER', 'Revisa el tipo de fotografía.');
  if (scope === 'OFFER' && !catalogAllowed) throw new AppError(403, 'ADMIN_PERMISSION_DENIED', 'Necesitas permiso de catálogo para consultar estas fotografías.');
  const where: Prisma.PhotoWhereInput = {
    OR: [{ businessId }, { coverForBusiness: { id: businessId } }, { profileForBusiness: { id: businessId } }, ...(catalogAllowed ? [{ offer: { businessId } }] : [])],
    ...(!catalogAllowed || scope === 'BUSINESS' ? { offerId: null } : scope === 'OFFER' ? { offerId: { not: null } } : {}),
  };
  const [total, photos] = await prisma.$transaction([
    prisma.photo.count({ where }), prisma.photo.findMany({ where, skip: (page - 1) * pageSize, take: pageSize,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }, { id: 'asc' }], select: { id: true, altText: true, createdAt: true,
        coverForBusiness: { select: { id: true } }, profileForBusiness: { select: { id: true } }, offer: { select: { id: true, name: true, kind: true } } } }),
  ]);
  return { photos: photos.map(({ coverForBusiness, profileForBusiness, ...photo }) => ({ ...photo, isCover: coverForBusiness?.id === businessId, isProfile: profileForBusiness?.id === businessId })), pagination: pagination(page, total, pageSize) };
}

/** Scoped, authenticated original. Never return storage keys or public URLs. */
export async function recordPhoto(identifier: string, photoId: string, catalogAllowed: boolean) {
  const businessId = await recordBusiness(identifier);
  const photo = await prisma.photo.findFirst({ where: { id: photoId,
    OR: [{ businessId }, { coverForBusiness: { id: businessId } }, { profileForBusiness: { id: businessId } }, { offer: { businessId } }] },
    select: { storageKey: true, offerId: true } });
  if (!photo) throw new AppError(404, 'ADMIN_BUSINESS_PHOTO_NOT_FOUND', 'La fotografía no pertenece a este negocio.');
  if (photo.offerId && !catalogAllowed) throw new AppError(403, 'ADMIN_PERMISSION_DENIED', 'Necesitas permiso de catálogo para consultar esta fotografía.');
  try { return { buffer: await readPhoto(photo.storageKey), mimeType: photoMimeType(photo.storageKey) }; }
  catch (error) {
    if (isPhotoMissingError(error) || (error as NodeJS.ErrnoException)?.code === 'ENOENT') throw new AppError(404, 'ADMIN_BUSINESS_PHOTO_MISSING', 'La fotografía ya no está disponible.');
    throw new AppError(503, 'ADMIN_BUSINESS_PHOTO_UNAVAILABLE', 'No pudimos cargar la fotografía. Inténtalo de nuevo.');
  }
}

export async function recordActivity(identifier: string, periodText: string, now = new Date()) {
  const businessId = await recordBusiness(identifier);
  const period = periodText || 'month';
  if (!['day', 'week', 'month', 'year', 'all'].includes(period)) throw new AppError(400, 'INVALID_PERIOD', 'El período solicitado no es válido.');
  const window = statisticsWindow(period as StatisticsPeriod, now);
  const localNow = new Date(now.getTime() - 5 * 3600000);
  const start = window.start ?? new Date(Date.UTC(localNow.getUTCFullYear() - 2, localNow.getUTCMonth() + 1, 1, 5));
  const format = period === 'day' ? '%Y-%m-%d %H:00' : period === 'year' || period === 'all' ? '%Y-%m' : '%Y-%m-%d';
  const date = { ...(window.start ? { gte: window.start } : {}), lt: now };
  const [events, totals, offers, reviews, reviewCount, offerCounts] = await Promise.all([
    prisma.$queryRaw<Array<{ label: string; eventType: string; quantity: bigint }>>(Prisma.sql`SELECT DATE_FORMAT(DATE_SUB(createdAt, INTERVAL 5 HOUR), ${format}) AS label, eventType, COUNT(*) AS quantity FROM BusinessAnalyticsEvent WHERE businessId=${businessId} AND createdAt>=${start} AND createdAt<${now} GROUP BY label,eventType ORDER BY label`),
    prisma.businessAnalyticsEvent.groupBy({ by: ['eventType'], where: { businessId, createdAt: date }, _count: { _all: true } }),
    prisma.$queryRaw<Array<{ label: string; kind: string; quantity: bigint }>>(Prisma.sql`SELECT DATE_FORMAT(DATE_SUB(createdAt, INTERVAL 5 HOUR), ${format}) AS label,kind,COUNT(*) AS quantity FROM BusinessOffer WHERE businessId=${businessId} AND createdAt>=${start} AND createdAt<${now} GROUP BY label,kind`),
    prisma.$queryRaw<Array<{ label: string; quantity: bigint }>>(Prisma.sql`SELECT DATE_FORMAT(DATE_SUB(createdAt, INTERVAL 5 HOUR), ${format}) AS label,COUNT(*) AS quantity FROM BusinessReview WHERE businessId=${businessId} AND createdAt>=${start} AND createdAt<${now} GROUP BY label`),
    prisma.businessReview.count({ where: { businessId, createdAt: date } }),
    prisma.businessOffer.groupBy({ by: ['kind'], where: { businessId, createdAt: date }, _count: { _all: true } }),
  ]);
  const count = (type: string) => totals.find(row => row.eventType === type)?._count._all ?? 0;
  const grid = completeCountTrend([], period as StatisticsPeriod, start, now);
  const series = grid.map(({ label }) => {
    const rows = events.filter(row => row.label === label);
    const sum = (...types: string[]) => rows.filter(row => types.includes(row.eventType)).reduce((n, row) => n + Number(row.quantity), 0);
    return { label, views: sum('BUSINESS_VIEW'), interactions: sum('WHATSAPP_CLICK', 'PHONE_CLICK', 'DIRECTIONS_CLICK'), offerViews: sum('OFFER_VIEW'),
      reviews: Number(reviews.find(row => row.label === label)?.quantity ?? 0),
      products: Number(offers.find(row => row.label === label && row.kind === 'PRODUCT')?.quantity ?? 0),
      services: Number(offers.find(row => row.label === label && row.kind === 'SERVICE')?.quantity ?? 0) };
  });
  return { period, timezone: 'America/Bogota', start: start.toISOString(), end: now.toISOString(),
    totals: { views: count('BUSINESS_VIEW'), interactions: count('WHATSAPP_CLICK') + count('PHONE_CLICK') + count('DIRECTIONS_CLICK'), offerViews: count('OFFER_VIEW'), reviews: reviewCount,
      products: offerCounts.find(row => row.kind === 'PRODUCT')?._count._all ?? 0, services: offerCounts.find(row => row.kind === 'SERVICE')?._count._all ?? 0 }, series,
    definition: 'Vistas: aperturas registradas de la ficha. Interacciones: clics registrados en WhatsApp, teléfono e indicaciones; no representan personas únicas. Las vistas del catálogo son eventos de productos y servicios. Altas de catálogo y opiniones: registros por fecha de creación, incluidos los retirados después. Fechas de Bogotá; los intervalos transcurridos sin eventos se representan con cero. En Todo el historial, los totales abarcan todos los registros y la gráfica solo los últimos 24 meses.' };
}
