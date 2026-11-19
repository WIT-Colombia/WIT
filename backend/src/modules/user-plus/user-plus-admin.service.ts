import { prisma } from '../../config/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';

type Actor = { userId: string; role: string };
function requireSuperAdmin(actor: Actor) {
  if (actor.role !== 'SUPER_ADMIN') throw new AppError(403, 'ADMIN_SUPER_ADMIN_REQUIRED', 'Solo el superadministrador puede gestionar Plus.');
}
export async function readAdminPlusSubscription(actor: Actor, userId: string) {
  requireSuperAdmin(actor);
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, displayName: true, emailNormalized: true, status: true } });
  if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'No encontramos al usuario.');
  return { user, subscription: await prisma.userPlusSubscription.findUnique({ where: { userId } }) };
}
export async function assignAdminPlusSubscription(actor: Actor, userId: string, input: { enabled: boolean; expiresAt?: string; reason: string }) {
  requireSuperAdmin(actor);
  const reason = input.reason.trim();
  if (reason.length < 12) throw new AppError(400, 'ADMIN_REASON_REQUIRED', 'La justificación debe tener al menos 12 caracteres.');
  const now = new Date();
  const expiresAt = input.enabled ? new Date(input.expiresAt ?? '') : now;
  if (input.enabled && (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= now.getTime() || expiresAt.getTime() > now.getTime() + 2 * 366 * 86400000))
    throw new AppError(400, 'PLUS_EXPIRY_INVALID', 'Selecciona una fecha futura, hasta dos años.');
  return prisma.$transaction(async tx => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { id: true, status: true } });
    if (!user || user.status !== 'ACTIVE') throw new AppError(404, 'USER_NOT_ACTIVE', 'El usuario no está activo.');
    const previous = await tx.userPlusSubscription.findUnique({ where: { userId } });
    const next = await tx.userPlusSubscription.upsert({
      where: { userId },
      create: { userId, status: input.enabled ? 'ACTIVE' : 'INACTIVE', startsAt: now, expiresAt, revokedAt: input.enabled ? null : now },
      update: input.enabled ? { status: 'ACTIVE', startsAt: now, expiresAt, revokedAt: null } : { status: 'INACTIVE', revokedAt: now },
    });
    await tx.auditLog.create({ data: {
      actorUserId: actor.userId, entityType: 'ADMIN_SECURITY', entityId: userId,
      action: input.enabled ? 'XAMUKO_PLUS_GRANTED' : 'XAMUKO_PLUS_REVOKED',
      reason,
      previousState: previous ? { userId, status: previous.status, expiresAt: previous.expiresAt.toISOString(), revoked: !!previous.revokedAt } : { userId, status: 'NONE' },
      newState: { userId, status: next.status, expiresAt: next.expiresAt.toISOString(), revoked: !!next.revokedAt },
    } });
    return { userId, subscription: next };
  });
}
