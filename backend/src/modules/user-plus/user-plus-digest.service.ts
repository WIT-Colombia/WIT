import { prisma } from '../../config/prisma.js';
import { Prisma } from '../../generated/prisma/client.js';
import { isPaidPlanEnabled } from '../admin/paid-plans.service.js';
import { plusLocalDateTime } from './user-plus-scheduling.js';

/** Send at most one daily in-app summary per recipient's local calendar day.
 * A unique database claim and the inbox write happen in one transaction, so retries
 * or multiple app instances cannot publish duplicate summaries.
 */
export async function dispatchDuePlusDigests(now = new Date(), db = prisma) {
  if (!(await isPaidPlanEnabled('xamukoPlus', db))) return { sent: 0 };
  // Cursor-paginate distinct recipient IDs instead of capping at 3,000.
  // A stable userId cursor also avoids skipping recipients when queue rows are
  // consumed by concurrent workers while a scan is in progress.
  const candidates: Array<{ userId: string }> = [];
  let lastUserId: string | undefined;
  for (;;) {
    const page = await db.userPlusDigestEvent.findMany({
      distinct: ['userId'], orderBy: { userId: 'asc' }, take: 300,
      ...(lastUserId ? { where: { userId: { gt: lastUserId } } } : {}),
      select: { userId: true },
    });
    if (!page.length) break;
    candidates.push(...page);
    lastUserId = page[page.length - 1].userId;
    if (page.length < 300) break;
  }
  let sent = 0;
  for (const { userId } of candidates) {
    try {
      const pref = await db.userPlusPreference.findUnique({
        where: { userId }, select: {
          deliveryMode: true, digestTimeZone: true, digestHour: true,
          radarEnabled: true, priceAlertsEnabled: true,
        },
      });
      if (!pref || pref.deliveryMode !== 'DAILY') continue;
      let local;
      try { local = plusLocalDateTime(now, pref.digestTimeZone); } catch { continue; }
      // Digest is sent in the configured local hour, not immediately on first event after it.
      if (local.hour !== pref.digestHour) continue;
      const result = await db.$transaction(async tx => {
        const [freshPref, membership, person, events] = await Promise.all([
          tx.userPlusPreference.findUnique({ where: { userId }, select: {
            deliveryMode: true, digestTimeZone: true, digestHour: true,
            radarEnabled: true, priceAlertsEnabled: true,
          } }),
          tx.userPlusSubscription.findUnique({ where: { userId }, select: {
            status: true, startsAt: true, expiresAt: true, revokedAt: true,
          } }),
          tx.user.findUnique({ where: { id: userId }, select: { status: true, adultContentEnabled: true } }),
          tx.userPlusDigestEvent.findMany({
            where: { userId, createdAt: { lte: now } },
            orderBy: { createdAt: 'asc' }, take: 1000,
            select: { id: true, kind: true, adultOnly: true, createdAt: true },
          }),
        ]);
        if (!freshPref || freshPref.deliveryMode !== 'DAILY'
          || freshPref.digestTimeZone !== pref.digestTimeZone || freshPref.digestHour !== pref.digestHour) return false;
        if (!person || person.status !== 'ACTIVE' || !membership || membership.status !== 'ACTIVE'
          || membership.revokedAt || membership.startsAt > now || membership.expiresAt <= now
          || !(await isPaidPlanEnabled('xamukoPlus', tx))) return false;
        const allowed = events.filter(event => event.createdAt >= membership.startsAt
          && (!event.adultOnly || person.adultContentEnabled)
          && (event.kind === 'RADAR' ? freshPref.radarEnabled : event.kind === 'TARGET' ? true : freshPref.priceAlertsEnabled));
        if (!allowed.length) {
          // Stale or revoked notices must not linger forever or block other recipients.
          if (events.length) await tx.userPlusDigestEvent.deleteMany({
            where: { userId, id: { in: events.map(event => event.id) } },
          });
          return false;
        }
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
          message: ('Desde tu último resumen: ' + pieces.join(', ') + '. Consulta Xamuko Plus para ver los detalles.').slice(0, 500),
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
