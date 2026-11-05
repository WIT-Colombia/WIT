import { prisma } from '../../config/prisma.js';
import type { Prisma, PrismaClient } from '../../generated/prisma/client.js';

type Db = PrismaClient | Prisma.TransactionClient;

export type UserNotificationInput = {
  userId: string;
  membershipId?: string | null;
  title: string;
  body: string;
  imageUrl?: string | null;
  imageAlt?: string | null;
};

export function createUserNotification(db: Db, input: UserNotificationInput) {
  return db.userNotification.create({ data: input });
}

export async function listUserNotifications(userId: string) {
  const rows = await prisma.userNotification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  const membershipIds = rows.flatMap(row => row.membershipId ? [row.membershipId] : []);
  const memberships = membershipIds.length
    ? await prisma.businessMembership.findMany({
        where: { id: { in: membershipIds }, userId },
        select: { id: true, status: true, expiresAt: true },
      })
    : [];
  const membershipById = new Map(memberships.map(membership => [membership.id, membership]));
  const now = new Date();

  return rows.map(row => {
    const membership = row.membershipId ? membershipById.get(row.membershipId) : undefined;
    const invitation = membership ? {
      membershipId: membership.id,
      status: membership.status === 'INVITED' && membership.expiresAt && membership.expiresAt <= now
        ? 'EXPIRED' : membership.status,
      expiresAt: membership.expiresAt,
    } : null;
    return { ...row, invitation };
  });
}
export async function markUserNotificationRead(userId: string, id: string) {
  await prisma.userNotification.updateMany({ where: { id, userId, readAt: null }, data: { readAt: new Date() } });
  return { ok: true };
}
export async function deleteUserNotification(userId: string, id: string) {
  await prisma.userNotification.deleteMany({ where: { id, userId } });
  return { ok: true };
}
