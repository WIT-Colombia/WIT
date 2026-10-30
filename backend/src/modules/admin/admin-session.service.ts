import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import { parseCookie, stringifySetCookie } from 'cookie';
import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { AppError } from '../../shared/errors/app-error.js';
import { getAdminContext } from './admin-auth.service.js';

const SESSION_COOKIE = 'xamuko_admin_session';
const CSRF_COOKIE = 'xamuko_admin_csrf';
const COOKIE_PATH = '/api/v1/admin';
const TTL_SECONDS = 8 * 60 * 60;
const hash = (value: string) => createHash('sha256').update(value).digest('hex');

function cookieOptions(maxAge: number) { return { httpOnly: true, secure: env.nodeEnv === 'production', sameSite: 'lax' as const, path: COOKIE_PATH, maxAge }; }
function append(response: Response, name: string, value: string, maxAge: number, httpOnly: boolean) { response.appendHeader('Set-Cookie', stringifySetCookie({ name, value, ...cookieOptions(maxAge), httpOnly })); }

export async function issueAdminSession(response: Response, userId: string): Promise<void> {
  const context = await getAdminContext(userId);
  if (!context || context.role !== 'SUPER_ADMIN') throw new AppError(403, 'ADMIN_ACCESS_DENIED', 'La cuenta no tiene rol SUPER_ADMIN.');
  const token = randomBytes(48).toString('base64url');
  const csrf = randomBytes(32).toString('base64url');
  await (prisma as any).adminSession.create({ data: { userId, tokenHash: hash(token), expiresAt: new Date(Date.now() + TTL_SECONDS * 1000) } });
  append(response, SESSION_COOKIE, token, TTL_SECONDS, true);
  append(response, CSRF_COOKIE, csrf, TTL_SECONDS, false);
}

function token(request: Request): string | null { return parseCookie(request.headers.cookie ?? '')[SESSION_COOKIE] ?? null; }
export async function requireAdminSession(request: Request): Promise<{ userId: string; csrf: string }> {
  const raw = token(request);
  if (!raw || !/^[A-Za-z0-9_-]{64}$/.test(raw)) throw new AppError(401, 'ADMIN_SESSION_REQUIRED', 'Sesión administrativa requerida.');
  const record = await (prisma as any).adminSession.findUnique({ where: { tokenHash: hash(raw) } });
  if (!record || record.revokedAt || record.expiresAt <= new Date()) throw new AppError(401, 'ADMIN_SESSION_INVALID', 'La sesión administrativa no es válida.');
  const context = await getAdminContext(record.userId);
  if (!context || context.role !== 'SUPER_ADMIN') throw new AppError(403, 'ADMIN_ACCESS_DENIED', 'Acceso administrativo denegado.');
  const csrf = parseCookie(request.headers.cookie ?? '')[CSRF_COOKIE] ?? '';
  if (!['GET','HEAD','OPTIONS'].includes(request.method)) {
    const supplied = request.header('x-admin-csrf') ?? '';
    if (!csrf || !supplied || csrf.length !== supplied.length || !timingSafeEqual(Buffer.from(csrf), Buffer.from(supplied))) throw new AppError(403, 'ADMIN_CSRF_INVALID', 'Verificación CSRF requerida.');
  }
  return { userId: record.userId, csrf };
}
export async function revokeAdminSession(request: Request, response: Response): Promise<void> {
  const raw = token(request); if (raw) await (prisma as any).adminSession.updateMany({ where: { tokenHash: hash(raw), revokedAt: null }, data: { revokedAt: new Date() } });
  append(response, SESSION_COOKIE, '', 0, true); append(response, CSRF_COOKIE, '', 0, false);
}
