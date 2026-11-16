import { prisma } from '../../config/prisma.js';
import { sweepCollaborationNotifications } from './collaboration-notifications.service.js';

export const VISIBILITY_PERIOD_DAYS = 40;
const DAY_MS = 24 * 60 * 60 * 1000;
const SCAN_EVERY_MS = 60 * 60 * 1000;
const MAX_BATCH = 200;

export type VisibilityMilestone = 'SEVEN_DAYS' | 'FIVE_DAYS' | 'THREE_DAYS' | 'ONE_DAY' | 'EXPIRED';

/** The nearest relevant milestone wins. Catch-up runs do not backfill stale reminders. */
export function visibilityMilestone(expiresAt: Date, now: Date): VisibilityMilestone | null {
  const timeLeft = expiresAt.getTime() - now.getTime();
  if (timeLeft <= 0) return 'EXPIRED';
  const daysRemaining = Math.ceil(timeLeft / DAY_MS);
  if (daysRemaining <= 1) return 'ONE_DAY';
  if (daysRemaining <= 3) return 'THREE_DAYS';
  if (daysRemaining <= 5) return 'FIVE_DAYS';
  if (daysRemaining <= 7) return 'SEVEN_DAYS';
  return null;
}

export function visibilityNoticeContent(businessName: string, stage: VisibilityMilestone, channel: 'business' | 'user') {
  const name = businessName.trim().slice(0, 140);
  if (stage === 'EXPIRED') return channel === 'business' ? {
    title: 'Tu negocio ya no está visible',
    message: 'El periodo de visibilidad de ' + name + ' terminó. Tu negocio dejó de aparecer en XAMUKO, pero puedes renovar su visibilidad para volver a conectar con más personas.',
  } : {
    title: 'Tu negocio necesita tu atención',
    message: name + ' ya no está visible en XAMUKO porque venció su periodo de publicación. Ingresa a XAMUKO Business y renueva su visibilidad para que más personas puedan encontrarlo.',
  };
  const days = stage === 'SEVEN_DAYS' ? 7 : stage === 'FIVE_DAYS' ? 5 : stage === 'THREE_DAYS' ? 3 : 1;
  if (channel === 'user') return {
    title: days === 1 ? 'Tu negocio podría dejar de estar visible mañana' : 'Tu negocio podría dejar de estar visible pronto',
    message: 'A ' + name + ' le ' + (days === 1 ? 'queda 1 día' : 'quedan ' + days + ' días') + ' de visibilidad. Nos encantaría que siguieras conectando con más personas. Entra a XAMUKO Business y renueva antes de que venza.',
  };
  return {
    title: days === 1 ? '¡Último día de visibilidad!' : 'A tu negocio le quedan ' + days + ' días de visibilidad',
    message: name + ' está a ' + (days === 1 ? 'un día' : days + ' días') + ' de terminar su periodo de visibilidad. ¡Queremos que sigas creciendo! Renueva a tiempo para continuar apareciendo en XAMUKO.',
  };
}

export function noticeChannels(stage: VisibilityMilestone): Array<'business' | 'user'> {
  return stage === 'SEVEN_DAYS' || stage === 'FIVE_DAYS' ? ['business'] : ['business', 'user'];
}

export async function processVisibilityBusiness(businessId: string, now = new Date()) {
  return prisma.$transaction(async tx => {
    // Re-read the current business and latest period within the transaction.
    const business = await tx.business.findFirst({
      where: {
        id: businessId, businessAccount: { status: 'ACTIVE' },
        lifecycleStatus: 'ACTIVE', publicationStatus: 'PUBLISHED',
        deletionStatus: 'NONE', visibilityStatus: { in: ['VISIBLE', 'EXPIRED'] },
      },
      select: {
        id: true, name: true, visibilityStatus: true,
        memberships: {
          where: { role: 'OWNER', status: 'ACTIVE', user: { status: 'ACTIVE' } },
          select: { userId: true },
        },
      },
    });
    if (!business) return { sent: 0, skipped: true };
    const period = await tx.businessVisibilityPeriod.findFirst({
      where: { businessId: business.id },
      orderBy: { expiresAt: 'desc' },
      select: { id: true, startsAt: true, expiresAt: true },
    });
    if (!period || period.startsAt > now) return { sent: 0, skipped: true };
    const stage = visibilityMilestone(period.expiresAt, now);
    if (!stage) return { sent: 0, skipped: true };

    if (stage === 'EXPIRED' && business.visibilityStatus === 'VISIBLE') {
      const expired = await tx.business.updateMany({
        where: { id: business.id, visibilityStatus: 'VISIBLE', deletionStatus: 'NONE' },
        data: { visibilityStatus: 'EXPIRED' },
      });
      if (expired.count) {
        await tx.auditLog.create({
          data: {
            actorUserId: null, entityType: 'BUSINESS', entityId: business.id,
            action: 'BUSINESS_VISIBILITY_EXPIRED',
            previousState: { visibilityStatus: 'VISIBLE', periodId: period.id },
            newState: { visibilityStatus: 'EXPIRED' },
            reason: 'Vencimiento automático del periodo de visibilidad',
          },
        });
      }
    }
    let sent = 0;
    const ownerIds = [...new Set(business.memberships.map(member => member.userId))];
    for (const userId of ownerIds) {
      for (const channel of noticeChannels(stage)) {
        // Keep this ledger even after an inbox message is removed by the recipient.
        const key = 'visibility:' + period.id + ':' + stage + ':' + userId + ':' + channel;
        const reserved = await tx.businessLifecycleNoticeDispatch.createMany({
          data: [{ dedupeKey: key, businessId: business.id, userId, event: stage, channel }],
          skipDuplicates: true,
        });
        if (reserved.count !== 1) continue;
        const copy = visibilityNoticeContent(business.name, stage, channel);
        if (channel === 'business') {
          await tx.businessNotification.create({
            data: {
              businessId: business.id, userId,
              type: stage === 'EXPIRED' ? 'VISIBILITY_EXPIRED' : 'VISIBILITY_REMINDER',
              title: copy.title, message: copy.message,
            },
          });
        } else {
          await tx.platformNotification.create({
            data: {
              userId, sourceType: 'BUSINESS_VISIBILITY',
              sourceId: business.id, title: copy.title, message: copy.message,
            },
          });
        }
        sent += 1;
      }
    }
    return { sent, skipped: false, stage };
  });
}

export async function sweepBusinessVisibilityNotifications(now = new Date()) {
  let cursor: string | undefined;
  let examined = 0;
  let sent = 0;
  let failed = 0;
  const cutoff = new Date(now.getTime() + 7 * DAY_MS);
  while (true) {
    const businesses = await prisma.business.findMany({
      where: {
        businessAccount: { status: 'ACTIVE' }, lifecycleStatus: 'ACTIVE',
        publicationStatus: 'PUBLISHED', deletionStatus: 'NONE',
        visibilityStatus: { in: ['VISIBLE', 'EXPIRED'] },
        visibilityPeriods: { some: { expiresAt: { lte: cutoff } } },
      },
      select: { id: true },
      orderBy: { id: 'asc' },
      take: MAX_BATCH,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    for (const business of businesses) {
      examined += 1;
      try { sent += (await processVisibilityBusiness(business.id, now)).sent; }
      catch (error) {
        failed += 1;
        console.error('[visibility-notices] No se pudo procesar negocio', business.id, error);
      }
    }
    if (businesses.length < MAX_BATCH) break;
    cursor = businesses[businesses.length - 1].id;
  }
  return { examined, sent, failed };
}

let running = false;
export function startVisibilityNotificationScheduler(): () => void {
  let stopped = false;
  const tick = async () => {
    if (running || stopped) return;
    running = true;
    try {
      const result = await sweepBusinessVisibilityNotifications();
      if (result.sent || result.failed) console.info('[visibility-notices] Barrido', result);
      const collaboration = await sweepCollaborationNotifications();
      if (collaboration.sent || collaboration.failed) console.info('[collab-notices] Barrido', collaboration);
    } catch (error) {
      console.error('[visibility-notices] No se pudo ejecutar el barrido', error);
    } finally { running = false; }
  };
  void tick(); // Catch up after restarts or deployments.
  const timer = setInterval(() => { void tick(); }, SCAN_EVERY_MS);
  timer.unref();
  return () => { stopped = true; clearInterval(timer); };
}
