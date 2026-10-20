import type { PrismaClient } from '../../generated/prisma/client.js';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';
import { findBusinessForPhotos } from './photo-access.js';
import { PHOTO_MAX_BYTES, PHOTO_MIME_TYPES, photoStoragePath, removePhoto, savePhoto } from './photo-storage.js';

const db: PrismaClient = prisma;

export type UploadedPhoto = { buffer: Buffer; mimetype: string; size: number };

function ensureFile(file: UploadedPhoto | undefined): asserts file is UploadedPhoto {
  if (!file) throw new AppError(400, 'PHOTO_REQUIRED', 'Selecciona una fotografía.');
  if (!PHOTO_MIME_TYPES.has(file.mimetype)) throw new AppError(422, 'PHOTO_FORMAT_UNSUPPORTED', 'Solo se permiten fotografías JPG, PNG o WebP.');
  if (file.size > PHOTO_MAX_BYTES) throw new AppError(422, 'PHOTO_TOO_LARGE', 'Cada fotografía puede pesar máximo 5 MB.');
  const isJpeg = file.mimetype === 'image/jpeg' && file.buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
  const isPng = file.mimetype === 'image/png' && file.buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isWebp = file.mimetype === 'image/webp' && file.buffer.subarray(0, 4).toString('ascii') === 'RIFF' && file.buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  if (!isJpeg && !isPng && !isWebp) throw new AppError(422, 'PHOTO_FORMAT_UNSUPPORTED', 'El contenido de la fotografía no coincide con su formato.');
}

function serializePhoto(businessId: string, photo: any) {
  return { id: photo.id, url: `/api/v1/businesses/${businessId}/photos/${photo.id}/content`, altText: photo.altText, sortOrder: photo.sortOrder, isCover: photo.isCover };
}

function ensurePosition(value: number | undefined, field: string) {
  if (value === undefined) return 50;
  if (!Number.isInteger(value) || value < 0 || value > 100) throw new AppError(422, 'PHOTO_POSITION_INVALID', `La posición de ${field} debe estar entre 0 y 100.`);
  return value;
}

export async function listPhotos(userId: string, businessId: string) {
  await findBusinessForPhotos(userId, businessId);
  const photos = await db.photo.findMany({ where: { businessId, isGallery: true }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });
  return photos.map(photo => serializePhoto(businessId, photo));
}

export async function uploadPhoto(userId: string, businessId: string, file: UploadedPhoto | undefined, requestedCover: boolean, offerId?: string) {
  ensureFile(file);
  await findBusinessForPhotos(userId, businessId);
  if (offerId) { const offer = await db.businessOffer.findFirst({ where: { id: offerId, businessId }, select: { id: true } }); if (!offer) throw new AppError(404, 'OFFER_NOT_FOUND', 'No encontramos ese producto.'); }
  const count = offerId ? 0 : await db.photo.count({ where: { businessId, isGallery: true } });
  if (!offerId && count >= 10) throw new AppError(422, 'PHOTO_LIMIT_REACHED', 'Cada negocio puede tener máximo 10 fotografías.');
  const business = await db.business.findUniqueOrThrow({ where: { id: businessId }, select: { coverPhotoId: true, profilePhotoId: true } });
  const previousOfferPhotos = offerId ? await db.photo.findMany({ where: { businessId, offerId }, select: { id: true, storageKey: true } }) : [];
  for (const previous of previousOfferPhotos) await removePhoto(previous.storageKey).catch(() => undefined);
  const stored = await savePhoto(businessId, file.buffer, file.mimetype);
  try {
    const photo = await db.$transaction(async tx => {
      const shouldUseAsCover = !offerId && (requestedCover || !business.coverPhotoId);
      if (shouldUseAsCover) await tx.photo.updateMany({ where: { businessId, isCover: true }, data: { isCover: false } });
      if (offerId && previousOfferPhotos.length) await tx.photo.deleteMany({ where: { id: { in: previousOfferPhotos.map(item => item.id) }, businessId, offerId } });
      const photo = await tx.photo.create({ data: { businessId, offerId: offerId ?? null, storageKey: stored.storageKey, url: null, source: 'NEGOCIOS', sortOrder: count, isCover: shouldUseAsCover, isGallery: !offerId, uploadedById: userId } });
      if (shouldUseAsCover || !business.profilePhotoId) await tx.business.update({ where: { id: businessId }, data: { ...(shouldUseAsCover ? { coverPhotoId: photo.id } : {}), ...(!business.profilePhotoId ? { profilePhotoId: photo.id } : {}) } });
      return photo;
    });
    return serializePhoto(businessId, photo);
  } catch (error) {
    await removePhoto(stored.storageKey).catch(() => undefined);
    throw error;
  }
}

export async function deletePhoto(userId: string, businessId: string, photoId: string) {
  await findBusinessForPhotos(userId, businessId);
  const photo = await db.photo.findFirst({ where: { id: photoId, businessId } });
  if (!photo) throw new AppError(404, 'PHOTO_NOT_FOUND', 'No encontramos esa fotografía.');
  await removePhoto(photo.storageKey).catch(() => { throw new AppError(503, 'PHOTO_STORAGE_UNAVAILABLE', 'No se pudo eliminar el archivo de fotografía.'); });
  await db.$transaction(async tx => { await tx.photo.delete({ where: { id: photo.id } }); });
}

export async function setPhotoCover(userId: string, businessId: string, photoId: string) {
  await findBusinessForPhotos(userId, businessId);
  const photo = await db.photo.findFirst({ where: { id: photoId, businessId } });
  if (!photo) throw new AppError(404, 'PHOTO_NOT_FOUND', 'No encontramos esa fotografía.');
  const updated = await db.$transaction(async tx => {
    await tx.photo.updateMany({ where: { businessId, isCover: true }, data: { isCover: false } });
    const selected = await tx.photo.update({ where: { id: photo.id }, data: { isCover: true } });
    await tx.business.update({ where: { id: businessId }, data: { coverPhotoId: selected.id } });
    return selected;
  });
  return serializePhoto(businessId, updated);
}

export async function clearCoverPhoto(userId: string, businessId: string) {
  await findBusinessForPhotos(userId, businessId);
  const business = await db.business.findUniqueOrThrow({ where: { id: businessId }, select: { coverPhotoId: true } });
  await db.$transaction(async tx => {
    if (business.coverPhotoId) await tx.photo.updateMany({ where: { id: business.coverPhotoId, businessId, isGallery: true }, data: { isCover: false } });
    await tx.business.update({ where: { id: businessId }, data: { coverPhotoId: null, coverImagePositionX: 50, coverImagePositionY: 50 } });
  });
}

export async function uploadCoverPhoto(userId: string, businessId: string, file: UploadedPhoto | undefined, positionX?: number, positionY?: number) {
  ensureFile(file);
  await findBusinessForPhotos(userId, businessId);
  const x = ensurePosition(positionX, 'la portada');
  const y = ensurePosition(positionY, 'la portada');
  const stored = await savePhoto(businessId, file.buffer, file.mimetype);
  try {
    const photo = await db.$transaction(async tx => {
      const created = await tx.photo.create({ data: { businessId, storageKey: stored.storageKey, url: null, source: 'NEGOCIOS', sortOrder: 0, isCover: false, isGallery: false, uploadedById: userId } });
      await tx.business.update({ where: { id: businessId }, data: { coverPhotoId: created.id, coverImagePositionX: x, coverImagePositionY: y } });
      return created;
    });
    return serializePhoto(businessId, photo);
  } catch (error) {
    await removePhoto(stored.storageKey).catch(() => undefined);
    throw error;
  }
}

export async function setProfilePhoto(userId: string, businessId: string, photoId: unknown, positionX?: number, positionY?: number) {
  await findBusinessForPhotos(userId, businessId);
  if (photoId === null) {
    await db.business.update({ where: { id: businessId }, data: { profilePhotoId: null, profileImagePositionX: 50, profileImagePositionY: 50 } });
    return null;
  }
  if (typeof photoId !== 'string' || !photoId.trim()) {
    throw new AppError(400, 'PHOTO_ID_REQUIRED', 'Selecciona una fotografía de la galería para usarla como imagen del negocio.');
  }
  const x = ensurePosition(positionX, 'la imagen de perfil');
  const y = ensurePosition(positionY, 'la imagen de perfil');
  const photo = await db.photo.findFirst({ where: { id: photoId, businessId, isGallery: true } });
  if (!photo) throw new AppError(404, 'PHOTO_NOT_FOUND', 'No encontramos esa fotografía en la galería del negocio.');
  await db.business.update({ where: { id: businessId }, data: { profilePhotoId: photo.id, profileImagePositionX: x, profileImagePositionY: y } });
  return serializePhoto(businessId, photo);
}

export async function getPhotoContent(userId: string, businessId: string, photoId: string) {
  await findBusinessForPhotos(userId, businessId);
  const photo = await db.photo.findFirst({ where: { id: photoId, businessId, OR: [{ offerId: null }, { offer: { deletedAt: null } }] } });
  if (!photo) throw new AppError(404, 'PHOTO_NOT_FOUND', 'No encontramos esa fotografía.');
  return { path: photoStoragePath(photo.storageKey), mimeType: photo.storageKey.endsWith('.png') ? 'image/png' : photo.storageKey.endsWith('.webp') ? 'image/webp' : 'image/jpeg' };
}
