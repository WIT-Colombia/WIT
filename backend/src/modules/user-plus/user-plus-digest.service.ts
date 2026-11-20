import { prisma } from '../../config/prisma.js';
import { Prisma } from '../../generated/prisma/client.js';
import { isPaidPlanEnabled } from '../admin/paid-plans.service.js';
import { plusLocalDateTime } from './user-plus-scheduling.js';

/** Send at most one daily in-app summary per recipient's local calendar day.
 * A unique database claim and the inbox write happen in one transaction, so retries
 * or multiple app instances cannot publish duplicate summaries.
 */
export async function dispatchDuePlusDigests(now = new Date()) {
  if (!(await isPaidPlanEnabled('xamukoPlus'))) return { sent: 0 };
  const candidates = await prisma.userPlusDigestEvent.findMany({
    distinct: ['userId'], orderBy: { createdAt: 'asc' }, take: 300,
    select: { userId: true },
  });
  let sent = 0;
  for (const { userId } of candidates) {
    try {
      const pref = await prisma.userPlusPreference.findUnique({
        where: { userId }, select: {
          deliveryMode: true, digestTimeZone: true, digestHour: true,
          radarEnabled: true, priceAlertsEnabled: true,
        },
      });
      if (!pref || pref.deliveryMode !== 'DAILY') continue;
      let local;
      try { local = plusLocalDateTime(now, pref.digestTimeZone); } catch { continue; }
      if (local.hour < pref.digestHour) continue;
      const result = await prisma.$transaction(async tx => {
        const [membership, person, events] = await Promise.all([
          tx.userPlusSubscription.findUnique({ where: { userId }, select: {
            status: true, startsAt: true, expiresAt: true, revokedAt: true,
          } }),
          tx.user.findUnique({ where: { id: userId }, select: { status: true } }),
          tx.userPlusDigestEvent.findMany({
            where: { userId, createdAt: { lte: now } },
            orderBy: { createdAt: 'asc' }, take: 1000,
            select: { id: true, kind: true, createdAt: true },
          }),
        ]);
        if (!person || person.status !== 'ACTIVE' || !membership || membership.status !== 'ACTIVE'
          || membership.revokedAt || membership.startsAt > now || membership.expiresAt <= now
          || !(await isPaidPlanEnabled('xamukoPlus', tx))) return false;
        const allowed = events.filter(event => event.createdAt >= membership.startsAt &&
          (event.kind === 'RADAR' ? pref.radarEnabled : event.kind === 'TARGET' ? true : pref.priceAlertsEnabled));
        if (!allowed.length) return false;
        // The unique constraint guarantees atomic idempotency across worker instances.
        await tx.userPlusDigestDispatch.create({ data: { userId, localDay: local.day } });
        const counts = {
          radar: allowed.filter(e => e.kind === 'RADAR').length,
          price: allowed.filter(e => e.kind === 'PRICE').length,
          targets: allowed.filter(e => e.kind === 'TARGET').length,
        };
        const pieces = [
          counts.radar ? counts.radar + ' novedades de tus negocios favoritos' : '',
          counts.price ? counts.price + ' rebajas de precios seguidos' : '',
          counts.targets ? counts.targets + ' precios objetivo alcanzados' : '',
        ].filter(Boolean);
        await tx.platformNotification.create({ data: {
          userId, sourceType: 'PLUS_DAILY_DIGEST', sourceId: userId,
          title: 'Tu resumen diario Xamuko Plus',
          message: ('Hoy tienes ' + pieces.join(', ') + '. Consulta Xamuko Plus para ver los detalles.').slice(0, 500),
        } });
        await tx.userPlusDigestEvent.deleteMany({ where: { id: { in: events.map(e => e.id) }, userId } });
        return true;
      });
      if (result) sent++;
    } catch (error) {
      // A duplicate daily claim means another worker delivered it. Other errors are logged.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') continue;
      console.error('No se pudo publicar el resumen diario de Xamuko Plus:', error);
    }
  }
  return { sent };
}

export function startPlusDailyDigestScheduler(): () => void {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try { await dispatchDuePlusDigests(); }
    catch (error) { console.error('Falló el programador diario de Xamuko Plus:', error); }
    finally { running = false; }
  };
  // Run promptly after restart, and periodically for each user's configured local hour.
  const timer = setInterval(() => void tick(), 60_000);
  timer.unref();
  void tick();
  return () => clearInterval(timer);
}
