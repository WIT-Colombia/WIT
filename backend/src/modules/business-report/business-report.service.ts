import { prisma } from '../../config/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';
import { notifyBusinessOwners, notifyPlatformUser, statusTitle } from '../notifications/platform-notifications.service.js';
import type { BusinessReportReason, BusinessReportStatus, Prisma } from '../../generated/prisma/client.js';

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

export async function listBusinessReports(status: unknown, page: number, pageSize: number, query: unknown = '') {
  if (status && (typeof status !== 'string' || !statuses.includes(status as BusinessReportStatus))) {
    throw new AppError(400, 'INVALID_BUSINESS_REPORT_STATUS', 'Estado de reporte inválido.');
  }
  const safePage = Number.isFinite(page) ? Math.max(1, Math.trunc(page)) : 1;
  const safeSize = Number.isFinite(pageSize) ? Math.min(100, Math.max(1, Math.trunc(pageSize))) : 25;
  const where: Prisma.BusinessReportWhereInput = status ? { status: status as BusinessReportStatus } : {};
  const q = typeof query === 'string' ? query.trim().slice(0, 100) : '';
  if (q) where.OR = [{ description: { contains: q } }, { business: { name: { contains: q } } }, { reporter: { displayName: { contains: q } } }];
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

export async function decideBusinessReport(adminId: string, id: string, rawStatus: unknown, rawNote: unknown) {
  if (typeof rawStatus !== 'string' || !statuses.includes(rawStatus as BusinessReportStatus))
    throw new AppError(400, 'INVALID_BUSINESS_REPORT_STATUS', 'Estado inválido.');
  if (rawNote != null && typeof rawNote !== 'string')
    throw new AppError(400, 'INVALID_DECISION_NOTE', 'La observación debe ser un texto.');
  const note = typeof rawNote === 'string' ? rawNote.trim() : '';
  if (note.length > 1500 || (['RESOLVED', 'REJECTED'].includes(rawStatus) && note.length < 10))
    throw new AppError(400, 'INVALID_DECISION_NOTE', 'Para resolver o rechazar, explica la decisión entre 10 y 1500 caracteres.');
  return prisma.$transaction(async tx => {
    const before = await tx.businessReport.findUnique({ where: { id } });
    if (!before) throw new AppError(404, 'BUSINESS_REPORT_NOT_FOUND', 'Reporte no encontrado.');
    if (before.status === rawStatus) throw new AppError(409, 'BUSINESS_REPORT_UNCHANGED', 'El reporte ya tiene ese estado.');
    if (['RESOLVED','REJECTED'].includes(before.status)) throw new AppError(409, 'BUSINESS_REPORT_ALREADY_CLOSED', 'Este reporte ya fue cerrado.');
    if (rawStatus === 'PENDING') throw new AppError(400, 'BUSINESS_REPORT_INVALID_TRANSITION', 'No se puede regresar a pendiente.');
    const report = await tx.businessReport.update({ where: { id }, data: { status: rawStatus as BusinessReportStatus, decisionNote: note || null } });
    await tx.auditLog.create({ data: {
      actorUserId: adminId, entityType: 'BUSINESS', entityId: before.businessId,
      action: 'BUSINESS_REPORT_MODERATED', previousState: { reportId: id, status: before.status },
      newState: { reportId: id, status: rawStatus }, reason: note || null,
    } });
    await notifyPlatformUser(tx, { userId: before.reporterId, sourceType: 'BUSINESS_REPORT', sourceId: id,
      title: 'Reporte sobre negocio: ' + statusTitle(rawStatus as typeof report.status),
      message: 'El reporte que presentaste sobre un negocio ahora está ' + statusTitle(rawStatus as typeof report.status).toLocaleLowerCase('es-CO') + '.' });
    if (rawStatus === 'RESOLVED') await notifyBusinessOwners(tx, before.businessId,
      'Revisión de un reporte concluida', 'Se concluyó la revisión de un reporte sobre tu negocio. No se incluyen datos personales de quien lo presentó.');
    return report;
  });
}
