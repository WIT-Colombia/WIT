import express from 'express';
import type { RequestHandler } from 'express';
import { env } from './config/env.js';
import { apiRouter } from './routes.js';
import { errorHandler } from './shared/middleware/error-handler.js';
import { notFound } from './shared/middleware/not-found.js';

export const app = express();
app.disable('x-powered-by');

// Reflect only exact trusted origins; wildcard origins cannot be used with
// credentialed cookies.
export const corsMiddleware: RequestHandler = (request, response, next) => {
  const origin = request.headers.origin;
  if (!origin) {
    next();
    return;
  }

  response.vary('Origin');
  if (!env.trustedOrigins.includes(origin)) {
    if (request.method === 'OPTIONS') {
      response.status(403).json({ error: { code: 'CORS_ORIGIN_NOT_ALLOWED', message: 'Origen no permitido.' } });
      return;
    }
    next();
    return;
  }

  response.setHeader('Access-Control-Allow-Origin', origin);
  response.setHeader('Access-Control-Allow-Credentials', 'true');
  response.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token, X-Requested-With');
  if (request.method === 'OPTIONS') {
    response.status(204).end();
    return;
  }
  next();
};

app.use(corsMiddleware);
app.use(express.json({ limit: '100kb' }));
app.use('/api/v1', apiRouter);
app.use(notFound);
app.use(errorHandler);
