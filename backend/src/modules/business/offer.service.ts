import { Prisma, type PrismaClient } from '../../generated/prisma/client.js';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';
import type { OfferCreateInput, OfferUpdateInput } from './offer.schemas.js';

type Db = PrismaClient | Prisma.TransactionClient;
type RequestMeta = { ipAddress?: string };

async function findBusiness(userId: string, identifier: string, db: Db) {
  const business = await db.business.findFirst({
    where: { OR: [{ id: identifier }, { publicId: identifier }], memberships: { some: { userId, status: 'ACTIVE' } } },
    select: { id: true, businessAccount: { select: { status: true } }, adultOnly: true, memberships: { where: { userId, status: 'ACTIVE' }, include: { permissions: true } } },
  });
  if (!business || business.businessAccount.status !== 'ACTIVE') throw new AppError(404, 'BUSINESS_NOT_FOUND', 'No encontramos ese negocio.');
  const membership = business.memberships[0];
  if (!membership || (membership.role !== 'OWNER' && !membership.permissions.some(item => item.permission === 'MANAGE_CATALOG' && item.allowed))) throw new AppError(403, 'BUSINESS_PERMISSION_DENIED', 'No tienes permisos para administrar el catálogo.');
  return business;
}

function amount(value: unknown): Prisma.Decimal | null {
  if (value === null || value === undefined || value === '') return null;
  try { return new Prisma.Decimal(String(value)); } catch { throw new AppError(400, 'INVALID_INPUT', 'El precio no es válido.'); }
}

function serialize(offer: any, businessId: string) {
  return { id: offer.id, businessId, kind: offer.kind, name: offer.name, description: offer.description, priceAmount: offer.priceAmount?.toString() ?? null, currency: offer.currency, priceText: offer.priceText, negotiable: offer.negotiable, active: offer.active, adultOnly: offer.adultOnly, publicationStatus: offer.publicationStatus, photos: (offer.photos ?? []).map((photo: any) => ({ id: photo.id, url: `/api/v1/businesses/${businessId}/photos/${photo.id}/content`, altText: photo.altText, sortOrder: photo.sortOrder, isCover: photo.isCover })) };
}

async function audit(db: Db, userId: string, offerId: string, action: string, previousState: unknown, newState: unknown, meta?: RequestMeta) {
  await db.auditLog.create({ data: { actorUserId: userId, entityType: 'OFFER', entityId: offerId, action, previousState: previousState === null ? Prisma.JsonNull : previousState as Prisma.InputJsonValue, newState: newState === null ? Prisma.JsonNull : newState as Prisma.InputJsonValue, ipAddress: meta?.ipAddress ?? null } });
}

const offerInclude = { photos: { where: { isGallery: true }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] as any } } as const;

export async function listOffers(userId: string, businessIdentifier: string, kind?: 'PRODUCT' | 'SERVICE') {
  const business = await findBusiness(userId, businessIdentifier, prisma);
  const offers = await prisma.businessOffer.findMany({ where: { businessId: business.id, ...(kind ? { kind } : {}) }, include: offerInclude, orderBy: { updatedAt: 'desc' } });
  return offers.map(item => serialize(item, business.id));
}

export async function createOffer(userId: string, businessIdentifier: string, input: OfferCreateInput, meta?: RequestMeta) {
  const business = await findBusiness(userId, businessIdentifier, prisma);
  const created = await prisma.$transaction(async tx => {
    const offer = await tx.businessOffer.create({ data: { businessId: business.id, kind: input.kind, name: input.name, description: input.description ?? null, priceAmount: amount(input.priceAmount), currency: input.currency ?? null, priceText: input.priceText ?? null, negotiable: input.negotiable, active: input.active, adultOnly: input.adultOnly, publicationStatus: input.publicationStatus }, include: offerInclude });
    await audit(tx, userId, offer.id, 'OFFER_CREATED', null, { adultOnly: offer.adultOnly, kind: offer.kind }, meta);
    return offer;
  });
  return serialize(created, business.id);
}

export async function updateOffer(userId: string, businessIdentifier: string, offerId: string, input: OfferUpdateInput, meta?: RequestMeta) {
  const business = await findBusiness(userId, businessIdentifier, prisma);
  const current = await prisma.businessOffer.findFirst({ where: { id: offerId, businessId: business.id }, include: offerInclude });
  if (!current) throw new AppError(404, 'OFFER_NOT_FOUND', 'No encontramos ese producto o servicio.');
  const updated = await prisma.$transaction(async tx => {
    const offer = await tx.businessOffer.update({ where: { id: current.id }, data: { ...(input.kind !== undefined ? { kind: input.kind } : {}), ...(input.name !== undefined ? { name: input.name } : {}), ...(input.description !== undefined ? { description: input.description } : {}), ...(input.priceAmount !== undefined ? { priceAmount: amount(input.priceAmount) } : {}), ...(input.currency !== undefined ? { currency: input.currency } : {}), ...(input.priceText !== undefined ? { priceText: input.priceText } : {}), ...(input.negotiable !== undefined ? { negotiable: input.negotiable } : {}), ...(input.active !== undefined ? { active: input.active } : {}), ...(input.adultOnly !== undefined ? { adultOnly: input.adultOnly } : {}), ...(input.publicationStatus !== undefined ? { publicationStatus: input.publicationStatus } : {}) }, include: offerInclude });
    await audit(tx, userId, offer.id, input.adultOnly === undefined || input.adultOnly === current.adultOnly ? 'OFFER_UPDATED' : 'OFFER_ADULT_CLASSIFICATION_CHANGED', { adultOnly: current.adultOnly }, { adultOnly: offer.adultOnly }, meta);
    return offer;
  });
  return serialize(updated, business.id);
}
