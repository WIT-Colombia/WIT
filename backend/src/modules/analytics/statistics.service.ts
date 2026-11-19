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
/**
 * The database returns only buckets containing events. For count metrics,
 * an empty bucket INSIDE a queried interval means zero recorded events.
 * Create every elapsed Bogotá calendar bucket; do not add future buckets.
 * Averages (e.g. ratings) must not use this function: absent ≠ zero stars.
 */
export function completeCountTrend(
  rows: Array<{ label: string; value: number }>,
  period: StatisticsPeriod, from: Date, until: Date,
): Array<{ label: string; value: number }> {
  const bogota = (date: Date) => new Date(date.getTime() - 5 * 60 * 60 * 1000);
  const beginning = bogota(from), ending = bogota(until);
  const unit = period === 'day' ? 'hour' : period === 'week' || period === 'month' ? 'day' : 'month';
  const cursor = new Date(Date.UTC(
    beginning.getUTCFullYear(), beginning.getUTCMonth(),
    unit === 'month' ? 1 : beginning.getUTCDate(),
    unit === 'hour' ? beginning.getUTCHours() : 0,
  ));
  const last = new Date(Date.UTC(
    ending.getUTCFullYear(), ending.getUTCMonth(),
    unit === 'month' ? 1 : ending.getUTCDate(),
    unit === 'hour' ? ending.getUTCHours() : 0,
  ));
  const counts = new Map(rows.map(row => [row.label, row.value]));
  const finished: Array<{ label: string; value: number }> = [];
  for (; cursor <= last && finished.length < 744; ) {
    const date = cursor.toISOString().slice(0, 10);
    const label = unit === 'hour' ? date + ' ' + String(cursor.getUTCHours()).padStart(2, '0') + ':00'
      : unit === 'month' ? date.slice(0, 7) : date;
    finished.push({ label, value: counts.get(label) ?? 0 });
    if (unit === 'hour') cursor.setUTCHours(cursor.getUTCHours() + 1);
    else if (unit === 'day') cursor.setUTCDate(cursor.getUTCDate() + 1);
    else cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return finished;
}


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

/**
 * Commercial offer availability and paid analytics entitlement are independent.
 * Events are collected for every eligible published business regardless of plan;
 * this query only decides which historical aggregates may be returned.
 * Deactivating new sales must never revoke an existing subscription.
 */
function effectiveProSubscription(businessId: string, now: Date) {
  return prisma.businessSubscription.findFirst({
    where: {
      businessId, plan: 'PRO', status: 'ACTIVE', startsAt: { lte: now },
      revokedAt: null,
      OR: [{ expiresAt: { gt: now } }, { expiresAt: null, specialActivation: true }],
    },
    select: { id: true },
  });
}
export function offerRankingVisibility(referralCount: number, proSubscriptionActive: boolean) {
  // The fifth recognition reward is an offer-view ranking, independent of PRO.
  const referralRanking = recognitionFor(referralCount).minimum >= 500;
  return { referralRanking: referralRanking || proSubscriptionActive, proRankings: proSubscriptionActive };
}

/** Statistics rankings use the same business membership and period window as the dashboard. */

export async function getOfferViewRanking(userId: string, identifier: string, period: StatisticsPeriod) {
  const business = await authorizeStatisticsBusiness(userId, identifier);
  const now = new Date();
  const window = statisticsWindow(period, now);
  const [referralCounter, subscription] = await Promise.all([
    prisma.businessReferralCounter.findUnique({ where: { businessId: business.id }, select: { validReferralCount: true } }),
    effectiveProSubscription(business.id, now),
  ]);
  const visibility = offerRankingVisibility(referralCounter?.validReferralCount ?? 0, Boolean(subscription));
  if (!visibility.referralRanking && !visibility.proRankings) {
    return { period, timezone: STATISTICS_TIMEZONE,
      window: { start: window.start?.toISOString() ?? null, end: now.toISOString() },
      offers: [], productOffers: [], serviceOffers: [] };
  }
  const createdAt = { ...(window.start ? { gte: window.start } : {}), lt: now };
  const rank = (kind: 'PRODUCT' | 'SERVICE') => prisma.businessAnalyticsEvent.groupBy({
    by: ['offerId'],
    where: { businessId: business.id, eventType: 'OFFER_VIEW', offerId: { not: null }, createdAt, offer: { kind, deletedAt: null } },
    _count: { _all: true },
    orderBy: [{ _count: { offerId: 'desc' } }, { offerId: 'asc' }],
    take: 5,
  });
  // Each category is ranked before limiting. A popular service can therefore
  // never push a product out of the product top five (or vice versa).
  const [productRows, serviceRows] = await Promise.all([rank('PRODUCT'), rank('SERVICE')]);
  const offerIds = [...productRows, ...serviceRows].flatMap(row => row.offerId ? [row.offerId] : []);
  const offers = offerIds.length ? await prisma.businessOffer.findMany({
    where: { id: { in: offerIds }, businessId: business.id, deletedAt: null },
    select: { id: true, name: true, kind: true },
  }) : [];
  const byId = new Map(offers.map(offer => [offer.id, offer]));
  const rows = (ranking: typeof productRows) => ranking.flatMap(row => {
    const offer = row.offerId ? byId.get(row.offerId) : undefined;
    return offer ? [{ offerId: offer.id, name: offer.name, kind: offer.kind, value: row._count._all }] : [];
  });
  const productOffers = rows(productRows);
  const serviceOffers = rows(serviceRows);
  return {
    period,
    timezone: STATISTICS_TIMEZONE,
    window: { start: window.start?.toISOString() ?? null, end: now.toISOString() },
    // Fifth recognition reward: combined ranking; commercial PRO rankings are
    // available only to businesses with a verified, effective PRO subscription.
    offers: visibility.referralRanking ? [...productOffers, ...serviceOffers] : [],
    productOffers: visibility.proRankings ? productOffers : [],
    serviceOffers: visibility.proRankings ? serviceOffers : [],
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
    effectiveProSubscription(business.id, now),
  ]);
  const counts = currentCounts(events as EventCount[]);
  const previous = previousEvents ? currentCounts(previousEvents as EventCount[]) : null;
  const referrals = referralCounter?.validReferralCount ?? 0;
  const proUnlocked = Boolean(subscription);
  const recognition = recognitionFor(referrals);
  const unlockedReferralStatistics = Math.min(5, Math.max(0, recognition.minimum === 0 ? 0 : recognition.minimum >= 500 ? 5 : recognition.minimum >= 250 ? 4 : recognition.minimum >= 100 ? 3 : recognition.minimum >= 50 ? 2 : 1));
  const referralsUnlocked = unlockedReferralStatistics > 0;
  // All-time totals remain complete; its chart is bounded to the latest 24 months.
  const trendStart = window.start ?? (() => { const local = new Date(now.getTime() - 5 * 60 * 60 * 1000); return new Date(Date.UTC(local.getUTCFullYear() - 2, local.getUTCMonth() + 1, 1, 5)); })();
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
  // Equal-length, real calendar intervals prevent zero days from disappearing
  // or producing misleading straight lines between distant event dates.
  for (const key of Object.values(eventKeys)) {
    trends[key] = completeCountTrend(trends[key], period, trendStart, now);
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
      contactRate: number | null; interactionRate: number | null; navigationRate: number | null; hourlyActivity: Array<{ label: string; value: number }>;
      weekdayActivity: Array<{ label: string; value: number }>; promotionViews: number;
      mostViewedPromotions: Array<{ id: string; title: string; value: number }>;
      ratingEvolution: Array<{ label: string; value: number }>;
      favoriteAcquisitions: Array<{ label: string; value: number }>;
      uniqueVisitors: number; repeatVisitors: number;
      visitOrigins: Array<{ label: string; value: number }>;
      keywords: Array<{ label: string; value: number }>;
      averagePosition: number | null;
      categoryPerformance: Array<{ label: string; value: number }>;
      featuredPerformance: { views: number; interactions: number; interactionRate: number | null };
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
    const [activity, promotionViews, promotionRanking, ratingRows, favoriteRows, uniqueVisitorRows, repeatVisitorRows, origins, keywords, positions, categories, featured] = await Promise.all([
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
      prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`SELECT COUNT(DISTINCT visitorKey) AS total FROM BusinessAnalyticsEvent WHERE businessId = ${business.id} AND eventType = 'BUSINESS_VIEW' AND visitorKey IS NOT NULL AND createdAt >= ${window.start ?? new Date(0)} AND createdAt < ${now}`),
      prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`SELECT COUNT(*) AS total FROM (SELECT visitorKey FROM BusinessAnalyticsEvent WHERE businessId = ${business.id} AND eventType = 'BUSINESS_VIEW' AND visitorKey IS NOT NULL AND createdAt >= ${window.start ?? new Date(0)} AND createdAt < ${now} GROUP BY visitorKey HAVING COUNT(*) > 1) AS repeatVisitors`),
      prisma.$queryRaw<Array<{ label: string; total: bigint }>>(Prisma.sql`SELECT source AS label, COUNT(*) AS total FROM BusinessAnalyticsEvent WHERE businessId = ${business.id} AND eventType = 'BUSINESS_VIEW' AND source IS NOT NULL AND source <> '' AND createdAt >= ${window.start ?? new Date(0)} AND createdAt < ${now} GROUP BY source ORDER BY total DESC, label ASC LIMIT 5`),
      prisma.$queryRaw<Array<{ label: string; total: bigint }>>(Prisma.sql`SELECT searchTerm AS label, COUNT(*) AS total FROM BusinessAnalyticsEvent WHERE businessId = ${business.id} AND eventType = 'SEARCH_IMPRESSION' AND searchTerm IS NOT NULL AND searchTerm <> '' AND createdAt >= ${window.start ?? new Date(0)} AND createdAt < ${now} GROUP BY searchTerm ORDER BY total DESC, label ASC LIMIT 10`),
      prisma.$queryRaw<Array<{ average: number | null }>>(Prisma.sql`SELECT AVG(searchPosition) AS average FROM BusinessAnalyticsEvent WHERE businessId = ${business.id} AND eventType = 'SEARCH_IMPRESSION' AND searchPosition IS NOT NULL AND createdAt >= ${window.start ?? new Date(0)} AND createdAt < ${now}`),
      prisma.$queryRaw<Array<{ label: string; total: bigint }>>(Prisma.sql`SELECT category AS label, COUNT(*) AS total FROM BusinessAnalyticsEvent WHERE businessId = ${business.id} AND eventType = 'BUSINESS_VIEW' AND category IS NOT NULL AND category <> '' AND createdAt >= ${window.start ?? new Date(0)} AND createdAt < ${now} GROUP BY category ORDER BY total DESC, label ASC LIMIT 8`),
      prisma.$queryRaw<Array<{ views: bigint; interactions: bigint }>>(Prisma.sql`SELECT SUM(eventType = 'BUSINESS_VIEW') AS views, SUM(eventType IN ('WHATSAPP_CLICK', 'PHONE_CLICK', 'DIRECTIONS_CLICK', 'OFFER_VIEW')) AS interactions FROM BusinessAnalyticsEvent WHERE businessId = ${business.id} AND isFeatured = true AND createdAt >= ${window.start ?? new Date(0)} AND createdAt < ${now}`),
    ]);
    const ids = promotionRanking.map(row => row.promotionId);
    const promotionNames = ids.length ? await prisma.businessPromotion.findMany({ where: { id: { in: ids } }, select: { id: true, title: true } }) : [];
    const byId = new Map(promotionNames.map(row => [row.id, row.title]));
    result.pro = {
      contactRate: counts.businessViews ? Math.round((counts.whatsappClicks + counts.phoneClicks) / counts.businessViews * 1000) / 10 : null,
      // Includes every deliberate interaction tracked inside XAMUKO. It is an
      // interest rate, not a conversion or sales rate.
      interactionRate: counts.businessViews ? Math.round((counts.whatsappClicks + counts.phoneClicks + counts.directionsClicks + (events.find(row => row.eventType === 'OFFER_VIEW')?._count._all ?? 0)) / counts.businessViews * 1000) / 10 : null,
      navigationRate: counts.businessViews ? Math.round(counts.directionsClicks / counts.businessViews * 1000) / 10 : null,
      hourlyActivity: Array.from({ length: 24 }, (_, hour) => ({ label: `${String(hour).padStart(2, '0')}:00`, value: activity.filter(row => row.hour === hour).reduce((sum, row) => sum + toNumber(row.total), 0) })),
      weekdayActivity: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((label, weekday) => ({ label, value: activity.filter(row => row.weekday === weekday).reduce((sum, row) => sum + toNumber(row.total), 0) })),
      promotionViews,
      mostViewedPromotions: promotionRanking.map(row => ({ id: row.promotionId, title: byId.get(row.promotionId) ?? 'Promoción', value: row._count._all })),
      ratingEvolution: ratingRows.map(row => ({ label: row.bucket, value: Number(row.average) })),
      favoriteAcquisitions: completeCountTrend(series(favoriteRows), period, trendStart, now),
      uniqueVisitors: toNumber(uniqueVisitorRows[0]?.total ?? 0),
      repeatVisitors: toNumber(repeatVisitorRows[0]?.total ?? 0),
      visitOrigins: origins.map(row => ({ label: row.label, value: toNumber(row.total) })),
      keywords: keywords.map(row => ({ label: row.label, value: toNumber(row.total) })),
      averagePosition: positions[0]?.average === null || positions[0]?.average === undefined ? null : Math.round(Number(positions[0].average) * 10) / 10,
      categoryPerformance: categories.map(row => ({ label: row.label, value: toNumber(row.total) })),
      featuredPerformance: (() => { const row = featured[0]; const views = toNumber(row?.views ?? 0); const interactions = toNumber(row?.interactions ?? 0); return { views, interactions, interactionRate: views ? Math.round(interactions / views * 1000) / 10 : null }; })(),
    };
  }
  return result;
}
