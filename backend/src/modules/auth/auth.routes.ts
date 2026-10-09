import { createHash } from 'node:crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../../config/env.js';
import { requireAuth } from '../../shared/middleware/require-auth.js';
import { requireTrustedOrigin } from '../../shared/middleware/require-trusted-origin.js';
import { changePasswordController, confirmEmailController, confirmPasswordResetController, googleCallbackController, googleLinkStartController, googleStartController, loginController, logoutController, meController, refreshController, registerController, requestPasswordResetController, requestVerificationController, updateProfileController } from './auth.controller.js';

export const authRouter = Router();
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
authRouter.post('/register', authRateLimit, requireTrustedOrigin, registerController);
authRouter.post('/login', authRateLimit, requireTrustedOrigin, loginController);
authRouter.post('/refresh', authRateLimit, requireTrustedOrigin, refreshController);
authRouter.post('/logout', authRateLimit, requireTrustedOrigin, logoutController);
authRouter.get('/me', requireAuth, meController);
authRouter.patch('/me', requireAuth, requireTrustedOrigin, updateProfileController);
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
