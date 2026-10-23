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
    select: { id: true, publicId: true, createdAt: true, visibilityStatus: true, memberships: { where: { userId, status: 'ACTIVE' }, select: { role: true, permissions: { where: { allowed: true }, select: { permission: true } } } } },
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
  return { businessId: business.id, publicId: business.publicId, visibilityStatus: business.visibilityStatus, createdAt: business.createdAt, period, isWithinPeriod: Boolean(period && period.startsAt <= new Date() && period.expiresAt > new Date()) };
}

export async function ensureInitialVisibilityPeriod(tx: any, businessId: string, createdAt: Date) {
  await tx.businessVisibilityPeriod.create({ data: { businessId, kind: 'INITIAL', startsAt: createdAt, expiresAt: expiresAtFrom(createdAt), reason: 'Periodo inicial de visibilidad' } });
}

export async function renewVisibility(userId: string, identifier: string) {
  const business = await authorizedBusiness(userId, identifier);
  const startsAt = new Date();
  const period = await prisma.$transaction(async tx => {
    const next = await tx.businessVisibilityPeriod.create({ data: { businessId: business.id, kind: 'MANUAL_EXTENSION', startsAt, expiresAt: expiresAtFrom(startsAt), requestedById: userId, reason: 'Renovación manual' } });
    await tx.business.update({ where: { id: business.id }, data: { visibilityStatus: 'VISIBLE' } });
    return next;
  });
  return { businessId: business.id, visibilityStatus: 'VISIBLE', isWithinPeriod: true, period: { id: period.id, kind: period.kind, startsAt: period.startsAt, expiresAt: period.expiresAt, requestedAt: period.requestedAt } };
}

export async function setVisibility(userId: string, identifier: string, visible: boolean) {
  const business = await authorizedBusiness(userId, identifier);
  const period = await currentPeriod(business.id);
  const activePeriod = period && period.startsAt <= new Date() && period.expiresAt > new Date();
  const visibilityStatus = visible ? (activePeriod ? 'VISIBLE' : 'EXPIRED') : 'HIDDEN';
  await prisma.business.update({ where: { id: business.id }, data: { visibilityStatus } });
  return { businessId: business.id, visibilityStatus, period };
}
