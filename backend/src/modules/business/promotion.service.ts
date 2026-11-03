import { Prisma, type PrismaClient } from '../../generated/prisma/client.js';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';
import { PHOTO_MAX_BYTES, PHOTO_MIME_TYPES, isPhotoMissingError, photoMimeType, readPhoto, removePhoto, savePhoto } from './photo-storage.js';
import { canManagePromotion, promotionEntitlements, promotionState, promotionValidationError, type PromotionPlan, type PromotionRecurrence } from './promotion-policy.js';
import type { PromotionCreateInput, PromotionUpdateInput } from './promotion.schemas.js';

type Db = PrismaClient | Prisma.TransactionClient;
type UploadedPhoto = { buffer: Buffer; mimetype: string; size: number };
type PromotionRow = { active: boolean; startsAt: Date; endsAt: Date; recurrence: PromotionRecurrence; recurrenceUntil: Date | null };

function amount(value: unknown): Prisma.Decimal | null {
  if (value === null || value === undefined || value === '') return null;
  try { const parsed = new Prisma.Decimal(String(value)); if (!parsed.isFinite() || parsed.isNegative() || !Number.isFinite(parsed.toNumber()) || parsed.greaterThan('9999999999.99')) throw new Error(); return parsed; }
  catch { throw new AppError(400, 'INVALID_PROMOTION_PRICE', 'El precio debe ser un valor válido igual o superior a cero.'); }
}

function state(row: PromotionRow) { return promotionState(row, new Date()); }

async function ensureRelatedOfferAvailable(db: Db, businessId: string, relatedOfferId: string | null, excludePromotionId?: string) {
  if (!relatedOfferId) return;
  const conflicts = await db.businessPromotion.findMany({ where: { businessId, relatedOfferId, deletedAt: null, ...(excludePromotionId ? { id: { not: excludePromotionId } } : {}) }, select: { active: true, startsAt: true, endsAt: true, recurrence: true, recurrenceUntil: true } });
  if (conflicts.some(row => state(row) !== 'FINISHED')) throw new AppError(409, 'PROMOTION_CONFLICT', 'Ese producto o servicio ya tiene una promoción activa o programada.');
}

async function findManagedBusiness(userId: string, identifier: string, db: Db) {
  const business = await db.business.findFirst({
    where: { OR: [{ id: identifier }, { publicId: identifier }], memberships: { some: { userId, status: 'ACTIVE' } } },
    select: { id: true, businessAccount: { select: { status: true } }, memberships: { where: { userId, status: 'ACTIVE' }, include: { permissions: true } } },
  });
  const membership = business?.memberships[0];
  const allowed = membership ? canManagePromotion(membership.role, membership.permissions) : false;
  if (!business || business.businessAccount.status !== 'ACTIVE') throw new AppError(404, 'BUSINESS_NOT_FOUND', 'No encontramos ese negocio.');
  if (!allowed) throw new AppError(403, 'BUSINESS_PERMISSION_DENIED', 'No tienes permisos para administrar las promociones de este negocio.');
  return business;
}

async function findMemberBusiness(userId: string, businessId: string) {
  const business = await prisma.business.findFirst({ where: { id: businessId, businessAccount: { status: 'ACTIVE' }, memberships: { some: { userId, status: 'ACTIVE' } } }, select: { id: true } });
  if (!business) throw new AppError(404, 'BUSINESS_NOT_FOUND', 'No encontramos ese negocio.');
  return business;
}

async function limits(db: Db, businessId: string) {
  const now = new Date();
  const pro = await db.$queryRaw<Array<{ id: string }>>`SELECT id FROM BusinessSubscription WHERE businessId = ${businessId} AND plan = 'PRO' AND status = 'ACTIVE' AND startsAt <= ${now} AND revokedAt IS NULL AND (expiresAt > ${now} OR (expiresAt IS NULL AND specialActivation = true)) ORDER BY startsAt DESC, createdAt DESC LIMIT 1`;
  const plan: PromotionPlan = pro.length ? 'PRO' : 'BASIC';
  const entitlements = promotionEntitlements(plan);
  const [rows, totalViews] = await Promise.all([
    db.businessPromotion.findMany({ where: { businessId, deletedAt: null }, select: { id: true, active: true, startsAt: true, endsAt: true, recurrence: true, recurrenceUntil: true } }),
    db.businessPromotionView.count({ where: { businessId } }),
  ]);
  const states = rows.map(state);
  return {
    plan,
    ...entitlements,
    activeCount: states.filter(value => value !== 'FINISHED').length,
    summary: { active: states.filter(value => value === 'ACTIVE').length, scheduled: states.filter(value => value === 'SCHEDULED').length, finished: states.filter(value => value === 'FINISHED').length, totalViews },
  };
}

function serialize(row: any, businessId: string, viewCount: number) {
  return {
    id: row.id, businessId, type: row.type, title: row.title, description: row.description,
    conditions: row.conditions, category: row.category, relatedOfferId: row.relatedOfferId,
    originalPrice: row.originalPrice?.toString() ?? null, promotionalPrice: row.promotionalPrice?.toString() ?? null,
    startsAt: row.startsAt.toISOString(), endsAt: row.endsAt.toISOString(), recurrence: row.recurrence,
    recurrenceUntil: row.recurrenceUntil?.toISOString() ?? null, active: row.active, state: state(row), viewCount,
    photos: (row.photos?.length ? row.photos : (row.relatedOffer?.photos ?? [])).map((photo: any) => ({ id: photo.id, url: row.photos?.length ? `/businesses/${businessId}/promotions/${row.id}/photos/${photo.id}/content` : `/api/v1/businesses/${businessId}/photos/${photo.id}/content`, sortOrder: photo.sortOrder })),
  };
}

const includePhotos = { photos: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] }, relatedOffer: { include: { photos: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] } } } } satisfies Prisma.BusinessPromotionInclude;

function validatePromotion(input: { type: 'OFFER' | 'PROMOTION'; originalPrice?: unknown; promotionalPrice?: unknown; startsAt: Date; endsAt: Date; recurrence: PromotionRecurrence; recurrenceUntil?: Date | null }, plan: PromotionPlan) {
  const original = amount(input.originalPrice);
  const promotional = amount(input.promotionalPrice);
  const code = promotionValidationError({ ...input, originalPrice: original?.toNumber() ?? null, promotionalPrice: promotional?.toNumber() ?? null }, plan);
  if (code === 'PROMOTION_DATE_RANGE_INVALID') throw new AppError(422, code, 'La fecha final debe ser posterior a la fecha de inicio.');
  if (code === 'PROMOTION_DISCOUNT_INVALID') throw new AppError(422, code, 'Una oferta requiere un precio original y uno promocional menor.');
  if (code === 'PROMOTION_ORIGINAL_PRICE_NOT_ALLOWED') throw new AppError(422, code, 'El precio original solo aplica a las ofertas con descuento.');
  if (code === 'PROMOTION_SCHEDULING_PRO_ONLY') throw new AppError(403, code, 'La programación futura está disponible con Business Pro.');
  if (code === 'PROMOTION_RECURRENCE_PRO_ONLY') throw new AppError(403, code, 'Las promociones recurrentes están disponibles con Business Pro.');
  if (code === 'PROMOTION_RECURRENCE_INVALID') throw new AppError(422, code, 'La repetición requiere frecuencia y una fecha posterior a la primera vigencia.');
  if (code === 'PROMOTION_RECURRENCE_TOO_LONG') throw new AppError(422, code, 'La repetición no puede programarse a más de cinco años.');
  return { original, promotional };
}

export async function listPromotions(userId: string, businessIdentifier: string) {
  const business = await findManagedBusiness(userId, businessIdentifier, prisma);
  const [rows, access] = await Promise.all([
    prisma.businessPromotion.findMany({ where: { businessId: business.id, deletedAt: null }, include: includePhotos, orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }] }),
    limits(prisma, business.id),
  ]);
  const views = rows.length ? await prisma.businessPromotionView.groupBy({ by: ['promotionId'], where: { promotionId: { in: rows.map(row => row.id) } }, _count: { _all: true } }) : [];
  const viewMap = new Map(views.map(row => [row.promotionId, row._count._all]));
  // El contador básico de visualizaciones pertenece a cada publicación y debe
  // estar disponible para todos los planes. Las analíticas avanzadas siguen
  // protegidas por `detailedAnalytics` en las vistas que las consumen.
  const promotions = rows.map(row => serialize(row, business.id, viewMap.get(row.id) ?? 0));
  return { promotions, limits: access };
}

export async function createPromotion(userId: string, identifier: string, input: PromotionCreateInput) {
  const business = await findManagedBusiness(userId, identifier, prisma);
  if (input.idempotencyKey) {
    const existing = await prisma.businessPromotion.findUnique({ where: { idempotencyKey: input.idempotencyKey }, include: includePhotos });
    if (existing?.businessId === business.id && !existing.deletedAt) return serialize(existing, business.id, 0);
  }
  const startsAt = new Date(input.startsAt); const endsAt = new Date(input.endsAt); const recurrenceUntil = input.recurrenceUntil ? new Date(input.recurrenceUntil) : null;
  const created = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM Business WHERE id = ${business.id} FOR UPDATE`;
    const access = await limits(tx, business.id);
    validatePromotion({ type: input.type, originalPrice: input.originalPrice, promotionalPrice: input.promotionalPrice, startsAt, endsAt, recurrence: input.recurrence, recurrenceUntil }, access.plan);
    if (access.activeCount >= access.maxActive) throw new AppError(409, 'PROMOTION_LIMIT_REACHED', `Tu plan permite hasta ${access.maxActive} publicaciones activas.`);
    if (input.relatedOfferId) {
      const related = await tx.businessOffer.findFirst({ where: { id: input.relatedOfferId, businessId: business.id, deletedAt: null }, select: { id: true } });
      if (!related) throw new AppError(422, 'RELATED_CATALOG_ITEM_NOT_FOUND', 'El producto o servicio seleccionado no pertenece a este negocio.');
      await ensureRelatedOfferAvailable(tx, business.id, input.relatedOfferId);
    }
    const row = await tx.businessPromotion.create({ data: {
      businessId: business.id, idempotencyKey: input.idempotencyKey, type: input.type, title: input.title,
      description: input.description, conditions: input.conditions ?? null, category: input.category ?? null,
      relatedOfferId: input.relatedOfferId ?? null, originalPrice: amount(input.originalPrice), promotionalPrice: amount(input.promotionalPrice),
      startsAt, endsAt, recurrence: input.recurrence, recurrenceUntil,
    }, include: includePhotos });
    return row;
  });
  return serialize(created, business.id, 0);
}

export async function updatePromotion(userId: string, identifier: string, promotionId: string, input: PromotionUpdateInput) {
  const business = await findManagedBusiness(userId, identifier, prisma);
  const current = await prisma.businessPromotion.findFirst({ where: { id: promotionId, businessId: business.id, deletedAt: null }, include: includePhotos });
  if (!current) throw new AppError(404, 'PROMOTION_NOT_FOUND', 'No encontramos esta oferta o promoción.');
  const merged = {
    type: input.type ?? current.type, originalPrice: input.type === 'PROMOTION' ? null : input.originalPrice !== undefined ? input.originalPrice : current.originalPrice?.toString(),
    promotionalPrice: input.promotionalPrice !== undefined ? input.promotionalPrice : current.promotionalPrice?.toString(),
    startsAt: input.startsAt ? new Date(input.startsAt) : current.startsAt, endsAt: input.endsAt ? new Date(input.endsAt) : current.endsAt,
    recurrence: input.recurrence ?? current.recurrence, recurrenceUntil: input.recurrenceUntil !== undefined ? (input.recurrenceUntil ? new Date(input.recurrenceUntil) : null) : current.recurrenceUntil,
  };
  const access = await limits(prisma, business.id);
  validatePromotion(merged, access.plan);
  if (merged.recurrence !== 'NONE' && !merged.recurrenceUntil) throw new AppError(422, 'PROMOTION_RECURRENCE_INVALID', 'Indica hasta cuándo se repetirá la promoción.');
  if (input.relatedOfferId) {
    const related = await prisma.businessOffer.findFirst({ where: { id: input.relatedOfferId, businessId: business.id, deletedAt: null }, select: { id: true } });
    if (!related) throw new AppError(422, 'RELATED_CATALOG_ITEM_NOT_FOUND', 'El producto o servicio seleccionado no pertenece a este negocio.');
  }
  if (input.relatedOfferId !== undefined) await ensureRelatedOfferAvailable(prisma, business.id, input.relatedOfferId, current.id);
  const updated = await prisma.businessPromotion.update({ where: { id: current.id }, data: {
    ...(input.type !== undefined ? { type: input.type } : {}), ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}), ...(input.conditions !== undefined ? { conditions: input.conditions } : {}),
    ...(input.category !== undefined ? { category: input.category } : {}), ...(input.relatedOfferId !== undefined ? { relatedOfferId: input.relatedOfferId } : {}),
    ...(merged.type === 'PROMOTION' ? { originalPrice: null } : input.originalPrice !== undefined ? { originalPrice: amount(input.originalPrice) } : {}), ...(input.promotionalPrice !== undefined ? { promotionalPrice: amount(input.promotionalPrice) } : {}),
    ...(input.startsAt !== undefined ? { startsAt: merged.startsAt } : {}), ...(input.endsAt !== undefined ? { endsAt: merged.endsAt } : {}),
    ...(input.recurrence !== undefined ? { recurrence: input.recurrence } : {}), ...(input.recurrenceUntil !== undefined ? { recurrenceUntil: merged.recurrenceUntil } : {}),
  }, include: includePhotos });
  return serialize(updated, business.id, await prisma.businessPromotionView.count({ where: { promotionId } }));
}

export async function finishPromotion(userId: string, identifier: string, promotionId: string) {
  const business = await findManagedBusiness(userId, identifier, prisma);
  const current = await prisma.businessPromotion.findFirst({ where: { id: promotionId, businessId: business.id, deletedAt: null } });
  if (!current) throw new AppError(404, 'PROMOTION_NOT_FOUND', 'No encontramos esta oferta o promoción.');
  const updated = await prisma.businessPromotion.update({ where: { id: current.id }, data: { active: false }, include: includePhotos });
  return serialize(updated, business.id, await prisma.businessPromotionView.count({ where: { promotionId } }));
}

export async function deletePromotion(userId: string, identifier: string, promotionId: string) {
  const business = await findManagedBusiness(userId, identifier, prisma);
  const current = await prisma.businessPromotion.findFirst({ where: { id: promotionId, businessId: business.id, deletedAt: null }, select: { id: true } });
  if (!current) throw new AppError(404, 'PROMOTION_NOT_FOUND', 'No encontramos esta oferta o promoción.');
  await prisma.businessPromotion.update({ where: { id: current.id }, data: { active: false, deletedAt: new Date() } });
}

function ensurePhoto(file: UploadedPhoto | undefined): asserts file is UploadedPhoto {
  if (!file) throw new AppError(400, 'PHOTO_REQUIRED', 'Selecciona una fotografía.');
  if (!PHOTO_MIME_TYPES.has(file.mimetype)) throw new AppError(422, 'PHOTO_FORMAT_UNSUPPORTED', 'Solo se permiten fotografías JPG, PNG o WebP.');
  if (file.size > PHOTO_MAX_BYTES) throw new AppError(422, 'PHOTO_TOO_LARGE', 'Cada fotografía puede pesar máximo 5 MB.');
  const jpeg = file.mimetype === 'image/jpeg' && file.buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
  const png = file.mimetype === 'image/png' && file.buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const webp = file.mimetype === 'image/webp' && file.buffer.subarray(0, 4).toString('ascii') === 'RIFF' && file.buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  if (!jpeg && !png && !webp) throw new AppError(422, 'PHOTO_FORMAT_UNSUPPORTED', 'El contenido no coincide con el formato de la fotografía.');
}

export async function uploadPromotionPhoto(userId: string, identifier: string, promotionId: string, file: UploadedPhoto | undefined) {
  ensurePhoto(file);
  const business = await findManagedBusiness(userId, identifier, prisma);
  const access = await limits(prisma, business.id);
  const promotion = await prisma.businessPromotion.findFirst({ where: { id: promotionId, businessId: business.id, deletedAt: null }, select: { id: true } });
  if (!promotion) throw new AppError(404, 'PROMOTION_NOT_FOUND', 'No encontramos esta publicación.');
  const count = await prisma.businessPromotionPhoto.count({ where: { promotionId } });
  if (count >= access.maxPhotos) throw new AppError(422, 'PROMOTION_PHOTO_LIMIT_REACHED', `Tu plan permite hasta ${access.maxPhotos} fotografía${access.maxPhotos === 1 ? '' : 's'} por publicación.`);
  const stored = await savePhoto(business.id, file.buffer, file.mimetype);
  try {
    const photo = await prisma.businessPromotionPhoto.create({ data: { businessId: business.id, promotionId, storageKey: stored.storageKey, sortOrder: count, uploadedById: userId } });
    return { id: photo.id, url: `/businesses/${business.id}/promotions/${promotionId}/photos/${photo.id}/content`, sortOrder: photo.sortOrder };
  } catch (error) { await removePhoto(stored.storageKey).catch(() => undefined); throw error; }
}

export async function deletePromotionPhoto(userId: string, identifier: string, promotionId: string, photoId: string) {
  const business = await findManagedBusiness(userId, identifier, prisma);
  const photo = await prisma.businessPromotionPhoto.findFirst({ where: { id: photoId, promotionId, businessId: business.id } });
  if (!photo) throw new AppError(404, 'PROMOTION_PHOTO_NOT_FOUND', 'No encontramos esa fotografía.');
  await prisma.businessPromotionPhoto.delete({ where: { id: photo.id } });
  await removePhoto(photo.storageKey).catch(() => undefined);
}

export async function getPromotionPhotoContent(userId: string, identifier: string, promotionId: string, photoId: string) {
  const business = await findMemberBusiness(userId, identifier);
  const photo = await prisma.businessPromotionPhoto.findFirst({ where: { id: photoId, promotionId, businessId: business.id }, select: { storageKey: true } });
  if (!photo) throw new AppError(404, 'PROMOTION_PHOTO_NOT_FOUND', 'No encontramos esa fotografía.');
  try { return { content: await readPhoto(photo.storageKey), mimeType: photoMimeType(photo.storageKey) }; }
  catch (error) { if (isPhotoMissingError(error)) throw new AppError(404, 'PROMOTION_PHOTO_NOT_FOUND', 'No encontramos esa fotografía.'); throw new AppError(503, 'PHOTO_STORAGE_UNAVAILABLE', 'No se pudo leer la fotografía.'); }
}

const publicBusinessWhere = { businessAccount: { status: 'ACTIVE' }, lifecycleStatus: 'ACTIVE', publicationStatus: 'PUBLISHED', visibilityStatus: 'VISIBLE', deletionStatus: 'NONE' } as const;

export async function listPublicPromotions(publicId: string) {
  const business = await prisma.business.findFirst({ where: { publicId, ...publicBusinessWhere }, select: { id: true } });
  if (!business) throw new AppError(404, 'BUSINESS_NOT_FOUND', 'No encontramos ese negocio.');
  const rows = await prisma.businessPromotion.findMany({ where: { businessId: business.id, active: true, deletedAt: null, startsAt: { lte: new Date() } }, include: includePhotos, orderBy: [{ startsAt: 'asc' }, { id: 'asc' }] });
  return rows.filter(row => state(row) === 'ACTIVE').map(row => ({ ...serialize(row, business.id, 0), photos: (row.photos?.length ? row.photos : (row.relatedOffer?.photos ?? [])).map((photo: any) => ({ id: photo.id, url: row.photos?.length ? `/api/v1/public/promotions/${row.id}/photos/${photo.id}` : `/api/v1/public/businesses/${business.id}/photos/${photo.id}/content`, sortOrder: photo.sortOrder })) }));
}

export async function getPublicPromotion(promotionId: string) {
  const row = await prisma.businessPromotion.findFirst({
    where: { id: promotionId, deletedAt: null, business: publicBusinessWhere },
    include: { ...includePhotos, business: { select: { publicId: true, name: true, category: { select: { translations: { where: { locale: 'es' }, select: { name: true }, take: 1 } } } } } },
  });
  if (!row) throw new AppError(404, 'PROMOTION_NOT_AVAILABLE', 'Esta promoción no está disponible.');
  const promotionState = state(row);
  if (promotionState === 'SCHEDULED') throw new AppError(404, 'PROMOTION_NOT_AVAILABLE', 'Esta promoción no está disponible.');
  return {
    ...serialize(row, row.businessId, 0),
    state: promotionState,
    business: { publicId: row.business.publicId, name: row.business.name, category: row.business.category.translations[0]?.name ?? null },
    photos: (row.photos ?? []).map((photo: any) => ({ id: photo.id, url: `/api/v1/public/promotions/${row.id}/photos/${photo.id}`, sortOrder: photo.sortOrder })),
  };
}

export async function getPublicPromotionPhoto(promotionId: string, photoId: string) {
  const photo = await prisma.businessPromotionPhoto.findFirst({ where: { id: photoId, promotionId, promotion: { deletedAt: null, business: publicBusinessWhere } }, select: { storageKey: true, promotion: { select: { active: true, startsAt: true, endsAt: true, recurrence: true, recurrenceUntil: true } } } });
  if (!photo || state(photo.promotion) === 'SCHEDULED') throw new AppError(404, 'PROMOTION_PHOTO_NOT_FOUND', 'No encontramos esa fotografía.');
  try { return { content: await readPhoto(photo.storageKey), mimeType: photoMimeType(photo.storageKey) }; }
  catch (error) { if (isPhotoMissingError(error)) throw new AppError(404, 'PROMOTION_PHOTO_NOT_FOUND', 'No encontramos esa fotografía.'); throw new AppError(503, 'PHOTO_STORAGE_UNAVAILABLE', 'No se pudo leer la fotografía.'); }
}

export async function recordPromotionView(promotionId: string, dedupeKey?: string) {
  const promotion = await prisma.businessPromotion.findFirst({ where: { id: promotionId, active: true, deletedAt: null, business: publicBusinessWhere }, select: { id: true, businessId: true, active: true, startsAt: true, endsAt: true, recurrence: true, recurrenceUntil: true } });
  if (!promotion || state(promotion) !== 'ACTIVE') throw new AppError(404, 'PROMOTION_NOT_AVAILABLE', 'La promoción no está disponible.');
  if (dedupeKey) {
    try { await prisma.businessPromotionView.create({ data: { businessId: promotion.businessId, promotionId, dedupeKey: `${promotionId}:${dedupeKey}`.slice(0, 191) } }); }
    catch (error) { if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error; }
  } else await prisma.businessPromotionView.create({ data: { businessId: promotion.businessId, promotionId } });
  return { recorded: true };
}
