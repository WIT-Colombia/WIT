import { Prisma, type BusinessSubscriptionStatus } from '../../generated/prisma/client.js';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';
import { isSubscriptionEffective } from '../business/recognition.service.js';

const statuses = ['PENDING', 'ACTIVE', 'EXPIRED', 'REVOKED'] as const;

/** Read-only administrative register of actual BusinessSubscription rows.
 * No payment claims, synthetic BASIC subscription rows or implicit state transitions. */
export function normalizeAdminSubscriptionsQuery(query: {
  page?: number; pageSize?: number; status?: string; q?: string;
}) {
  const page = Number.isFinite(query.page) ? Math.max(1, Math.min(100000, Math.floor(query.page!))) : 1;
  const pageSize = Number.isFinite(query.pageSize) ? Math.max(1, Math.min(50, Math.floor(query.pageSize!))) : 12;
  const status = (query.status ?? '').trim().toUpperCase();
  const q = (query.q ?? '').trim();
  if (status && !statuses.includes(status as typeof statuses[number]))
    throw new AppError(400, 'ADMIN_SUBSCRIPTION_STATUS_INVALID', 'El estado de suscripción solicitado no existe.');
  if (q.length > 100)
    throw new AppError(400, 'ADMIN_SUBSCRIPTION_SEARCH_TOO_LONG', 'La búsqueda no puede superar 100 caracteres.');
  return { page, pageSize, status: status as BusinessSubscriptionStatus | '', q };
}

export async function listAdminSubscriptions(query: {
  page?: number; pageSize?: number; status?: string; q?: string;
}, now = new Date()) {
  const { page, pageSize, status, q } = normalizeAdminSubscriptionsQuery(query);
  const where: Prisma.BusinessSubscriptionWhereInput = {
    ...(status ? { status } : {}),
    ...(q ? { business: { is: { OR: [
      { name: { contains: q } },
      { publicId: { contains: q } },
    ] } } } : {}),
  };
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
    definition: 'Registros reales de BusinessSubscription. El estado guardado y la vigencia efectiva se muestran por separado. No implica pagos confirmados. No existen suscripciones BASIC: Básico significa no tener PRO vigente.',
  };
}
