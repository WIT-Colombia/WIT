import { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';
import { recognitionFor } from '../business/recognition.service.js';

export type StatisticsPeriod = 'day' | 'week' | 'month' | 'year' | 'all';
export const STATISTICS_TIMEZONE = 'America/Bogota';
export const REFERRAL_STATISTICS_GOAL = 5;
const eventKeys = {
  BUSINESS_VIEW: 'businessViews',
  SEARCH_IMPRESSION: 'searchAppearances',
  WHATSAPP_CLICK: 'whatsappClicks',
  PHONE_CLICK: 'phoneClicks',
  DIRECTIONS_CLICK: 'directionsClicks',
} as const;
type EventKey = typeof eventKeys[keyof typeof eventKeys];
type EventCount = { eventType: keyof typeof eventKeys; _count: { _all: number } };
const currentCounts = (rows: EventCount[]) => {
  const counts = Object.fromEntries(rows.map(row => [eventKeys[row.eventType], row._count._all]));
  return {
    businessViews: counts.businessViews ?? 0,
    searchAppearances: counts.searchAppearances ?? 0,
    whatsappClicks: counts.whatsappClicks ?? 0,
    phoneClicks: counts.phoneClicks ?? 0,
    directionsClicks: counts.directionsClicks ?? 0,
  };
};

export function statisticsWindow(period: StatisticsPeriod, now = new Date()) {
  if (period === 'all') return { start: null, end: now, previousStart: null, previousEnd: null };
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: STATISTICS_TIMEZONE, year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(now);
  const fields = Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]));
  const start = new Date(Date.UTC(fields.year, fields.month - 1, fields.day, 5));
  if (period === 'week') start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  if (period === 'month') start.setUTCDate(1);
  if (period === 'year') start.setUTCMonth(0, 1);
  const previousStart = new Date(start);
  if (period === 'day') previousStart.setUTCDate(previousStart.getUTCDate() - 1);
  if (period === 'week') previousStart.setUTCDate(previousStart.getUTCDate() - 7);
  if (period === 'month') previousStart.setUTCMonth(previousStart.getUTCMonth() - 1);
  if (period === 'year') previousStart.setUTCFullYear(previousStart.getUTCFullYear() - 1);
  // Suppress a comparison if the preceding calendar interval was shorter.
  const elapsed = now.getTime() - start.getTime();
  if (elapsed > start.getTime() - previousStart.getTime()) return { start, end: now, previousStart: null, previousEnd: null };
  const previousEnd = new Date(previousStart.getTime() + elapsed);
  return { start, end: now, previousStart, previousEnd };
}

const toNumber = (value: bigint | number) => Number(value);
const series = (rows: Array<{ bucket: string; total: bigint }>) => rows.map(row => ({ label: row.bucket, value: toNumber(row.total) }));

export async function authorizeStatisticsBusiness(userId: string, identifier: string, db: Pick<typeof prisma, 'business'> = prisma) {
  const business = await db.business.findFirst({
    where: { OR: [{ id: identifier }, { publicId: identifier }], memberships: { some: { userId, status: 'ACTIVE' } } },
    select: { id: true, memberships: { where: { userId, status: 'ACTIVE' }, include: { permissions: true }, take: 1 } },
  });
  if (!business) throw new AppError(404, 'BUSINESS_NOT_FOUND', 'No encontramos ese negocio.');
  const membership = business.memberships[0];
  if (!membership || (membership.role !== 'OWNER' && !membership.permissions.some(item => item.permission === 'READ_ANALYTICS' && item.allowed))) {
    throw new AppError(403, 'BUSINESS_PERMISSION_DENIED', 'No tienes permiso para consultar las estadísticas de este negocio.');
  }
  return business;
}

/** Rankings are owner-only, and their period window matches the dashboard exactly. */
export async function getOfferViewRanking(userId: string, identifier: string, period: StatisticsPeriod) {
  const business = await authorizeStatisticsBusiness(userId, identifier);
  const now = new Date();
  const window = statisticsWindow(period, now);
  const createdAt = { ...(window.start ? { gte: window.start } : {}), lt: now };
  const grouped = await prisma.businessAnalyticsEvent.groupBy({
    by: ['offerId'],
    where: { businessId: business.id, eventType: 'OFFER_VIEW', offerId: { not: null }, createdAt },
    _count: { _all: true },
    orderBy: [{ _count: { offerId: 'desc' } }, { offerId: 'asc' }],
    take: 5,
  });
  const offerIds = grouped.flatMap(row => row.offerId ? [row.offerId] : []);
  const offers = offerIds.length ? await prisma.businessOffer.findMany({
    where: { id: { in: offerIds }, businessId: business.id, deletedAt: null },
    select: { id: true, name: true, kind: true },
  }) : [];
  const byId = new Map(offers.map(offer => [offer.id, offer]));
  return {
    period,
    timezone: STATISTICS_TIMEZONE,
    window: { start: window.start?.toISOString() ?? null, end: now.toISOString() },
    offers: grouped.flatMap(row => {
      const offer = row.offerId ? byId.get(row.offerId) : undefined;
      return offer ? [{ offerId: offer.id, name: offer.name, kind: offer.kind, value: row._count._all }] : [];
    }),
  };
}

export async function getBusinessStatistics(userId: string, identifier: string, period: StatisticsPeriod) {
  const business = await authorizeStatisticsBusiness(userId, identifier);
  const now = new Date();
  const window = statisticsWindow(period, now);
  const date = { ...(window.start ? { gte: window.start } : {}), lt: now };
  const [events, previousEvents, favoriteCount, referralCounter, subscription] = await Promise.all([
    prisma.businessAnalyticsEvent.groupBy({ by: ['eventType'], where: { businessId: business.id, createdAt: date }, _count: { _all: true } }),
    window.previousStart && window.previousEnd
      ? prisma.businessAnalyticsEvent.groupBy({ by: ['eventType'], where: { businessId: business.id, createdAt: { gte: window.previousStart, lt: window.previousEnd } }, _count: { _all: true } })
      : Promise.resolve(null),
    prisma.businessFavorite.count({ where: { businessId: business.id } }),
    prisma.businessReferralCounter.findUnique({ where: { businessId: business.id }, select: { validReferralCount: true } }),
    prisma.businessSubscription.findFirst({ where: { businessId: business.id, plan: 'PRO', status: 'ACTIVE', startsAt: { lte: now }, revokedAt: null, OR: [{ expiresAt: { gt: now } }, { expiresAt: null, specialActivation: true }] }, select: { id: true } }),
  ]);
  const counts = currentCounts(events as EventCount[]);
  const previous = previousEvents ? currentCounts(previousEvents as EventCount[]) : null;
  const referrals = referralCounter?.validReferralCount ?? 0;
  const proUnlocked = Boolean(subscription);
  const recognition = recognitionFor(referrals);
  const unlockedReferralStatistics = Math.min(5, Math.max(0, recognition.minimum === 0 ? 0 : recognition.minimum >= 500 ? 5 : recognition.minimum >= 250 ? 4 : recognition.minimum >= 100 ? 3 : recognition.minimum >= 50 ? 2 : 1));
  const referralsUnlocked = unlockedReferralStatistics > 0;
  // All-time totals remain complete; its chart is bounded to the latest 24 months.
  const trendStart = window.start ?? new Date(Date.UTC(now.getUTCFullYear() - 2, now.getUTCMonth() + 1, 1));
  const format = period === 'day' ? '%Y-%m-%d %H:00' : period === 'year' || period === 'all' ? '%Y-%m' : '%Y-%m-%d';
  const eventSeries = await prisma.$queryRaw<Array<{ eventType: keyof typeof eventKeys; bucket: string; total: bigint }>>(Prisma.sql`
    SELECT eventType, DATE_FORMAT(DATE_SUB(createdAt, INTERVAL 5 HOUR), ${format}) AS bucket, COUNT(*) AS total
    FROM BusinessAnalyticsEvent
    WHERE businessId = ${business.id} AND createdAt >= ${trendStart} AND createdAt < ${now}
    GROUP BY eventType, bucket ORDER BY bucket
  `);
  const trends = Object.fromEntries(Object.values(eventKeys).map(key => [key, [] as Array<{ label: string; value: number }>])) as Record<EventKey, Array<{ label: string; value: number }>>;
  for (const row of eventSeries) {
    // OFFER_VIEW belongs exclusively to the referral ranking. It must not be
    // treated as a free dashboard series just because it shares the event table.
    const metric = eventKeys[row.eventType];
    if (metric) trends[metric].push({ label: row.bucket, value: toNumber(row.total) });
  }
  const result: {
    period: StatisticsPeriod;
    timezone: string;
    window: { start: string | null; end: string };
    access: { referralCount: number; referralGoal: number; nextLevel: string | null; nextLevelMinimum: number | null; unlockedReferralStatistics: number; referralsUnlocked: boolean; proUnlocked: boolean };
    metrics: typeof counts & { currentFavorites: number };
    previous: typeof previous;
    trends: typeof trends;
    referral?: { offerLikes: number; reviewsCount: number; averageRating: number | null; ratingCount: number };
    pro?: {
      contactRate: number | null; hourlyActivity: Array<{ label: string; value: number }>;
      weekdayActivity: Array<{ label: string; value: number }>; promotionViews: number;
      mostViewedPromotions: Array<{ id: string; title: string; value: number }>;
      ratingEvolution: Array<{ label: string; value: number }>;
      favoriteAcquisitions: Array<{ label: string; value: number }>;
    };
  } = {
    period, timezone: STATISTICS_TIMEZONE,
    window: { start: window.start?.toISOString() ?? null, end: now.toISOString() },
    access: { referralCount: referrals, referralGoal: REFERRAL_STATISTICS_GOAL, nextLevel: recognition.level === 'DIAMOND' ? null : (recognition.level === 'BASIC' ? 'BRONZE' : recognition.level === 'BRONZE' ? 'SILVER' : recognition.level === 'SILVER' ? 'GOLD' : recognition.level === 'GOLD' ? 'PLATINUM' : 'DIAMOND'), nextLevelMinimum: recognition.level === 'DIAMOND' ? null : (recognition.level === 'BASIC' ? 20 : recognition.level === 'BRONZE' ? 50 : recognition.level === 'SILVER' ? 100 : recognition.level === 'GOLD' ? 250 : 500), unlockedReferralStatistics, referralsUnlocked, proUnlocked },
    metrics: { ...counts, currentFavorites: unlockedReferralStatistics >= 1 ? favoriteCount : 0 }, previous, trends,
  };
  if (referralsUnlocked) {
    const [offerLikes, reviews, activeRatings] = await Promise.all([
      // This referral metric is a current-state total, not an interaction
      // history: every still-active like on a non-deleted offer counts,
      // regardless of the selected statistics period.
      prisma.businessOfferLike.count({ where: { offer: { businessId: business.id, deletedAt: null } } }),
      prisma.businessReview.aggregate({ where: { businessId: business.id, status: 'PUBLISHED', createdAt: date }, _count: { _all: true }, _avg: { rating: true } }),
      // The current average uses every still-published rating. Editing a
      // review updates this value in place and never creates a duplicate.
      prisma.businessReview.aggregate({ where: { businessId: business.id, status: 'PUBLISHED' }, _count: { _all: true }, _avg: { rating: true } }),
    ]);
    result.referral = {
      ...(unlockedReferralStatistics >= 2 ? { offerLikes } : {}),
      ...(unlockedReferralStatistics >= 3 ? { reviewsCount: reviews._count._all } : {}),
      ...(unlockedReferralStatistics >= 4 ? { averageRating: activeRatings._avg.rating, ratingCount: activeRatings._count._all } : {}),
    } as typeof result.referral;
  }
  if (proUnlocked) {
    const [activity, promotionViews, promotionRanking, ratingRows, favoriteRows] = await Promise.all([
      prisma.$queryRaw<Array<{ hour: number; weekday: number; total: bigint }>>(Prisma.sql`
        SELECT HOUR(DATE_SUB(createdAt, INTERVAL 5 HOUR)) AS hour, WEEKDAY(DATE_SUB(createdAt, INTERVAL 5 HOUR)) AS weekday, COUNT(*) AS total
        FROM BusinessAnalyticsEvent WHERE businessId = ${business.id} AND eventType = 'BUSINESS_VIEW'
          AND createdAt >= ${window.start ?? new Date(0)} AND createdAt < ${now}
        GROUP BY hour, weekday
      `),
      prisma.businessPromotionView.count({ where: { businessId: business.id, createdAt: date } }),
      prisma.businessPromotionView.groupBy({ by: ['promotionId'], where: { businessId: business.id, createdAt: date, promotion: { deletedAt: null } }, _count: { _all: true }, orderBy: { _count: { promotionId: 'desc' } }, take: 5 }),
      prisma.$queryRaw<Array<{ bucket: string; average: number }>>(Prisma.sql`
        SELECT DATE_FORMAT(DATE_SUB(createdAt, INTERVAL 5 HOUR), ${format}) AS bucket, AVG(rating) AS average
        FROM BusinessReview WHERE businessId = ${business.id} AND status = 'PUBLISHED' AND createdAt >= ${trendStart} AND createdAt < ${now}
        GROUP BY bucket ORDER BY bucket
      `),
      prisma.$queryRaw<Array<{ bucket: string; total: bigint }>>(Prisma.sql`
        SELECT DATE_FORMAT(DATE_SUB(createdAt, INTERVAL 5 HOUR), ${format}) AS bucket, COUNT(*) AS total
        FROM BusinessFavorite WHERE businessId = ${business.id} AND createdAt >= ${trendStart} AND createdAt < ${now}
        GROUP BY bucket ORDER BY bucket
      `),
    ]);
    const ids = promotionRanking.map(row => row.promotionId);
    const promotionNames = ids.length ? await prisma.businessPromotion.findMany({ where: { id: { in: ids } }, select: { id: true, title: true } }) : [];
    const byId = new Map(promotionNames.map(row => [row.id, row.title]));
    result.pro = {
      contactRate: counts.businessViews ? Math.round((counts.whatsappClicks + counts.phoneClicks) / counts.businessViews * 1000) / 10 : null,
      hourlyActivity: Array.from({ length: 24 }, (_, hour) => ({ label: `${String(hour).padStart(2, '0')}:00`, value: activity.filter(row => row.hour === hour).reduce((sum, row) => sum + toNumber(row.total), 0) })),
      weekdayActivity: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((label, weekday) => ({ label, value: activity.filter(row => row.weekday === weekday).reduce((sum, row) => sum + toNumber(row.total), 0) })),
      promotionViews,
      mostViewedPromotions: promotionRanking.map(row => ({ id: row.promotionId, title: byId.get(row.promotionId) ?? 'Promoción', value: row._count._all })),
      ratingEvolution: ratingRows.map(row => ({ label: row.bucket, value: Number(row.average) })),
      favoriteAcquisitions: series(favoriteRows),
    };
  }
  return result;
}
