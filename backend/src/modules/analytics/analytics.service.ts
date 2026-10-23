import { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';

const PUBLIC_BUSINESS = { businessAccount: { status: 'ACTIVE' }, lifecycleStatus: 'ACTIVE', publicationStatus: 'PUBLISHED', visibilityStatus: 'VISIBLE', deletionStatus: 'NONE' } as const;
const EVENT_TYPES = ['BUSINESS_VIEW', 'SEARCH_IMPRESSION', 'WHATSAPP_CLICK', 'PHONE_CLICK'] as const;
export type AnalyticsEventType = typeof EVENT_TYPES[number];
export type AnalyticsPeriod = 'day' | 'week' | 'month' | 'year' | 'all';

function publicBusiness(identifier: string) {
  return prisma.business.findFirst({ where: { OR: [{ id: identifier }, { publicId: identifier }], ...PUBLIC_BUSINESS }, select: { id: true, publicId: true } });
}

function periodStart(period: AnalyticsPeriod, now = new Date()): Date | null {
  if (period === 'all') return null;
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const values = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]));
  const date = new Date(Date.UTC(values.year, values.month - 1, values.day));
  if (period === 'day') return new Date(date.getTime() + 5 * 60 * 60 * 1000);
  if (period === 'week') { const day = date.getUTCDay() || 7; date.setUTCDate(date.getUTCDate() - day + 1); }
  if (period === 'month') date.setUTCDate(1);
  if (period === 'year') { date.setUTCMonth(0, 1); }
  return new Date(date.getTime() + 5 * 60 * 60 * 1000);
}

export async function recordAnalyticsEvent(input: { businessId: string; eventType: string; dedupeKey?: string; actorUserId?: string }) {
  if (!EVENT_TYPES.includes(input.eventType as AnalyticsEventType)) throw new AppError(400, 'INVALID_ANALYTICS_EVENT', 'Tipo de evento no permitido.');
  const business = await publicBusiness(input.businessId);
  if (!business) throw new AppError(404, 'BUSINESS_NOT_AVAILABLE', 'El establecimiento no está disponible.');
  try {
    await prisma.businessAnalyticsEvent.create({ data: { businessId: business.id, eventType: input.eventType as AnalyticsEventType, actorUserId: input.actorUserId, dedupeKey: input.dedupeKey?.slice(0, 191) || undefined } });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
  }
  return { recorded: true, businessId: business.publicId };
}

export async function getBusinessAnalytics(userId: string, identifier: string, period: AnalyticsPeriod) {
  const business = await prisma.business.findFirst({
    where: { OR: [{ id: identifier }, { publicId: identifier }], memberships: { some: { userId, status: 'ACTIVE' } } },
    select: { id: true, publicId: true, memberships: { where: { userId, status: 'ACTIVE' }, include: { permissions: true }, take: 1 } },
  });
  if (!business) throw new AppError(404, 'BUSINESS_NOT_FOUND', 'No encontramos ese negocio.');
  const membership = business.memberships[0];
  if (!membership || (membership.role !== 'OWNER' && !membership.permissions.some(item => item.permission === 'READ_ANALYTICS' && item.allowed))) {
    throw new AppError(403, 'BUSINESS_PERMISSION_DENIED', 'No tienes permiso para consultar las estadísticas de este negocio.');
  }
  const start = periodStart(period);
  const rows = await prisma.businessAnalyticsEvent.groupBy({ by: ['eventType'], where: { businessId: business.id, ...(start ? { createdAt: { gte: start } } : {}) }, _count: { _all: true } });
  const counts = Object.fromEntries(rows.map((row) => [row.eventType, row._count._all]));
  const [promotionViews, promotionRanking, offerLikes] = await Promise.all([
    prisma.businessPromotionView.count({ where: { businessId: business.id, ...(start ? { createdAt: { gte: start } } : {}) } }),
    prisma.businessPromotionView.groupBy({ by: ['promotionId'], where: { businessId: business.id, promotion: { deletedAt: null }, ...(start ? { createdAt: { gte: start } } : {}) }, _count: { _all: true }, orderBy: { _count: { promotionId: 'desc' } }, take: 10 }),
    prisma.businessOfferLike.groupBy({ by: ['offerId'], where: { offer: { businessId: business.id, deletedAt: null }, ...(start ? { createdAt: { gte: start } } : {}) }, _count: { _all: true }, orderBy: { _count: { offerId: 'desc' } }, take: 10 }),
  ]);
  const offerIds = offerLikes.map((row) => row.offerId);
  const promotionIds = promotionRanking.map((row) => row.promotionId);
  const offers = offerIds.length ? await prisma.businessOffer.findMany({ where: { id: { in: offerIds } }, select: { id: true, internalCode: true, name: true, kind: true, photos: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }], take: 1, select: { id: true } } } }) : [];
  const promotions = promotionIds.length ? await prisma.businessPromotion.findMany({ where: { id: { in: promotionIds } }, select: { id: true, title: true } }) : [];
  const offerNames = new Map(offers.map((offer) => [offer.id, offer]));
  const promotionNames = new Map(promotions.map((promotion) => [promotion.id, promotion.title]));
  return { period, timezone: 'America/Bogota', metrics: { businessViews: counts.BUSINESS_VIEW ?? 0, searchAppearances: counts.SEARCH_IMPRESSION ?? 0, whatsappClicks: counts.WHATSAPP_CLICK ?? 0, phoneClicks: counts.PHONE_CLICK ?? 0, promotionViews }, rankings: { offerLikes: offerLikes.map((row) => { const offer = offerNames.get(row.offerId); const photoId = offer?.photos[0]?.id; return { offerId: row.offerId, code: offer?.internalCode ?? null, name: offer?.name ?? 'Publicación', kind: offer?.kind ?? null, photoUrl: photoId ? `/api/v1/businesses/${business.id}/photos/${photoId}/content` : null, value: row._count._all }; }), mostViewedPromotions: promotionRanking.map(row => ({ promotionId: row.promotionId, title: promotionNames.get(row.promotionId) ?? 'Promoción', value: row._count._all })) } };
}
