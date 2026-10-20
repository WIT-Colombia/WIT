import { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';

const publicBusinessWhere = {
  businessAccount: { status: 'ACTIVE' }, lifecycleStatus: 'ACTIVE', publicationStatus: 'PUBLISHED',
  visibilityStatus: 'VISIBLE', deletionStatus: 'NONE',
} as const;

async function findPublicBusiness(businessId: string) {
  const business = await prisma.business.findFirst({ where: { OR: [{ id: businessId }, { publicId: businessId }], ...publicBusinessWhere }, select: { id: true, publicId: true } });
  if (!business) throw new AppError(404, 'BUSINESS_NOT_AVAILABLE', 'El establecimiento no está disponible.');
  return business;
}

export async function addFavorite(userId: string, businessId: string) {
  const business = await findPublicBusiness(businessId);
  try { await prisma.businessFavorite.create({ data: { userId, businessId: business.id } }); }
  catch (error) { if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error; }
  return { businessId: business.publicId, saved: true };
}

export async function removeFavorite(userId: string, businessId: string) {
  const business = await prisma.business.findFirst({ where: { OR: [{ id: businessId }, { publicId: businessId }] }, select: { id: true, publicId: true } });
  if (business) await prisma.businessFavorite.deleteMany({ where: { userId, businessId: business.id } });
  return { businessId: business?.publicId ?? businessId, saved: false };
}

export async function listFavorites(userId: string) {
  const rows = await prisma.businessFavorite.findMany({ where: { userId, business: publicBusinessWhere }, orderBy: { createdAt: 'desc' }, select: {
    businessId: true, createdAt: true,
    business: { select: { id: true, publicId: true, name: true, slug: true, profilePhotoId: true } },
  } });
  return rows.map((row) => ({ ...row, businessId: row.business.publicId }));
}

export async function listFavoriteIds(userId: string) {
  const rows = await prisma.businessFavorite.findMany({ where: { userId }, select: { businessId: true } });
  const businesses = await prisma.business.findMany({ where: { id: { in: rows.map((row) => row.businessId) } }, select: { id: true, publicId: true } });
  const publicIds = new Map(businesses.map((business) => [business.id, business.publicId]));
  return rows.map((row) => publicIds.get(row.businessId) ?? row.businessId);
}

export async function getFavoriteCount(userId: string, identifier: string) {
  const business = await prisma.business.findFirst({
    where: { OR: [{ id: identifier }, { publicId: identifier }], memberships: { some: { userId, status: 'ACTIVE', role: 'OWNER' } } },
    select: { id: true },
  });
  if (!business) throw new AppError(404, 'BUSINESS_NOT_FOUND', 'No encontramos ese negocio o no tienes autorización.');
  return prisma.businessFavorite.count({ where: { businessId: business.id } });
}
