import { prisma } from '../../config/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';

export const BUSINESS_VISIBILITY_DAYS = 40;
const DAY_MS = 24 * 60 * 60 * 1000;

function expiresAtFrom(start: Date) {
  return new Date(start.getTime() + BUSINESS_VISIBILITY_DAYS * DAY_MS);
}

async function authorizedBusiness(userId: string, identifier: string) {
  const business = await prisma.business.findFirst({
    where: { OR: [{ id: identifier }, { publicId: identifier }], deletionStatus: { not: 'DELETED' }, memberships: { some: { userId, status: 'ACTIVE' } } },
    select: { id: true, publicId: true, createdAt: true, visibilityStatus: true, publicationStatus: true, administrativeRestriction: true, memberships: { where: { userId, status: 'ACTIVE' }, select: { role: true, permissions: { where: { allowed: true }, select: { permission: true } } } } },
  });
  if (!business) throw new AppError(404, 'BUSINESS_NOT_FOUND', 'No encontramos el negocio.');
  const membership = business.memberships[0];
  const canManage = membership?.role === 'OWNER' || membership?.permissions.some(item => item.permission === 'CHANGE_PUBLICATION' || item.permission === 'EDIT_BUSINESS');
  if (!canManage) throw new AppError(403, 'BUSINESS_PERMISSION_DENIED', 'No tienes permisos para modificar la visibilidad.');
  return business;
}

async function currentPeriod(businessId: string) {
  return prisma.businessVisibilityPeriod.findFirst({ where: { businessId }, orderBy: { expiresAt: 'desc' }, select: { id: true, kind: true, startsAt: true, expiresAt: true, requestedAt: true } });
}

export async function getVisibility(userId: string, identifier: string) {
  const business = await authorizedBusiness(userId, identifier);
  const period = await currentPeriod(business.id);
  return { businessId: business.id, publicId: business.publicId,
    visibilityStatus: business.visibilityStatus, administrativeRestriction: business.administrativeRestriction,
    publicationStatus: business.publicationStatus, createdAt: business.createdAt,
    period, isWithinPeriod: Boolean(period && period.startsAt <= new Date() && period.expiresAt > new Date()) };
}

export async function ensureInitialVisibilityPeriod(tx: any, businessId: string, createdAt: Date) {
  await tx.businessVisibilityPeriod.create({ data: { businessId, kind: 'INITIAL', startsAt: createdAt, expiresAt: expiresAtFrom(createdAt), reason: 'Periodo inicial de visibilidad' } });
}

export async function renewVisibility(userId: string, identifier: string) {
  const business = await authorizedBusiness(userId, identifier);
  if (business.administrativeRestriction) throw new AppError(403, 'BUSINESS_ADMIN_RESTRICTION', 'Este negocio tiene una restricción administrativa. Comunícate con soporte para solicitar revisión.');
  const startsAt = new Date();
  const period = await prisma.$transaction(async tx => {
    const next = await tx.businessVisibilityPeriod.create({ data: { businessId: business.id, kind: 'MANUAL_EXTENSION', startsAt, expiresAt: expiresAtFrom(startsAt), requestedById: userId, reason: 'Renovación manual' } });
    // Log this owner action in the same transaction as the visibility change,
    // so both Admin histories show exactly one durable event.
    const changed = await tx.business.updateMany({
      where: { id: business.id, administrativeRestriction: null },
      data: { visibilityStatus: 'VISIBLE' },
    });
    if (!changed.count)
      throw new AppError(409, 'BUSINESS_ADMIN_RESTRICTION', 'El negocio fue restringido por Administración. Actualiza e inténtalo de nuevo.');
    await tx.auditLog.create({ data: {
      actorUserId: userId, entityType: 'BUSINESS', entityId: business.id,
      action: 'BUSINESS_VISIBILITY_RENEWED',
      previousState: { visibilityStatus: business.visibilityStatus, administrativeRestriction: business.administrativeRestriction },
      newState: { visibilityStatus: 'VISIBLE', administrativeRestriction: null },
      reason: 'Renovación voluntaria de visibilidad por 40 días desde Business',
    } });
    // A fresh forty-day period supersedes unanswered reminders from the old period.
    // Keep the history but stop showing expired warnings as unread.
    await tx.businessNotification.updateMany({
      where: { businessId: business.id, type: { in: ['VISIBILITY_REMINDER', 'VISIBILITY_EXPIRED'] }, readAt: null },
      data: { readAt: startsAt },
    });
    await tx.platformNotification.updateMany({
      where: { sourceType: 'BUSINESS_VISIBILITY', sourceId: business.id, readAt: null },
      data: { readAt: startsAt },
    });
    return next;
  });
  return { businessId: business.id, publicId: business.publicId, createdAt: business.createdAt,
    visibilityStatus: 'VISIBLE', administrativeRestriction: null,
    publicationStatus: business.publicationStatus, isWithinPeriod: true,
    period: { id: period.id, kind: period.kind, startsAt: period.startsAt, expiresAt: period.expiresAt, requestedAt: period.requestedAt } };
}

export async function setVisibility(userId: string, identifier: string, visible: boolean) {
  const business = await authorizedBusiness(userId, identifier);
  if (business.administrativeRestriction) throw new AppError(403, 'BUSINESS_ADMIN_RESTRICTION', 'Este negocio tiene una restricción administrativa. Comunícate con soporte para solicitar revisión.');
  const period = await currentPeriod(business.id);
  const activePeriod = period && period.startsAt <= new Date() && period.expiresAt > new Date();
  const visibilityStatus = visible ? (activePeriod ? 'VISIBLE' : 'EXPIRED') : 'HIDDEN';
  await prisma.$transaction(async tx => {
    const updated = await tx.business.updateMany({
      where: { id: business.id, administrativeRestriction: null },
      data: { visibilityStatus },
    });
    if (!updated.count) throw new AppError(409, 'BUSINESS_ADMIN_RESTRICTION', 'El negocio fue restringido por Administración. Actualiza e inténtalo de nuevo.');
    if (business.visibilityStatus !== visibilityStatus) {
      await tx.auditLog.create({ data: {
        actorUserId: userId, entityType: 'BUSINESS', entityId: business.id,
        action: visible ? 'BUSINESS_VISIBILITY_SET_VISIBLE' : 'BUSINESS_VISIBILITY_SET_HIDDEN',
        previousState: { visibilityStatus: business.visibilityStatus, administrativeRestriction: null },
        newState: { visibilityStatus, administrativeRestriction: null },
        reason: visible ? 'El negocio fue reactivado voluntariamente desde Business' : 'El negocio fue ocultado voluntariamente desde Business',
      } });
    }
  });
  return { businessId: business.id, publicId: business.publicId, createdAt: business.createdAt,
    visibilityStatus, administrativeRestriction: null,
    publicationStatus: business.publicationStatus, isWithinPeriod: Boolean(activePeriod), period };
}
