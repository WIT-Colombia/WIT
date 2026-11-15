import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { resolve, join, isAbsolute } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { AppError } from '../../shared/errors/app-error.js';

export const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;
const backend = process.env.ADMIN_DOCUMENT_STORAGE_BACKEND?.trim() || process.env.PHOTO_STORAGE_BACKEND?.trim() || 'local';
// Documents must have an explicitly designated private bucket. Never assume
// that a bucket configured for business photos has the same access policy.
const bucket = process.env.ADMIN_DOCUMENT_S3_BUCKET?.trim();
const root = resolve(process.env.ADMIN_DOCUMENT_STORAGE_DIR?.trim() || 'storage/admin-documents');
const s3 = backend === 's3' ? new S3Client({ region: process.env.AWS_REGION || 'us-east-2' }) : null;
export function assertDocumentStorageReady() {
  if (!['local', 's3'].includes(backend) || (backend === 's3' && !bucket) ||
      (process.env.NODE_ENV === 'production' && backend === 'local' && !isAbsolute(process.env.ADMIN_DOCUMENT_STORAGE_DIR?.trim() || ''))) {
    throw new AppError(503, 'ADMIN_DOCUMENT_STORAGE_REQUIRED', 'El archivo documental requiere almacenamiento privado persistente.');
  }
}
function checkedKey(key: string) {
  if (!/^admin-documents\/[0-9a-f-]{36}\.pdf$/.test(key)) throw new AppError(400, 'INVALID_DOCUMENT_KEY', 'Referencia de archivo inválida.');
  return key;
}
export async function saveAdminDocument(buffer: Buffer) {
  assertDocumentStorageReady();
  const key = `admin-documents/${randomUUID()}.pdf`;
  if (s3) {
    await s3.send(new PutObjectCommand({ Bucket: bucket!, Key: key, Body: buffer, ContentType: 'application/pdf', ServerSideEncryption: 'AES256', CacheControl: 'private, no-store' }));
  } else {
    await mkdir(join(root, 'admin-documents'), { recursive: true, mode: 0o700 });
    const target = join(root, key), temporary = `${target}.uploading`;
    try { await writeFile(temporary, buffer, { flag: 'wx', mode: 0o600 }); await rename(temporary, target); }
    catch (error) { await unlink(temporary).catch(() => undefined); throw error; }
  }
  return key;
}
export async function readAdminDocument(key: string) {
  assertDocumentStorageReady(); checkedKey(key);
  if (!s3) return readFile(join(root, key));
  const response = await s3.send(new GetObjectCommand({ Bucket: bucket!, Key: key }));
  if (!response.Body) throw new AppError(404, 'DOCUMENT_FILE_MISSING', 'El archivo no está disponible.');
  return Buffer.from(await response.Body.transformToByteArray());
}
// Only used to clean up a newly uploaded file if its database transaction fails.
export async function discardUnregisteredDocument(key: string) {
  checkedKey(key);
  if (s3) await s3.send(new DeleteObjectCommand({ Bucket: bucket!, Key: key }));
  else await unlink(join(root, key));
}
