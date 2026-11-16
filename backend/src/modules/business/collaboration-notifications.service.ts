import { prisma } from '../../config/prisma.js';
import { notifyPlatformUser } from '../notifications/platform-notifications.service.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const PAGE_SIZE = 200;
export type CollaborationDeadline = 'ONE_DAY' | 'EXPIRED';
export function collaborationDeadline(expiresAt: Date, now: Date): CollaborationDeadline | null {
  const milliseconds = expiresAt.getTime() - now.getTime();
  if (milliseconds <= 0) return 'EXPIRED';
  return milliseconds <= DAY_MS ? 'ONE_DAY' : null;
}


/**
 * An inbox item can be deleted by its recipient. A separate durable dispatch
 * key prevents re-sending the same milestone on later hourly sweeps.
 */
async function processInvitation(membershipId: string, now: Date) {
  return prisma.$transaction(async tx => {
    const membership = await tx.businessMembership.findFirst({
      where: { id: membershipId, role: 'COLLABORATOR', status: 'INVITED',
        business: { deletionStatus: { not: 'DELETED' }, businessAccount: { status: 'ACTIVE' } },
        user: { status: 'ACTIVE' } },
      select: { id: true, businessId: true, userId: true, invitedAt: true, expiresAt: true,
        business: { select: { name: true, memberships: { where: { role: 'OWNER', status: 'ACTIVE', user: { status: 'ACTIVE' } }, select: { userId: true } } } } },
    });
    if (!membership?.expiresAt) return 0;
    const deadline = collaborationDeadline(membership.expiresAt, now);
    if (!deadline) return 0;
    const expired = deadline === 'EXPIRED';
    const event = expired ? 'COLLAB_INVITE_EXPIRED' : 'COLLAB_INVITE_1DAY';
    const ownerIds = [...new Set(membership.business.memberships.map(item => item.userId))].filter(id => id !== membership.userId);
    const audience: Array<{ userId: string; channel: string }> = [{ userId: membership.userId, channel: 'user' }];
    if (expired) {
      audience.push(...ownerIds.map(userId => ({ userId, channel: 'business' })));
      await tx.platformNotification.updateMany({ where: {
        userId: membership.userId, sourceType: 'COLLABORATION_INVITED',
        sourceId: membership.businessId, readAt: null,
      }, data: { readAt: now } });
    }
    let delivered = 0;
    for (const recipient of audience) {
      const reserved = await tx.businessLifecycleNoticeDispatch.createMany({
        data: [{ dedupeKey: ['invitation',membership.id,membership.invitedAt.getTime(),event,recipient.userId,recipient.channel].join(':'),
          businessId: membership.businessId, userId: recipient.userId, event, channel: recipient.channel }],
        skipDuplicates: true,
      });
      if (!reserved.count) continue;
      if (recipient.channel === 'business') {
        await tx.businessNotification.create({ data: { userId: recipient.userId,
          businessId: membership.businessId, membershipId: membership.id, type: 'COLLABORATION_UPDATE',
          title: 'Invitación de colaboración vencida',
          message: 'La invitación para colaborar en ' + membership.business.name + ' venció sin respuesta. Puedes enviar una nueva invitación si aún deseas contar con esta persona.' } });
      } else {
        await notifyPlatformUser(tx, { userId: recipient.userId, sourceType: 'COLLABORATION_EXPIRED',
          sourceId: membership.businessId,
          title: expired ? 'Tu invitación de colaboración venció' : 'Tu invitación vence mañana',
          message: expired
            ? 'Ya venció la invitación para colaborar con ' + membership.business.name + '. Si te interesa participar, solicita una nueva invitación al propietario.'
            : 'Te queda aproximadamente 1 día para responder la invitación de ' + membership.business.name + '. Entra a XAMUKO Business para aceptarla o rechazarla.' });
      }
      delivered++;
    }
    if (expired) await tx.businessNotification.updateMany({
      where: { membershipId: membership.id, userId: membership.userId,
        type: 'COLLABORATION_INVITATION', readAt: null }, data: { readAt: now },
    });
    return delivered;
  });
}

async function processTransfer(transferId: string, now: Date) {
  return prisma.$transaction(async tx => {
    const transfer = await tx.ownershipTransfer.findFirst({
      where: { id: transferId, status: 'PENDING', business: { deletionStatus: { not: 'DELETED' } } },
      select: { id: true, businessId: true, fromUserId: true, toUserId: true, expiresAt: true,
        business: { select: { name: true } } },
    });
    if (!transfer?.expiresAt) return 0;
    const deadline = collaborationDeadline(transfer.expiresAt, now);
    if (!deadline) return 0;
    const expired = deadline === 'EXPIRED';
    const event = expired ? 'OWNERSHIP_EXPIRED' : 'OWNERSHIP_1DAY';
    if (expired) {
      const changed = await tx.ownershipTransfer.updateMany({
        where: { id: transfer.id, status: 'PENDING', expiresAt: { lte: now } },
        data: { status: 'EXPIRED', respondedAt: now },
      });
      if (!changed.count) return 0;
    }
    if (expired) {
      // Retire only old pending transfer notices, before creating the new expiry notice.
      await tx.platformNotification.updateMany({ where: {
        userId: { in: [transfer.fromUserId, transfer.toUserId] }, sourceType: 'OWNERSHIP_TRANSFER',
        sourceId: transfer.businessId, readAt: null,
      }, data: { readAt: now } });
    }
    let delivered = 0;
    for (const userId of new Set([transfer.fromUserId, transfer.toUserId])) {
      const reserved = await tx.businessLifecycleNoticeDispatch.createMany({
        data: [{ dedupeKey: ['transfer',transfer.id,event,userId,'user'].join(':'),
          businessId: transfer.businessId, userId, event, channel: 'user' }], skipDuplicates: true,
      });
      if (!reserved.count) continue;
      const sender = userId === transfer.fromUserId;
      await notifyPlatformUser(tx, { userId, sourceType: 'OWNERSHIP_TRANSFER', sourceId: transfer.businessId,
        title: expired ? 'La transferencia de propiedad venció' : 'La transferencia vence mañana',
        message: expired
          ? 'La propuesta de transferencia de ' + transfer.business.name + ' venció sin aceptarse. La propiedad del negocio no cambió.'
          : sender
            ? 'La solicitud para transferir ' + transfer.business.name + ' vence aproximadamente en 1 día. Puedes revisar su estado en XAMUKO Business.'
            : 'Te queda aproximadamente 1 día para aceptar o rechazar la propiedad de ' + transfer.business.name + ' en XAMUKO Business.' });
      delivered++;
    }
    if (expired) {
      const ownerNotice = await tx.businessLifecycleNoticeDispatch.createMany({
        data: [{ dedupeKey: ['transfer',transfer.id,event,transfer.fromUserId,'business'].join(':'),
          businessId: transfer.businessId, userId: transfer.fromUserId, event, channel: 'business' }], skipDuplicates: true,
      });
      if (ownerNotice.count) {
        await tx.businessNotification.create({ data: { userId: transfer.fromUserId, businessId: transfer.businessId,
          type: 'COLLABORATION_UPDATE', title: 'Transferencia de propiedad vencida',
          message: 'La transferencia de ' + transfer.business.name + ' venció. Sigues siendo el propietario.' } });
        delivered++;
      }
    }
    return delivered;
  });
}

export async function sweepCollaborationNotifications(now = new Date()) {
  const cutoff = new Date(now.getTime() + DAY_MS);
  let sent = 0, failed = 0, examined = 0;
  let cursor: string | undefined;
  do {
    const rows: Array<{ id: string }> = await prisma.businessMembership.findMany({
      where: { role: 'COLLABORATOR', status: 'INVITED', expiresAt: { lte: cutoff },
        business: { deletionStatus: { not: 'DELETED' }, businessAccount: { status: 'ACTIVE' } },
        user: { status: 'ACTIVE' } },
      select: { id: true }, orderBy: { id: 'asc' }, take: PAGE_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    for (const row of rows) { examined++;
      try { sent += await processInvitation(row.id, now); }
      catch (error) { failed++; console.error('[collab-notices] Error en invitación', row.id, error); }
    }
    if (rows.length < PAGE_SIZE) break;
    cursor = rows[rows.length - 1].id;
  } while (true);
  cursor = undefined;
  do {
    const rows: Array<{ id: string }> = await prisma.ownershipTransfer.findMany({
      where: { status: 'PENDING', expiresAt: { lte: cutoff },
        business: { deletionStatus: { not: 'DELETED' } } },
      select: { id: true }, orderBy: { id: 'asc' }, take: PAGE_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    for (const row of rows) { examined++;
      try { sent += await processTransfer(row.id, now); }
      catch (error) { failed++; console.error('[collab-notices] Error en transferencia', row.id, error); }
    }
    if (rows.length < PAGE_SIZE) break;
    cursor = rows[rows.length - 1].id;
  } while (true);
  return { examined, sent, failed };
}
