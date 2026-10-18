import type { RequestHandler } from 'express';
import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { verifyAccessToken } from '../auth/tokens.js';
import type { AuthenticatedRequest } from '../auth/auth-request.js';
import { shouldRequireEmailVerification } from '../../modules/auth/email-login-policy.js';

/**
 * Public routes remain accessible without credentials. A malformed, expired,
 * revoked or unverified token is treated as anonymous and can never unlock
 * restricted content.
 */
export const optionalAuth: RequestHandler = async (request, _response, next) => {
  const header = request.header('authorization');
  if (!header?.startsWith('Bearer ')) return next();
  try {
    const token = header.slice(7).trim();
    if (!token) return next();
    const auth = await verifyAccessToken(token);
    const session = await prisma.session.findUnique({ where: { id: auth.sessionId }, select: { userId: true, revokedAt: true, expiresAt: true } });
    if (!session || session.userId !== auth.userId || session.revokedAt || session.expiresAt <= new Date()) return next();
    const user = await prisma.user.findUnique({ where: { id: auth.userId }, select: { status: true, authIdentities: { select: { verifiedAt: true } } } });
    if (!user || user.status !== 'ACTIVE' || user.authIdentities.every(identity => shouldRequireEmailVerification(identity.verifiedAt, env.allowUnverifiedEmailLogin))) return next();
    (request as AuthenticatedRequest).auth = auth;
  } catch {
    // Public access is intentionally preserved; invalid credentials never grant access.
  }
  return next();
};
