import { Prisma, type BusinessReviewReportReason, type BusinessReviewReportStatus, type BusinessReviewModerationStatus } from '../../generated/prisma/client.js';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';

const REVIEW_EDIT_WINDOW_MS = 12 * 60 * 60 * 1000;
const REVIEW_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

const publicBusinessWhere = { businessAccount: { status: 'ACTIVE' }, lifecycleStatus: 'ACTIVE', publicationStatus: 'PUBLISHED', visibilityStatus: 'VISIBLE', deletionStatus: 'NONE' } as const;

async function business(identifier: string, publicOnly = false) {
  const row = await prisma.business.findFirst({ where: { OR: [{ id: identifier }, { publicId: identifier }], ...(publicOnly ? publicBusinessWhere : {}) }, select: { id: true, publicId: true, name: true } });
  if (!row) throw new AppError(404, 'BUSINESS_NOT_FOUND', 'No encontramos ese establecimiento.');
  return row;
}

async function review(id: string) {
  const row = await prisma.businessReview.findUnique({ where: { id }, include: { business: { select: { id: true, publicId: true } } } });
  if (!row) throw new AppError(404, 'REVIEW_NOT_FOUND', 'No encontramos esa opinión.');
  return row;
}

function publicReview(row: any) { return { id: row.id, businessId: row.business.publicId, userId: row.user.publicId, author: row.user.displayName, rating: row.rating, comment: row.comment, createdAt: row.createdAt, updatedAt: row.updatedAt, response: row.response ? { body: row.response.body, createdAt: row.response.createdAt, updatedAt: row.response.updatedAt } : null }; }

export async function listReviews(identifier: string, page = 1, pageSize = 20) {
  const b = await business(identifier, true); const size = Math.min(Math.max(pageSize, 1), 50); const skip = (Math.max(page, 1) - 1) * size;
  const where = { businessId: b.id, status: 'PUBLISHED' as BusinessReviewModerationStatus };
  const [rows, total, aggregate, groups] = await Promise.all([
    prisma.businessReview.findMany({ where, skip, take: size, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], include: { user: { select: { publicId: true, displayName: true } }, business: { select: { publicId: true } }, response: true } }),
    prisma.businessReview.count({ where }), prisma.businessReview.aggregate({ where, _avg: { rating: true } }), prisma.businessReview.groupBy({ by: ['rating'], where, _count: { _all: true } }),
  ]);
  const distribution = Object.fromEntries([1,2,3,4,5].map(r => [r, groups.find(g => g.rating === r)?._count._all ?? 0]));
  return { businessId: b.publicId, reviews: rows.map(publicReview), pagination: { page: Math.max(page, 1), pageSize: size, total, totalPages: Math.ceil(total / size) }, summary: { average: aggregate._avg.rating ?? null, total, distribution } };
}

export async function listMyReviews(userId: string, page = 1, pageSize = 20) {
  const size = Math.min(Math.max(pageSize, 1), 50); const safePage = Math.max(page, 1); const where = { userId, status: 'PUBLISHED' as BusinessReviewModerationStatus };
  const [rows, total] = await Promise.all([prisma.businessReview.findMany({ where, skip: (safePage - 1) * size, take: size, orderBy: { createdAt: 'desc' }, include: { user: { select: { publicId: true, displayName: true } }, business: { select: { publicId: true, name: true } }, response: true } }), prisma.businessReview.count({ where })]);
  return { reviews: rows.map(row => ({ ...publicReview({ ...row, business: { publicId: row.business.publicId }, user: row.user }), businessName: row.business.name })), pagination: { page: safePage, pageSize: size, total, totalPages: Math.ceil(total / size) } };
}

export async function createReview(userId: string, identifier: string, rating: number, comment: string) {
  const b = await business(identifier, true); const clean = comment.trim();
  if (rating < 1 || rating > 5 || !Number.isInteger(rating)) throw new AppError(400, 'INVALID_RATING', 'La calificación debe estar entre 1 y 5.');
  if (!clean || clean.length > 2000) throw new AppError(400, 'INVALID_COMMENT', 'La opinión debe tener entre 1 y 2000 caracteres.');
  try {
    return await prisma.$transaction(async tx => {
      const cooldown = await tx.businessReviewCooldown.findUnique({ where: { businessId_userId: { businessId: b.id, userId } } });
      if (cooldown) {
        const elapsed = Date.now() - cooldown.lastPublishedAt.getTime();
        if (elapsed < REVIEW_COOLDOWN_MS) {
          const availableAt = new Date(cooldown.lastPublishedAt.getTime() + REVIEW_COOLDOWN_MS);
          throw new AppError(409, 'REVIEW_COOLDOWN_ACTIVE', `Podrás volver a opinar el ${availableAt.toLocaleDateString('es-CO')}.`, { availableAt: availableAt.toISOString() });
        }
      }
      const row = await tx.businessReview.create({ data: { businessId: b.id, userId, rating, comment: clean }, include: { user: { select: { publicId: true, displayName: true } }, business: { select: { publicId: true } }, response: true } });
      await tx.businessReviewCooldown.upsert({ where: { businessId_userId: { businessId: b.id, userId } }, create: { businessId: b.id, userId, lastPublishedAt: row.createdAt }, update: { lastPublishedAt: row.createdAt } });
      return publicReview(row);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && (e.code === 'P2034' || e.code === 'P2002')) throw new AppError(409, 'REVIEW_COOLDOWN_ACTIVE', 'Ya existe una ventana de espera activa para este negocio.');
    throw e;
  }
}

function withinUserWindow(createdAt: Date): boolean { return Date.now() - createdAt.getTime() <= REVIEW_EDIT_WINDOW_MS; }
export async function updateReview(userId: string, id: string, rating: number, comment: string) { const r = await review(id); if (r.userId !== userId) throw new AppError(403, 'REVIEW_FORBIDDEN', 'Solo puedes editar tus opiniones.'); if (r.status !== 'PUBLISHED') throw new AppError(409, 'REVIEW_NOT_EDITABLE', 'Esta opinión no está disponible para edición.'); if (!withinUserWindow(r.createdAt)) throw new AppError(409, 'REVIEW_EDIT_WINDOW_EXPIRED', 'La ventana de edición de esta opinión venció después de 24 horas.'); const clean = comment.trim(); if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new AppError(400, 'INVALID_RATING', 'La calificación debe estar entre 1 y 5.'); if (!clean || clean.length > 2000) throw new AppError(400, 'INVALID_COMMENT', 'La opinión debe tener entre 1 y 2000 caracteres.'); const row = await prisma.businessReview.update({ where: { id }, data: { rating, comment: clean }, include: { user: { select: { publicId: true, displayName: true } }, business: { select: { publicId: true } }, response: true } }); return publicReview(row); }
export async function deleteReview(userId: string, id: string) { const r = await review(id); if (r.userId !== userId) throw new AppError(403, 'REVIEW_FORBIDDEN', 'Solo puedes eliminar tus opiniones.'); if (!withinUserWindow(r.createdAt)) throw new AppError(409, 'REVIEW_DELETE_WINDOW_EXPIRED', 'Esta opinión es definitiva después de 24 horas y ya no puede eliminarse.'); await prisma.businessReview.update({ where: { id }, data: { status: 'REMOVED_BY_AUTHOR' } }); return { deleted: true, id }; }

async function assertOwner(userId: string, reviewId: string) { const r = await review(reviewId); const owned = await prisma.businessMembership.count({ where: { businessId: r.businessId, userId, status: 'ACTIVE', role: 'OWNER' } }); if (!owned) throw new AppError(403, 'BUSINESS_REVIEW_FORBIDDEN', 'No tienes autorización sobre este negocio.'); return r; }
export async function upsertResponse(userId: string, reviewId: string, body: string) { const r = await assertOwner(userId, reviewId); const clean = body.trim(); if (!clean || clean.length > 2000) throw new AppError(400, 'INVALID_RESPONSE', 'La respuesta debe tener entre 1 y 2000 caracteres.'); const existing = await prisma.businessReviewResponse.findUnique({ where: { reviewId: r.id } }); if (existing && !withinUserWindow(existing.createdAt)) throw new AppError(409, 'RESPONSE_EDIT_WINDOW_EXPIRED', 'La ventana de edición de la respuesta venció después de 12 horas.'); return existing ? prisma.businessReviewResponse.update({ where: { reviewId: r.id }, data: { body: clean } }) : prisma.businessReviewResponse.create({ data: { reviewId: r.id, ownerId: userId, body: clean } }); }
export async function reportReview(userId: string, reviewId: string, reason: BusinessReviewReportReason, description?: string) { await review(reviewId); if (!['OFFENSIVE','SPAM','FALSE_INFORMATION','PERSONAL_DATA','OTHER'].includes(reason)) throw new AppError(400, 'INVALID_REPORT_REASON', 'Motivo de reporte inválido.'); const clean = description?.trim() || ''; if (clean.length > 1000 || (reason === 'OTHER' && !clean)) throw new AppError(400, 'INVALID_REPORT_DESCRIPTION', 'La descripción es obligatoria para este motivo y no puede superar 1000 caracteres.'); const existing = await prisma.businessReviewReport.findFirst({ where: { reviewId, reporterId: userId, status: 'PENDING' } }); if (existing) throw new AppError(409, 'REPORT_ALREADY_PENDING', 'Ya existe un reporte pendiente para esta opinión.'); return prisma.businessReviewReport.create({ data: { reviewId, reporterId: userId, reason, description: clean || null } }); }
export async function listAdminReviews(page = 1, pageSize = 20) {
  const safePage = Math.max(1, page); const size = Math.min(100, Math.max(1, pageSize));
  const [rows, total] = await prisma.$transaction([
    prisma.businessReview.findMany({ orderBy: { createdAt: 'desc' }, skip: (safePage - 1) * size, take: size, include: { business: { select: { publicId: true, name: true } }, user: { select: { publicId: true, displayName: true } }, response: true, reports: { select: { id: true, status: true, reason: true } } } }),
    prisma.businessReview.count(),
  ]);
  return { reviews: rows, pagination: { page: safePage, pageSize: size, total, totalPages: Math.ceil(total / size) } };
}

export async function listReports(status?: BusinessReviewReportStatus) { return prisma.businessReviewReport.findMany({ where: status ? { status } : undefined, orderBy: { createdAt: 'desc' }, include: { review: { include: { business: { select: { id: true, publicId: true, name: true } }, user: { select: { publicId: true, displayName: true } } } }, reporter: { select: { publicId: true, displayName: true } }, moderator: { select: { publicId: true, displayName: true } } } }); }
export async function moderateReport(adminId: string, id: string, status: BusinessReviewReportStatus, decisionNote?: string, requestedReviewStatus?: BusinessReviewModerationStatus) { const row = await prisma.businessReviewReport.findUnique({ where: { id } }); if (!row) throw new AppError(404, 'REPORT_NOT_FOUND', 'No encontramos ese reporte.'); if (!['PENDING','UNDER_REVIEW','RESOLVED','REJECTED'].includes(status)) throw new AppError(400, 'INVALID_REPORT_STATUS', 'Estado de reporte inválido.'); const note = decisionNote?.trim() || null; if (note && note.length > 1000) throw new AppError(400, 'INVALID_DECISION_NOTE', 'La justificación no puede superar 1000 caracteres.'); return prisma.$transaction(async tx => { const report = await tx.businessReviewReport.update({ where: { id }, data: { status, moderatorId: adminId, decisionNote: note } }); let reviewStatus: string | undefined; const normalized = note?.toLowerCase() ?? ''; if (requestedReviewStatus) reviewStatus = requestedReviewStatus; else if (status === 'RESOLVED' && normalized.includes('retirar')) reviewStatus = 'REMOVED'; else if (status === 'RESOLVED' && normalized.includes('ocultar')) reviewStatus = 'HIDDEN'; else if (status === 'RESOLVED' && normalized.includes('restablecer')) reviewStatus = 'PUBLISHED'; if (reviewStatus) await tx.businessReview.update({ where: { id: row.reviewId }, data: { status: reviewStatus as BusinessReviewModerationStatus } }); await tx.auditLog.create({ data: { actorUserId: adminId, entityType: 'BUSINESS', entityId: row.reviewId, action: `REVIEW_REPORT_${status}`, previousState: { reportStatus: row.status }, newState: { reportStatus: status, reviewStatus: reviewStatus ?? 'UNCHANGED' }, reason: note } }); return report; }); }
