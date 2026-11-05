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
  // Read older invitations created before membershipId was stored. Only infer
  // a link when exactly one membership matches the recipient, message and time.
  const unlinked = rows.filter(row => !row.membershipId && row.title === 'Invitación para colaborar');
  const inferred = new Map<string, string>();
  if (unlinked.length) {
    const times = unlinked.map(row => row.createdAt.getTime());
    const earliest = new Date(Math.min(...times) - 15_000);
    const latest = new Date(Math.max(...times) + 15_000);
    const candidates = await prisma.businessMembership.findMany({
      where: { userId, role: 'COLLABORATOR', invitedAt: { gte: earliest, lte: latest } },
      select: { id: true, invitedAt: true, business: { select: { name: true } } },
    });
    for (const row of unlinked) {
      const matches = candidates.filter(candidate =>
        row.body === `${candidate.business.name} te ha invitado a colaborar en su establecimiento.`
        && Math.abs(row.createdAt.getTime() - candidate.invitedAt.getTime()) <= 15_000);
      if (matches.length === 1) inferred.set(row.id, matches[0].id);
    }
  }

  const membershipIds = rows.flatMap(row => {
    const id = row.membershipId ?? inferred.get(row.id);
    return id ? [id] : [];
  });
  const memberships = membershipIds.length
    ? await prisma.businessMembership.findMany({
        where: { id: { in: membershipIds }, userId },
        select: { id: true, status: true, expiresAt: true },
      })
    : [];
  const membershipById = new Map(memberships.map(membership => [membership.id, membership]));
  const now = new Date();

  return rows.map(row => {
    const membershipId = row.membershipId ?? inferred.get(row.id);
    const membership = membershipId ? membershipById.get(membershipId) : undefined;
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
