import { prisma } from '../../config/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';
import type { OfferReportReason, OfferReportStatus, Prisma, OfferKind } from '../../generated/prisma/client.js';

const reasons: OfferReportReason[] = ['UNAVAILABLE', 'WRONG_INFORMATION', 'WRONG_IMAGE', 'OTHER'];
const statuses: OfferReportStatus[] = ['PENDING', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED'];

export function validateOfferReport(reason: unknown, description: unknown): { reason: OfferReportReason; description: string | null } {
  if (typeof reason !== 'string' || !reasons.includes(reason as OfferReportReason)) {
    throw new AppError(400, 'INVALID_OFFER_REPORT_REASON', 'Selecciona un motivo válido.');
  }
  if (description != null && typeof description !== 'string') {
    throw new AppError(400, 'INVALID_OFFER_REPORT_DESCRIPTION', 'La descripción debe ser un texto.');
  }
  const text = typeof description === 'string' ? description.trim() : '';
  if (text.length > 500) {
    throw new AppError(400, 'INVALID_OFFER_REPORT_DESCRIPTION', 'La descripción no puede superar 500 caracteres.');
  }
  return { reason: reason as OfferReportReason, description: text || null };
}

export async function submitOfferReport(identifier: string, reporterId: string | null, reason: unknown, description: unknown) {
  const validated = validateOfferReport(reason, description);
  const offer = await prisma.businessOffer.findFirst({
    where: {
      id: identifier,
      active: true,
      deletedAt: null,
      publicationStatus: 'PUBLISHED',
      business: { lifecycleStatus: 'ACTIVE', publicationStatus: 'PUBLISHED', deletionStatus: 'NONE' },
    },
    select: { id: true, kind: true },
  });
  if (!offer) throw new AppError(404, 'OFFER_NOT_FOUND', 'No encontramos una publicación disponible con ese identificador.');
  if (validated.reason === 'WRONG_IMAGE' && offer.kind !== 'PRODUCT') {
    throw new AppError(400, 'INVALID_OFFER_REPORT_REASON', 'Selecciona un motivo válido para este servicio.');
  }

  if (reporterId) {
    const existing = await prisma.offerReport.findFirst({
      where: { offerId: offer.id, reporterId, status: { in: ['PENDING', 'UNDER_REVIEW'] } },
      select: { id: true },
    });
    if (existing) {
      throw new AppError(409, 'OFFER_REPORT_ALREADY_PENDING', 'Ya tienes un reporte pendiente de revisión para esta publicación.');
    }
  }

  return prisma.offerReport.create({
    data: {
      offerId: offer.id,
      reporterId,
      reason: validated.reason,
      description: validated.description,
    },
    select: { id: true, status: true, createdAt: true },
  });
}

export async function listOfferReports(status: unknown, page: number, pageSize: number, kind: unknown = null, query: unknown = '') {
  if (status && (typeof status !== 'string' || !statuses.includes(status as OfferReportStatus))) {
    throw new AppError(400, 'INVALID_OFFER_REPORT_STATUS', 'Estado de reporte inválido.');
  }
  if (kind && kind !== 'PRODUCT' && kind !== 'SERVICE') {
    throw new AppError(400, 'INVALID_OFFER_REPORT_KIND', 'Tipo de publicación inválido.');
  }
  const safePage = Number.isFinite(page) ? Math.max(1, Math.min(100000, Math.trunc(page))) : 1;
  const safeSize = Number.isFinite(pageSize) ? Math.min(100, Math.max(1, Math.trunc(pageSize))) : 25;
  const q = typeof query === 'string' ? query.trim().slice(0, 100) : '';
  const where: Prisma.OfferReportWhereInput = {};
  if (status) where.status = status as OfferReportStatus;
  if (kind) where.offer = { kind: kind as OfferKind };
  if (q) where.OR = [
    { id: { contains: q } },
    { description: { contains: q } },
    { offer: { name: { contains: q } } },
    { offer: { business: { name: { contains: q } } } },
    { reporter: { displayName: { contains: q } } },
  ];
  const [reports, total, pendingTotal] = await prisma.$transaction([
    prisma.offerReport.findMany({
      where,
      skip: (safePage - 1) * safeSize,
      take: safeSize,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        offer: { select: { id: true, name: true, kind: true, business: { select: { id: true, name: true } } } },
        reporter: { select: { displayName: true } },
      },
    }),
    prisma.offerReport.count({ where }),
    prisma.offerReport.count({ where: { status: 'PENDING' } }),
  ]);
  return {
    reports,
    pagination: { page: safePage, pageSize: safeSize, total, totalPages: Math.ceil(total / safeSize) },
    pendingTotal,
  };
}
