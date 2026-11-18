import express from 'express';
import type { RequestHandler } from 'express';
import { env } from './config/env.js';
import { apiRouter } from './routes.js';
import { errorHandler } from './shared/middleware/error-handler.js';
import { notFound } from './shared/middleware/not-found.js';

export const app = express();
app.disable('x-powered-by');
// H9: cabeceras de defensa en profundidad para todas las respuestas de API.
// No imponemos un CSP general de scripts que pueda romper las aplicaciones SPA.
app.use((_request, response, next) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.setHeader('Content-Security-Policy', "frame-ancestors 'none'; object-src 'none'; base-uri 'none'");
  response.setHeader('Strict-Transport-Security', 'max-age=31536000');
  next();
});

// Reflect only exact trusted origins; wildcard origins cannot be used with
// credentialed cookies.
export const corsMiddleware: RequestHandler = (request, response, next) => {
  const origin = request.headers.origin;
  if (!origin) {
    next();
    return;
  }

  response.vary('Origin');
  // Public launch information and explicit opt-in are also used by the marketing landing.
  // Permit only the two official marketing origins, only on the dedicated public zone routes.
  const landingZonesOrigin = ['https://xamuko.com', 'https://www.xamuko.com'].includes(origin)
    && request.path.startsWith('/api/v1/public/zones/');
  if (!env.trustedOrigins.includes(origin) && !landingZonesOrigin) {
    if (request.method === 'OPTIONS') {
      response.status(403).json({ error: { code: 'CORS_ORIGIN_NOT_ALLOWED', message: 'Origen no permitido.' } });
      return;
    }
    next();
    return;
  }

  response.setHeader('Access-Control-Allow-Origin', origin);
  if (!landingZonesOrigin) response.setHeader('Access-Control-Allow-Credentials', 'true');
  response.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token, X-Requested-With, X-Admin-CSRF, X-Admin-Activation-Code');
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
