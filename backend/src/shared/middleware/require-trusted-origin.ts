import type { RequestHandler } from 'express';
import { env } from '../../config/env.js';
import { AppError } from '../errors/app-error.js';

export const requireTrustedOrigin: RequestHandler = (request, _response, next) => {
  const origin = request.get('origin');
  if (origin && env.trustedOrigins.includes(origin)) {
    next();
    return;
  }
  if (!origin && !request.get('referer')) {
    next();
    return;
  }
  if (!origin && request.get('referer')) {
    try {
      const refererOrigin = new URL(request.get('referer') as string).origin;
      if (env.trustedOrigins.includes(refererOrigin)) {
        next();
        return;
      }
    } catch {
      // Fall through to the same safe response as an untrusted origin.
    }
  }
  next(new AppError(403, 'UNTRUSTED_ORIGIN', 'Origen de solicitud no autorizado.'));
};
