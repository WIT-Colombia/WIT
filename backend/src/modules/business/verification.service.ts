import { createHash, randomUUID } from 'node:crypto';
import { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';
import { notifyBusinessOwners, notifyPlatformUser } from '../notifications/platform-notifications.service.js';
import { removeVerificationPdf, saveVerificationPdf, VERIFICATION_MAX_BYTES, VERIFICATION_MIME, verificationStoragePath } from './verification-storage.js';

const permission = (membership: any) => membership.role === 'OWNER' || membership.permissions.some((p: any) => p.permission === 'EDIT_BUSINESS');
async function access(userId: string, businessId: string) {
  const business = await prisma.business.findFirst({ where: { id: businessId, deletionStatus: { not: 'DELETED' }, memberships: { some: { userId, status: 'ACTIVE' } } }, select: { id: true, name: true, verificationStatus: true, memberships: { where: { userId, status: 'ACTIVE' }, select: { role: true, permissions: { where: { allowed: true }, select: { permission: true } } } } } });
  if (!business || !permission(business.memberships[0])) throw new AppError(403, 'BUSINESS_VERIFICATION_FORBIDDEN', 'No tienes permisos para solicitar la verificación.');
  return business;
}
function assertPdf(file: { buffer: Buffer; mimetype: string; size: number } | undefined) {
  if (!file) throw new AppError(400, 'VERIFICATION_DOCUMENT_REQUIRED', 'Adjunta un documento PDF.');
  if (file.size > VERIFICATION_MAX_BYTES) throw new AppError(422, 'VERIFICATION_DOCUMENT_TOO_LARGE', 'El PDF puede pesar máximo 10 MB.');
  if (file.mimetype !== VERIFICATION_MIME || file.buffer.subarray(0, 5).toString() !== '%PDF-') throw new AppError(422, 'VERIFICATION_DOCUMENT_INVALID', 'El archivo debe ser un PDF válido.');
}
function clean(row: any) { return { id: row.id, businessId: row.businessId, status: row.status, businessNameAtRequest: row.businessNameAtRequest, documentType: row.documentType, documentSizeBytes: row.documentSizeBytes, documentDeletionStatus: row.documentDeletionStatus, requestedAt: row.requestedAt, updatedAt: row.updatedAt, resolvedAt: row.resolvedAt, decisions: row.decisions?.map((d: any) => ({ id: d.id, action: d.action, reason: d.reason, createdAt: d.createdAt, admin: d.admin ? { displayName: d.admin.displayName } : undefined })) };
}
export async function getVerification(userId: string, businessId: string) { await access(userId, businessId); const row = await prisma.businessVerificationRequest.findFirst({ where: { businessId }, orderBy: { requestedAt: 'desc' }, include: { decisions: { orderBy: { createdAt: 'asc' }, include: { admin: { select: { displayName: true } } } } } }); return row ? clean(row) : { businessId, status: 'NONE' }; }
export async function submitVerification(userId: string, businessId: string, file: { buffer: Buffer; mimetype: string; size: number }) {
  const business = await access(userId, businessId); assertPdf(file);
  const active = await prisma.businessVerificationRequest.findFirst({ where: { businessId, activeKey: { not: null } } });
  if (active) throw new AppError(409, 'VERIFICATION_REQUEST_ACTIVE', 'Ya existe una solicitud de verificación abierta.');
  const stored = await saveVerificationPdf(businessId, file.buffer); const hash = createHash('sha256').update(file.buffer).digest('hex'); const activeKey = randomUUID();
  try { return await prisma.$transaction(async tx => { const request = await tx.businessVerificationRequest.create({ data: { businessId, requesterId: userId, status: 'PENDING', businessNameAtRequest: business.name, documentType: 'PDF', documentSizeBytes: file.size, documentSha256: hash, documentStorageKey: stored.key, activeKey } }); await tx.business.update({ where: { id: businessId }, data: { verificationStatus: 'PENDING' } }); await tx.businessNotification.create({ data: { userId, businessId, type: 'COLLABORATION_UPDATE', title: 'Solicitud de verificación recibida', message: 'Recibimos la documentación de tu negocio y la revisaremos.' } }); return clean(request); }); }
  catch (error) { await removeVerificationPdf(stored.key).catch(() => undefined); if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new AppError(409, 'VERIFICATION_REQUEST_ACTIVE', 'Ya existe una solicitud de verificación abierta.'); throw error; }
}
export async function replaceVerification(userId: string, businessId: string, file: { buffer: Buffer; mimetype: string; size: number }) { const row = await prisma.businessVerificationRequest.findFirst({ where: { businessId, activeKey: { not: null }, status: 'INFORMATION' } }); if (!row) throw new AppError(409, 'VERIFICATION_REPLACEMENT_UNAVAILABLE', 'La solicitud no está pendiente de información.'); await submitVerificationReplacement(userId, businessId, row.id, file); return getVerification(userId, businessId); }
async function submitVerificationReplacement(userId: string, businessId: string, id: string, file: { buffer: Buffer; mimetype: string; size: number }) { const business = await access(userId, businessId); assertPdf(file); const stored = await saveVerificationPdf(businessId, file.buffer); const hash = createHash('sha256').update(file.buffer).digest('hex'); const activeKey = randomUUID(); try { await prisma.$transaction(async tx => { await tx.businessVerificationRequest.update({ where: { id }, data: { businessNameAtRequest: business.name, documentType: 'PDF', documentSizeBytes: file.size, documentSha256: hash, documentStorageKey: stored.key, documentDeletionStatus: 'ACTIVE', status: 'PENDING', activeKey, resolvedAt: null } }); await tx.business.update({ where: { id: businessId }, data: { verificationStatus: 'PENDING' } }); }); } catch (error) { await removeVerificationPdf(stored.key).catch(() => undefined); throw error; } }
export async function listVerificationRequests(_context: any) { const rows = await prisma.businessVerificationRequest.findMany({ where: { status: { in: ['PENDING', 'INFORMATION'] } }, orderBy: { requestedAt: 'asc' }, include: { business: { select: { id: true, publicId: true, name: true, createdBy: { select: { displayName: true, emailNormalized: true } } } }, requester: { select: { displayName: true, emailNormalized: true } }, decisions: { orderBy: { createdAt: 'asc' }, include: { admin: { select: { displayName: true } } } } } }); return rows.map(row => ({ ...clean(row), business: row.business, requester: row.requester })); }
export async function verificationDocument(_context: any, requestId: string) { const row = await prisma.businessVerificationRequest.findUnique({ where: { id: requestId }, select: { documentStorageKey: true, documentType: true } }); if (!row) throw new AppError(404, 'VERIFICATION_NOT_FOUND', 'No encontramos la solicitud.'); return { path: verificationStoragePath(row.documentStorageKey), mimeType: row.documentType === 'PDF' ? VERIFICATION_MIME : 'application/octet-stream' }; }
export async function decideVerification(
  context: { userId: string }, requestId: string,
  action: 'APPROVE' | 'REQUEST_INFORMATION' | 'REJECT', reason: string, nameConfirmed = false,
) {
  if (action === 'APPROVE' && !nameConfirmed)
    throw new AppError(422, 'VERIFICATION_NAME_NOT_CONFIRMED', 'Confirma que el nombre comercial coincide antes de aprobar.');
  const note = reason.trim();
  if (note.length < 10 || note.length > 1000)
    throw new AppError(400, 'VERIFICATION_REASON_REQUIRED', 'Explica la decisión entre 10 y 1000 caracteres.');
  const row = await prisma.businessVerificationRequest.findUnique({ where: { id: requestId } });
  if (!row || !row.activeKey || !['PENDING','INFORMATION'].includes(row.status))
    throw new AppError(409, 'VERIFICATION_ALREADY_RESOLVED', 'La solicitud ya no está abierta.');
  if (action === 'REQUEST_INFORMATION' && row.status === 'INFORMATION')
    throw new AppError(409, 'VERIFICATION_ALREADY_WAITING', 'Esta solicitud ya está esperando información.');
  const status = action === 'APPROVE' ? 'APPROVED' : action === 'REJECT' ? 'REJECTED' : 'INFORMATION';
  const final = action !== 'REQUEST_INFORMATION';
  const updated = await prisma.$transaction(async tx => {
    const current = await tx.businessVerificationRequest.findUnique({ where: { id: requestId }, select: { activeKey: true, status: true } });
    if (!current?.activeKey || !['PENDING','INFORMATION'].includes(current.status))
      throw new AppError(409, 'VERIFICATION_ALREADY_RESOLVED', 'La solicitud ya fue atendida.');
    const next = await tx.businessVerificationRequest.update({
      where: { id: requestId }, data: {
        status, resolvedAt: final ? new Date() : null, activeKey: final ? null : current.activeKey,
        documentDeletionStatus: final ? 'PENDING' : row.documentDeletionStatus,
      },
    });
    await tx.businessVerificationDecision.create({
      data: { requestId, adminId: context.userId, action, reason: note },
    });
    await tx.business.update({ where: { id: row.businessId }, data: { verificationStatus: status } });
    const title = action === 'APPROVE' ? 'Negocio verificado' : action === 'REJECT'
      ? 'Solicitud de verificación rechazada' : 'Información adicional requerida';
    const message = action === 'APPROVE'
      ? 'Tu negocio fue verificado. Ya puedes consultar el estado actualizado en XAMUKO Business.'
      : action === 'REJECT'
        ? 'La solicitud de verificación fue rechazada. Consulta el motivo en el historial de verificación de tu negocio.'
        : 'Necesitamos información adicional para verificar tu negocio. Consulta el historial y adjunta la documentación requerida.';
    await tx.businessNotification.create({
      data: { userId: row.requesterId, businessId: row.businessId,
        type: 'COLLABORATION_UPDATE', title, message },
    });
    await notifyPlatformUser(tx, {
      userId: row.requesterId, sourceType: 'VERIFICATION', sourceId: requestId, title, message,
    });
    await notifyBusinessOwners(tx, row.businessId, title, message, row.requesterId);
    return next;
  });
  if (final) {
    try {
      await removeVerificationPdf(row.documentStorageKey);
      await prisma.businessVerificationRequest.update({ where: { id: requestId }, data: { documentDeletionStatus: 'DELETED' } });
    } catch {
      await prisma.businessVerificationRequest.update({ where: { id: requestId }, data: { documentDeletionStatus: 'FAILED' } });
    }
  }
  return clean(updated);
}
