import { createHash } from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { env } from '../../config/env.js';
import { requireAuth } from '../../shared/middleware/require-auth.js';
import { requireTrustedOrigin } from '../../shared/middleware/require-trusted-origin.js';
import { changePasswordController, confirmEmailController, confirmPasswordResetController, googleCallbackController, googleLinkStartController, googleStartController, loginController, logoutController, meController, ownAvatarController, refreshController, registerController, requestPasswordResetController, requestVerificationController, updateAdultContentPreferenceController, getPreferredLocationController, savePreferredLocationController, updateProfileController, uploadAvatarController } from './auth.controller.js';
import { LOGIN_ACCOUNT_WINDOW_SECONDS, LOGIN_IP_WINDOW_SECONDS, LOGIN_RATE_LIMIT } from './auth-rate-limit-policy.js';

export const authRouter = Router();
const avatarUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
const authRateLimitWindowMs = env.nodeEnv === 'development' ? 60 * 1000 : 15 * 60 * 1000;
const authRateLimitLimit = env.nodeEnv === 'development' ? 60 : 10;
const authRateLimit = rateLimit({
  windowMs: authRateLimitWindowMs,
  limit: authRateLimitLimit,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_request, response) => {
    response.setHeader('Retry-After', String(Math.ceil(authRateLimitWindowMs / 1000)));
    response.status(429).json({ error: { code: 'AUTH_RATE_LIMITED', message: 'Demasiados intentos. Intenta de nuevo más tarde.' } });
  },
});
const loginRateLimitWindowMs = LOGIN_IP_WINDOW_SECONDS * 1000;
const loginRateLimit = rateLimit({
  windowMs: loginRateLimitWindowMs,
  limit: LOGIN_RATE_LIMIT,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_request, response) => {
    response.setHeader('Retry-After', String(Math.ceil(loginRateLimitWindowMs / 1000)));
    response.status(429).json({ error: { code: 'AUTH_RATE_LIMITED', message: 'Demasiados intentos. Espera 60 segundos antes de intentar de nuevo.' } });
  },
});
const loginAccountRateLimit = rateLimit({
  windowMs: LOGIN_ACCOUNT_WINDOW_SECONDS * 1000,
  limit: LOGIN_RATE_LIMIT,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (request) => createHash('sha256').update(typeof request.body?.email === 'string' ? request.body.email.trim().toLocaleLowerCase('en-US') : '').digest('hex'),
  handler: (_request, response) => {
    response.setHeader('Retry-After', String(LOGIN_ACCOUNT_WINDOW_SECONDS));
    response.status(429).json({ error: { code: 'AUTH_RATE_LIMITED', message: 'Demasiados intentos para esta cuenta. Intenta más tarde.' } });
  },
});
authRouter.post('/register', authRateLimit, requireTrustedOrigin, registerController);
authRouter.post('/login', loginAccountRateLimit, loginRateLimit, requireTrustedOrigin, loginController);
authRouter.post('/refresh', authRateLimit, requireTrustedOrigin, refreshController);
authRouter.post('/logout', authRateLimit, requireTrustedOrigin, logoutController);
authRouter.get('/me', requireAuth, meController);
authRouter.get('/me/avatar', requireAuth, ownAvatarController);
authRouter.post('/me/avatar', requireAuth, requireTrustedOrigin, avatarUpload.single('file'), uploadAvatarController);
authRouter.patch('/me', requireAuth, requireTrustedOrigin, updateProfileController);
authRouter.patch('/me/adult-content', requireAuth, requireTrustedOrigin, updateAdultContentPreferenceController);
authRouter.get('/me/location', requireAuth, getPreferredLocationController);
authRouter.put('/me/location', requireAuth, requireTrustedOrigin, savePreferredLocationController);
authRouter.post('/change-password', requireAuth, requireTrustedOrigin, authRateLimit, changePasswordController);
const verificationIpLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false, handler: (_req, res) => { res.setHeader('Retry-After', '900'); res.status(429).json({ error: { code: 'AUTH_RATE_LIMITED', message: 'Demasiadas solicitudes de verificación. Intenta más tarde.' } }); } });
const verificationAddressLimit = rateLimit({ windowMs: 60 * 1000, limit: 1, standardHeaders: 'draft-8', legacyHeaders: false, keyGenerator: (req) => createHash('sha256').update(typeof req.body?.email === 'string' ? req.body.email.trim().toLocaleLowerCase('en-US') : '').digest('hex'), handler: (_req, res) => { res.setHeader('Retry-After', '60'); res.status(429).json({ error: { code: 'AUTH_RATE_LIMITED', message: 'Espera un minuto antes de solicitar otro enlace.' } }); } });
authRouter.post('/verify-email/request', requireTrustedOrigin, verificationIpLimit, verificationAddressLimit, requestVerificationController);
authRouter.post('/verify-email/confirm', authRateLimit, confirmEmailController);
authRouter.post('/password-reset/request', authRateLimit, requestPasswordResetController);
authRouter.post('/password-reset/confirm', authRateLimit, confirmPasswordResetController);
authRouter.get('/google/start', googleStartController);
authRouter.get('/google/callback', googleCallbackController);
authRouter.post('/google/link/start', requireAuth, requireTrustedOrigin, googleLinkStartController);
