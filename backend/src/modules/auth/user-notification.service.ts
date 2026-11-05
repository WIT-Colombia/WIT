import { prisma } from '../../config/prisma.js';
import type { Prisma, PrismaClient } from '../../generated/prisma/client.js';

type Db = PrismaClient | Prisma.TransactionClient;

export type UserNotificationInput = {
  userId: string;
  title: string;
  body: string;
  imageUrl?: string | null;
  imageAlt?: string | null;
};

export function createUserNotification(db: Db, input: UserNotificationInput) {
  return db.userNotification.create({ data: input });
}

export async function listUserNotifications(userId: string) {
  return prisma.userNotification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 100 });
}
export async function markUserNotificationRead(userId: string, id: string) {
  await prisma.userNotification.updateMany({ where: { id, userId, readAt: null }, data: { readAt: new Date() } });
  return { ok: true };
}
export async function deleteUserNotification(userId: string, id: string) {
  await prisma.userNotification.deleteMany({ where: { id, userId } });
  return { ok: true };
}
