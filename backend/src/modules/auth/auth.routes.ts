import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../../shared/middleware/require-auth.js';
import { confirmEmailController, confirmPasswordResetController, loginController, logoutController, meController, refreshController, registerController, requestPasswordResetController, requestVerificationController } from './auth.controller.js';

export const authRouter = Router();
const authRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: { code: 'AUTH_RATE_LIMITED', message: 'Demasiados intentos. Intenta de nuevo más tarde.' } } });
authRouter.post('/register', authRateLimit, registerController);
authRouter.post('/login', authRateLimit, loginController);
authRouter.post('/refresh', authRateLimit, refreshController);
authRouter.post('/logout', logoutController);
authRouter.get('/me', requireAuth, meController);
authRouter.post('/verify-email/request', authRateLimit, requestVerificationController);
authRouter.post('/verify-email/confirm', authRateLimit, confirmEmailController);
authRouter.post('/password-reset/request', authRateLimit, requestPasswordResetController);
authRouter.post('/password-reset/confirm', authRateLimit, confirmPasswordResetController);
