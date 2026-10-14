import { Prisma, type PrismaClient } from '../../generated/prisma/client.js';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';
import type { BusinessCreateInput, BusinessUpdateInput } from './business.schemas.js';
import { modalityRules } from './modality.service.js';

type Db = PrismaClient | Prisma.TransactionClient;
type RequestMeta = { ipAddress?: string };

const businessInclude = {
  businessAccount: true,
  category: true,
  secondaryCategories: { include: { category: true }, orderBy: { createdAt: 'asc' as const } },
  location: true,
  photos: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] as any },
  memberships: { where: { status: 'ACTIVE' as const }, include: { permissions: true } },
  modalities: { include: { contact: true, hours: { orderBy: { dayOfWeek: 'asc' as const } } }, orderBy: { createdAt: 'asc' as const } },
} as const;

function slugify(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 160) || 'negocio';
}

function normalizeCategory(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function isCatalogCategory(code: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(code);
}

/**
 * Location visibility is a consequence of the business modalities. A public
 * address is only appropriate when the business has a physical establishment;
 * delivery and virtual businesses must keep their location private.
 */
function visibilityForModalities(types: readonly string[] | undefined): 'PUBLIC' | 'PRIVATE' {
  return types?.includes('PHYSICAL') ? 'PUBLIC' : 'PRIVATE';
}

async function resolveCategory(input: { categoryId?: string; categoryCode?: string }, db: Db) {
  let category = input.categoryId
    ? await db.category.findUnique({ where: { id: input.categoryId } })
    : await db.category.findUnique({ where: { code: input.categoryCode! } });
  if (!category && input.categoryCode) {
    const normalized = normalizeCategory(input.categoryCode);
    const candidates = await db.category.findMany({ where: { active: true }, include: { translations: true } });
    category = candidates.find(item => isCatalogCategory(item.code) && (normalizeCategory(item.code) === normalized || item.translations.some(translation => normalizeCategory(translation.name) === normalized))) ?? null;
  }
  if (!category || !category.active || !isCatalogCategory(category.code)) throw new AppError(422, 'CATEGORY_UNAVAILABLE', 'La categoría seleccionada no está disponible.');
  return category;
}

async function resolveSecondaryCategories(input: { secondaryCategoryCodes?: string[] }, primaryId: string, db: Db) {
  const resolved: Array<{ id: string }> = [];
  const ids = new Set<string>();
  for (const code of input.secondaryCategoryCodes ?? []) {
    const category = await resolveCategory({ categoryCode: code }, db);
    if (category.id === primaryId || ids.has(category.id)) throw new AppError(422, 'DUPLICATE_CATEGORY', 'La categoría principal no puede repetirse como secundaria y no puede haber duplicados.');
    ids.add(category.id);
    resolved.push(category);
  }
  return resolved;
}

async function findBusiness(userId: string, identifier: string, db: Db) {
  const business = await db.business.findFirst({ where: { OR: [{ id: identifier }, { publicId: identifier }], memberships: { some: { userId, status: 'ACTIVE' } } }, include: businessInclude });
  if (!business || business.businessAccount.status !== 'ACTIVE') throw new AppError(404, 'BUSINESS_NOT_FOUND', 'No encontramos ese negocio.');
  return business;
}

function serialize(business: any, userId?: string) {
  const membership = business.memberships?.find((item: any) => item.userId === userId);
  return {
    id: business.id,
    publicId: business.publicId,
    businessAccountId: business.businessAccountId,
    name: business.name,
    sede: business.sede,
    slug: business.slug,
    description: business.description,
    category: business.category?.code ?? null,
    categoryId: business.categoryId,
    secondaryCategories: (business.secondaryCategories ?? []).map((item: any) => ({ id: item.category.id, code: item.category.code })),
    email: business.email,
    website: business.website,
    instagram: business.instagram,
    phone: business.phone,
    whatsapp: business.whatsapp,
    completeness: business.completeness,
    lifecycleStatus: business.lifecycleStatus,
    publicationStatus: business.publicationStatus,
    visibilityStatus: business.visibilityStatus,
    verificationStatus: business.verificationStatus,
    deletionStatus: business.deletionStatus,
    role: membership?.role ?? null,
    permissions: membership?.permissions?.filter((item: any) => item.allowed).map((item: any) => item.permission) ?? [],
    location: business.location ? { ...business.location, latitude: business.location.latitude?.toString() ?? null, longitude: business.location.longitude?.toString() ?? null } : null,
    modalities: business.modalities ?? [],
    photos: (business.photos ?? []).map((photo: any) => ({
      id: photo.id,
      url: `/api/v1/businesses/${business.id}/photos/${photo.id}/content`,
      altText: photo.altText,
      sortOrder: photo.sortOrder,
      isCover: photo.isCover,
    })),
  };
}

async function audit(db: Db, userId: string, businessId: string, action: string, previousState: unknown, newState: unknown, meta?: RequestMeta) {
  await db.auditLog.create({ data: { actorUserId: userId, entityType: 'BUSINESS', entityId: businessId, action, previousState: previousState === null ? Prisma.JsonNull : previousState as Prisma.InputJsonValue, newState: newState === null ? Prisma.JsonNull : newState as Prisma.InputJsonValue, ipAddress: meta?.ipAddress ?? null } });
}

export async function listBusinesses(userId: string) {
  const businesses = await prisma.business.findMany({ where: { businessAccount: { status: 'ACTIVE' }, deletionStatus: { not: 'DELETED' }, memberships: { some: { userId, status: 'ACTIVE' } } }, include: businessInclude, orderBy: { updatedAt: 'desc' } });
  return businesses.map((business) => serialize(business, userId));
}

async function assertBusinessOwner(userId: string, identifier: string) {
  const current = await findBusiness(userId, identifier, prisma);
  const membership = current.memberships.find((item: any) => item.userId === userId);
  if (!membership || membership.role !== 'OWNER' && !membership.permissions.some((item: any) => item.permission === 'EDIT_BUSINESS' && item.allowed)) throw new AppError(403, 'BUSINESS_PERMISSION_DENIED', 'No tienes permisos para modificar la eliminación de este negocio.');
  return current;
}

export async function requestBusinessDeletion(userId: string, identifier: string, meta?: RequestMeta) {
  const current = await assertBusinessOwner(userId, identifier);
  if (current.deletionStatus !== 'NONE') throw new AppError(409, 'BUSINESS_DELETION_INVALID_STATE', 'El negocio ya está en proceso de eliminación o fue eliminado.');
  const updated = await prisma.$transaction(async (tx) => {
    const business = await tx.business.update({ where: { id: current.id }, data: { deletionStatus: 'RECOVERY' }, include: businessInclude });
    await audit(tx, userId, current.id, 'BUSINESS_DELETION_REQUESTED', { deletionStatus: current.deletionStatus }, { deletionStatus: business.deletionStatus }, meta);
    return business;
  });
  return serialize(updated, userId);
}

export async function recoverBusiness(userId: string, identifier: string, meta?: RequestMeta) {
  const current = await assertBusinessOwner(userId, identifier);
  if (current.deletionStatus !== 'RECOVERY') throw new AppError(409, 'BUSINESS_RECOVERY_INVALID_STATE', 'El negocio no está disponible para recuperación.');
  const updated = await prisma.$transaction(async (tx) => {
    const business = await tx.business.update({ where: { id: current.id }, data: { deletionStatus: 'NONE' }, include: businessInclude });
    await audit(tx, userId, current.id, 'BUSINESS_RECOVERED', { deletionStatus: current.deletionStatus }, { deletionStatus: business.deletionStatus }, meta);
    return business;
  });
  return serialize(updated, userId);
}

export async function listCategories() {
  const categories = await prisma.category.findMany({ where: { active: true }, include: { translations: { where: { locale: 'es-CO' } } }, orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }] });
  return categories.filter(category => isCatalogCategory(category.code));
}

export async function createBusiness(userId: string, input: BusinessCreateInput, meta?: RequestMeta) {
  const category = await resolveCategory(input, prisma);
  const secondaryCategories = await resolveSecondaryCategories(input, category.id, prisma);
  const baseSlug = slugify(input.name);
  const result = await prisma.$transaction(async (tx) => {
    const account = await tx.businessAccount.create({ data: { name: input.name, createdById: userId } });
    const existing = await tx.business.count({ where: { businessAccountId: account.id, slug: baseSlug } });
    const locationData = input.cityName ? { create: { countryCode: input.countryCode, regionCode: input.regionCode ?? null, regionName: input.regionName ?? null, cityName: input.cityName, zoneName: input.zoneName ?? null, address: input.address ?? '', additionalAddressInfo: input.additionalAddressInfo ?? null, latitude: input.latitude ?? null, longitude: input.longitude ?? null, visibility: visibilityForModalities(input.modalityTypes), postalCode: input.postalCode ?? null, timezone: input.timezone } } : undefined;
    const business = await tx.business.create({ data: { businessAccountId: account.id, createdById: userId, name: input.name, sede: input.sede ?? null, slug: existing ? `${baseSlug}-${existing + 1}` : baseSlug, description: input.description ?? null, categoryId: category.id, email: input.email ?? null, website: input.website ?? null, instagram: input.instagram ?? null, phone: input.phone ?? null, whatsapp: input.whatsapp ?? null, memberships: { create: { userId, role: 'OWNER', status: 'ACTIVE', acceptedAt: new Date() } }, ...(locationData ? { location: locationData } : {}) }, include: businessInclude });
    if (secondaryCategories.length) await tx.businessSecondaryCategory.createMany({ data: secondaryCategories.map(item => ({ businessId: business.id, categoryId: item.id })) });
    await audit(tx, userId, business.id, 'BUSINESS_CREATED', null, { businessId: business.id, publicId: business.publicId }, meta);
    for (const type of input.modalityTypes ?? []) {
      const configuration = input.modalityConfigurations?.find(item => item.type === type);
      const modality = await tx.businessModality.create({ data: { businessId: business.id, type, status: 'CONFIGURING' } });
      await audit(tx, userId, business.id, 'BUSINESS_MODALITY_CREATED', null, { modalityId: modality.id, type: modality.type, status: modality.status }, meta);
      if (configuration?.contact && Object.values(configuration.contact).some(value => value !== null && value !== undefined && value !== '')) await tx.businessModalityContact.create({ data: { modalityId: modality.id, email: configuration.contact.email ?? null, website: configuration.contact.website ?? null, phone: configuration.contact.phone ?? null, whatsapp: configuration.contact.whatsapp ?? null } });
      for (const hour of configuration?.hours ?? []) await tx.businessModalityHour.create({ data: { modalityId: modality.id, ...hour, opensAt: hour.opensAt ?? null, closesAt: hour.closesAt ?? null } });
      if (!input.startModalitiesConfiguring) {
        const ready = await tx.businessModality.findUniqueOrThrow({ where: { id: modality.id }, include: { contact: true, hours: { orderBy: { dayOfWeek: 'asc' } }, business: { select: { email: true, website: true, instagram: true, phone: true, whatsapp: true, location: true } } } });
        const blockers = modalityRules.activationBlockers(ready);
        if (!blockers.length) {
          const active = await tx.businessModality.update({ where: { id: modality.id }, data: { status: 'ACTIVE' }, include: { contact: true, hours: { orderBy: { dayOfWeek: 'asc' } } } });
          await audit(tx, userId, business.id, 'BUSINESS_MODALITY_ACTIVATED', { modalityId: modality.id, type, status: 'CONFIGURING' }, { modalityId: active.id, type: active.type, status: active.status }, meta);
        }
      }
    }
    return tx.business.findUniqueOrThrow({ where: { id: business.id }, include: businessInclude });
  });
  return serialize(result, userId);
}

export async function getBusiness(userId: string, identifier: string) {
  return serialize(await findBusiness(userId, identifier, prisma), userId);
}

export async function updateBusiness(userId: string, identifier: string, input: BusinessUpdateInput, meta?: RequestMeta) {
  const current = await findBusiness(userId, identifier, prisma);
  const membership = current.memberships.find((item: any) => item.userId === userId);
  if (!membership || membership.role !== 'OWNER' && !membership.permissions.some((item: any) => item.permission === 'EDIT_BUSINESS' && item.allowed)) throw new AppError(403, 'BUSINESS_PERMISSION_DENIED', 'No tienes permisos para editar este negocio.');
  const category = input.categoryId || input.categoryCode ? await resolveCategory(input, prisma) : null;
  const secondaryCategories = input.secondaryCategoryCodes ? await resolveSecondaryCategories(input, category?.id ?? current.categoryId, prisma) : null;
  const prospective = {
    ...current,
    email: input.email !== undefined ? input.email : current.email,
    website: input.website !== undefined ? input.website : current.website,
    instagram: input.instagram !== undefined ? input.instagram : current.instagram,
    phone: input.phone !== undefined ? input.phone : current.phone,
    whatsapp: input.whatsapp !== undefined ? input.whatsapp : current.whatsapp,
    location: current.location ? {
      ...current.location,
      cityName: input.cityName !== undefined && input.cityName !== null ? input.cityName : current.location.cityName,
      address: input.address !== undefined && input.address !== null ? input.address : current.location.address,
      latitude: input.latitude !== undefined ? input.latitude : current.location.latitude,
      longitude: input.longitude !== undefined ? input.longitude : current.location.longitude,
      visibility: visibilityForModalities(current.modalities.map((modality: any) => modality.type)),
    } : null,
  };
  const affectedModalities = current.modalities.filter((modality: any) => modality.status === 'ACTIVE').map((modality: any) => ({ modality, blockers: modalityRules.activationBlockers({ ...modality, business: prospective }) })).filter((item: any) => item.blockers.length > 0);
  const requestedDeactivation = new Set(input.deactivateModalities ?? []);
  const unconfirmed = affectedModalities.filter((item: any) => !requestedDeactivation.has(item.modality.type));
  if (unconfirmed.length) {
    const details = Object.fromEntries(unconfirmed.map((item: any) => [item.modality.type, item.blockers]));
    throw new AppError(422, 'ACTIVE_MODALITY_REQUIREMENTS', 'El cambio afecta modalidades activas. Confirma su desactivación para continuar.', { modalities: JSON.stringify(details) });
  }
  const updated = await prisma.$transaction(async (tx) => {
    for (const item of affectedModalities.filter((entry: any) => requestedDeactivation.has(entry.modality.type))) {
      const paused = await tx.businessModality.update({ where: { id: item.modality.id }, data: { status: 'PAUSED' } });
      await audit(tx, userId, current.id, 'BUSINESS_MODALITY_PAUSED', { modalityId: item.modality.id, type: item.modality.type, status: item.modality.status }, { modalityId: item.modality.id, type: item.modality.type, status: paused.status }, meta);
    }
    const business = await tx.business.update({ where: { id: current.id }, data: { ...(input.name !== undefined ? { name: input.name, slug: slugify(input.name) } : {}), ...(input.sede !== undefined ? { sede: input.sede?.trim() || null } : {}), ...(input.description !== undefined ? { description: input.description ?? null } : {}), ...(category ? { categoryId: category.id } : {}), ...(input.email !== undefined ? { email: input.email ?? null } : {}), ...(input.website !== undefined ? { website: input.website ?? null } : {}), ...(input.instagram !== undefined ? { instagram: input.instagram ?? null } : {}), ...(input.phone !== undefined ? { phone: input.phone ?? null } : {}), ...(input.whatsapp !== undefined ? { whatsapp: input.whatsapp ?? null } : {}) }, include: businessInclude });
    if (secondaryCategories) {
      await tx.businessSecondaryCategory.deleteMany({ where: { businessId: business.id } });
      if (secondaryCategories.length) await tx.businessSecondaryCategory.createMany({ data: secondaryCategories.map(item => ({ businessId: business.id, categoryId: item.id })) });
    }
    if (input.cityName !== undefined || input.address !== undefined || input.latitude !== undefined || input.longitude !== undefined || input.additionalAddressInfo !== undefined || input.countryCode !== undefined || input.regionCode !== undefined || input.regionName !== undefined || input.zoneName !== undefined || input.postalCode !== undefined || input.timezone !== undefined) {
      if (!business.location) throw new AppError(409, 'BUSINESS_LOCATION_MISSING', 'El negocio no tiene una ubicación configurada.');
      await tx.businessLocation.update({ where: { businessId: business.id }, data: { ...(input.countryCode !== undefined ? { countryCode: input.countryCode } : {}), ...(input.regionCode !== undefined ? { regionCode: input.regionCode ?? null } : {}), ...(input.regionName !== undefined ? { regionName: input.regionName ?? null } : {}), ...(input.cityName !== undefined && input.cityName !== null ? { cityName: input.cityName } : {}), ...(input.zoneName !== undefined ? { zoneName: input.zoneName ?? null } : {}), ...(input.address !== undefined && input.address !== null ? { address: input.address } : {}), ...(input.latitude !== undefined ? { latitude: input.latitude } : {}), ...(input.longitude !== undefined ? { longitude: input.longitude } : {}), ...(input.additionalAddressInfo !== undefined ? { additionalAddressInfo: input.additionalAddressInfo?.trim() || null } : {}), ...(input.postalCode !== undefined ? { postalCode: input.postalCode ?? null } : {}), ...(input.timezone !== undefined ? { timezone: input.timezone } : {}), visibility: visibilityForModalities(current.modalities.map((modality: any) => modality.type)) } });
    }
    await audit(tx, userId, business.id, 'BUSINESS_UPDATED', { name: current.name, description: current.description }, { name: business.name, description: business.description }, meta);
    return tx.business.findUniqueOrThrow({ where: { id: business.id }, include: businessInclude });
  });
  return serialize(updated, userId);
}
