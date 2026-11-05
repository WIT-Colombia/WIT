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
  const rows = await prisma.userNotification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  const invitationRows = rows.filter(row => row.title === 'Invitación para colaborar');
  if (!invitationRows.length) return rows.map(row => ({ ...row, invitation: null }));

  // Legacy and new invitations are both linked through the existing Business
  // records. Require the same authenticated recipient, exact message and a
  // close creation time so a notification cannot act on another invitation.
  const times = invitationRows.map(row => row.createdAt.getTime());
  const earliest = new Date(Math.min(...times) - 15_000);
  const latest = new Date(Math.max(...times) + 15_000);
  const records = await prisma.businessNotification.findMany({
    where: {
      userId,
      type: 'COLLABORATION_INVITATION',
      createdAt: { gte: earliest, lte: latest },
    },
    select: { membershipId: true, title: true, message: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });
  const invitationIds = new Map<string, string>();
  for (const row of invitationRows) {
    const matches = records.filter(record =>
      record.membershipId &&
      record.title === row.title &&
      record.message === row.body &&
      Math.abs(record.createdAt.getTime() - row.createdAt.getTime()) <= 15_000);
    if (matches.length === 1 && matches[0].membershipId) {
      invitationIds.set(row.id, matches[0].membershipId);
    }
  }

  // A dismissed Business inbox card must not prevent a valid Usuario
  // invitation from being acted upon. Resolve a unique matching membership.
  const unresolved = invitationRows.filter(row => !invitationIds.has(row.id));
  if (unresolved.length) {
    const candidates = await prisma.businessMembership.findMany({
      where: { userId, role: 'COLLABORATOR', invitedAt: { gte: earliest, lte: latest } },
      select: { id: true, invitedAt: true, business: { select: { name: true } } },
      take: 500,
    });
    for (const row of unresolved) {
      const matches = candidates.filter(candidate =>
        row.body === `${candidate.business.name} te ha invitado a colaborar en su establecimiento.` &&
        Math.abs(row.createdAt.getTime() - candidate.invitedAt.getTime()) <= 15_000);
      if (matches.length === 1) invitationIds.set(row.id, matches[0].id);
    }
  }

  const ids = [...new Set(invitationIds.values())];
  const memberships = ids.length
    ? await prisma.businessMembership.findMany({
        where: { id: { in: ids }, userId },
        select: { id: true, status: true, expiresAt: true },
      })
    : [];
  const membershipById = new Map(memberships.map(item => [item.id, item]));
  const now = new Date();

  return rows.map(row => {
    const id = invitationIds.get(row.id);
    const membership = id ? membershipById.get(id) : undefined;
    return {
      ...row,
      invitation: membership ? {
        membershipId: membership.id,
        status: membership.status === 'INVITED' && membership.expiresAt && membership.expiresAt <= now
          ? 'EXPIRED' : membership.status,
        expiresAt: membership.expiresAt,
      } : null,
    };
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
