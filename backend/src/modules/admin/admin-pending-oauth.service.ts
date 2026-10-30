import { createHash, randomBytes } from 'node:crypto';
import type { Request, Response } from 'express';
import { parseCookie, stringifySetCookie } from 'cookie';
import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { AppError } from '../../shared/errors/app-error.js';
import { isAuthorizedAdminGoogleSub } from '../auth/google-oauth.service.js';

const COOKIE = 'xamuko_admin_pending';
const PATH = '/api/v1';
const TTL_SECONDS = 5 * 60;
const hash = (value: string) => createHash('sha256').update(value).digest('hex');

export async function createAdminPendingOAuth(response: Response, googleSub: string): Promise<void> {
  if (!isAuthorizedAdminGoogleSub(googleSub)) throw new AppError(403, 'ADMIN_GOOGLE_SUB_DENIED', 'Identidad Google no autorizada.');
  const token = randomBytes(48).toString('base64url');
  await prisma.adminPendingOAuth.create({ data: { googleSub, tokenHash: hash(token), expiresAt: new Date(Date.now() + TTL_SECONDS * 1000) } });
  response.appendHeader('Set-Cookie', stringifySetCookie({ name: COOKIE, value: token, httpOnly: true, secure: env.nodeEnv === 'production', sameSite: 'lax', path: PATH, maxAge: TTL_SECONDS }));
}

export async function readAdminPendingOAuth(request: Request): Promise<string> {
  const token = parseCookie(request.headers.cookie ?? '')[COOKIE];
  if (!token || !/^[A-Za-z0-9_-]{64}$/.test(token)) throw new AppError(401, 'ADMIN_PENDING_INVALID', 'Debes autenticarte nuevamente con Google.');
  const record = await prisma.adminPendingOAuth.findUnique({ where: { tokenHash: hash(token) } });
  if (!record || record.consumedAt || record.expiresAt <= new Date() || !isAuthorizedAdminGoogleSub(record.googleSub)) {
    throw new AppError(401, 'ADMIN_PENDING_INVALID', 'Debes autenticarte nuevamente con Google.');
  }
  return record.googleSub;
}

export async function consumeAdminPendingOAuth(request: Request): Promise<string> {
  const token = parseCookie(request.headers.cookie ?? '')[COOKIE];
  if (!token || !/^[A-Za-z0-9_-]{64}$/.test(token)) throw new AppError(401, 'ADMIN_PENDING_INVALID', 'Debes autenticarte nuevamente con Google.');
  const tokenHash = hash(token);
  const record = await prisma.adminPendingOAuth.findUnique({ where: { tokenHash } });
  if (!record || record.consumedAt || record.expiresAt <= new Date() || !isAuthorizedAdminGoogleSub(record.googleSub)) {
    throw new AppError(401, 'ADMIN_PENDING_INVALID', 'Debes autenticarte nuevamente con Google.');
  }
  const updated = await prisma.adminPendingOAuth.updateMany({ where: { id: record.id, consumedAt: null, expiresAt: { gt: new Date() } }, data: { consumedAt: new Date() } });
  if (updated.count !== 1) throw new AppError(401, 'ADMIN_PENDING_INVALID', 'Debes autenticarte nuevamente con Google.');
  return record.googleSub;
}

export function clearAdminPendingOAuth(response: Response): void {
  response.appendHeader('Set-Cookie', stringifySetCookie({ name: COOKIE, value: '', httpOnly: true, secure: env.nodeEnv === 'production', sameSite: 'lax', path: PATH, maxAge: 0 }));
}
