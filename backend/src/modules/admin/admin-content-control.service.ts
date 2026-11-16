import { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';
import { notifyBusinessOwners } from '../notifications/platform-notifications.service.js';
import { removePhoto } from '../business/photo-storage.js';

export type ContentControlAction = 'HIDE' | 'REVIEW' | 'RELEASE' | 'DELETE' | 'RESTORE';
export type ContentEdit = {
  name?: string; description?: string | null; priceAmount?: string | null;
  currency?: string | null; priceText?: string | null; negotiable?: boolean;
  adultOnly?: boolean; categoryId?: string | null;
};
const ACTION_NAMES: Record<ContentControlAction, string> = {
  HIDE: 'ADMIN_CONTENT_HIDDEN', REVIEW: 'ADMIN_CONTENT_REVIEWED',
  RELEASE: 'ADMIN_CONTENT_RELEASED', DELETE: 'ADMIN_CONTENT_DELETED',
  RESTORE: 'ADMIN_CONTENT_RECOVERED',
};
const statement = (value: string) => {
  const reason = value.trim();
  if (reason.length < 12 || reason.length > 500)
    throw new AppError(400, 'ADMIN_CONTENT_REASON_REQUIRED', 'Explica el motivo con entre 12 y 500 caracteres.');
  return reason;
};
function snapshot(offer: {
  administrativeStatus: string; active: boolean; publicationStatus: string;
  deletedAt: Date | null; name: string; categoryId: string | null;
  description: string | null; adultOnly: boolean; priceAmount: Prisma.Decimal | null;
  priceText: string | null; currency: string | null; negotiable: boolean;
}) {
  return {
    administrativeStatus: offer.administrativeStatus, active: offer.active,
    publicationStatus: offer.publicationStatus, deletedAt: offer.deletedAt?.toISOString() ?? null,
    name: offer.name, categoryId: offer.categoryId, description: offer.description,
    adultOnly: offer.adultOnly, priceAmount: offer.priceAmount?.toString() ?? null,
    priceText: offer.priceText, currency: offer.currency, negotiable: offer.negotiable,
  };
}
function businessEligible(business: {
  publicationStatus: string; lifecycleStatus: string; deletionStatus: string;
  businessAccount: { status: string };
}) {
  return business.publicationStatus === 'PUBLISHED' && business.lifecycleStatus === 'ACTIVE' &&
    business.deletionStatus === 'NONE' && business.businessAccount.status === 'ACTIVE';
}
export async function getAdminContentHistory(id: string) {
  const exists = await prisma.businessOffer.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw new AppError(404, 'ADMIN_OFFER_NOT_FOUND', 'No encontramos el contenido.');
  const rows = await prisma.auditLog.findMany({
    where: { entityType: 'OFFER', entityId: id },
    take: 100, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { id: true, action: true, reason: true, comment: true, createdAt: true, previousState: true,
      newState: true, actor: { select: { displayName: true } } },
  });
  return { history: rows };
}

export async function controlAdminContent(id: string, actorId: string, action: ContentControlAction, note: string) {
  const reason = statement(note);
  const response = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM BusinessOffer WHERE id = ${id} FOR UPDATE`;
    const offer = await tx.businessOffer.findUnique({
      where: { id }, include: { business: { select: {
        publicationStatus: true, lifecycleStatus: true, deletionStatus: true,
        businessAccount: { select: { status: true } },
      } } },
    });
    if (!offer) throw new AppError(404, 'ADMIN_OFFER_NOT_FOUND', 'No encontramos este producto o servicio.');
    const before = snapshot(offer);
    if (action !== 'RESTORE' && offer.deletedAt)
      throw new AppError(409, 'ADMIN_CONTENT_ALREADY_DELETED', 'Este contenido ya está eliminado.');
    if (action === 'RESTORE' && (offer.administrativeStatus !== 'DELETED' || !offer.deletedAt))
      throw new AppError(409, 'ADMIN_CONTENT_NOT_ADMIN_DELETED', 'Solo puedes recuperar eliminaciones realizadas por Admin.');
    if (action === 'RELEASE' && !['HIDDEN', 'REVIEW'].includes(offer.administrativeStatus))
      throw new AppError(409, 'ADMIN_CONTENT_NOT_RESTRICTED', 'La publicación no tiene una restricción administrativa.');
    if (action === 'DELETE' && offer.administrativeStatus === 'DELETED')
      throw new AppError(409, 'ADMIN_CONTENT_ALREADY_DELETED', 'El contenido ya está eliminado.');
    if ((action === 'HIDE' && offer.administrativeStatus === 'HIDDEN') ||
        (action === 'REVIEW' && offer.administrativeStatus === 'REVIEW'))
      throw new AppError(409, 'ADMIN_CONTENT_NO_CHANGE', 'Esta medida ya se encuentra aplicada.');

    let data: Prisma.BusinessOfferUpdateInput;
    if (action === 'HIDE') data = {
      administrativeStatus: 'HIDDEN', adminRestrictedAt: new Date(),
      active: false, publicationStatus: 'UNPUBLISHED',
    };
    else if (action === 'REVIEW') data = {
      administrativeStatus: 'REVIEW', adminRestrictedAt: new Date(),
      active: false, publicationStatus: 'REVIEW',
    };
    else if (action === 'DELETE') data = {
      administrativeStatus: 'DELETED', adminRestrictedAt: new Date(),
      deletedAt: new Date(), active: false, publicationStatus: 'UNPUBLISHED',
    };
    else if (action === 'RESTORE') data = {
      administrativeStatus: 'HIDDEN', adminRestrictedAt: new Date(),
      deletedAt: null, active: false, publicationStatus: 'UNPUBLISHED',
    };
    else {
      const recent = await tx.auditLog.findMany({
        where: { entityType: 'OFFER', entityId: id, action: { in: [
          'ADMIN_CONTENT_HIDDEN', 'ADMIN_CONTENT_REVIEWED', 'ADMIN_CONTENT_DELETED',
        ] } }, orderBy: { createdAt: 'desc' }, take: 60, select: { previousState: true },
      });
      const original = recent.map(entry => entry.previousState)
        .find((state): state is Prisma.JsonObject =>
          Boolean(state && typeof state === 'object' && !Array.isArray(state) &&
            (state as Prisma.JsonObject).administrativeStatus === 'NONE'));
      if (!original) throw new AppError(409, 'ADMIN_CONTENT_HISTORY_MISSING',
        'No se encontró el estado original. Consulta la auditoría antes de levantar la medida.');
      const requested = original.publicationStatus === 'PUBLISHED' ? 'PUBLISHED' :
        original.publicationStatus === 'REVIEW' ? 'REVIEW' : 'UNPUBLISHED';
      if (requested === 'PUBLISHED' && !businessEligible(offer.business))
        throw new AppError(409, 'ADMIN_CONTENT_BUSINESS_INACTIVE',
          'No se puede publicar mientras el negocio no esté activo y publicado.');
      data = { administrativeStatus: 'NONE', adminRestrictedAt: null,
        active: original.active === true, publicationStatus: requested };
    }
    const updated = await tx.businessOffer.update({ where: { id }, data });
    await tx.auditLog.create({ data: {
      actorUserId: actorId, entityType: 'OFFER', entityId: id,
      action: ACTION_NAMES[action], previousState: before,
      newState: snapshot(updated), reason,
    } });
    await notifyBusinessOwners(tx, offer.businessId,
      'Decisión administrativa sobre una publicación',
      'XAMUKO registró una decisión sobre «' + offer.name +
        '». Acción: ' + ({ HIDE: 'ocultar', REVIEW: 'enviar a revisión', RELEASE: 'levantar restricción',
          DELETE: 'retirar', RESTORE: 'recuperar' } as Record<ContentControlAction, string>)[action] +
        '. Puedes consultar el estado en tu catálogo.');
    return { id, administrativeStatus: updated.administrativeStatus,
      publicationStatus: updated.publicationStatus,
      message: ({ HIDE: 'Publicación oculta', REVIEW: 'Publicación enviada a revisión',
        RELEASE: 'Restricción levantada', DELETE: 'Publicación eliminada temporalmente',
        RESTORE: 'Contenido recuperado y oculto hasta nueva revisión' } as Record<ContentControlAction, string>)[action] + '. Decisión registrada en auditoría.' };
  });
  return response;
}

export async function editAdminContent(id: string, actorId: string, changes: ContentEdit, note: string) {
  const reason = statement(note);
  const fields = Object.keys(changes);
  if (!fields.length) throw new AppError(400, 'ADMIN_CONTENT_NO_CHANGES', 'No se enviaron modificaciones.');
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM BusinessOffer WHERE id = ${id} FOR UPDATE`;
    const offer = await tx.businessOffer.findUnique({ where: { id } });
    if (!offer) throw new AppError(404, 'ADMIN_OFFER_NOT_FOUND', 'No encontramos la publicación.');
    if (offer.deletedAt) throw new AppError(409, 'ADMIN_CONTENT_DELETED', 'Recupera la publicación antes de editarla.');
    if (changes.categoryId) {
      const category = await tx.category.findUnique({ where: { id: changes.categoryId }, select: { active: true } });
      if (!category || !category.active) throw new AppError(400, 'ADMIN_CONTENT_CATEGORY_INVALID', 'La categoría debe existir y estar activa.');
    }
    const before = snapshot(offer);
    const data: Prisma.BusinessOfferUpdateInput = {
      ...(changes.name !== undefined ? { name: changes.name } : {}),
      ...(changes.description !== undefined ? { description: changes.description } : {}),
      ...(changes.priceAmount !== undefined ? { priceAmount: changes.priceAmount === null ? null : new Prisma.Decimal(changes.priceAmount) } : {}),
      ...(changes.currency !== undefined ? { currency: changes.currency } : {}),
      ...(changes.priceText !== undefined ? { priceText: changes.priceText } : {}),
      ...(changes.negotiable !== undefined ? { negotiable: changes.negotiable } : {}),
      ...(changes.adultOnly !== undefined ? { adultOnly: changes.adultOnly } : {}),
      ...(changes.categoryId !== undefined ? { category: changes.categoryId ?
        { connect: { id: changes.categoryId } } : { disconnect: true } } : {}),
    };
    const updated = await tx.businessOffer.update({ where: { id }, data });
    await tx.auditLog.create({ data: {
      actorUserId: actorId, entityType: 'OFFER', entityId: id,
      action: 'ADMIN_CONTENT_UPDATED', previousState: before, newState: snapshot(updated), reason,
    } });
    await notifyBusinessOwners(tx, offer.businessId, 'XAMUKO actualizó una publicación',
      'Se actualizaron datos de «' + updated.name + '» por una decisión administrativa. Consulta tu catálogo.');
    return { id, message: 'Información actualizada y registrada en auditoría.' };
  });
}

export async function removeAdminContentPhoto(photoId: string, actorId: string, note: string) {
  const reason = statement(note);
  const photo = await prisma.photo.findFirst({
    where: { id: photoId, offerId: { not: null } },
    select: { id: true, offerId: true, storageKey: true, businessId: true },
  });
  if (!photo || !photo.offerId) throw new AppError(404, 'ADMIN_CONTENT_PHOTO_NOT_FOUND', 'No encontramos la fotografía.');
  // Delete the database record first to stop publication. If removing the physical
  // file fails, report the orphan for storage cleanup; never re-expose it publicly.
  await prisma.$transaction(async tx => {
    await tx.photo.delete({ where: { id: photo.id } });
    await tx.auditLog.create({ data: {
      actorUserId: actorId, entityType: 'OFFER', entityId: photo.offerId!,
      action: 'ADMIN_CONTENT_PHOTO_REMOVED', reason,
      previousState: { photoId: photo.id }, newState: { photoId: null },
    } });
    if (photo.businessId) await notifyBusinessOwners(tx, photo.businessId,
      'XAMUKO retiró una fotografía', 'Una fotografía del catálogo fue retirada por una decisión administrativa.');
  });
  try { await removePhoto(photo.storageKey); }
  catch { throw new AppError(503, 'ADMIN_CONTENT_PHOTO_CLEANUP',
    'La fotografía ya no es pública, pero el archivo requiere limpieza en almacenamiento.'); }
  return { id: photo.id, message: 'Fotografía retirada y acción registrada.' };
}

export async function controlAdminContentBulk(ids: string[], actorId: string, action: 'HIDE' | 'REVIEW', reason: string) {
  statement(reason);
  if (!ids.length || ids.length > 25 || new Set(ids).size !== ids.length)
    throw new AppError(400, 'ADMIN_CONTENT_BULK_INVALID', 'Selecciona entre 1 y 25 publicaciones diferentes.');
  const results: Array<{ id: string; ok: boolean; message: string }> = [];
  for (const id of ids) {
    try {
      const result = await controlAdminContent(id, actorId, action, reason);
      results.push({ id, ok: true, message: result.message });
    } catch (error) {
      results.push({ id, ok: false, message: error instanceof Error ? error.message : 'Error al procesar esta publicación.' });
    }
  }
  return { results, succeeded: results.filter(item => item.ok).length, failed: results.filter(item => !item.ok).length };
}
