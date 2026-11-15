import { prisma } from '../../config/prisma.js';
import { Prisma } from '../../generated/prisma/client.js';

type Period = '6m' | '12m' | '24m' | '60m' | 'all';
type Status = 'all' | 'active' | 'review' | 'inactive';
type Query = { period?: string; city?: string; categoryId?: string; status?: string };
const publicationStatuses: Record<Exclude<Status, 'all'>, 'PUBLISHED' | 'REVIEW' | 'UNPUBLISHED'> = {
  active: 'PUBLISHED', review: 'REVIEW', inactive: 'UNPUBLISHED',
};
const getPeriod = (p?: string): Period => p === '6m' || p === '12m' || p === '24m' || p === '60m' || p === 'all' ? p : '12m';
const getStatus = (s?: string): Status => s === 'active' || s === 'review' || s === 'inactive' ? s : 'all';

export async function getAdminBusinessAnalytics(query: Query, now = new Date()) {
  const period = getPeriod(query.period);
  const status = getStatus(query.status);
  const categoryId = (query.categoryId ?? '').trim().slice(0, 36);
  const cityKey = (query.city ?? '').trim().slice(0, 220);
  const divider = cityKey.indexOf('|');
  const country = divider >= 0 ? cityKey.slice(0, divider) : '';
  const cityName = divider >= 0 ? cityKey.slice(divider + 1) : '';
  const city = country.length === 2 && cityName ? { country, cityName } : null;
  const publicationStatus = status !== 'all' ? publicationStatuses[status] : undefined;
  const where: Prisma.BusinessWhereInput = {
    deletionStatus: { not: 'DELETED' },
    ...(publicationStatus ? { publicationStatus } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(city ? { location: { is: { countryCode: city.country, cityName: city.cityName } } } : {}),
  };
  const [first, total, categories, locations, firstUser, totalUsers, totalReviews] = await Promise.all([
    prisma.business.findFirst({ where, orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),
    prisma.business.count({ where }),
    prisma.category.findMany({
      where: { businesses: { some: { deletionStatus: { not: 'DELETED' } } } },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
      select: { id: true, code: true, translations: { select: { locale: true, name: true } } },
    }),
    prisma.businessLocation.findMany({
      where: { business: { deletionStatus: { not: 'DELETED' } } },
      distinct: ['countryCode', 'cityName'],
      select: { countryCode: true, cityName: true },
      orderBy: [{ countryCode: 'asc' }, { cityName: 'asc' }],
    }),
    prisma.user.findFirst({ where: { status: { not: 'DELETED' } }, orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),
    prisma.user.count({ where: { status: { not: 'DELETED' } } }),
    prisma.businessReview.count({ where: { status: 'PUBLISHED', business: where } }),
  ]);
  const todayMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const isGlobal = !city && !categoryId && status === 'all';
  const oldestDate = isGlobal && firstUser && (!first || firstUser.createdAt < first.createdAt) ? firstUser.createdAt : first?.createdAt;
  const start = period === 'all'
    ? oldestDate ? new Date(Date.UTC(oldestDate.getUTCFullYear(), oldestDate.getUTCMonth(), 1)) : todayMonth
    : new Date(Date.UTC(todayMonth.getUTCFullYear(), todayMonth.getUTCMonth() - Number.parseInt(period, 10) + 1, 1));
  const end = new Date(Date.UTC(todayMonth.getUTCFullYear(), todayMonth.getUTCMonth() + 1, 1));
  const conditions: Prisma.Sql[] = [
    Prisma.sql`b.deletionStatus <> 'DELETED'`,
    Prisma.sql`b.createdAt >= ${start}`,
    Prisma.sql`b.createdAt < ${end}`,
  ];
  if (publicationStatus) conditions.push(Prisma.sql`b.publicationStatus = ${publicationStatus}`);
  if (categoryId) conditions.push(Prisma.sql`b.categoryId = ${categoryId}`);
  if (city) conditions.push(Prisma.sql`EXISTS (
    SELECT 1 FROM BusinessLocation l WHERE l.businessId = b.id
      AND l.countryCode = ${city.country} AND l.cityName = ${city.cityName}
  )`);
  const reviewsConditions: Prisma.Sql[] = [
    Prisma.sql`r.status = 'PUBLISHED'`,
    Prisma.sql`b.deletionStatus <> 'DELETED'`,
    Prisma.sql`r.createdAt >= ${start}`,
    Prisma.sql`r.createdAt < ${end}`,
  ];
  if (publicationStatus) reviewsConditions.push(Prisma.sql`b.publicationStatus = ${publicationStatus}`);
  if (categoryId) reviewsConditions.push(Prisma.sql`b.categoryId = ${categoryId}`);
  if (city) reviewsConditions.push(Prisma.sql`EXISTS (
    SELECT 1 FROM BusinessLocation l WHERE l.businessId = b.id
      AND l.countryCode = ${city.country} AND l.cityName = ${city.cityName}
  )`);
  const [records, reviewRecords, userRecords] = await Promise.all([
    prisma.$queryRaw<Array<{ month: string; quantity: bigint }>>(Prisma.sql`
      SELECT DATE_FORMAT(b.createdAt, '%Y-%m') AS month, COUNT(*) AS quantity
      FROM Business b WHERE ${Prisma.join(conditions, ' AND ')}
      GROUP BY DATE_FORMAT(b.createdAt, '%Y-%m') ORDER BY month ASC
    `),
    prisma.$queryRaw<Array<{ month: string; quantity: bigint }>>(Prisma.sql`
      SELECT DATE_FORMAT(r.createdAt, '%Y-%m') AS month, COUNT(*) AS quantity
      FROM BusinessReview r INNER JOIN Business b ON b.id = r.businessId
      WHERE ${Prisma.join(reviewsConditions, ' AND ')}
      GROUP BY DATE_FORMAT(r.createdAt, '%Y-%m') ORDER BY month ASC
    `),
    prisma.$queryRaw<Array<{ month: string; quantity: bigint }>>(Prisma.sql`
      SELECT DATE_FORMAT(u.createdAt, '%Y-%m') AS month, COUNT(*) AS quantity
      FROM \`User\` u WHERE u.status <> 'DELETED'
        AND u.createdAt >= ${start} AND u.createdAt < ${end}
      GROUP BY DATE_FORMAT(u.createdAt, '%Y-%m') ORDER BY month ASC
    `),
  ]);
  const monthly = new Map(records.map(item => [item.month, Number(item.quantity)]));
  const monthlyReviews = new Map(reviewRecords.map(item => [item.month, Number(item.quantity)]));
  const monthlyUsers = new Map(userRecords.map(item => [item.month, Number(item.quantity)]));
  const series: Array<{ month: string; registrations: number; cumulative: number; reviews: number; reviewCumulative: number; users: number; userCumulative: number }> = [];
  let cumulative = total - [...monthly.values()].reduce((a, b) => a + b, 0);
  let reviewCumulative = totalReviews - [...monthlyReviews.values()].reduce((a, b) => a + b, 0);
  let userCumulative = totalUsers - [...monthlyUsers.values()].reduce((a, b) => a + b, 0);
  for (let cursor = new Date(start); cursor < end; cursor.setUTCMonth(cursor.getUTCMonth() + 1)) {
    const month = cursor.toISOString().slice(0, 7);
    const registrations = monthly.get(month) ?? 0;
    const reviews = monthlyReviews.get(month) ?? 0;
    const users = monthlyUsers.get(month) ?? 0;
    cumulative += registrations;
    reviewCumulative += reviews;
    userCumulative += users;
    series.push({ month, registrations, cumulative, reviews, reviewCumulative, users, userCumulative });
  }
  return {
    period, status, timezone: 'UTC', total, totalUsers, totalReviews,
    filters: {
      cities: locations.map(loc => ({ value: loc.countryCode + '|' + loc.cityName, label: loc.cityName + ' · ' + loc.countryCode })),
      categories: categories.map(category => ({
        id: category.id,
        name: category.translations.find(t => t.locale === 'es-CO')?.name ??
          category.translations.find(t => t.locale === 'es')?.name ??
          category.translations[0]?.name ?? category.code,
      })),
    },
    series,
    definition: 'Negocios y usuarios se agrupan por fecha de creación. Las opiniones visibles se agrupan por fecha de creación, no por fecha de aprobación. Los estados son los actuales, no un historial de cambios. Se excluyen negocios y usuarios eliminados. Los usuarios se muestran únicamente de forma global.',
  };
}
