import { prisma } from '../../config/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';

export async function findBusinessForPhotos(userId: string, businessId: string) {
  const business = await prisma.business.findFirst({
    where: { id: businessId, memberships: { some: { userId, status: 'ACTIVE', role: 'OWNER' } } },
    select: { id: true, businessAccount: { select: { status: true } } },
  });
  if (!business || business.businessAccount.status !== 'ACTIVE') throw new AppError(404, 'BUSINESS_NOT_FOUND', 'No encontramos ese negocio.');
  return business;
}
