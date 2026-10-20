import { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';

const publicOfferWhere = {
  active: true,
  publicationStatus: 'PUBLISHED',
  deletedAt: null,
  business: {
    businessAccount: { status: 'ACTIVE' },
    lifecycleStatus: 'ACTIVE',
    publicationStatus: 'PUBLISHED',
    visibilityStatus: 'VISIBLE',
    deletionStatus: 'NONE',
  },
} as const;

async function findPublicOffer(identifier: string) {
  const offer = await prisma.businessOffer.findFirst({
    where: { id: identifier, ...publicOfferWhere },
    select: { id: true },
  });
  if (!offer) throw new AppError(404, 'OFFER_NOT_AVAILABLE', 'La publicación no está disponible.');
  return offer;
}

export async function getOfferLikeStatus(userId: string, identifier: string) {
  const offer = await findPublicOffer(identifier);
  const [like, count] = await Promise.all([
    prisma.businessOfferLike.findUnique({ where: { userId_offerId: { userId, offerId: offer.id } }, select: { id: true } }),
    prisma.businessOfferLike.count({ where: { offerId: offer.id } }),
  ]);
  return { offerId: offer.id, liked: Boolean(like), count };
}

export async function addOfferLike(userId: string, identifier: string) {
  const offer = await findPublicOffer(identifier);
  try {
    await prisma.businessOfferLike.create({ data: { userId, offerId: offer.id } });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
  }
  return getOfferLikeStatus(userId, offer.id);
}

export async function removeOfferLike(userId: string, identifier: string) {
  const offer = await findPublicOffer(identifier);
  await prisma.businessOfferLike.deleteMany({ where: { userId, offerId: offer.id } });
  return getOfferLikeStatus(userId, offer.id);
}

export async function getOfferLikesBatch(userId: string, identifiers: string[]) {
  const ids = [...new Set(identifiers.filter(Boolean))];
  if (ids.length === 0) return { likes: [] };
  const offers = await prisma.businessOffer.findMany({ where: { id: { in: ids }, ...publicOfferWhere }, select: { id: true } });
  const visibleIds = offers.map((offer) => offer.id);
  if (visibleIds.length === 0) return { likes: [] };
  const [userLikes, counts] = await Promise.all([
    prisma.businessOfferLike.findMany({ where: { userId, offerId: { in: visibleIds } }, select: { offerId: true } }),
    prisma.businessOfferLike.groupBy({ by: ['offerId'], where: { offerId: { in: visibleIds } }, _count: { _all: true } }),
  ]);
  const liked = new Set(userLikes.map((like) => like.offerId));
  const countMap = new Map(counts.map((row) => [row.offerId, row._count._all]));
  return { likes: visibleIds.map((offerId) => ({ offerId, liked: liked.has(offerId), count: countMap.get(offerId) ?? 0 })) };
}

export async function listUserOfferLikes(userId: string, page = 1, pageSize = 20) {
  const safePage = Number.isInteger(page) && page > 0 ? page : 1;
  const safeSize = Number.isInteger(pageSize) ? Math.min(Math.max(pageSize, 1), 50) : 20;
  const where = { userId, offer: publicOfferWhere };
  const [rows, total] = await Promise.all([
    prisma.businessOfferLike.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (safePage - 1) * safeSize,
      take: safeSize,
      select: {
        offerId: true,
        createdAt: true,
        offer: {
          select: {
            id: true, kind: true, name: true, description: true,
            priceAmount: true, priceText: true, currency: true, negotiable: true,
            business: { select: { id: true, publicId: true, name: true } },
            photos: { where: { sortOrder: 0 }, take: 1, select: { url: true, storageKey: true } },
          },
        },
      },
    }),
    prisma.businessOfferLike.count({ where }),
  ]);
  const offerIds = rows.map((row) => row.offerId);
  const counts = offerIds.length ? await prisma.businessOfferLike.groupBy({ by: ['offerId'], where: { offerId: { in: offerIds } }, _count: { _all: true } }) : [];
  const countMap = new Map(counts.map((row) => [row.offerId, row._count._all]));
  return {
    items: rows.map((row) => ({
      offerId: row.offerId,
      likedAt: row.createdAt,
      likeCount: countMap.get(row.offerId) ?? 0,
      kind: row.offer.kind,
      name: row.offer.name,
      description: row.offer.description,
      priceAmount: row.offer.priceAmount,
      priceText: row.offer.priceText,
      currency: row.offer.currency,
      negotiable: row.offer.negotiable,
      business: row.offer.business,
      photo: row.offer.photos[0] ?? null,
    })),
    pagination: { page: safePage, pageSize: safeSize, total, totalPages: Math.ceil(total / safeSize) },
  };
}

export async function listBusinessOfferLikeCounts(userId: string, businessIdentifier: string) {
  const business = await prisma.business.findFirst({
    where: { OR: [{ id: businessIdentifier }, { publicId: businessIdentifier }], memberships: { some: { userId, status: 'ACTIVE', role: 'OWNER' } } },
    select: { id: true },
  });
  if (!business) throw new AppError(404, 'BUSINESS_NOT_FOUND', 'No encontramos ese negocio o no tienes autorización.');
  const offers = await prisma.businessOffer.findMany({ where: { businessId: business.id, deletedAt: null }, select: { id: true } });
  const rows = offers.length ? await prisma.businessOfferLike.groupBy({ by: ['offerId'], where: { offerId: { in: offers.map((offer) => offer.id) } }, _count: { _all: true } }) : [];
  const countMap = new Map(rows.map((row) => [row.offerId, row._count._all]));
  return { offers: offers.map((offer) => ({ offerId: offer.id, likeCount: countMap.get(offer.id) ?? 0 })) };
}
