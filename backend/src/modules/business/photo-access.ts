import { prisma } from '../../config/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';

export type BusinessPhotoPermission = 'EDIT_BUSINESS' | 'MANAGE_CATALOG';

type PhotoPermissionGrant = { permission: string; allowed: boolean };
type PhotoMembership = { role: string; permissions: PhotoPermissionGrant[] };

export function canManageBusinessPhoto(membership: PhotoMembership, permission: BusinessPhotoPermission) {
  return membership.role === 'OWNER' || membership.permissions.some(item => item.permission === permission && item.allowed);
}

export async function findBusinessForPhotoRead(userId: string, businessId: string) {
  const business = await prisma.business.findFirst({
    where: { id: businessId, memberships: { some: { userId, status: 'ACTIVE' } } },
    select: { id: true, businessAccount: { select: { status: true } }, memberships: { where: { userId, status: 'ACTIVE' }, include: { permissions: true }, take: 1 } },
  });
  if (!business || business.businessAccount.status !== 'ACTIVE') throw new AppError(404, 'BUSINESS_NOT_FOUND', 'No encontramos ese negocio.');
  const membership = business.memberships[0];
  if (!membership) throw new AppError(404, 'BUSINESS_NOT_FOUND', 'No encontramos ese negocio.');
  return { ...business, membership };
}

export function requireBusinessPhotoPermission(
  access: Awaited<ReturnType<typeof findBusinessForPhotoRead>>,
  permission: BusinessPhotoPermission,
) {
  if (!canManageBusinessPhoto(access.membership, permission)) {
    throw new AppError(403, 'BUSINESS_PERMISSION_DENIED', 'No tienes permiso para modificar estas fotografías.');
  }
  return access;
}

export async function findBusinessForPhotoWrite(userId: string, businessId: string, permission: BusinessPhotoPermission) {
  return requireBusinessPhotoPermission(await findBusinessForPhotoRead(userId, businessId), permission);
}
