import { prisma } from '../../config/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';
import { isPaidPlanEnabled } from '../admin/paid-plans.service.js';

const publishedBusiness = {
  publicationStatus: 'PUBLISHED' as const,
  visibilityStatus: 'VISIBLE' as const,
  lifecycleStatus: 'ACTIVE' as const,
  deletionStatus: 'NONE' as const,
  businessAccount: { status: 'ACTIVE' as const },
};
const publishedOffer = {
  active: true, deletedAt: null, publicationStatus: 'PUBLISHED' as const,
  administrativeStatus: 'NONE' as const,
  business: publishedBusiness,
};
const safeOfferWhere = (adultContentEnabled: boolean) => ({
  ...publishedOffer,
  ...(adultContentEnabled ? {} : { adultOnly: false, business: { ...publishedBusiness, adultOnly: false } }),
});
const adultConsent = async (userId: string) => (await prisma.user.findUnique({
  where: { id: userId }, select: { adultContentEnabled: true },
}))?.adultContentEnabled === true;


export function hasPlusEntitlement(enabled: boolean, membership: {
  status: string; startsAt: Date; expiresAt: Date; revokedAt: Date | null;
} | null, now = new Date()): boolean {
  return Boolean(enabled && membership?.status === 'ACTIVE'
    && membership.startsAt <= now && membership.expiresAt > now && !membership.revokedAt);
}

export async function plusStatus(userId: string) {
  const [enabled, membership] = await Promise.all([
    isPaidPlanEnabled('xamukoPlus'),
    prisma.userPlusSubscription.findUnique({ where: { userId } }),
  ]);
  const active = hasPlusEntitlement(enabled, membership);
  return {
    enabled, active,
    subscription: membership ? {
      status: membership.status,
      startsAt: membership.startsAt.toISOString(),
      expiresAt: membership.expiresAt.toISOString(),
      revoked: Boolean(membership.revokedAt),
    } : null,
  };
}

/** Every protected Plus operation verifies both master availability and membership server-side. */
export async function requirePlus(userId: string) {
  const status = await plusStatus(userId);
  if (!status.active) throw new AppError(403, 'XAMUKO_PLUS_REQUIRED',
    'Xamuko Plus no está disponible o tu suscripción no está vigente.');
}

export async function plusOverview(userId: string) {
  const status = await plusStatus(userId);
  if (!status.active) return { ...status, collections: [], searches: [], watches: [], preferences: null };
  const [collections, searches, watches, preferences] = await Promise.all([
    prisma.userPlusCollection.findMany({ where: { userId }, include: { items: { orderBy: { createdAt: 'desc' } } }, orderBy: { updatedAt: 'desc' }, take: 50 }),
    prisma.userPlusSavedSearch.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50 }),
    prisma.userPlusPriceWatch.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 100,
      select: { id: true, offerId: true, createdAt: true,
        offer: { select: { name: true, kind: true, priceAmount: true, priceText: true, currency: true, active: true, adultOnly: true, deletedAt: true,
          publicationStatus: true, administrativeStatus: true,
          business: { select: { name: true, publicId: true, adultOnly: true, publicationStatus: true, visibilityStatus: true,
            lifecycleStatus: true, deletionStatus: true, businessAccount: { select: { status: true } } } },
        } },
      },
    }),
    prisma.userPlusPreference.findUnique({ where: { userId } }),
  ]);
  const adultAllowed = await adultConsent(userId);
  const offerIds = collections.flatMap(col => col.items.filter(item => item.targetType === 'OFFER').map(item => item.targetId));
  const businessIds = collections.flatMap(col => col.items.filter(item => item.targetType === 'BUSINESS').map(item => item.targetId));
  const [collectedOffers, collectedBusinesses] = await Promise.all([
    prisma.businessOffer.findMany({ where: { id: { in: offerIds }, ...safeOfferWhere(adultAllowed) },
      select: { id: true, name: true, kind: true } }),
    prisma.business.findMany({ where: { id: { in: businessIds }, ...publishedBusiness,
      ...(adultAllowed ? {} : { adultOnly: false }) },
      select: { id: true, publicId: true, name: true } }),
  ]);
  const foundOffers = new Map(collectedOffers.map(item => [item.id, item]));
  const foundBusinesses = new Map(collectedBusinesses.map(item => [item.id, item]));
  const safeCollections = collections.map(col => ({
    ...col,
    items: col.items.map(item => {
      const business = item.targetType === 'BUSINESS' ? foundBusinesses.get(item.targetId) : undefined;
      const offer = item.targetType === 'OFFER' ? foundOffers.get(item.targetId) : undefined;
      return { ...item, available: Boolean(business || offer),
        name: business?.name ?? offer?.name ?? 'Publicación no disponible',
        href: business ? '/business/' + business.publicId : offer ? '/' + (offer.kind === 'PRODUCT' ? 'product' : 'service') + '/' + offer.id : null };
    }),
  }));
  const safeWatches = watches.map(row => {
    const item = row.offer;
    const business = item.business;
    const available = item.active && !item.deletedAt && item.publicationStatus === 'PUBLISHED'
      && item.administrativeStatus === 'NONE' && business.publicationStatus === 'PUBLISHED'
      && business.visibilityStatus === 'VISIBLE' && business.lifecycleStatus === 'ACTIVE'
      && business.deletionStatus === 'NONE' && business.businessAccount.status === 'ACTIVE'
      && (adultAllowed || (!item.adultOnly && !business.adultOnly));
    return {
      id: row.id, offerId: row.offerId, createdAt: row.createdAt, kind: item.kind,
      name: available ? item.name : 'Publicación no disponible',
      currency: available ? item.currency : null,
      price: available ? item.priceAmount?.toString() ?? null : null,
      priceText: available ? item.priceText : null,
      businessName: available ? business.name : '',
      available,
    };
  });
  return { ...status, collections: safeCollections, searches, watches: safeWatches,
    preferences: { radarEnabled: preferences?.radarEnabled ?? true,
      priceAlertsEnabled: preferences?.priceAlertsEnabled ?? true } };
}

export async function setPlusPreferences(userId: string, next: { radarEnabled?: boolean; priceAlertsEnabled?: boolean }) {
  await requirePlus(userId);
  const data = await prisma.userPlusPreference.upsert({
    where: { userId }, create: { userId, ...next }, update: next,
  });
  return { radarEnabled: data.radarEnabled, priceAlertsEnabled: data.priceAlertsEnabled };
}

export async function plusRadar(userId: string) {
  await requirePlus(userId);
  const prefs = await prisma.userPlusPreference.findUnique({ where: { userId } });
  if (prefs?.radarEnabled === false) return { items: [] };
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { adultContentEnabled: true } });
  const allowedAdult = user?.adultContentEnabled === true;
  const favorites = await prisma.businessFavorite.findMany({ where: { userId }, select: { businessId: true }, take: 250 });
  const ids = favorites.map(row => row.businessId);
  if (!ids.length) return { items: [] };
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const [offers, promotions] = await Promise.all([
    prisma.businessOffer.findMany({
      where: { ...publishedOffer, businessId: { in: ids }, createdAt: { gte: since },
        ...(allowedAdult ? {} : { adultOnly: false, business: { ...publishedBusiness, adultOnly: false } }) },
      select: { id: true, name: true, kind: true, createdAt: true, business: { select: { name: true, publicId: true } } },
      orderBy: { createdAt: 'desc' }, take: 30,
    }),
    prisma.businessPromotion.findMany({
      where: { businessId: { in: ids }, deletedAt: null, active: true, endsAt: { gt: new Date() }, createdAt: { gte: since },
        business: { ...publishedBusiness, ...(allowedAdult ? {} : { adultOnly: false }) } },
      select: { id: true, title: true, createdAt: true, business: { select: { name: true, publicId: true } } },
      orderBy: { createdAt: 'desc' }, take: 30,
    }),
  ]);
  const items = [
    ...offers.map(offer => ({ id: offer.id, type: offer.kind, title: offer.name, business: offer.business.name,
      href: '/' + (offer.kind === 'PRODUCT' ? 'product' : 'service') + '/' + offer.id,
      createdAt: offer.createdAt.toISOString() })),
    ...promotions.map(offer => ({ id: offer.id, type: 'PROMOTION', title: offer.title, business: offer.business.name,
      href: '/promociones/' + offer.id, createdAt: offer.createdAt.toISOString() })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 40);
  return { items };
}

export async function addPlusCollection(userId: string, title: string) {
  await requirePlus(userId);
  const count = await prisma.userPlusCollection.count({ where: { userId } });
  if (count >= 50) throw new AppError(409, 'PLUS_COLLECTION_LIMIT', 'Máximo 50 colecciones.');
  return prisma.userPlusCollection.create({ data: { userId, title }, include: { items: true } });
}
export async function deletePlusCollection(userId: string, id: string) {
  await requirePlus(userId);
  await prisma.userPlusCollection.deleteMany({ where: { userId, id } });
  return { ok: true };
}
export async function addPlusCollectionItem(userId: string, id: string, targetType: 'BUSINESS' | 'OFFER', targetId: string) {
  await requirePlus(userId);
  const collection = await prisma.userPlusCollection.findFirst({ where: { id, userId }, select: { id: true } });
  if (!collection) throw new AppError(404, 'PLUS_COLLECTION_NOT_FOUND', 'Colección no encontrada.');
  const adultAllowed = await adultConsent(userId);
  const exists = targetType === 'BUSINESS'
    ? await prisma.business.findFirst({ where: { OR: [{ id: targetId }, { publicId: targetId }], ...publishedBusiness,
      ...(adultAllowed ? {} : { adultOnly: false }) }, select: { id: true } })
    : await prisma.businessOffer.findFirst({ where: { id: targetId, ...safeOfferWhere(adultAllowed) }, select: { id: true } });
  if (!exists) throw new AppError(404, 'PLUS_ITEM_NOT_AVAILABLE', 'El elemento no está disponible.');
  const count = await prisma.userPlusCollectionItem.count({ where: { collectionId: id } });
  if (count >= 100) throw new AppError(409, 'PLUS_ITEMS_LIMIT', 'Máximo 100 elementos por colección.');
  return prisma.userPlusCollectionItem.upsert({
    where: { collectionId_targetType_targetId: { collectionId: id, targetType, targetId: exists.id } },
    create: { collectionId: id, targetType, targetId: exists.id }, update: {},
  });
}
export async function deletePlusCollectionItem(userId: string, collectionId: string, itemId: string) {
  await requirePlus(userId);
  await prisma.userPlusCollectionItem.deleteMany({ where: { id: itemId, collectionId, collection: { userId } } });
  return { ok: true };
}

export async function addPlusSearch(userId: string, input: {
  title: string; query: string; category?: string | null; city?: string | null;
  openNow?: boolean; minRating?: number | null; sort?: string;
}) {
  await requirePlus(userId);
  if (await prisma.userPlusSavedSearch.count({ where: { userId } }) >= 50)
    throw new AppError(409, 'PLUS_SAVED_SEARCH_LIMIT', 'Máximo 50 búsquedas guardadas.');
  return prisma.userPlusSavedSearch.create({ data: { userId, ...input } });
}
export async function deletePlusSearch(userId: string, id: string) {
  await requirePlus(userId);
  await prisma.userPlusSavedSearch.deleteMany({ where: { id, userId } });
  return { ok: true };
}

export async function addPlusWatch(userId: string, offerId: string) {
  await requirePlus(userId);
  const offer = await prisma.businessOffer.findFirst({ where: { id: offerId, ...safeOfferWhere(await adultConsent(userId)) }, select: { id: true, priceAmount: true } });
  if (!offer) throw new AppError(404, 'PLUS_OFFER_NOT_AVAILABLE', 'Producto o servicio no publicado.');
  if (await prisma.userPlusPriceWatch.count({ where: { userId } }) >= 100)
    throw new AppError(409, 'PLUS_WATCH_LIMIT', 'Máximo 100 productos vigilados.');
  return prisma.userPlusPriceWatch.upsert({
    where: { userId_offerId: { userId, offerId: offer.id } }, create: { userId, offerId: offer.id }, update: {},
    select: { id: true, offerId: true },
  });
}
export async function deletePlusWatch(userId: string, id: string) {
  await requirePlus(userId);
  await prisma.userPlusPriceWatch.deleteMany({ where: { id, userId } });
  return { ok: true };
}
export async function plusPriceHistory(userId: string, offerId: string) {
  await requirePlus(userId);
  const offer = await prisma.businessOffer.findFirst({ where: { id: offerId, ...safeOfferWhere(await adultConsent(userId)) },
    select: { id: true, name: true, priceAmount: true, currency: true } });
  if (!offer) throw new AppError(404, 'PLUS_OFFER_NOT_AVAILABLE', 'El elemento no está disponible.');
  const rows = await prisma.offerPriceHistory.findMany({
    where: { offerId }, orderBy: { createdAt: 'desc' }, take: 50,
    select: { previousPrice: true, newPrice: true, currency: true, createdAt: true },
  });
  return { offer: { id: offer.id, name: offer.name, price: offer.priceAmount?.toString() ?? null, currency: offer.currency },
    history: rows.map(item => ({ ...item,
      previousPrice: item.previousPrice?.toString() ?? null,
      newPrice: item.newPrice?.toString() ?? null })) };
}
export async function plusCompare(userId: string, offerIds: string[]) {
  await requirePlus(userId);
  const ids = [...new Set(offerIds)].slice(0, 4);
  const offers = await prisma.businessOffer.findMany({
    where: { id: { in: ids }, ...safeOfferWhere(await adultConsent(userId)) },
    select: { id: true, name: true, description: true, kind: true, priceAmount: true, currency: true,
      priceText: true, negotiable: true,
      business: { select: { name: true, publicId: true } } },
  });
  return { offers: ids.flatMap(id => {
    const offer = offers.find(row => row.id === id);
    return offer ? [{ ...offer, priceAmount: offer.priceAmount?.toString() ?? null }] : [];
  }) };
}
