import { createHash } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import { Prisma } from '../../generated/prisma/client.js';
import { AppError } from '../../shared/errors/app-error.js';
import type { AdminContext } from './admin-auth.service.js';
import { assertDocumentStorageReady, discardUnregisteredDocument, DOCUMENT_MAX_BYTES, readAdminDocument, saveAdminDocument } from './admin-document-storage.js';

export const documentSection = z.enum(['CORPORATE', 'LEGAL', 'CASES']);
const metadata = z.object({ section: documentSection, title: z.string().trim().min(3).max(160), description: z.string().trim().max(1000).optional().default('') });
const documentId = z.string().uuid();
const selection = { id: true, section: true, title: true, description: true, filename: true, mimeType: true, sizeBytes: true, createdAt: true, deletedAt: true, deletionReason: true, uploadedBy: { select: { displayName: true } } } as const;
export function assertDocumentAccess(context: AdminContext) {
  if (context.role !== 'SUPER_ADMIN' || !context.permissions.includes('ADMINS_MANAGE')) throw new AppError(403, 'ADMIN_PERMISSION_DENIED', 'El archivo documental está reservado a la administración principal.');
}
function validated<T>(result: z.ZodSafeParseResult<T>): T {
  if (!result.success) throw new AppError(400, 'INVALID_DOCUMENT_INPUT', 'Revisa el título, la sección y los datos del documento.');
  return result.data;
}
export async function listAdminDocuments(context: AdminContext, input: { section: unknown; q?: unknown; page?: unknown; trash?: unknown }) {
  assertDocumentAccess(context); assertDocumentStorageReady();
  const section = validated(documentSection.safeParse(input.section));
  const q = String(input.q ?? '').trim().slice(0, 100);
  const numericPage = Number(input.page);
  const page = Number.isFinite(numericPage) ? Math.max(1, Math.min(100000, Math.floor(numericPage))) : 1;
  const trash = input.trash === 'true';
  const where: Prisma.AdminDocumentWhereInput = { section, deletedAt: trash ? { not: null } : null, ...(q ? { OR: [{ title: { contains: q } }, { filename: { contains: q } }] } : {}) };
  const [total, documents, active, deleted, size] = await prisma.$transaction([
    prisma.adminDocument.count({ where }),
    prisma.adminDocument.findMany({ where, select: selection, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 12, skip: (page - 1) * 12 }),
    prisma.adminDocument.count({ where: { section, deletedAt: null } }),
    prisma.adminDocument.count({ where: { section, deletedAt: { not: null } } }),
    prisma.adminDocument.aggregate({ where: { section, deletedAt: null }, _sum: { sizeBytes: true } }),
  ]);
  return { documents, pagination: { page, pageSize: 12, total, totalPages: Math.ceil(total / 12) }, summary: { active, deleted, sizeBytes: size._sum.sizeBytes ?? 0 } };
}
export async function uploadAdminDocument(context: AdminContext, input: unknown, file?: { buffer: Buffer; mimetype: string; originalname: string }) {
  assertDocumentAccess(context);
  const data = validated(metadata.safeParse(input));
  if (!file || !file.buffer.length) throw new AppError(400, 'DOCUMENT_FILE_REQUIRED', 'Adjunta un archivo PDF.');
  if (file.buffer.length > DOCUMENT_MAX_BYTES) throw new AppError(413, 'DOCUMENT_TOO_LARGE', 'El PDF debe pesar máximo 10 MB.');
  if (file.mimetype !== 'application/pdf' || !file.originalname.toLowerCase().endsWith('.pdf') || file.buffer.subarray(0, 5).toString('ascii') !== '%PDF-' || !file.buffer.subarray(-1024).includes(Buffer.from('%%EOF'))) {
    throw new AppError(415, 'DOCUMENT_PDF_REQUIRED', 'El archivo debe ser un PDF válido.');
  }
  const filename = file.originalname.split(/[\\/]/).pop()!.replace(/[^\p{L}\p{N} ._()-]/gu, '_').slice(-180);
  const storageKey = await saveAdminDocument(file.buffer);
  try {
    return await prisma.$transaction(async tx => {
      const document = await tx.adminDocument.create({ data: { section: data.section, title: data.title, description: data.description || null, filename, mimeType: 'application/pdf', sizeBytes: file.buffer.length, sha256: createHash('sha256').update(file.buffer).digest('hex'), storageKey, uploadedById: context.userId }, select: selection });
      await tx.auditLog.create({ data: { actorUserId: context.userId, entityType: 'ADMIN_SECURITY', entityId: document.id, action: 'ADMIN_DOCUMENT_UPLOADED', newState: { section: data.section, title: data.title, sizeBytes: file.buffer.length } } });
      return document;
    });
  } catch (error) { await discardUnregisteredDocument(storageKey).catch(() => undefined); throw error; }
}
export async function adminDocumentContent(context: AdminContext, id: unknown) {
  assertDocumentAccess(context);
  const key = validated(documentId.safeParse(id));
  const document = await prisma.adminDocument.findFirst({ where: { id: key, deletedAt: null } });
  if (!document) throw new AppError(404, 'DOCUMENT_NOT_FOUND', 'El documento no está disponible.');
  try {
    const buffer = await readAdminDocument(document.storageKey);
    if (createHash('sha256').update(buffer).digest('hex') !== document.sha256) throw new AppError(409, 'DOCUMENT_INTEGRITY_FAILED', 'No se pudo verificar la integridad del archivo.');
    return { buffer, filename: document.filename };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(503, 'DOCUMENT_STORAGE_UNAVAILABLE', 'No se pudo recuperar el archivo privado. Inténtalo de nuevo.');
  }
}
export async function setAdminDocumentDeleted(context: AdminContext, id: unknown, deleted: boolean, reason: unknown) {
  assertDocumentAccess(context);
  const key = validated(documentId.safeParse(id));
  const note = typeof reason === 'string' ? reason.trim() : '';
  if (deleted && (note.length < 10 || note.length > 500)) throw new AppError(400, 'DOCUMENT_REASON_REQUIRED', 'Escribe un motivo de entre 10 y 500 caracteres.');
  return prisma.$transaction(async tx => {
    const changed = await tx.adminDocument.updateMany({ where: { id: key, deletedAt: deleted ? null : { not: null } }, data: { deletedAt: deleted ? new Date() : null, deletedById: deleted ? context.userId : null, deletionReason: deleted ? note : null } });
    if (!changed.count) throw new AppError(409, 'DOCUMENT_STATE_CHANGED', 'El documento ya cambió de estado. Actualiza la lista.');
    await tx.auditLog.create({ data: { actorUserId: context.userId, entityType: 'ADMIN_SECURITY', entityId: key, action: deleted ? 'ADMIN_DOCUMENT_TRASHED' : 'ADMIN_DOCUMENT_RESTORED', reason: deleted ? note : 'Restauración desde la papelera' } });
    return { id: key, deleted };
  });
}
