import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';

export const paidPlanKey = z.enum(['businessPro', 'xamukoPlus']);
export const paidPlanUpdate = z.object({
  enabled: z.boolean(),
  reason: z.string().trim().min(12).max(500),
  confirmation: z.literal('CONFIRMAR'),
}).strict();
export type PaidPlanKey = z.infer<typeof paidPlanKey>;

export function availabilityFromRows(rows: Array<{ key: string; enabled: boolean }>) {
  return {
    businessPro: rows.some(row => row.key === 'businessPro' && row.enabled === true),
    xamukoPlus: rows.some(row => row.key === 'xamukoPlus' && row.enabled === true),
  };
}

/** The DB is authoritative for every paid feature, not just marketing UI. */
export async function isPaidPlanEnabled(key: PaidPlanKey, db: Pick<typeof prisma, 'paidPlanAvailability'> = prisma) {
  const record = await db.paidPlanAvailability.findUnique({ where: { key }, select: { enabled: true } });
  return record?.enabled === true;
}

export async function getPaidPlanAvailability() {
  return availabilityFromRows(await prisma.paidPlanAvailability.findMany());
}

export async function setPaidPlanAvailability(
  context: { role: string; userId: string }, key: PaidPlanKey, enabled: boolean, reason: string,
) {
  if (context.role !== 'SUPER_ADMIN') {
    throw new AppError(403, 'ADMIN_SUPER_ADMIN_REQUIRED', 'Solo el administrador principal puede activar o desactivar los planes.');
  }
  const justification = reason?.trim() ?? '';
  if (justification.length < 12 || justification.length > 500) {
    throw new AppError(400, 'PAID_PLAN_REASON_REQUIRED', 'Registra una justificación de entre 12 y 500 caracteres.');
  }
  return prisma.$transaction(async tx => {
    const previous = await tx.paidPlanAvailability.findUnique({ where: { key } });
    if (previous?.enabled === enabled) return availabilityFromRows(await tx.paidPlanAvailability.findMany());
    await tx.paidPlanAvailability.upsert({ where: { key }, create: { key, enabled }, update: { enabled } });
    await tx.auditLog.create({ data: {
      actorUserId: context.userId, entityType: 'ADMIN_SECURITY', entityId: key,
      action: 'PAID_PLAN_AVAILABILITY_CHANGED', reason: justification,
      previousState: { key, enabled: previous?.enabled ?? false },
      newState: { key, enabled },
    } });
    return availabilityFromRows(await tx.paidPlanAvailability.findMany());
  });
}
