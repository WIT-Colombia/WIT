import { prisma } from '../../config/prisma.js';
import { Prisma, type PrismaClient } from '../../generated/prisma/client.js';
import { AppError } from '../../shared/errors/app-error.js';
import type { ContactInput, CreateModalityInput, HoursInput } from './modality.schemas.js';

type Db = PrismaClient | Prisma.TransactionClient;
type RequestMeta = { ipAddress?: string };
const permission = {
  edit: 'EDIT_BUSINESS' as const,
  hours: 'MANAGE_HOURS' as const,
  publication: 'CHANGE_PUBLICATION' as const,
};

const modalityInclude = { contact: true, hours: { orderBy: { dayOfWeek: 'asc' as const } }, business: { select: { email: true, website: true, instagram: true, phone: true, whatsapp: true, location: true } } } as const;
const MAX_SERIALIZABLE_RETRIES = 3;
const modalityLifecycleActions = ['BUSINESS_MODALITY_CREATED', 'BUSINESS_MODALITY_ACTIVATED', 'BUSINESS_MODALITY_PAUSED', 'BUSINESS_MODALITY_REACTIVATED', 'BUSINESS_MODALITY_RETIRED'] as const;

const contactValue = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : null;

function serialize(modality: any) {
  const general = modality.business ?? {};
  const effectiveContact = { email: contactValue(general.email), website: contactValue(general.website), phone: contactValue(general.phone), whatsapp: contactValue(general.whatsapp), instagram: contactValue(general.instagram) };
  return { id: modality.id, businessId: modality.businessId, type: modality.type, status: modality.status, createdAt: modality.createdAt, updatedAt: modality.updatedAt, contact: modality.contact ?? null, effectiveContact, blockers: activationBlockers(modality), hours: modality.hours ?? [] };
}

async function getMembership(userId: string, businessId: string, db: Db) {
  const membership = await db.businessMembership.findUnique({ where: { businessId_userId: { businessId, userId } }, include: { permissions: true } });
  if (!membership || membership.status !== 'ACTIVE') throw new AppError(403, 'BUSINESS_ACCESS_DENIED', 'No tienes acceso a este negocio.');
  return membership;
}

async function requirePermission(userId: string, businessId: string, code: typeof permission[keyof typeof permission], db: Db) {
  const membership = await getMembership(userId, businessId, db);
  const allowed = membership.role === 'OWNER' || membership.permissions.some((item) => item.permission === code && item.allowed);
  if (!allowed) throw new AppError(403, 'BUSINESS_PERMISSION_DENIED', 'No tienes permisos para realizar esta operación.');
  return membership;
}

async function getModality(modalityId: string, businessId: string, db: Db) {
  const modality = await db.businessModality.findUnique({ where: { id: modalityId }, include: modalityInclude });
  if (!modality || modality.businessId !== businessId) throw new AppError(404, 'MODALITY_NOT_FOUND', 'Modalidad no encontrada.');
  return modality;
}

async function latestLifecycleAction(db: Db, businessId: string, modalityId: string) {
  const audits = await db.auditLog.findMany({ where: { entityType: 'BUSINESS', entityId: businessId, action: { in: [...modalityLifecycleActions] } }, orderBy: { createdAt: 'desc' } });
  return audits.find((entry) => {
    const state = entry.newState && typeof entry.newState === 'object' ? entry.newState as { modalityId?: unknown } : null;
    return state?.modalityId === modalityId;
  })?.action ?? null;
}

async function audit(db: Db, userId: string, businessId: string, action: string, previousState: unknown, newState: unknown, meta?: RequestMeta) {
  await db.auditLog.create({ data: { actorUserId: userId, entityType: 'BUSINESS', entityId: businessId, action, previousState: previousState === null ? Prisma.JsonNull : previousState as Prisma.InputJsonValue, newState: newState === null ? Prisma.JsonNull : newState as Prisma.InputJsonValue, ipAddress: meta?.ipAddress ?? null } });
}

function transition(status: string, target: 'ACTIVE' | 'PAUSED' | 'CONFIGURING') {
  if (target === 'CONFIGURING') return status === 'CONFIGURING' ? false : true;
  if (target === 'PAUSED') return status === 'ACTIVE';
  return status === 'CONFIGURING' || status === 'PAUSED';
}

function activationBlockers(modality: any): string[] {
  const business = modality.business ?? {};
  const contact = { email: contactValue(business.email), website: contactValue(business.website), phone: contactValue(business.phone), whatsapp: contactValue(business.whatsapp), instagram: contactValue(business.instagram) };
  if (modality.type === 'VIRTUAL') {
    const blockers: string[] = [];
    if (!contact.website && !contact.instagram && !contact.whatsapp) blockers.push('Para activar la atención virtual, agrega WhatsApp, un sitio web o Instagram.');
    return blockers;
  }
  if (modality.type === 'DELIVERY') {
    const blockers: string[] = [];
    if (!business.location?.cityName?.trim()) blockers.push('Agrega la ciudad o municipio donde prestas el servicio.');
    if (!contact.email && !contact.phone && !contact.whatsapp && !contact.website && !contact.instagram) blockers.push('La modalidad a domicilio requiere al menos un canal de contacto.');
    return blockers;
  }
  const location = modality.business.location;
  const blockers: string[] = [];
  if (!location || location.visibility !== 'PUBLIC' || !location.address?.trim()) blockers.push('La ubicación física debe existir, tener dirección y ser pública.');
  return blockers;
}

export const modalityRules = { transition, activationBlockers };

async function serializableTransaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < MAX_SERIALIZABLE_RETRIES; attempt += 1) {
    try {
      return await prisma.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2034' || attempt === MAX_SERIALIZABLE_RETRIES - 1) throw error;
    }
  }
  throw new Error('No se pudo completar la transacción.');
}

export async function listModalities(userId: string, businessId: string) {
  await getMembership(userId, businessId, prisma);
  const modalities = await prisma.businessModality.findMany({ where: { businessId }, include: modalityInclude, orderBy: { createdAt: 'asc' } });
  const visible = [];
  for (const modality of modalities) {
    if (await latestLifecycleAction(prisma, businessId, modality.id) === 'BUSINESS_MODALITY_RETIRED') continue;
    visible.push(modality);
  }
  return visible.map(serialize);
}

export async function getModalityDetail(userId: string, businessId: string, modalityId: string) {
  await getMembership(userId, businessId, prisma);
  return serialize(await getModality(modalityId, businessId, prisma));
}

export async function createModality(userId: string, businessId: string, input: CreateModalityInput, meta?: RequestMeta) {
  await requirePermission(userId, businessId, permission.edit, prisma);
  try {
    const modality = await serializableTransaction(async (tx) => {
      const existing = await tx.businessModality.findUnique({ where: { businessId_type: { businessId, type: input.type } }, include: modalityInclude });
      if (existing) {
        const lastAction = await latestLifecycleAction(tx, businessId, existing.id);
        if (lastAction === 'BUSINESS_MODALITY_RETIRED') {
          await audit(tx, userId, businessId, 'BUSINESS_MODALITY_CREATED', { modalityId: existing.id, type: existing.type, status: existing.status }, { modalityId: existing.id, type: existing.type, status: 'CONFIGURING' }, meta);
          return existing;
        }
        throw new AppError(409, 'MODALITY_TYPE_ALREADY_EXISTS', 'Esta modalidad ya existe para el negocio.');
      }
      const count = await tx.businessModality.count({ where: { businessId } });
      if (count >= 3) throw new AppError(409, 'MODALITY_LIMIT_REACHED', 'Un negocio puede tener hasta tres modalidades.');
      const created = await tx.businessModality.create({ data: { businessId, type: input.type, status: 'CONFIGURING' }, include: modalityInclude });
      await audit(tx, userId, businessId, 'BUSINESS_MODALITY_CREATED', null, { modalityId: created.id, type: created.type, status: created.status }, meta);
      return created;
    });
    return serialize(modality);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new AppError(409, 'MODALITY_TYPE_ALREADY_EXISTS', 'Esta modalidad ya existe para el negocio.');
    throw error;
  }
}

export async function updateConfiguration(userId: string, businessId: string, modalityId: string, meta?: RequestMeta) {
  await requirePermission(userId, businessId, permission.edit, prisma);
  const modality = await getModality(modalityId, businessId, prisma);
  await prisma.$transaction((tx) => audit(tx, userId, businessId, 'BUSINESS_MODALITY_CONFIGURATION_UPDATED', { modalityId, type: modality.type, status: modality.status }, { modalityId, type: modality.type, status: modality.status }, meta));
  return serialize(modality);
}

export async function updateContact(userId: string, businessId: string, modalityId: string, input: ContactInput, meta?: RequestMeta) {
  await requirePermission(userId, businessId, permission.edit, prisma);
  const existing = await getModality(modalityId, businessId, prisma);
  const values = { email: input.email ?? null, website: input.website ?? null, phone: input.phone ?? null, whatsapp: input.whatsapp ?? null };
  const updated = await prisma.$transaction(async (tx) => {
    const contact = Object.values(values).every((value) => value === null)
      ? (await tx.businessModalityContact.deleteMany({ where: { modalityId } }), null)
      : await tx.businessModalityContact.upsert({ where: { modalityId }, create: { modalityId, ...values }, update: values });
    await audit(tx, userId, businessId, 'BUSINESS_MODALITY_CONTACT_UPDATED', { modalityId, contact: existing.contact }, { modalityId, contact }, meta);
    return tx.businessModality.findUniqueOrThrow({ where: { id: modalityId }, include: modalityInclude });
  });
  return serialize(updated);
}

export async function updateHours(userId: string, businessId: string, modalityId: string, input: HoursInput, meta?: RequestMeta) {
  await requirePermission(userId, businessId, permission.hours, prisma);
  const existing = await getModality(modalityId, businessId, prisma);
  const updated = await prisma.$transaction(async (tx) => {
    const days = input.hours.map((hour) => hour.dayOfWeek);
    await tx.businessModalityHour.deleteMany({ where: { modalityId, dayOfWeek: { notIn: days } } });
    for (const hour of input.hours) await tx.businessModalityHour.upsert({ where: { modalityId_dayOfWeek: { modalityId, dayOfWeek: hour.dayOfWeek } }, create: { modalityId, ...hour }, update: { isClosed: hour.isClosed, opensAt: hour.opensAt ?? null, closesAt: hour.closesAt ?? null, timezone: hour.timezone } });
    await audit(tx, userId, businessId, 'BUSINESS_MODALITY_HOURS_UPDATED', { modalityId, hours: existing.hours }, { modalityId, hours: input.hours }, meta);
    return tx.businessModality.findUniqueOrThrow({ where: { id: modalityId }, include: modalityInclude });
  });
  return serialize(updated);
}

async function changeStatus(userId: string, businessId: string, modalityId: string, target: 'ACTIVE' | 'PAUSED' | 'CONFIGURING', action: string, meta?: RequestMeta) {
  const code = target === 'ACTIVE' ? permission.publication : permission.publication;
  await requirePermission(userId, businessId, code, prisma);
  const current = await getModality(modalityId, businessId, prisma);
  const isCancellation = action === 'BUSINESS_MODALITY_RETIRED' && target === 'CONFIGURING';
  if (current.status === target && target === 'CONFIGURING' && !isCancellation) return serialize(current);
  if (!transition(current.status, target) && !isCancellation) throw new AppError(409, 'INVALID_MODALITY_TRANSITION', 'La modalidad no puede cambiar a ese estado.');
  if (target === 'ACTIVE') {
    const blockers = activationBlockers(current);
    if (blockers.length) throw new AppError(422, 'MODALITY_NOT_READY', 'La modalidad aún no puede activarse.', { modality: blockers.join(' ') });
  }
  const updated = await prisma.$transaction(async (tx) => {
    const changed = await tx.businessModality.updateMany({ where: { id: modalityId, status: current.status }, data: { status: target } });
    if (changed.count !== 1) throw new AppError(409, 'MODALITY_STATE_CONFLICT', 'La modalidad cambió mientras se procesaba la solicitud.');
    const value = await tx.businessModality.findUniqueOrThrow({ where: { id: modalityId }, include: modalityInclude });
    await audit(tx, userId, businessId, action, { modalityId, type: current.type, status: current.status }, { modalityId, type: value.type, status: value.status }, meta);
    return value;
  });
  return serialize(updated);
}

export const activateModality = (u: string, b: string, m: string, meta?: RequestMeta) => changeStatus(u, b, m, 'ACTIVE', 'BUSINESS_MODALITY_ACTIVATED', meta);
export const pauseModality = (u: string, b: string, m: string, meta?: RequestMeta) => changeStatus(u, b, m, 'PAUSED', 'BUSINESS_MODALITY_PAUSED', meta);
export const reactivateModality = (u: string, b: string, m: string, meta?: RequestMeta) => changeStatus(u, b, m, 'ACTIVE', 'BUSINESS_MODALITY_REACTIVATED', meta);
export const retireModality = (u: string, b: string, m: string, meta?: RequestMeta) => changeStatus(u, b, m, 'CONFIGURING', 'BUSINESS_MODALITY_RETIRED', meta);
