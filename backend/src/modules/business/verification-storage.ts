import { mkdir, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const root = resolve(process.env.VERIFICATION_STORAGE_DIR?.trim() || fileURLToPath(new URL('../../../storage/business-verification', import.meta.url)));
export const VERIFICATION_MAX_BYTES = 10 * 1024 * 1024;
export const VERIFICATION_MIME = 'application/pdf';
export function verificationStoragePath(key: string) { return join(root, key); }
export async function saveVerificationPdf(businessId: string, buffer: Buffer) {
  const key = `${businessId}/${randomUUID()}.pdf`;
  const target = verificationStoragePath(key); const temporary = `${target}.uploading`;
  await mkdir(dirname(target), { recursive: true });
  try { await writeFile(temporary, buffer, { flag: 'wx' }); await rename(temporary, target); return { key, path: target }; }
  catch (error) { await unlink(temporary).catch(() => undefined); throw error; }
}
export async function removeVerificationPdf(key: string) { await unlink(verificationStoragePath(key)); }
