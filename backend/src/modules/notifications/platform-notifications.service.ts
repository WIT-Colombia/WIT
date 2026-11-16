import { prisma } from '../../config/prisma.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { AppError } from '../../shared/errors/app-error.js';
import { isPhotoMissingError, photoMimeType, readPhoto } from '../business/photo-storage.js';

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
  tx: Transaction, businessId: string, title: string, message: string, excludeUserId?: string, actorUserId?: string,
) {
  const owners = await tx.businessMembership.findMany({
    where: { businessId, role: 'OWNER', status: 'ACTIVE', user: { status: 'ACTIVE' } },
    select: { userId: true },
  });
  const ids = [...new Set(owners.map(owner => owner.userId))].filter(id => id !== excludeUserId);
  if (!ids.length) return;
  await tx.businessNotification.createMany({
    data: ids.map(userId => ({
      userId, businessId, actorUserId, type: 'COLLABORATION_UPDATE' as const,
      title: title.slice(0, 180), message: message.slice(0, 500),
    })),
  });
}

export const statusTitle = (status: 'PENDING' | 'UNDER_REVIEW' | 'RESOLVED' | 'REJECTED') => ({
  PENDING: 'Pendiente', UNDER_REVIEW: 'En revisión', RESOLVED: 'Resuelto', REJECTED: 'Rechazado',
})[status];

export async function listPlatformNotifications(userId: string) {
  const [notifications, unread] = await Promise.all([
    prisma.platformNotification.findMany({
      where: { userId, deletedAt: null },
      select: { id: true, title: true, message: true, sourceType: true, sourceId: true, readAt: true, createdAt: true },
      orderBy: { createdAt: 'desc' }, take: 100,
    }),
    prisma.platformNotification.count({ where: { userId, deletedAt: null, readAt: null } }),
  ]);
  return { notifications, unread };
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

/** Artwork is returned only when the authenticated recipient owns the notice.
 * Covers deleted / hidden businesses without exposing private photos publicly.
 */
const businessArtworkEvents = new Set([
  'BUSINESS_VISIBILITY', 'BUSINESS_RECOVERY', 'BUSINESS_DELETED',
  'COLLABORATION_INVITED', 'COLLABORATION_ACCESS', 'COLLABORATION_PERMISSIONS',
  'COLLABORATION_EXPIRED', 'OWNERSHIP_TRANSFER', 'REVIEW_RESPONSE',
]);

export async function readPersonalNoticeArtwork(userId: string, noticeId: string) {
  const notice = await prisma.platformNotification.findFirst({
    where: { id: noticeId, userId, deletedAt: null },
    select: { sourceType: true, sourceId: true },
  });
  if (!notice || !businessArtworkEvents.has(notice.sourceType))
    throw new AppError(404, 'NOTIFICATION_ARTWORK_NOT_FOUND', 'No hay imagen para esta notificación.');
  const business = await prisma.business.findUnique({
    where: { id: notice.sourceId },
    select: { profilePhoto: { select: { storageKey: true } } },
  });
  const key = business?.profilePhoto?.storageKey;
  if (!key) throw new AppError(404, 'NOTIFICATION_ARTWORK_NOT_FOUND', 'El negocio no tiene una imagen disponible.');
  try {
    return { content: await readPhoto(key), mimeType: photoMimeType(key) };
  } catch (error) {
    if (isPhotoMissingError(error) || (error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'ENOENT'))
      throw new AppError(404, 'NOTIFICATION_ARTWORK_NOT_FOUND', 'La imagen ya no está disponible.');
    throw new AppError(503, 'NOTIFICATION_ARTWORK_UNAVAILABLE', 'No se pudo cargar la imagen.');
  }
}
