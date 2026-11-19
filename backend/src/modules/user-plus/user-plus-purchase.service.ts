import { prisma } from '../../config/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';
import { isPaidPlanEnabled } from '../admin/paid-plans.service.js';
import { hasPlusEntitlement } from './user-plus.service.js';

/** Price is fixed server-side in Colombian pesos; client amounts are never trusted. */
export const PLUS_MONTHLY_COP = 3_900;

function publicRequest(row: {
  id: string; status: string; amountCop: number; currency: string;
  periodMonths: number; createdAt: Date;
}) {
  return { id: row.id, status: row.status, amountCop: row.amountCop,
    currency: row.currency, periodMonths: row.periodMonths, createdAt: row.createdAt.toISOString() };
}

export async function currentPlusPurchaseRequest(userId: string) {
  const request = await prisma.userPlusPurchaseRequest.findFirst({
    where: { userId, status: 'PENDING_PAYMENT' }, orderBy: { createdAt: 'desc' },
  });
  return { request: request ? publicRequest(request) : null };
}

/**
 * Stores a request to contract a monthly subscription.
 * A purchase request NEVER triggers a debit, renewal, invoice or Plus entitlement.
 * A payment gateway and verified settlement are still required before self-service purchase is possible.
 */
export async function requestPlusPurchase(userId: string, input: { acceptedAmountCop: number; acceptedTerms: boolean }) {
  if (!input.acceptedTerms || input.acceptedAmountCop !== PLUS_MONTHLY_COP)
    throw new AppError(400, 'PLUS_PRICE_ACCEPTANCE_REQUIRED',
      'Debes aceptar expresamente el precio mensual vigente de Xamuko Plus.');
  if (!(await isPaidPlanEnabled('xamukoPlus')))
    throw new AppError(409, 'PLUS_DISABLED', 'Xamuko Plus está deshabilitado temporalmente.');
  const now = new Date();
  const [user, membership] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, status: true } }),
    prisma.userPlusSubscription.findUnique({ where: { userId } }),
  ]);
  if (!user || user.status !== 'ACTIVE')
    throw new AppError(403, 'PLUS_ACCOUNT_NOT_ELIGIBLE', 'La cuenta no está habilitada.');
  if (hasPlusEntitlement(true, membership, now))
    throw new AppError(409, 'PLUS_ALREADY_ACTIVE', 'Ya tienes una membresía Plus vigente.');

  // The pending request is idempotent from the user's point of view.
  const existing = await prisma.userPlusPurchaseRequest.findFirst({
    where: { userId, status: 'PENDING_PAYMENT' }, orderBy: { createdAt: 'desc' },
  });
  if (existing) return { request: publicRequest(existing), created: false };
  const request = await prisma.userPlusPurchaseRequest.create({
    data: { userId, status: 'PENDING_PAYMENT', amountCop: PLUS_MONTHLY_COP, currency: 'COP', periodMonths: 1 },
  });
  return { request: publicRequest(request), created: true };
}

export async function adminListPlusRequests(actor: { role: string }) {
  if (actor.role !== 'SUPER_ADMIN')
    throw new AppError(403, 'ADMIN_SUPER_ADMIN_REQUIRED', 'Solo el superadministrador puede consultar las solicitudes Plus.');
  const rows = await prisma.userPlusPurchaseRequest.findMany({
    where: { status: 'PENDING_PAYMENT' },
    orderBy: { createdAt: 'desc' }, take: 100,
    select: { id: true, userId: true, status: true, amountCop: true,
      currency: true, periodMonths: true, createdAt: true,
      user: { select: { displayName: true, emailNormalized: true } } },
  });
  return { requests: rows.map(row => ({
    ...publicRequest(row), userId: row.userId,
    user: { displayName: row.user.displayName, emailNormalized: row.user.emailNormalized },
  })) };
}

/** Close a request manually after follow-up; separate from membership provisioning. */
export async function adminClosePlusRequest(actor: { role: string; userId: string }, id: string, reason: string) {
  if (actor.role !== 'SUPER_ADMIN')
    throw new AppError(403, 'ADMIN_SUPER_ADMIN_REQUIRED', 'Solo el superadministrador puede cerrar solicitudes Plus.');
  if (reason.trim().length < 12)
    throw new AppError(400, 'PLUS_CLOSE_REASON', 'Registra una justificación de al menos 12 caracteres.');
  return prisma.$transaction(async tx => {
    const previous = await tx.userPlusPurchaseRequest.findUnique({ where: { id } });
    if (!previous) throw new AppError(404, 'PLUS_PURCHASE_NOT_FOUND', 'Solicitud no encontrada.');
    if (previous.status !== 'PENDING_PAYMENT') return { status: previous.status };
    await tx.userPlusPurchaseRequest.update({ where: { id }, data: { status: 'CLOSED', closedAt: new Date() } });
    await tx.auditLog.create({ data: {
      actorUserId: actor.userId, entityType: 'ADMIN_SECURITY', entityId: previous.userId,
      action: 'XAMUKO_PLUS_REQUEST_CLOSED', reason: reason.trim(),
      previousState: { userId: previous.userId, status: previous.status, requestId: id },
      newState: { userId: previous.userId, status: 'CLOSED', requestId: id },
    } });
    return { status: 'CLOSED' as const };
  });
}
