import { readFile } from 'node:fs/promises';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';
import { PHOTO_MAX_BYTES, PHOTO_MIME_TYPES, photoStoragePath, savePhoto } from '../business/photo-storage.js';

type AvatarFile = { buffer: Buffer; mimetype: string; size: number };

function validate(file: AvatarFile | undefined): asserts file is AvatarFile {
  if (!file) throw new AppError(400, 'AVATAR_REQUIRED', 'Selecciona una imagen.');
  if (!PHOTO_MIME_TYPES.has(file.mimetype) || file.size > PHOTO_MAX_BYTES) throw new AppError(422, 'AVATAR_INVALID', 'La imagen debe ser JPG, PNG o WebP y pesar máximo 5 MB.');
}

export async function uploadAvatar(userId: string, file: AvatarFile | undefined) {
  validate(file);
  const stored = await savePhoto(`user-avatars/${userId}`, file.buffer, file.mimetype);
  await prisma.user.update({ where: { id: userId }, data: { avatarUrl: `private-avatar:${stored.storageKey}` } });
}

export async function readOwnAvatar(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { avatarUrl: true } });
  const storageKey = user?.avatarUrl?.startsWith('private-avatar:') ? user.avatarUrl.slice('private-avatar:'.length) : null;
  if (!storageKey || !/^user-avatars\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(storageKey)) throw new AppError(404, 'AVATAR_NOT_FOUND', 'No encontramos la foto.');
  return { content: await readFile(photoStoragePath(storageKey)), mimeType: storageKey.endsWith('.png') ? 'image/png' : storageKey.endsWith('.webp') ? 'image/webp' : 'image/jpeg' };
}
