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
  const [first, total, categories, locations] = await Promise.all([
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
  ]);
  const todayMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const start = period === 'all'
    ? first ? new Date(Date.UTC(first.createdAt.getUTCFullYear(), first.createdAt.getUTCMonth(), 1)) : todayMonth
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
  const records = await prisma.$queryRaw<Array<{ month: string; quantity: bigint }>>(Prisma.sql`
    SELECT DATE_FORMAT(b.createdAt, '%Y-%m') AS month, COUNT(*) AS quantity
    FROM Business b WHERE ${Prisma.join(conditions, ' AND ')}
    GROUP BY DATE_FORMAT(b.createdAt, '%Y-%m') ORDER BY month ASC
  `);
  const monthly = new Map(records.map(item => [item.month, Number(item.quantity)]));
  const series: Array<{ month: string; registrations: number; cumulative: number }> = [];
  let cumulative = total - [...monthly.values()].reduce((a, b) => a + b, 0);
  for (let cursor = new Date(start); cursor < end; cursor.setUTCMonth(cursor.getUTCMonth() + 1)) {
    const month = cursor.toISOString().slice(0, 7);
    const registrations = monthly.get(month) ?? 0;
    cumulative += registrations;
    series.push({ month, registrations, cumulative });
  }
  return {
    period, status, timezone: 'UTC', total,
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
    definition: 'Registros agrupados por fecha de creación. El estado es el actual, no un historial de cambios de estado. Se excluyen negocios eliminados.',
  };
}
