import { prisma } from '../../config/prisma.js';
import { Prisma, type BusinessVisibilityStatus } from '../../generated/prisma/client.js';
import { AppError } from '../../shared/errors/app-error.js';
import { notifyBusinessOwners, notifyPlatformUser } from '../notifications/platform-notifications.service.js';
import { isSubscriptionEffective } from '../business/recognition.service.js';
import { isPhotoMissingError, photoMimeType, readPhoto } from '../business/photo-storage.js';

export type AdminVisibilityAction = 'HIDE' | 'SUSPEND' | 'RESTORE' | 'SET_VISIBLE' | 'SET_HIDDEN';
export function restoredAdminBusinessVisibility(
  previous: BusinessVisibilityStatus | null,
  period: { startsAt: Date; expiresAt: Date } | null,
  now = new Date(),
): BusinessVisibilityStatus {
  if (previous !== 'VISIBLE') return previous ?? 'HIDDEN';
  return period && period.startsAt <= now && period.expiresAt > now ? 'VISIBLE' : 'EXPIRED';
}

export function validateAdminVisibilityAction(action: string, reason: string): AdminVisibilityAction {
  if (!['HIDE', 'SUSPEND', 'RESTORE', 'SET_VISIBLE', 'SET_HIDDEN'].includes(action))
    throw new AppError(400, 'ADMIN_VISIBILITY_ACTION_INVALID', 'Acción administrativa no válida.');
  if (reason.trim().length < 12 || reason.trim().length > 500)
    throw new AppError(400, 'ADMIN_BUSINESS_REASON_REQUIRED', 'Explica el motivo de la decisión (12 a 500 caracteres).');
  return action as AdminVisibilityAction;
}

const businessSelect = {
  id: true, publicId: true, name: true, description: true, email: true, phone: true,
  coverPhotoId: true, profilePhotoId: true,
  lifecycleStatus: true, publicationStatus: true, visibilityStatus: true,
  administrativeRestriction: true, administrativePreviousVisibility: true,
  administrativeRestrictedAt: true, administrativeRestrictionReason: true,
  verificationStatus: true, deletionStatus: true, completeness: true,
  createdAt: true, updatedAt: true,
  createdBy: { select: { displayName: true, emailNormalized: true } },
  location: { select: { cityName: true, regionName: true, countryCode: true, zoneName: true, address: true } },
  category: { select: { id: true, code: true, translations: { select: { locale: true, name: true } } } },
  memberships: { where: { role: 'OWNER' as const, status: 'ACTIVE' as const }, select: { user: { select: { displayName: true, nickname: true } } }, take: 2 },
  subscriptions: { where: { plan: 'PRO' as const, status: 'ACTIVE' as const, revokedAt: null }, select: { plan: true, status: true, startsAt: true, expiresAt: true, specialActivation: true, revokedAt: true } },
  _count: { select: { offers: true, reviews: true, reports: true, memberships: true } },
} as const;
const activePro = (now: Date) => ({
  plan: 'PRO' as const, status: 'ACTIVE' as const, revokedAt: null,
  startsAt: { lte: now },
  OR: [{ expiresAt: { gt: now } }, { expiresAt: null, specialActivation: true }],
});
const compact = (value: Prisma.BusinessGetPayload<{ select: typeof businessSelect }> | null, now: Date) => value && ({
  ...value,
  isPro: value.subscriptions.some(subscription => isSubscriptionEffective(subscription, now)),
});

export type AdminBusinessesFilters = {
  q?: string; page?: number; pageSize?: number; status?: string;
  city?: string; categoryId?: string; visibility?: string; verification?: string;
  plan?: string; restriction?: string; from?: string; to?: string; order?: string;
};

function dateFilter(value: string | undefined, endOfDay = false): Date | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(value + (endOfDay ? 'T23:59:59.999Z' : 'T00:00:00.000Z'));
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : undefined;
}

export function adminBusinessWhere(filters: AdminBusinessesFilters = {}, now = new Date()): Prisma.BusinessWhereInput {
  const q = (filters.q ?? '').trim().slice(0, 100);
  const status = (filters.status ?? '').trim();
  const restriction = (filters.restriction ?? '').trim();
  const visibility = (filters.visibility ?? '').trim();
  const city = (filters.city ?? '').trim().slice(0, 180);
  const index = city.indexOf('|');
  const location = index > 0 ? { countryCode: city.slice(0, index), cityName: city.slice(index + 1) } : null;
  const from = dateFilter(filters.from), to = dateFilter(filters.to, true);
  if (from && to && from > to) throw new AppError(400, 'ADMIN_BUSINESS_DATES_INVALID', 'La fecha inicial debe ser anterior a la final.');
  const where: Prisma.BusinessWhereInput = {
    ...(status === 'deleted' ? { deletionStatus: 'DELETED' } : { deletionStatus: { not: 'DELETED' } }),
    ...(q ? { OR: [
      { name: { contains: q } },
      { publicId: { contains: q } },
      { location: { is: { cityName: { contains: q } } } },
      { createdBy: { is: { displayName: { contains: q } } } },
      { createdBy: { is: { emailNormalized: { contains: q } } } },
      { memberships: { some: { role: 'OWNER', user: { displayName: { contains: q } } } } },
    ] } : {}),
    ...(['active', 'review', 'inactive'].includes(status) ? { publicationStatus: ({ active: 'PUBLISHED', review: 'REVIEW', inactive: 'UNPUBLISHED' } as const)[status as 'active' | 'review' | 'inactive'] } : {}),
    ...(filters.categoryId ? { categoryId: filters.categoryId.slice(0, 36) } : {}),
    ...(location ? { location: { is: location } } : {}),
    ...(visibility === 'ADMIN_HIDDEN' ? { administrativeRestriction: { not: null } }
      : ['VISIBLE','HIDDEN','EXPIRED','REVIEW'].includes(visibility) ? { visibilityStatus: visibility as BusinessVisibilityStatus }
      : {}),
    ...(['NONE','PENDING','INFORMATION','APPROVED','REJECTED'].includes(filters.verification ?? '')
      ? { verificationStatus: filters.verification as 'NONE' | 'PENDING' | 'INFORMATION' | 'APPROVED' | 'REJECTED' } : {}),
    ...(restriction === 'NONE' ? { administrativeRestriction: null }
      : ['HIDDEN','SUSPENDED'].includes(restriction) ? { administrativeRestriction: restriction } : {}),
    ...(filters.plan === 'pro' ? { subscriptions: { some: activePro(now) } }
      : filters.plan === 'basic' ? { subscriptions: { none: activePro(now) } } : {}),
    ...((from || to) ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
  };
  return where;
}

export async function listAdminBusinesses(query: AdminBusinessesFilters) {
  const page = Number.isFinite(query.page) ? Math.max(1, Math.min(100000, Math.floor(query.page!))) : 1;
  const pageSize = Number.isFinite(query.pageSize) ? Math.min(100, Math.max(1, Math.floor(query.pageSize!))) : 20;
  const now = new Date();
  const where = adminBusinessWhere(query, now);
  const orderBy: Prisma.BusinessOrderByWithRelationInput[] = [
    query.order === 'oldest' ? { createdAt: 'asc' }
      : query.order === 'name' ? { name: 'asc' }
      : query.order === 'city' ? { location: { cityName: 'asc' } }
      : query.order === 'category' ? { category: { code: 'asc' } }
      : query.order === 'verification' ? { verificationStatus: 'asc' }
      : { createdAt: 'desc' },
    { id: 'asc' },
  ];
  const [total, businesses] = await Promise.all([
    prisma.business.count({ where }),
    prisma.business.findMany({ where, select: businessSelect, orderBy, skip: (page - 1) * pageSize, take: pageSize }),
  ]);
  return { businesses: businesses.map(value => compact(value, now)), pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
}

export async function getAdminBusiness(id: string) {
  const value = await prisma.business.findFirst({ where: { OR: [{ id }, { publicId: id }] }, select: {
    ...businessSelect, businessAccount: { select: { status: true } },
    coverImagePositionX: true, coverImagePositionY: true, profileImagePositionX: true, profileImagePositionY: true,
    visibilityPeriods: { take: 1, orderBy: { expiresAt: 'desc' }, select: { startsAt: true, expiresAt: true } },
  } });
  if (!value) return null;
  const [members, rating, catalog, businessPhotos, catalogPhotos, referralCounter] = await Promise.all([
    prisma.businessMembership.findMany({ where: { businessId: value.id }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { id: true, role: true, status: true, createdAt: true, user: { select: { displayName: true, nickname: true } } } }),
    prisma.businessReview.aggregate({ where: { businessId: value.id, status: 'PUBLISHED' }, _avg: { rating: true }, _count: { _all: true } }),
    prisma.businessOffer.groupBy({ by: ['kind'], where: { businessId: value.id }, _count: { _all: true } }),
    prisma.photo.count({ where: { offerId: null, OR: [{ businessId: value.id }, { coverForBusiness: { id: value.id } }, { profileForBusiness: { id: value.id } }] } }),
    prisma.photo.count({ where: { offer: { businessId: value.id } } }),
    prisma.businessReferralCounter.findUnique({ where: { businessId: value.id }, select: { validReferralCount: true } }),
  ]);
  const now = new Date(), period = value.visibilityPeriods[0];
  const effectiveVisibility = value.visibilityStatus === 'VISIBLE' && period ? period.expiresAt <= now ? 'EXPIRED' : period.startsAt > now ? 'NOT_STARTED' : value.visibilityStatus : value.visibilityStatus;
  return { ...compact(value, now)!, record: { version: 1, members, effectiveVisibility, rating: { value: rating._avg.rating, count: rating._count._all },
    products: catalog.find(row => row.kind === 'PRODUCT')?._count._all ?? 0, services: catalog.find(row => row.kind === 'SERVICE')?._count._all ?? 0,
    businessPhotos, catalogPhotos, referrals: referralCounter?.validReferralCount ?? 0, accountStatus: value.businessAccount.status,
    coverPosition: { x: value.coverImagePositionX, y: value.coverImagePositionY }, profilePosition: { x: value.profileImagePositionX, y: value.profileImagePositionY } } };
}

/** Read the original gallery cover under Admin permissions, regardless of publication state. */
export async function getAdminBusinessCoverPhoto(photoId: string) {
  const photo = await prisma.photo.findFirst({
    where: { id: photoId, business: { OR: [{ coverPhotoId: photoId }, { profilePhotoId: photoId }] } },
    select: { storageKey: true },
  });
  if (!photo) throw new AppError(404, 'ADMIN_BUSINESS_PHOTO_NOT_FOUND', 'No encontramos la portada del negocio.');
  try {
    return { buffer: await readPhoto(photo.storageKey), mimeType: photoMimeType(photo.storageKey) };
  } catch (error) {
    if (isPhotoMissingError(error) || (error instanceof Error && (error as NodeJS.ErrnoException).code === 'ENOENT'))
      throw new AppError(404, 'ADMIN_BUSINESS_PHOTO_MISSING', 'La portada ya no está disponible.');
    throw new AppError(503, 'ADMIN_BUSINESS_PHOTO_UNAVAILABLE', 'No pudimos cargar la portada en este momento.');
  }
}

export async function getAdminBusinessesFilters() {
  const [categories, locations] = await Promise.all([
    prisma.category.findMany({
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
      select: { id: true, code: true, translations: { select: { locale: true, name: true } } },
    }),
    prisma.businessLocation.findMany({
      distinct: ['countryCode', 'cityName'], orderBy: [{ countryCode: 'asc' }, { cityName: 'asc' }],
      select: { countryCode: true, cityName: true },
    }),
  ]);
  return {
    categories: categories.map(category => ({ id: category.id, name: category.translations.find(t => t.locale === 'es-CO')?.name ?? category.translations[0]?.name ?? category.code })),
    cities: locations.map(city => ({ value: city.countryCode + '|' + city.cityName, label: city.cityName + ' · ' + city.countryCode })),
  };
}

export async function getAdminBusinessesOverview(now = new Date()) {
  const live = { deletionStatus: { not: 'DELETED' as const } };
  const soon = new Date(now.getTime() + 7 * 86400000);
  const [total, visible, hidden, expired, adminHidden, suspended, verified, pendingVerification, rejectedVerification, pro, reported, review, deleted, expiring] = await Promise.all([
    prisma.business.count({ where: live }),
    prisma.business.count({ where: {
      deletionStatus: 'NONE', businessAccount: { status: 'ACTIVE' }, lifecycleStatus: 'ACTIVE',
      publicationStatus: 'PUBLISHED', visibilityStatus: 'VISIBLE', administrativeRestriction: null,
      OR: [{ visibilityPeriods: { none: {} } }, { visibilityPeriods: { some: { startsAt: { lte: now }, expiresAt: { gt: now } } } }],
    } }),
    prisma.business.count({ where: { ...live, visibilityStatus: 'HIDDEN', administrativeRestriction: null } }),
    prisma.business.count({ where: { ...live, visibilityStatus: 'EXPIRED' } }),
    prisma.business.count({ where: { ...live, administrativeRestriction: 'HIDDEN' } }),
    prisma.business.count({ where: { ...live, administrativeRestriction: 'SUSPENDED' } }),
    prisma.business.count({ where: { ...live, verificationStatus: 'APPROVED' } }),
    prisma.business.count({ where: { ...live, verificationStatus: { in: ['PENDING', 'INFORMATION'] } } }),
    prisma.business.count({ where: { ...live, verificationStatus: 'REJECTED' } }),
    prisma.business.count({ where: { ...live, subscriptions: { some: activePro(now) } } }),
    prisma.business.count({ where: { ...live, reports: { some: {} } } }),
    prisma.business.count({ where: { ...live, publicationStatus: 'REVIEW' } }),
    prisma.business.count({ where: { deletionStatus: 'DELETED' } }),
    prisma.$queryRaw<Array<{ quantity: bigint }>>(Prisma.sql`
      SELECT COUNT(*) AS quantity FROM Business b
      INNER JOIN (
        SELECT businessId, MAX(expiresAt) AS latestExpiry
        FROM BusinessVisibilityPeriod GROUP BY businessId
      ) p ON p.businessId = b.id
      WHERE b.deletionStatus = 'NONE' AND b.publicationStatus = 'PUBLISHED'
        AND b.visibilityStatus = 'VISIBLE' AND b.administrativeRestriction IS NULL
        AND p.latestExpiry > ${now} AND p.latestExpiry <= ${soon}
    `),
  ]);
  return { generatedAt: now.toISOString(), total, visible, hidden, expired, adminHidden, suspended, verified, pendingVerification, rejectedVerification, pro, reported, review, deleted, expiring: Number(expiring[0]?.quantity ?? 0) };
}

export type AdminBusinessHistoryKind = 'ALL' | 'VISIBILITY' | 'VERIFICATION' | 'SUBSCRIPTION' | 'OFFER';

/** A single immutable business audit stream; product changes already write a
 * business-scoped audit entry in addition to their separate offer audit. Never
 * combine those two rows, or an event would appear twice. */
const adminBusinessHistoryGroups: Record<Exclude<AdminBusinessHistoryKind, 'ALL'>, Prisma.AuditLogWhereInput> = {
  VISIBILITY: { OR: [
    { action: { contains: 'VISIBILITY' } }, { action: { startsWith: 'ADMIN_BUSINESS_SET_' } },
    { action: { in: ['ADMIN_BUSINESS_HIDE', 'ADMIN_BUSINESS_SUSPEND', 'ADMIN_BUSINESS_RESTORE', 'BUSINESS_PUBLISHED'] } },
  ] },
  VERIFICATION: { OR: [{ action: { contains: 'VERIF' } }, { action: { contains: 'VERIFICATION' } }] },
  SUBSCRIPTION: { OR: [{ action: { contains: 'PLAN' } }, { action: { contains: 'SUBSCRIPTION' } }] },
  OFFER: { OR: [
    { action: { startsWith: 'ADMIN_OFFER_' } }, { action: { startsWith: 'BUSINESS_OFFER_' } },
    { action: { startsWith: 'OFFER_' } }, { action: { contains: 'CATALOG' } },
  ] },
};

export async function getAdminBusinessHistory(
  identifier: string, page = 1, pageSize = 60, kindText = 'ALL', searchText = '',
) {
  const business = await prisma.business.findFirst({
    where: { OR: [{ id: identifier }, { publicId: identifier }] }, select: { id: true },
  });
  if (!business) throw new AppError(404, 'ADMIN_BUSINESS_NOT_FOUND', 'No encontramos este negocio.');
  const allowedKinds: AdminBusinessHistoryKind[] = ['ALL', 'VISIBILITY', 'VERIFICATION', 'SUBSCRIPTION', 'OFFER'];
  if (!allowedKinds.includes(kindText as AdminBusinessHistoryKind))
    throw new AppError(400, 'ADMIN_BUSINESS_HISTORY_FILTER_INVALID', 'El filtro del historial no es válido.');
  const kind = kindText as AdminBusinessHistoryKind;
  const currentPage = Number.isInteger(page) ? Math.max(1, Math.min(100000, page)) : 1;
  const size = Number.isInteger(pageSize) ? Math.max(1, Math.min(60, pageSize)) : 60;
  const search = searchText.trim().slice(0, 100);
  const match: Prisma.AuditLogWhereInput[] = [
    { action: { contains: search } }, { reason: { contains: search } },
    { comment: { contains: search } }, { actor: { is: { displayName: { contains: search } } } },
  ];
  // Search names are shown in Spanish; audit action codes are in English.
  // Translate common category searches without touching persisted audit rows.
  if (search) {
    const needle = search.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (/visib|ocult|suspend|restaur|restitu/.test(needle)) match.push(adminBusinessHistoryGroups.VISIBILITY);
    if (/verif|aprob|rechaz/.test(needle)) match.push(adminBusinessHistoryGroups.VERIFICATION);
    if (/suscrip|plan|pro|basic/.test(needle)) match.push(adminBusinessHistoryGroups.SUBSCRIPTION);
    if (/product|servici|catalog|publicacion/.test(needle)) match.push(adminBusinessHistoryGroups.OFFER);
    if (/registr|creacion|creado/.test(needle)) match.push({ action: 'BUSINESS_CREATED' });
  }
  const scopes: Prisma.AuditLogWhereInput[] = [];
  if (kind !== 'ALL') scopes.push(adminBusinessHistoryGroups[kind]);
  if (search) scopes.push({ OR: match });
  const where: Prisma.AuditLogWhereInput = {
    entityType: 'BUSINESS', entityId: business.id,
    ...(scopes.length ? { AND: scopes } : {}),
  };
  const [history, total] = await prisma.$transaction([
    prisma.auditLog.findMany({
      where, take: size, skip: (currentPage - 1) * size,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { id: true, action: true, reason: true, comment: true, createdAt: true,
        previousState: true, newState: true, actor: { select: { displayName: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);
  const state = (input: Prisma.JsonValue) => input && typeof input === 'object' && !Array.isArray(input)
    ? Object.fromEntries(Object.entries(input).filter(([key, value]) =>
      ['name', 'visibilityStatus', 'publicationStatus', 'lifecycleStatus', 'deletionStatus', 'verificationStatus',
        'administrativeRestriction', 'completeness', 'plan', 'offerName', 'offerCode', 'offerState',
        'description', 'sede', 'cityName', 'regionName', 'adultOnly', 'changedFields',
        'status', 'type', 'phonePublic', 'whatsappPublic', 'emailPublic'].includes(key)
      && (value === null || ['string', 'number', 'boolean'].includes(typeof value)))
        .map(([key, value]) => [key, typeof value === 'string' && value.length > 600
          ? value.slice(0, 600) + '…' : value])) : null;
  return {
    history: history.map(row => ({ ...row, previousState: state(row.previousState), newState: state(row.newState) })),
    pagination: { page: currentPage, pageSize: size, total, totalPages: Math.ceil(total / size) },
  };
}

/** A restriction belongs to Admin, not the business owner. Never restores an expired 40-day period. */
export async function setAdminBusinessVisibility(identifier: string, actorUserId: string, actionText: string, reasonText: string) {
  const action = validateAdminVisibilityAction(actionText, reasonText);
  const reason = reasonText.trim();
  return prisma.$transaction(async tx => {
    const business = await tx.business.findFirst({
      where: { OR: [{ id: identifier }, { publicId: identifier }] },
      select: {
        id: true, name: true, deletionStatus: true, visibilityStatus: true, publicationStatus: true,
        administrativeRestriction: true, administrativePreviousVisibility: true,
      },
    });
    if (!business) throw new AppError(404, 'ADMIN_BUSINESS_NOT_FOUND', 'No encontramos este negocio.');
    if (business.deletionStatus === 'DELETED') throw new AppError(409, 'ADMIN_BUSINESS_DELETED', 'No puede modificar un negocio eliminado.');
    if (action === 'SET_VISIBLE' || action === 'SET_HIDDEN') {
      const period = await tx.businessVisibilityPeriod.findFirst({
        where: { businessId: business.id }, orderBy: { expiresAt: 'desc' },
        select: { startsAt: true, expiresAt: true },
      });
      const now = new Date();
      const valid = Boolean(period && period.startsAt <= now && period.expiresAt > now);
      const nextVisibility: BusinessVisibilityStatus = action === 'SET_HIDDEN' ? 'HIDDEN' : valid ? 'VISIBLE' : 'EXPIRED';
      if (business.visibilityStatus === nextVisibility && !business.administrativeRestriction)
        throw new AppError(409, 'ADMIN_BUSINESS_STATE_UNCHANGED', 'El negocio ya tiene este estado.');
      const result = await tx.business.updateMany({
        where: { id: business.id, administrativeRestriction: business.administrativeRestriction },
        data: { visibilityStatus: nextVisibility, administrativeRestriction: null,
          administrativePreviousVisibility: null, administrativeRestrictedAt: null, administrativeRestrictionReason: null },
      });
      if (!result.count) throw new AppError(409, 'ADMIN_BUSINESS_CONCURRENT_CHANGE', 'El negocio cambió durante la operación. Actualiza la ficha.');
      const title = action === 'SET_HIDDEN' ? 'Tu negocio fue ocultado' : 'Estado de visibilidad actualizado';
      const message = action === 'SET_HIDDEN'
        ? business.name + ' fue ocultado en XAMUKO. Puedes volver a activarlo desde Business cuando cumpla las condiciones de publicación y vigencia.'
        : nextVisibility === 'VISIBLE'
          ? business.name + ' ya puede mostrarse públicamente en XAMUKO si cumple las demás condiciones de publicación.'
          : business.name + ' no tiene visibilidad vigente. La restricción administrativa fue retirada, pero necesitas renovar la vigencia desde Business.';
      await notifyBusinessOwners(tx, business.id, title, message);
      const owners = await tx.businessMembership.findMany({ where: { businessId: business.id, role: 'OWNER', status: 'ACTIVE', user: { status: 'ACTIVE' } }, select: { userId: true } });
      for (const userId of new Set(owners.map(owner => owner.userId)))
        await notifyPlatformUser(tx, { userId, sourceType: 'BUSINESS_ADMIN_ACTION', sourceId: business.id, title, message });
      await tx.auditLog.create({ data: {
        actorUserId, entityType: 'BUSINESS', entityId: business.id, action: action === 'SET_HIDDEN' ? 'ADMIN_BUSINESS_SET_HIDDEN' : 'ADMIN_BUSINESS_SET_VISIBLE',
        previousState: { visibilityStatus: business.visibilityStatus, administrativeRestriction: business.administrativeRestriction },
        newState: { visibilityStatus: nextVisibility, administrativeRestriction: null }, reason,
      } });
      return { id: business.id, action, visibilityStatus: nextVisibility, administrativeRestriction: null, message };
    }

    if (action === 'RESTORE' && !business.administrativeRestriction)
      throw new AppError(409, 'ADMIN_BUSINESS_NOT_RESTRICTED', 'El negocio no tiene una restricción administrativa vigente.');
    if (action !== 'RESTORE' && business.administrativeRestriction === (action === 'HIDE' ? 'HIDDEN' : 'SUSPENDED'))
      throw new AppError(409, 'ADMIN_BUSINESS_ALREADY_RESTRICTED', 'Esta medida ya está vigente.');
    let visibilityStatus: BusinessVisibilityStatus = 'HIDDEN';
    if (action === 'RESTORE') {
      const period = await tx.businessVisibilityPeriod.findFirst({
        where: { businessId: business.id }, orderBy: { expiresAt: 'desc' },
        select: { startsAt: true, expiresAt: true },
      });
      visibilityStatus = restoredAdminBusinessVisibility(business.administrativePreviousVisibility, period);
    }
    const restriction = action === 'RESTORE' ? null : action === 'HIDE' ? 'HIDDEN' : 'SUSPENDED';
    const updated = await tx.business.updateMany({
      where: { id: business.id, administrativeRestriction: business.administrativeRestriction },
      data: {
        administrativeRestriction: restriction,
        administrativePreviousVisibility: action === 'RESTORE' ? null : business.administrativePreviousVisibility ?? business.visibilityStatus,
        administrativeRestrictedAt: action === 'RESTORE' ? null : new Date(),
        administrativeRestrictionReason: action === 'RESTORE' ? null : reason,
        visibilityStatus,
      },
    });
    if (!updated.count) throw new AppError(409, 'ADMIN_BUSINESS_CONCURRENT_CHANGE', 'El negocio cambió mientras procesábamos la solicitud. Actualiza e inténtalo de nuevo.');
    const labels = { HIDE: 'ocultado', SUSPEND: 'suspendido', RESTORE: 'revisado y restituido' } as const;
    const title = action === 'RESTORE' ? 'Se revisó la restricción de tu negocio' : action === 'HIDE' ? 'Tu negocio fue ocultado por XAMUKO' : 'Tu negocio fue suspendido por XAMUKO';
    const message = 'El negocio ' + business.name + ' fue ' + labels[action] + ' mediante una decisión administrativa. Si necesitas aclaraciones, comunícate con soporte.';
    const owners = await tx.businessMembership.findMany({ where: { businessId: business.id, role: 'OWNER', status: 'ACTIVE', user: { status: 'ACTIVE' } }, select: { userId: true } });
    for (const userId of new Set(owners.map(owner => owner.userId)))
      await notifyPlatformUser(tx, { userId, sourceType: 'BUSINESS_ADMIN_ACTION', sourceId: business.id, title, message });
    await notifyBusinessOwners(tx, business.id, title, message);
    await tx.auditLog.create({
      data: {
        actorUserId, entityType: 'BUSINESS', entityId: business.id, action: 'ADMIN_BUSINESS_' + action,
        previousState: { visibilityStatus: business.visibilityStatus, administrativeRestriction: business.administrativeRestriction },
        newState: { visibilityStatus, administrativeRestriction: restriction }, reason,
      },
    });
    return { id: business.id, action, visibilityStatus, administrativeRestriction: restriction, message: action === 'RESTORE' ? 'Se retiró la restricción administrativa. La visibilidad depende de la vigencia del negocio.' : action === 'HIDE' ? 'Negocio ocultado con registro de auditoría.' : 'Negocio suspendido con registro de auditoría.' };
  });
}

/** Baja lógica del negocio: no elimina la identidad de su propietario ni el historial contable. */
export async function deleteAdminBusiness(identifier: string, actorUserId: string, reason: string) {
  const justification = reason.trim();
  if (justification.length < 12 || justification.length > 500)
    throw new AppError(400, 'ADMIN_BUSINESS_REASON_REQUIRED', 'Indica un motivo de entre 12 y 500 caracteres.');
  return prisma.$transaction(async tx => {
    const business = await tx.business.findFirst({
      where: { OR: [{ id: identifier }, { publicId: identifier }] },
      select: { id: true, name: true, deletionStatus: true, publicationStatus: true, visibilityStatus: true },
    });
    if (!business) throw new AppError(404, 'ADMIN_BUSINESS_NOT_FOUND', 'No encontramos este negocio.');
    if (business.deletionStatus === 'DELETED')
      throw new AppError(409, 'ADMIN_BUSINESS_ALREADY_DELETED', 'El negocio ya está eliminado.');
    const updated = await tx.business.updateMany({
      where: { id: business.id, deletionStatus: business.deletionStatus },
      data: { deletionStatus: 'DELETED', publicationStatus: 'UNPUBLISHED', visibilityStatus: 'HIDDEN' },
    });
    if (updated.count !== 1)
      throw new AppError(409, 'ADMIN_BUSINESS_CONCURRENT_CHANGE', 'El negocio cambió de estado. Actualiza la página antes de continuar.');
    const now = new Date();
    const owners = await tx.businessMembership.findMany({
      where: { businessId: business.id, role: 'OWNER', status: 'ACTIVE', user: { status: 'ACTIVE' } },
      select: { userId: true },
    });
    for (const ownerId of new Set(owners.map(owner => owner.userId))) {
      await notifyPlatformUser(tx, {
        userId: ownerId, sourceType: 'BUSINESS_DELETED', sourceId: business.id,
        title: 'Tu negocio fue retirado de XAMUKO',
        message: 'El negocio ' + business.name + ' fue eliminado mediante una decisión administrativa y ya no está disponible en XAMUKO. Consulta con el equipo de soporte si necesitas revisar esta decisión.',
      });
    }
    await tx.ownershipTransfer.updateMany({
      where: { businessId: business.id, status: 'PENDING' },
      data: { status: 'CANCELLED', respondedAt: now },
    });
    // A deleted business must not keep active plans or automatic renewal enabled.
    await tx.businessSubscription.updateMany({
      where: { businessId: business.id, status: { in: ['ACTIVE', 'PENDING'] } },
      data: { status: 'REVOKED', autoRenew: false, revokedAt: now, revocationReason: 'Baja administrativa del negocio' },
    });
    await tx.auditLog.create({
      data: {
        actorUserId, entityType: 'BUSINESS', entityId: business.id, action: 'ADMIN_BUSINESS_DELETED',
        previousState: { name: business.name, deletionStatus: business.deletionStatus,
          publicationStatus: business.publicationStatus, visibilityStatus: business.visibilityStatus },
        newState: { deletionStatus: 'DELETED', publicationStatus: 'UNPUBLISHED', visibilityStatus: 'HIDDEN' },
        reason: justification,
      },
    });
    return { id: business.id, status: 'DELETED' as const,
      message: 'Negocio retirado de XAMUKO. La cuenta del propietario permanece activa y el historial se conserva.' };
  });
}


/** Explicit SUPER_ADMIN manual approval; pending documentary requests must use their own review workflow. */
export type AdminVerificationAction = 'VERIFY' | 'UNVERIFY';

export function validateAdminVerificationAction(actionText: string, reasonText: string): AdminVerificationAction {
  if (actionText !== 'VERIFY' && actionText !== 'UNVERIFY')
    throw new AppError(400, 'ADMIN_VERIFICATION_ACTION_INVALID', 'Selecciona Verificado o Sin verificar.');
  const reason = reasonText.trim();
  if (reason.length < 12 || reason.length > 500)
    throw new AppError(400, 'ADMIN_VERIFICATION_REASON_REQUIRED', 'Explica el motivo de la decisión (12 a 500 caracteres).');
  return actionText;
}

/** Reversible Super Admin verification; preserves documentary history and records each decision. */
export async function setAdminBusinessVerificationStatus(identifier: string, actorUserId: string, actionText: string, reasonText: string) {
  const action = validateAdminVerificationAction(actionText, reasonText);
  const reason = reasonText.trim();
  return prisma.$transaction(async tx => {
    const business = await tx.business.findFirst({
      where: { OR: [{ id: identifier }, { publicId: identifier }] },
      select: { id: true, name: true, deletionStatus: true, verificationStatus: true },
    });
    if (!business) throw new AppError(404, 'ADMIN_BUSINESS_NOT_FOUND', 'Negocio no encontrado.');
    if (business.deletionStatus === 'DELETED')
      throw new AppError(409, 'ADMIN_BUSINESS_DELETED', 'No puedes modificar un negocio eliminado.');
    const verificationStatus = action === 'VERIFY' ? 'APPROVED' : 'NONE';
    if (business.verificationStatus === verificationStatus)
      throw new AppError(409, 'ADMIN_BUSINESS_VERIFICATION_UNCHANGED', 'El negocio ya tiene este estado de verificación.');
    const openRequest = await tx.businessVerificationRequest.findFirst({
      where: { businessId: business.id, activeKey: { not: null } }, select: { id: true },
    });
    if (openRequest)
      throw new AppError(409, 'ADMIN_VERIFICATION_PENDING_DOCUMENT', 'Existe una solicitud documental abierta. Resuélvela desde Verificaciones para conservar el expediente.');
    const updated = await tx.business.updateMany({
      where: { id: business.id, verificationStatus: business.verificationStatus, deletionStatus: { not: 'DELETED' } },
      data: { verificationStatus },
    });
    if (!updated.count)
      throw new AppError(409, 'ADMIN_BUSINESS_CONCURRENT_CHANGE', 'El estado de verificación cambió. Actualiza la ficha.');
    await tx.auditLog.create({ data: {
      actorUserId, entityType: 'BUSINESS', entityId: business.id,
      action: action === 'VERIFY' ? 'ADMIN_BUSINESS_VERIFIED_MANUALLY' : 'ADMIN_BUSINESS_UNVERIFIED_MANUALLY',
      previousState: { verificationStatus: business.verificationStatus },
      newState: { verificationStatus }, reason,
    } });
    const title = action === 'VERIFY' ? 'Tu negocio ha sido verificado' : 'Se retiró la verificación de tu negocio';
    const message = action === 'VERIFY'
      ? business.name + ' fue verificado mediante una decisión administrativa de XAMUKO. Consulta el estado actualizado en Business.'
      : 'XAMUKO Admin retiró el estado de verificado de ' + business.name + '. Consulta el motivo en el historial y contacta con soporte si necesitas una revisión. Esto no modifica la visibilidad del negocio.';
    await notifyBusinessOwners(tx, business.id, title, message);
    const owners = await tx.businessMembership.findMany({
      where: { businessId: business.id, role: 'OWNER', status: 'ACTIVE', user: { status: 'ACTIVE' } },
      select: { userId: true },
    });
    for (const userId of new Set(owners.map(owner => owner.userId)))
      await notifyPlatformUser(tx, { userId, sourceType: 'BUSINESS_ADMIN_ACTION', sourceId: business.id, title, message });
    return { id: business.id, verificationStatus,
      message: action === 'VERIFY' ? 'Negocio verificado y propietarios notificados.' : 'Verificación retirada y propietarios notificados.' };
  });
}

/** Compatible with older manual-approval clients. */
export function setAdminBusinessVerification(identifier: string, actorUserId: string, reasonText: string) {
  return setAdminBusinessVerificationStatus(identifier, actorUserId, 'VERIFY', reasonText);
}

/** Administrative subscription override does not create a charge or recurring payment. */
export async function setAdminBusinessPlan(identifier: string, actorUserId: string, plan: string, reasonText: string) {
  const reason = reasonText.trim();
  if (!['BASIC', 'PRO'].includes(plan))
    throw new AppError(400, 'ADMIN_PLAN_INVALID', 'Selecciona Básico o Business PRO.');
  if (reason.length < 12 || reason.length > 500)
    throw new AppError(400, 'ADMIN_PLAN_REASON_REQUIRED', 'Explica el cambio de plan (12 a 500 caracteres).');
  return prisma.$transaction(async tx => {
    const business = await tx.business.findFirst({
      where: { OR: [{ id: identifier }, { publicId: identifier }] },
      select: { id: true, name: true, deletionStatus: true },
    });
    if (!business) throw new AppError(404, 'ADMIN_BUSINESS_NOT_FOUND', 'Negocio no encontrado.');
    if (business.deletionStatus === 'DELETED') throw new AppError(409, 'ADMIN_BUSINESS_DELETED', 'No puedes cambiar el plan de un negocio eliminado.');
    const now = new Date();
    const active = await tx.businessSubscription.findMany({
      where: { businessId: business.id, plan: 'PRO', status: 'ACTIVE', revokedAt: null,
        startsAt: { lte: now }, OR: [{ expiresAt: { gt: now } }, { expiresAt: null, specialActivation: true }] },
      select: { id: true },
    });
    const before = active.length ? 'PRO' : 'BASIC';
    if (before === plan) throw new AppError(409, 'ADMIN_PLAN_UNCHANGED', 'El negocio ya tiene ese plan.');
    if (plan === 'PRO') {
      await tx.businessSubscription.create({ data: {
        businessId: business.id, plan: 'PRO', status: 'ACTIVE', startsAt: now,
        expiresAt: null, specialActivation: true, autoRenew: false,
      } });
    } else {
      await tx.businessSubscription.updateMany({
        where: { id: { in: active.map(item => item.id) }, status: 'ACTIVE', revokedAt: null },
        data: { status: 'REVOKED', revokedAt: now, revocationReason: ('Cambio administrativo: ' + reason).slice(0, 255), autoRenew: false },
      });
    }
    await tx.auditLog.create({ data: { actorUserId, entityType: 'BUSINESS', entityId: business.id,
      action: 'ADMIN_BUSINESS_PLAN_CHANGED', previousState: { plan: before }, newState: { plan }, reason } });
    const title = 'Actualización de tu plan Business';
    const message = business.name + ' ahora tiene el plan ' + (plan === 'PRO' ? 'Business PRO' : 'Básico') + ' por decisión administrativa. Consulta tu suscripción en Business.';
    await notifyBusinessOwners(tx, business.id, title, message);
    const owners = await tx.businessMembership.findMany({ where: { businessId: business.id, role: 'OWNER', status: 'ACTIVE', user: { status: 'ACTIVE' } }, select: { userId: true } });
    for (const userId of new Set(owners.map(owner => owner.userId)))
      await notifyPlatformUser(tx, { userId, sourceType: 'BUSINESS_ADMIN_ACTION', sourceId: business.id, title, message });
    return { id: business.id, plan, message: 'Plan actualizado y propietarios notificados.' };
  });
}
