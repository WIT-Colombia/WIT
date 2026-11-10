import { createWriteStream } from 'node:fs';
import { mkdir, readFile, unlink } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const storageRoot = resolve(process.env.PHOTO_STORAGE_DIR?.trim() || fileURLToPath(new URL('../../../storage/business-photos', import.meta.url)));
const backend = process.env.PHOTO_STORAGE_BACKEND?.trim().toLowerCase() || 'local';
const bucket = process.env.PHOTO_S3_BUCKET?.trim();
const region = process.env.AWS_REGION?.trim() || 'us-east-2';
const s3 = backend === 's3' ? new S3Client({ region }) : null;
if (backend === 's3' && !bucket) throw new Error('PHOTO_S3_BUCKET es obligatorio cuando PHOTO_STORAGE_BACKEND=s3.');

const extensionByMime: Record<string, string> = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
export const PHOTO_MIME_TYPES = new Set(Object.keys(extensionByMime));
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const photoStoragePath = (storageKey: string) => join(storageRoot, storageKey);
export const photoMimeType = (storageKey: string) => storageKey.endsWith('.png') ? 'image/png' : storageKey.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
export const isPhotoMissingError = (error: unknown) => Boolean(error && typeof error === 'object' && (error as { name?: string }).name === 'NoSuchKey');

export async function savePhoto(businessId: string, buffer: Buffer, mimeType: string) {
  const extension = extensionByMime[mimeType];
  if (!extension) throw new Error('UNSUPPORTED_PHOTO_TYPE');
  const storageKey = `${businessId}/${randomUUID()}${extension}`;
  if (backend === 's3') {
    await s3!.send(new PutObjectCommand({ Bucket: bucket, Key: storageKey, Body: buffer, ContentType: mimeType, ServerSideEncryption: 'AES256' }));
    return { storageKey, path: storageKey };
  }
  const target = photoStoragePath(storageKey);
  await mkdir(dirname(target), { recursive: true });
  const temporary = `${target}.uploading`;
  try {
    await new Promise<void>((resolvePromise, reject) => { const stream = createWriteStream(temporary, { flags: 'wx' }); stream.on('error', reject); stream.on('finish', resolvePromise); stream.end(buffer); });
    await import('node:fs/promises').then(({ rename }) => rename(temporary, target));
    return { storageKey, path: target };
  } catch (error) { await unlink(temporary).catch(() => undefined); throw error; }
}

export async function readPhoto(storageKey: string) {
  if (backend !== 's3') return readFile(photoStoragePath(storageKey));
  const response = await s3!.send(new GetObjectCommand({ Bucket: bucket, Key: storageKey }));
  if (!response.Body) throw new Error('PHOTO_EMPTY');
  return Buffer.from(await response.Body.transformToByteArray());
}

export async function removePhoto(storageKey: string) {
  if (backend === 's3') { await s3!.send(new DeleteObjectCommand({ Bucket: bucket, Key: storageKey })); return; }
  await unlink(photoStoragePath(storageKey));
}
