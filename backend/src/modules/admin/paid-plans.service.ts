import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';

export const paidPlanKey = z.enum(['businessPro', 'xamukoPlus']);
export const paidPlanUpdate = z.object({ enabled: z.boolean() }).strict();
export type PaidPlanKey = z.infer<typeof paidPlanKey>;
export function availabilityFromRows(rows: Array<{ key: string; enabled: boolean }>) {
  return {
    businessPro: rows.some(row => row.key === 'businessPro' && row.enabled === true),
    xamukoPlus: rows.some(row => row.key === 'xamukoPlus' && row.enabled === true),
  };
}
export async function getPaidPlanAvailability() {
  return availabilityFromRows(await prisma.paidPlanAvailability.findMany());
}
export async function setPaidPlanAvailability(context: { role: string; userId: string }, key: PaidPlanKey, enabled: boolean) {
  if (context.role !== 'SUPER_ADMIN') throw new AppError(403, 'ADMIN_SUPER_ADMIN_REQUIRED', 'Solo el administrador principal puede activar o desactivar los planes.');
  return prisma.$transaction(async tx => {
    const previous = await tx.paidPlanAvailability.findUnique({ where: { key } });
    await tx.paidPlanAvailability.upsert({ where: { key }, create: { key, enabled }, update: { enabled } });
    await tx.auditLog.create({ data: {
      actorUserId: context.userId, entityType: 'ADMIN_SECURITY', entityId: key,
      action: 'PAID_PLAN_AVAILABILITY_CHANGED', previousState: { key, enabled: previous?.enabled ?? false },
      newState: { key, enabled },
    } });
    return availabilityFromRows(await tx.paidPlanAvailability.findMany());
  });
}
