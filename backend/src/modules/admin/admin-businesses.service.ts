import { prisma } from '../../config/prisma.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { AppError } from '../../shared/errors/app-error.js';

const businessSelect = {
  id: true, publicId: true, name: true, description: true, email: true, phone: true,
  lifecycleStatus: true, publicationStatus: true, visibilityStatus: true,
  verificationStatus: true, deletionStatus: true, completeness: true,
  createdAt: true, updatedAt: true,
  createdBy: { select: { displayName: true, emailNormalized: true } },
  location: { select: { cityName: true, countryCode: true, address: true } },
  category: { select: { code: true, translations: { select: { locale: true, name: true } } } },
} as const;

export async function listAdminBusinesses(query: { q?: string; page?: number; pageSize?: number; status?: string }) {
  const q = (query.q ?? '').trim().slice(0, 100);
  const page = Number.isFinite(query.page) ? Math.max(1, Math.min(100000, Math.floor(query.page!))) : 1;
  const pageSize = Number.isFinite(query.pageSize) ? Math.min(100, Math.max(1, Math.floor(query.pageSize!))) : 20;
  const publicationStatus = query.status === 'active' ? 'PUBLISHED' : query.status === 'review' ? 'REVIEW' : query.status === 'inactive' ? 'UNPUBLISHED' : undefined;
  const where: Prisma.BusinessWhereInput = { deletionStatus: { not: 'DELETED' }, ...(q ? { name: { contains: q } } : {}), ...(publicationStatus ? { publicationStatus } : {}) };
  const [total, businesses] = await Promise.all([
    prisma.business.count({ where }),
    prisma.business.findMany({ where, select: businessSelect, orderBy: { updatedAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
  ]);
  return { businesses, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
}

export async function getAdminBusiness(id: string) {
  return prisma.business.findFirst({ where: { OR: [{ id }, { publicId: id }] }, select: businessSelect });
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
    await tx.ownershipTransfer.updateMany({
      where: { businessId: business.id, status: 'PENDING' },
      data: { status: 'CANCELLED', respondedAt: now },
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
