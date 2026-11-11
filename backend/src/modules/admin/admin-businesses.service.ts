import { prisma } from '../../config/prisma.js';
import type { Prisma } from '../../generated/prisma/client.js';

const businessSelect = {
  id: true, publicId: true, name: true, description: true, email: true, phone: true,
  lifecycleStatus: true, publicationStatus: true, visibilityStatus: true,
  verificationStatus: true, deletionStatus: true, completeness: true,
  createdAt: true, updatedAt: true,
  createdBy: { select: { displayName: true, emailNormalized: true } },
  location: { select: { cityName: true, countryCode: true, address: true } },
  category: { select: { translations: { where: { locale: 'es' }, select: { name: true }, take: 1 } } },
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
