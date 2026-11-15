import { Prisma, type SupportRequestKind, type SupportRequestStatus } from '../../generated/prisma/client.js';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';
import { notifyBusinessOwners, notifyPlatformUser, statusTitle } from '../notifications/platform-notifications.service.js';

const kinds: SupportRequestKind[] = ['NEED', 'SUPPORT', 'SUGGESTION'];
const statuses: SupportRequestStatus[] = ['PENDING', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED'];
const required = (value: unknown, name: string, min: number, max: number) => {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max)
    throw new AppError(400, 'INVALID_SUPPORT_REQUEST', `${name} debe tener entre ${min} y ${max} caracteres.`);
  return value.trim();
};
const optional = (value: unknown, max: number) => {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || value.trim().length > max)
    throw new AppError(400, 'INVALID_SUPPORT_REQUEST', 'La información enviada es inválida.');
  return value.trim() || null;
};

export async function submitNeed(userId: string | null, body: Record<string, unknown>) {
  const title = required(body.title, 'La necesidad', 2, 90);
  const category = required(body.category, 'La categoría', 2, 120);
  const description = optional(body.description, 320);
  const locationName = optional(body.locationName, 240);
  const locationContext = optional(body.locationContext, 240);
  return prisma.supportRequest.create({
    data: { kind: 'NEED', userId, title, category, description, locationName, locationContext },
    select: { id: true, kind: true, status: true, createdAt: true },
  });
}

export async function submitBusinessRequest(userId: string, body: Record<string, unknown>) {
  const kind = body.kind;
  if (kind !== 'SUPPORT' && kind !== 'SUGGESTION')
    throw new AppError(400, 'INVALID_SUPPORT_REQUEST_KIND', 'Selecciona una solicitud válida.');
  const category = required(body.category, 'El tema', 2, 120);
  const title = required(body.title || (kind === 'SUPPORT' ? 'Solicitud de soporte' : 'Sugerencia'), 'El asunto', 2, 120);
  const description = required(body.description, 'La descripción', 10, 2000);
  const businessId = optional(body.businessId, 36);
  if (businessId) {
    const membership = await prisma.businessMembership.findFirst({
      where: { businessId, userId, status: 'ACTIVE' }, select: { id: true },
    });
    if (!membership) throw new AppError(403, 'BUSINESS_ACCESS_DENIED', 'No tienes acceso al negocio indicado.');
  }
  return prisma.supportRequest.create({
    data: { kind, userId, businessId, title, category, description },
    select: { id: true, kind: true, status: true, createdAt: true },
  });
}

export async function listSupportRequests(rawKind: unknown, rawStatus: unknown, rawPage: unknown, rawQuery: unknown) {
  if (typeof rawKind !== 'string' || !kinds.includes(rawKind as SupportRequestKind))
    throw new AppError(400, 'INVALID_SUPPORT_REQUEST_KIND', 'Tipo de solicitud inválido.');
  if (rawStatus && (typeof rawStatus !== 'string' || !statuses.includes(rawStatus as SupportRequestStatus)))
    throw new AppError(400, 'INVALID_SUPPORT_REQUEST_STATUS', 'Estado inválido.');
  const kind = rawKind as SupportRequestKind;
  const status = rawStatus as SupportRequestStatus | undefined;
  const rawNumber = Number(rawPage);
  const page = Number.isFinite(rawNumber) ? Math.min(100000, Math.max(1, Math.floor(rawNumber))) : 1;
  const q = typeof rawQuery === 'string' ? rawQuery.trim().slice(0, 100) : '';
  const where: Prisma.SupportRequestWhereInput = { kind };
  if (status) where.status = status;
  if (q) where.OR = [
    { title: { contains: q } },
    { category: { contains: q } },
    { description: { contains: q } },
    { sender: { displayName: { contains: q } } },
    { business: { name: { contains: q } } },
  ];
  const pageSize = 25;
  const [requests, total] = await prisma.$transaction([
    prisma.supportRequest.findMany({
      where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * pageSize, take: pageSize,
      include: {
        sender: { select: { displayName: true, publicId: true } },
        business: { select: { id: true, name: true } },
        reviewer: { select: { displayName: true } },
      },
    }),
    prisma.supportRequest.count({ where }),
  ]);
  return { requests, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
}

export async function decideSupportRequest(adminId: string, id: string, rawStatus: unknown, rawNote: unknown) {
  if (typeof rawStatus !== 'string' || !statuses.includes(rawStatus as SupportRequestStatus))
    throw new AppError(400, 'INVALID_SUPPORT_REQUEST_STATUS', 'Estado inválido.');
  const status = rawStatus as SupportRequestStatus;
  const decisionNote = optional(rawNote, 1500);
  if ((status === 'RESOLVED' || status === 'REJECTED') && (!decisionNote || decisionNote.length < 10))
    throw new AppError(400, 'SUPPORT_DECISION_NOTE_REQUIRED', 'Explica la decisión con al menos 10 caracteres.');
  return prisma.$transaction(async tx => {
    const before = await tx.supportRequest.findUnique({ where: { id }, select: { id: true, kind: true, status: true, userId: true, businessId: true, title: true } });
    if (!before) throw new AppError(404, 'SUPPORT_REQUEST_NOT_FOUND', 'Solicitud no encontrada.');
    if (before.status === status) throw new AppError(409, 'SUPPORT_REQUEST_UNCHANGED', 'La solicitud ya tiene ese estado.');
    if (['RESOLVED', 'REJECTED'].includes(before.status)) throw new AppError(409, 'SUPPORT_REQUEST_ALREADY_CLOSED', 'Esta solicitud ya fue cerrada.');
    if (status === 'PENDING') throw new AppError(400, 'SUPPORT_REQUEST_INVALID_TRANSITION', 'No se puede regresar una solicitud a pendiente.');
    const result = await tx.supportRequest.update({
      where: { id }, data: { status, decisionNote, reviewedById: adminId, reviewedAt: new Date() },
    });
    await tx.auditLog.create({
      data: {
        actorUserId: adminId, entityType: before.kind === 'NEED' ? 'USER' : 'BUSINESS',
        entityId: id, action: 'SUPPORT_REQUEST_STATUS_CHANGED',
        previousState: { status: before.status },
        newState: { status }, reason: decisionNote,
      },
    });
    const type = before.kind === 'NEED' ? 'Necesidad registrada' : before.kind === 'SUPPORT' ? 'Solicitud de soporte' : 'Sugerencia';
    const subject = 'Tu solicitud «' + before.title.slice(0, 100) + '» está ' + statusTitle(status).toLocaleLowerCase('es-CO') + '.';
    // The applicant sees the actual response. Never forward a report's private administrative
    // notes to the potentially reported business; this branch concerns the applicant's own request.
    const response = decisionNote ? ' Respuesta de XAMUKO: ' + decisionNote.slice(0, 320) : '';
    await notifyPlatformUser(tx, { userId: before.userId, sourceType: 'SUPPORT_REQUEST', sourceId: id,
      title: type + ': ' + statusTitle(status), message: subject + response });
    if (before.businessId) await notifyBusinessOwners(tx, before.businessId, type + ': ' + statusTitle(status),
      'Solicitud «' + before.title.slice(0, 90) + '»: ' + statusTitle(status) + '.' +
      (decisionNote ? ' Respuesta administrativa: ' + decisionNote.slice(0, 280) : ''));
    return result;
  });
}
