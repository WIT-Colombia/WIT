import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import { parseCookie, stringifySetCookie } from 'cookie';
import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { AppError } from '../../shared/errors/app-error.js';
import { isAuthorizedAdminGoogleSub } from '../auth/google-oauth.service.js';
import { readAdminPendingOAuth } from './admin-pending-oauth.service.js';
import { beginRegistration, finishRegistration } from './admin-webauthn.service.js';

const COOKIE = 'xamuko_admin_activation';
const TTL = 10 * 60;
const hash = (v: string) => createHash('sha256').update(v).digest('hex');
export function activationCodeMatches(configured: string | undefined, supplied: string): boolean { if (!configured || !supplied || !/^[a-f0-9]{64}$/i.test(configured)) return false; const actual = Buffer.from(hash(supplied), 'utf8'); const expected = Buffer.from(configured, 'utf8'); return actual.length === expected.length && timingSafeEqual(actual, expected); }
const setCookie = (response: Response, value: string, maxAge: number) => response.appendHeader('Set-Cookie', stringifySetCookie({ name: COOKIE, value, httpOnly: true, secure: env.nodeEnv === 'production', sameSite: 'lax', path: '/api/v1/admin/auth', maxAge }));

async function userForSub(googleSub: string) {
  const identity = await prisma.authIdentity.findUnique({ where: { provider_providerSubject: { provider: 'GOOGLE', providerSubject: googleSub } }, select: { userId: true } });
  if (!identity) throw new AppError(403, 'ADMIN_IDENTITY_NOT_LINKED', 'La identidad Google no está vinculada.');
  const role = await prisma.adminRoleAssignment.findFirst({ where: { userId: identity.userId, role: 'SUPER_ADMIN', active: true }, select: { userId: true } });
  if (!role) throw new AppError(403, 'ADMIN_SUPER_ADMIN_REQUIRED', 'La identidad no tiene autorización SUPER_ADMIN.');
  return identity.userId;
}
async function tokenFrom(request: Request) {
  const token = parseCookie(request.headers.cookie ?? '')[COOKIE];
  if (!token || !/^[A-Za-z0-9_-]{64}$/.test(token)) throw new AppError(401, 'ADMIN_ACTIVATION_INVALID', 'La activación no es válida.');
  const activation = await (prisma as any).adminPasskeyActivation.findUnique({ where: { tokenHash: hash(token) } });
  if (!activation || activation.consumedAt || activation.expiresAt <= new Date() || !isAuthorizedAdminGoogleSub(activation.googleSub)) throw new AppError(401, 'ADMIN_ACTIVATION_INVALID', 'La activación expiró o ya fue utilizada.');
  return activation;
}
export async function beginPasskeyActivation(request: Request, response: Response) {
  const configured = env.adminPasskeyActivationCodeHash;
  const supplied = request.header('x-admin-activation-code') ?? '';
  if (!activationCodeMatches(configured, supplied)) throw new AppError(403, 'ADMIN_ACTIVATION_AUTH_REQUIRED', 'Se requiere autorización operativa independiente.');
  const googleSub = await readAdminPendingOAuth(request);
  const userId = await userForSub(googleSub);
  const existing = await (prisma as any).adminWebAuthnCredential.count({ where: { userId, revokedAt: null } });
  if (existing > 0) throw new AppError(409, 'ADMIN_PASSKEY_ALREADY_REGISTERED', 'La activación inicial ya fue utilizada para esta cuenta.');
  const token = randomBytes(48).toString('base64url');
  await (prisma as any).adminPasskeyActivation.create({ data: { googleSub, tokenHash: hash(token), expiresAt: new Date(Date.now() + TTL * 1000) } });
  setCookie(response, token, TTL);
  return beginRegistration(userId);
}
export async function finishPasskeyActivation(request: Request) {
  const supplied = request.header('x-admin-activation-code') ?? '';
  if (!activationCodeMatches(env.adminPasskeyActivationCodeHash, supplied)) throw new AppError(403, 'ADMIN_ACTIVATION_AUTH_REQUIRED', 'Se requiere autorización operativa independiente.');
  const activation = await tokenFrom(request);
  const userId = await userForSub(activation.googleSub);
  const result = await finishRegistration(userId, request.body);
  const consumed = await (prisma as any).adminPasskeyActivation.updateMany({ where: { id: activation.id, consumedAt: null, expiresAt: { gt: new Date() } }, data: { consumedAt: new Date() } });
  if (consumed.count !== 1) throw new AppError(409, 'ADMIN_ACTIVATION_REUSED', 'La activación ya fue utilizada.');
  await prisma.auditLog.create({ data: { actorUserId: userId, entityType: 'ADMIN_SECURITY', entityId: activation.id, action: 'ADMIN_PASSKEY_ACTIVATED', previousState: {}, newState: { googleSub: activation.googleSub }, reason: 'One-time controlled activation' } });
  return result;
}
