import { prisma } from '../../config/prisma.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { AppError } from '../../shared/errors/app-error.js';

type Transaction = Prisma.TransactionClient;
type Notice = { userId: string | null | undefined; sourceType: string; sourceId: string; title: string; message: string };

export async function notifyPlatformUser(tx: Transaction, notice: Notice) {
  if (!notice.userId) return;
  // Notification data is intentionally limited to non-sensitive status updates.
  await tx.platformNotification.create({
    data: {
      userId: notice.userId,
      sourceType: notice.sourceType,
      sourceId: notice.sourceId,
      title: notice.title.slice(0, 180),
      message: notice.message.slice(0, 500),
    },
  });
}

export async function notifyBusinessOwners(
  tx: Transaction, businessId: string, title: string, message: string,
) {
  const owners = await tx.businessMembership.findMany({
    where: { businessId, role: 'OWNER', status: 'ACTIVE', user: { status: 'ACTIVE' } },
    select: { userId: true },
  });
  const ids = [...new Set(owners.map(owner => owner.userId))];
  if (!ids.length) return;
  await tx.businessNotification.createMany({
    data: ids.map(userId => ({
      userId, businessId, type: 'COLLABORATION_UPDATE' as const,
      title: title.slice(0, 180), message: message.slice(0, 500),
    })),
  });
}

export const statusTitle = (status: 'PENDING' | 'UNDER_REVIEW' | 'RESOLVED' | 'REJECTED') => ({
  PENDING: 'Pendiente', UNDER_REVIEW: 'En revisión', RESOLVED: 'Resuelto', REJECTED: 'Rechazado',
})[status];

export async function listPlatformNotifications(userId: string) {
  const notifications = await prisma.platformNotification.findMany({
    where: { userId, deletedAt: null },
    select: { id: true, title: true, message: true, sourceType: true, sourceId: true, readAt: true, createdAt: true },
    orderBy: { createdAt: 'desc' }, take: 100,
  });
  return {
    notifications,
    unread: notifications.filter(item => !item.readAt).length,
  };
}
export async function markPlatformNotificationRead(userId: string, id: string) {
  const updated = await prisma.platformNotification.updateMany({
    where: { id, userId, deletedAt: null, readAt: null },
    data: { readAt: new Date() },
  });
  if (!updated.count) {
    const found = await prisma.platformNotification.findFirst({ where: { id, userId, deletedAt: null }, select: { id: true } });
    if (!found) throw new AppError(404, 'PLATFORM_NOTIFICATION_NOT_FOUND', 'No encontramos esta notificación.');
  }
  return { ok: true };
}
export async function markAllPlatformNotificationsRead(userId: string) {
  await prisma.platformNotification.updateMany({
    where: { userId, deletedAt: null, readAt: null }, data: { readAt: new Date() },
  });
  return { ok: true };
}
export async function deletePlatformNotification(userId: string, id: string) {
  const result = await prisma.platformNotification.updateMany({
    where: { userId, id, deletedAt: null }, data: { deletedAt: new Date() },
  });
  if (!result.count) throw new AppError(404, 'PLATFORM_NOTIFICATION_NOT_FOUND', 'No encontramos esta notificación.');
  return { ok: true };
}
