import { Router } from 'express';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';
import { readAdminPendingOAuth, consumeAdminPendingOAuth, clearAdminPendingOAuth } from './admin-pending-oauth.service.js';
import { beginAuthentication, finishAuthentication } from './admin-webauthn.service.js';

export const adminAuthRouter = Router();

async function userIdForGoogleSub(googleSub: string): Promise<string> {
  const identity = await prisma.authIdentity.findUnique({ where: { provider_providerSubject: { provider: 'GOOGLE', providerSubject: googleSub } }, select: { userId: true } });
  if (!identity) throw new AppError(403, 'ADMIN_IDENTITY_NOT_LINKED', 'La identidad Google autorizada aún no está vinculada a una cuenta.');
  return identity.userId;
}

adminAuthRouter.get('/webauthn/options', async (request, response, next) => {
  try {
    const googleSub = await readAdminPendingOAuth(request);
    response.json(await beginAuthentication(await userIdForGoogleSub(googleSub)));
  } catch (error) { next(error); }
});

adminAuthRouter.post('/webauthn/verify', async (request, response, next) => {
  try {
    const googleSub = await readAdminPendingOAuth(request);
    const verified = await finishAuthentication(await userIdForGoogleSub(googleSub), request.body);
    await consumeAdminPendingOAuth(request);
    clearAdminPendingOAuth(response);
    response.json({ verified: verified.verified, requiresAdminSession: true });
  } catch (error) { next(error); }
});
