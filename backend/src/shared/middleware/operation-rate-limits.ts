import rateLimit from 'express-rate-limit';
import type { Request, Response } from 'express';
import { env } from '../../config/env.js';
import type { AuthenticatedRequest } from '../auth/auth-request.js';

/**
 * H8: límites específicos para escrituras de reseñas y cargas de fotografías.
 * Aplica tras requireAuth; las cuotas por usuario no dependen de NAT/IP compartidas.
 * La cuota IP agrega protección contra múltiples cuentas. En producción con varias
 * réplicas será necesario un almacén distribuido (o un control equivalente en WAF).
 */
const windowMs = 15 * 60 * 1000;
const standard = { windowMs, standardHeaders: 'draft-8' as const, legacyHeaders: false };
const blocked = (_request: Request, response: Response) => {
  response.setHeader('Retry-After', String(windowMs / 1000));
  response.status(429).json({ error: { code: 'WRITE_RATE_LIMITED', message: 'Demasiadas acciones en poco tiempo. Intenta de nuevo más tarde.' } });
};
const userKey = (request: Request) =>
  'user:' + (request as AuthenticatedRequest).auth.userId;

// Cada límite se mide por IP y cuenta, y se aplica a las rutas de escritura.
export const reviewWriteIpLimit = rateLimit({ ...standard, limit: env.nodeEnv === 'development' ? 600 : 180, handler: blocked });
export const reviewWriteUserLimit = rateLimit({ ...standard, limit: env.nodeEnv === 'development' ? 200 : 60, keyGenerator: userKey, handler: blocked });
export const imageUploadIpLimit = rateLimit({ ...standard, limit: env.nodeEnv === 'development' ? 400 : 120, handler: blocked });
export const imageUploadUserLimit = rateLimit({ ...standard, limit: env.nodeEnv === 'development' ? 120 : 40, keyGenerator: userKey, handler: blocked });
