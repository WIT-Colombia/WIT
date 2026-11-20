import { Prisma } from '../../generated/prisma/client.js';
import { isPaidPlanEnabled } from '../admin/paid-plans.service.js';
import { publicReleaseWhere } from '../zones/zones.service.js';

type Tx = Prisma.TransactionClient;

/**
 * Follow the same strictly numeric catalog price the public product page displays.
 * Free text and negotiable values are not eligible for price alerts.
 */
export function effectivePlusPrice(amount: Prisma.Decimal | null, text: string | null, negotiable: boolean): Prisma.Decimal | null {
  if (negotiable) return null;
  if (amount !== null && amount.gt(0)) return amount;
  const raw = text?.trim() ?? '';
  if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) return null;
  try {
    const parsed = new Prisma.Decimal(raw);
    return parsed.gt(0) ? parsed : null;
  } catch {
    return null;
  }
}

export async function eligibleUsers(tx: Tx, ids: string[], kind: 'radar' | 'price', adultOnly: boolean) {
  if (!ids.length || !(await isPaidPlanEnabled('xamukoPlus', tx))) return [];
  const now = new Date();
  const unique = [...new Set(ids)];
  const [members, preferences, people] = await Promise.all([
    tx.userPlusSubscription.findMany({ where: { userId: { in: unique }, status: 'ACTIVE',
      startsAt: { lte: now }, expiresAt: { gt: now }, revokedAt: null }, select: { userId: true } }),
    tx.userPlusPreference.findMany({ where: { userId: { in: unique } },
      select: { userId: true, radarEnabled: true, priceAlertsEnabled: true } }),
    tx.user.findMany({ where: { id: { in: unique }, status: 'ACTIVE' },
      select: { id: true, adultContentEnabled: true } }),
  ]);
  const active = new Set(members.map(m => m.userId));
  // Commercial alerts are opt-in: missing preference rows must never send notifications.
  const optedIn = new Set(preferences.filter(p => kind === 'radar' ? p.radarEnabled : p.priceAlertsEnabled).map(p => p.userId));
  return people.filter(person => active.has(person.id) && optedIn.has(person.id)
    && (adultOnly === false || person.adultContentEnabled)).map(person => person.id);
}

/** New published catalog items and promotions trigger Plus inbox notices for favorite businesses. */
export async function notifyPlusFollowers(tx: Tx, input: {
  businessId: string; sourceId: string; businessName: string;
  itemName: string; sourceType: 'PLUS_NEW_OFFER' | 'PLUS_NEW_PROMOTION'; adultOnly: boolean;
}) {
  // Never send commercial alerts for businesses in closed/unreleased cities.
  const released = await tx.business.findFirst({
    where: { id: input.businessId, AND: [await publicReleaseWhere(undefined, tx)] },
    select: { id: true },
  });
  if (!released) return;
  const favorites = await tx.businessFavorite.findMany({ where: { businessId: input.businessId },
    select: { userId: true }, take: 2000 });
  const recipients = await eligibleUsers(tx, favorites.map(f => f.userId), 'radar', input.adultOnly);
  await dispatchPlusAlert(tx, recipients, {
    kind: 'RADAR', sourceType: input.sourceType, sourceId: input.sourceId,
    title: 'Novedad de ' + input.businessName.slice(0, 145),
    message: ('Se publicó «' + input.itemName + '» en uno de tus negocios favoritos.').slice(0, 500),
  });
}

/** Capture every real price change, regardless of plan; notify opted-in active Plus watchers only. */
export async function recordPlusPriceChange(tx: Tx, input: {
  offerId: string; businessId: string; name: string;
  previousPrice: Prisma.Decimal | null; newPrice: Prisma.Decimal | null;
  previousCurrency: string | null; currency: string | null; adultOnly: boolean; publiclyVisible: boolean;
}) {
  if (input.previousPrice?.toString() === input.newPrice?.toString() && input.previousCurrency === input.currency) return;
  await tx.offerPriceHistory.create({ data: {
    offerId: input.offerId, previousPrice: input.previousPrice, newPrice: input.newPrice,
    previousCurrency: input.previousCurrency, currency: input.currency,
  } });
  if (!input.publiclyVisible || !input.newPrice || !input.currency) return;
  const dropped = Boolean(input.previousPrice && input.previousCurrency === input.currency
    && input.newPrice.lt(input.previousPrice));
  const watchRows = await tx.userPlusPriceWatch.findMany({ where: { offerId: input.offerId },
    select: { id: true, userId: true, targetAmount: true, targetCurrency: true, targetNotifiedAt: true },
    take: 2000 });
  if (!watchRows.length) return;
  const recipients = new Set(await eligibleUsers(tx, watchRows.map(w => w.userId), 'price', input.adultOnly));
  const targetUsers: string[] = [];
  const dropUsers: string[] = [];
  for (const watch of watchRows) {
    if (!recipients.has(watch.userId)) continue;
    const hitTarget = watch.targetAmount !== null && watch.targetNotifiedAt === null
      && watch.targetCurrency === input.currency && input.newPrice.lte(watch.targetAmount);
    if (hitTarget) {
      // Atomic one-shot claim; changing the objective re-arms it intentionally.
      const claimed = await tx.userPlusPriceWatch.updateMany({
        where: { id: watch.id, targetNotifiedAt: null, targetAmount: watch.targetAmount,
          targetCurrency: input.currency },
        data: { targetNotifiedAt: new Date() },
      });
      if (claimed.count) targetUsers.push(watch.userId);
    } else if (dropped) dropUsers.push(watch.userId);
  }
  await dispatchPlusAlert(tx, targetUsers, {
    kind: 'TARGET', sourceType: 'PLUS_PRICE_TARGET', sourceId: input.offerId,
    title: 'Precio objetivo alcanzado: ' + input.name.slice(0, 145),
    message: ('El precio publicado llegó a ' + input.newPrice.toString() + ' ' + input.currency
      + ', igual o menor que tu objetivo configurado.').slice(0, 500),
  });
  if (dropped && input.previousPrice) await dispatchPlusAlert(tx, dropUsers, {
    kind: 'PRICE', sourceType: 'PLUS_PRICE_DROP', sourceId: input.offerId,
    title: 'Bajó el precio de ' + input.name.slice(0, 145),
    message: ('El precio publicado bajó de ' + input.previousPrice.toString() +
      ' a ' + input.newPrice.toString() + ' ' + input.currency + '.').slice(0, 500),
  });
}

/** A commercial notice goes either straight to the inbox or to the durable digest queue. */
async function dispatchPlusAlert(tx: Tx, userIds: string[], alert: {
  kind: 'RADAR' | 'PRICE' | 'TARGET'; sourceType: string; sourceId: string;
  title: string; message: string;
}) {
  if (!userIds.length) return;
  const prefs = await tx.userPlusPreference.findMany({ where: { userId: { in: [...new Set(userIds)] } },
    select: { userId: true, deliveryMode: true } });
  const daily = new Set(prefs.filter(p => p.deliveryMode === 'DAILY').map(p => p.userId));
  const unique = [...new Set(userIds)];
  const immediate = unique.filter(userId => !daily.has(userId));
  const deferred = unique.filter(userId => daily.has(userId));
  if (immediate.length) await tx.platformNotification.createMany({
    data: immediate.map(userId => ({
      userId, sourceType: alert.sourceType, sourceId: alert.sourceId,
      title: alert.title.slice(0, 180), message: alert.message.slice(0, 500),
    })),
  });
  if (deferred.length) await tx.userPlusDigestEvent.createMany({
    data: deferred.map(userId => ({ userId, kind: alert.kind, sourceId: alert.sourceId })),
  });
}
