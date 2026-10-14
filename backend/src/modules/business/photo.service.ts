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

export async function listPhotos(userId: string, businessId: string) {
  await findBusinessForPhotos(userId, businessId);
  const photos = await db.photo.findMany({ where: { businessId }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });
  return photos.map(photo => serializePhoto(businessId, photo));
}

export async function uploadPhoto(userId: string, businessId: string, file: UploadedPhoto | undefined, requestedCover: boolean) {
  ensureFile(file);
  await findBusinessForPhotos(userId, businessId);
  const count = await db.photo.count({ where: { businessId } });
  if (count >= 10) throw new AppError(422, 'PHOTO_LIMIT_REACHED', 'Cada negocio puede tener máximo 10 fotografías.');
  const existingCover = await db.photo.findFirst({ where: { businessId, isCover: true }, select: { id: true } });
  const stored = await savePhoto(businessId, file.buffer, file.mimetype);
  try {
    const photo = await db.$transaction(async tx => {
      if (requestedCover || !existingCover) await tx.photo.updateMany({ where: { businessId, isCover: true }, data: { isCover: false } });
      return tx.photo.create({ data: { businessId, storageKey: stored.storageKey, url: null, source: 'NEGOCIOS', sortOrder: count, isCover: requestedCover || !existingCover, uploadedById: userId } });
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
  await db.$transaction(async tx => {
    await tx.photo.delete({ where: { id: photo.id } });
    if (photo.isCover) {
      const replacement = await tx.photo.findFirst({ where: { businessId }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });
      if (replacement) await tx.photo.update({ where: { id: replacement.id }, data: { isCover: true } });
    }
  });
}

export async function setPhotoCover(userId: string, businessId: string, photoId: string) {
  await findBusinessForPhotos(userId, businessId);
  const photo = await db.photo.findFirst({ where: { id: photoId, businessId } });
  if (!photo) throw new AppError(404, 'PHOTO_NOT_FOUND', 'No encontramos esa fotografía.');
  const updated = await db.$transaction(async tx => {
    await tx.photo.updateMany({ where: { businessId, isCover: true }, data: { isCover: false } });
    return tx.photo.update({ where: { id: photo.id }, data: { isCover: true } });
  });
  return serializePhoto(businessId, updated);
}

export async function getPhotoContent(userId: string, businessId: string, photoId: string) {
  await findBusinessForPhotos(userId, businessId);
  const photo = await db.photo.findFirst({ where: { id: photoId, businessId } });
  if (!photo) throw new AppError(404, 'PHOTO_NOT_FOUND', 'No encontramos esa fotografía.');
  return { path: photoStoragePath(photo.storageKey), mimeType: photo.storageKey.endsWith('.png') ? 'image/png' : photo.storageKey.endsWith('.webp') ? 'image/webp' : 'image/jpeg' };
}
