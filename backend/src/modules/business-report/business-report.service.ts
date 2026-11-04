import { prisma } from '../../config/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';
import type { BusinessReportReason, BusinessReportStatus } from '../../generated/prisma/client.js';

const reasons: BusinessReportReason[] = ['IMPERSONATION','FALSE_INFORMATION','SUSPECTED_FRAUD','INAPPROPRIATE_CONTENT','OTHER'];
const statuses: BusinessReportStatus[] = ['PENDING','UNDER_REVIEW','RESOLVED','REJECTED'];

export async function submitBusinessReport(identifier: string, reporterId: string | null, reason: unknown, description: unknown) {
  if (typeof reason !== 'string' || !reasons.includes(reason as BusinessReportReason)) {
    throw new AppError(400, 'INVALID_BUSINESS_REPORT_REASON', 'Selecciona un motivo válido.');
  }
  if (typeof description !== 'string' || description.trim().length < 15 || description.trim().length > 1500) {
    throw new AppError(400, 'INVALID_BUSINESS_REPORT_DESCRIPTION', 'Describe el problema entre 15 y 1500 caracteres.');
  }
  const business = await prisma.business.findFirst({
    where: { OR: [{ id: identifier }, { publicId: identifier }], lifecycleStatus: 'ACTIVE', publicationStatus: 'PUBLISHED', deletionStatus: 'NONE' },
    select: { id: true },
  });
  if (!business) throw new AppError(404, 'BUSINESS_NOT_FOUND', 'No encontramos este negocio.');
  if (reporterId) {
    const existing = await prisma.businessReport.findFirst({
      where: { businessId: business.id, reporterId, status: { in: ['PENDING', 'UNDER_REVIEW'] } },
      select: { id: true },
    });
    if (existing) throw new AppError(409, 'BUSINESS_REPORT_ALREADY_PENDING', 'Ya tienes un reporte en revisión para este negocio.');
  }
  const row = await prisma.businessReport.create({
    data: { businessId: business.id, reporterId, reason: reason as BusinessReportReason, description: description.trim() },
    select: { id: true, status: true, createdAt: true },
  });
  return row;
}

export async function listBusinessReports(status: unknown, page: number, pageSize: number) {
  if (status && (typeof status !== 'string' || !statuses.includes(status as BusinessReportStatus))) {
    throw new AppError(400, 'INVALID_BUSINESS_REPORT_STATUS', 'Estado de reporte inválido.');
  }
  const safePage = Number.isFinite(page) ? Math.max(1, Math.trunc(page)) : 1;
  const safeSize = Number.isFinite(pageSize) ? Math.min(100, Math.max(1, Math.trunc(pageSize))) : 25;
  const where = status ? { status: status as BusinessReportStatus } : {};
  const [reports, total] = await prisma.$transaction([
    prisma.businessReport.findMany({
      where, skip: (safePage - 1) * safeSize, take: safeSize, orderBy: { createdAt: 'desc' },
      include: {
        business: { select: { id: true, publicId: true, name: true } },
        reporter: { select: { publicId: true, displayName: true } },
      },
    }),
    prisma.businessReport.count({ where }),
  ]);
  return { reports, pagination: { page: safePage, pageSize: safeSize, total, totalPages: Math.ceil(total / safeSize) } };
}
