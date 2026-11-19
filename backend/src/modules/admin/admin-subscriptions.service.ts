import { Prisma, type BusinessSubscriptionStatus } from '../../generated/prisma/client.js';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';
import { isSubscriptionEffective } from '../business/recognition.service.js';

const statuses = ['PENDING', 'ACTIVE', 'EXPIRED', 'REVOKED'] as const;
/** Query views over persisted subscription attributes; these are NOT new database states. */
export const subscriptionViews = ['ALL', 'EFFECTIVE', 'EXPIRING_30_DAYS', 'SPECIAL_EFFECTIVE'] as const;
export type AdminSubscriptionView = typeof subscriptionViews[number];

/** Read-only administrative register of actual BusinessSubscription rows.
 * No payment claims, synthetic BASIC subscription rows or implicit state transitions. */
export function normalizeAdminSubscriptionsQuery(query: {
  page?: number; pageSize?: number; status?: string; q?: string; view?: string;
}) {
  const page = Number.isFinite(query.page) ? Math.max(1, Math.min(100000, Math.floor(query.page!))) : 1;
  const pageSize = Number.isFinite(query.pageSize) ? Math.max(1, Math.min(50, Math.floor(query.pageSize!))) : 12;
  const status = (query.status ?? '').trim().toUpperCase();
  const q = (query.q ?? '').trim();
  const view = (query.view ?? 'ALL').trim().toUpperCase();
  if (!subscriptionViews.includes(view as AdminSubscriptionView))
    throw new AppError(400, 'ADMIN_SUBSCRIPTION_VIEW_INVALID', 'Selecciona una vista de suscripciones disponible.');
  if (status && !statuses.includes(status as typeof statuses[number]))
    throw new AppError(400, 'ADMIN_SUBSCRIPTION_STATUS_INVALID', 'El estado de suscripción solicitado no existe.');
  if (q.length > 100)
    throw new AppError(400, 'ADMIN_SUBSCRIPTION_SEARCH_TOO_LONG', 'La búsqueda no puede superar 100 caracteres.');
  return { page, pageSize, status: status as BusinessSubscriptionStatus | '', q, view: view as AdminSubscriptionView };
}

/** Compose filters before pagination so every count and page reflects the entire database. */
export function adminSubscriptionWhere(filters: ReturnType<typeof normalizeAdminSubscriptionsQuery>, now = new Date()): Prisma.BusinessSubscriptionWhereInput {
  const effective: Prisma.BusinessSubscriptionWhereInput = {
    plan: 'PRO', status: 'ACTIVE', revokedAt: null, startsAt: { lte: now },
    OR: [{ expiresAt: { gt: now } }, { expiresAt: null, specialActivation: true }],
  };
  const soon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const view: Prisma.BusinessSubscriptionWhereInput =
    filters.view === 'EFFECTIVE' ? effective
    : filters.view === 'EXPIRING_30_DAYS'
      ? { plan: 'PRO', status: 'ACTIVE', revokedAt: null, startsAt: { lte: now },
          expiresAt: { gt: now, lte: soon } }
    : filters.view === 'SPECIAL_EFFECTIVE' ? { ...effective, specialActivation: true }
    : {};
  return {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.q ? { business: { is: { OR: [
      { name: { contains: filters.q } }, { publicId: { contains: filters.q } },
    ] } } } : {}),
    ...(Object.keys(view).length ? { AND: [view] } : {}),
  };
}

export async function listAdminSubscriptions(query: {
  page?: number; pageSize?: number; status?: string; q?: string; view?: string;
}, now = new Date()) {
  const filters = normalizeAdminSubscriptionsQuery(query);
  const { page, pageSize } = filters;
  const where = adminSubscriptionWhere(filters, now);
  const [total, records] = await prisma.$transaction([
    prisma.businessSubscription.count({ where }),
    prisma.businessSubscription.findMany({
      where, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip: (page - 1) * pageSize, take: pageSize,
      select: {
        id: true, plan: true, status: true, startsAt: true, expiresAt: true,
        specialActivation: true, autoRenew: true, revokedAt: true, revocationReason: true,
        createdAt: true, updatedAt: true,
        business: { select: { id: true, publicId: true, name: true, deletionStatus: true } },
      },
    }),
  ]);
  return {
    generatedAt: now.toISOString(),
    subscriptions: records.map(row => ({
      ...row,
      effective: isSubscriptionEffective(row, now),
    })),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    definition: 'Registros reales de BusinessSubscription. Las vistas por vigencia son filtros calculados a partir de fechas, estado, revocación y activaciones especiales: NO son nuevos estados. No hay pagos confirmados en esta consulta. No existen suscripciones BASIC: Básico significa no tener PRO vigente.',
  };
}
