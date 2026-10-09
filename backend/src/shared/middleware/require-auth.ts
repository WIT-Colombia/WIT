import type { RequestHandler } from 'express';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../errors/app-error.js';
import type { AuthenticatedRequest } from '../auth/auth-request.js';
import { verifyAccessToken } from '../auth/tokens.js';

export const requireAuth: RequestHandler = async (request, _response, next) => {
  try {
    const header = request.header('authorization');
    if (!header?.startsWith('Bearer ')) throw new AppError(401, 'UNAUTHENTICATED', 'Autenticación requerida.');
    const token = header.slice(7).trim();
    if (!token) throw new AppError(401, 'UNAUTHENTICATED', 'Autenticación requerida.');
    const auth = await verifyAccessToken(token);
    const user = await prisma.user.findUnique({ where: { id: auth.userId }, select: { status: true, authIdentities: { select: { verifiedAt: true } } } });
    if (!user || user.status !== 'ACTIVE') throw new AppError(401, 'UNAUTHENTICATED', 'Autenticación requerida.');
    if (!user.authIdentities.some((identity) => identity.verifiedAt !== null)) throw new AppError(403, 'EMAIL_NOT_VERIFIED', 'Verifica tu correo electrónico para continuar.');
    (request as AuthenticatedRequest).auth = auth;
    next();
  } catch (error) {
    if (error instanceof AppError) next(error);
    else next(new AppError(401, 'UNAUTHENTICATED', 'Autenticación requerida.'));
  }
};
