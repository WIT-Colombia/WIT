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
  const business = await prisma.business.findFirst({ where: { OR: [{ id: identifier }, { publicId: identifier }], memberships: { some: { userId, status: 'ACTIVE', role: 'OWNER' } } }, select: { id: true, publicId: true } });
  if (!business) throw new AppError(404, 'BUSINESS_NOT_FOUND', 'No encontramos ese negocio o no tienes autorización.');
  const start = periodStart(period);
  const rows = await prisma.businessAnalyticsEvent.groupBy({ by: ['eventType'], where: { businessId: business.id, ...(start ? { createdAt: { gte: start } } : {}) }, _count: { _all: true } });
  const counts = Object.fromEntries(rows.map((row) => [row.eventType, row._count._all]));
  return { period, timezone: 'America/Bogota', metrics: { businessViews: counts.BUSINESS_VIEW ?? 0, searchAppearances: counts.SEARCH_IMPRESSION ?? 0, whatsappClicks: counts.WHATSAPP_CLICK ?? 0, phoneClicks: counts.PHONE_CLICK ?? 0 } };
}
