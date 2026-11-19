import { Prisma } from '../../generated/prisma/client.js';
import { isPaidPlanEnabled } from '../admin/paid-plans.service.js';

type Tx = Prisma.TransactionClient;

async function eligibleUsers(tx: Tx, ids: string[], kind: 'radar' | 'price', adultOnly: boolean) {
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
  const muted = new Set(preferences.filter(p => kind === 'radar' ? !p.radarEnabled : !p.priceAlertsEnabled).map(p => p.userId));
  return people.filter(person => active.has(person.id) && !muted.has(person.id)
    && (adultOnly === false || person.adultContentEnabled)).map(person => person.id);
}

/** New published catalog items and promotions trigger Plus inbox notices for favorite businesses. */
export async function notifyPlusFollowers(tx: Tx, input: {
  businessId: string; sourceId: string; businessName: string;
  itemName: string; sourceType: 'PLUS_NEW_OFFER' | 'PLUS_NEW_PROMOTION'; adultOnly: boolean;
}) {
  const favorites = await tx.businessFavorite.findMany({ where: { businessId: input.businessId },
    select: { userId: true }, take: 2000 });
  const recipients = await eligibleUsers(tx, favorites.map(f => f.userId), 'radar', input.adultOnly);
  if (!recipients.length) return;
  await tx.platformNotification.createMany({ data: recipients.map(userId => ({
    userId, sourceType: input.sourceType, sourceId: input.sourceId,
    title: 'Novedad de ' + input.businessName.slice(0, 145),
    message: ('Se publicó «' + input.itemName + '» en uno de tus negocios favoritos.').slice(0, 500),
  })) });
}

/** Capture every real price change, regardless of plan; notify opted-in active Plus watchers only. */
export async function recordPlusPriceChange(tx: Tx, input: {
  offerId: string; businessId: string; name: string;
  previousPrice: Prisma.Decimal | null; newPrice: Prisma.Decimal | null;
  currency: string | null; adultOnly: boolean; publiclyVisible: boolean;
}) {
  if (input.previousPrice?.toString() === input.newPrice?.toString()) return;
  await tx.offerPriceHistory.create({ data: {
    offerId: input.offerId, previousPrice: input.previousPrice, newPrice: input.newPrice, currency: input.currency,
  } });
  if (!input.publiclyVisible || !input.newPrice || !input.previousPrice || input.newPrice.gte(input.previousPrice)) return;
  const watchRows = await tx.userPlusPriceWatch.findMany({ where: { offerId: input.offerId },
    select: { userId: true }, take: 2000 });
  const recipients = await eligibleUsers(tx, watchRows.map(w => w.userId), 'price', input.adultOnly);
  if (!recipients.length) return;
  await tx.platformNotification.createMany({ data: recipients.map(userId => ({
    userId, sourceType: 'PLUS_PRICE_DROP', sourceId: input.offerId,
    title: 'Bajó el precio de ' + input.name.slice(0, 145),
    message: ('El precio publicado bajó de ' + input.previousPrice?.toString()
      + ' a ' + input.newPrice?.toString() + ' ' + (input.currency ?? '') + '.').slice(0, 500),
  })) });
}
