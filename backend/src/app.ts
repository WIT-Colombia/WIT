import express from 'express';
import { env } from './config/env.js';
import { apiRouter } from './routes.js';
import { errorHandler } from './shared/middleware/error-handler.js';
import { notFound } from './shared/middleware/not-found.js';

export const app = express();
app.disable('x-powered-by');

// CORS is enforced at the HTTP boundary; AUTH_TRUSTED_ORIGINS is the allowlist.
// Keep this before JSON parsing, routing and authentication so preflights succeed.
app.use((request, response, next) => {
  const origin = request.get('origin');
  response.vary('Origin');

  if (!origin) {
    next();
    return;
  }

  if (!env.trustedOrigins.includes(origin)) {
    if (request.method === 'OPTIONS') {
      response.sendStatus(403);
      return;
    }
    next();
    return;
  }

  response.setHeader('Access-Control-Allow-Origin', origin);
  response.setHeader('Access-Control-Allow-Credentials', 'true');

  if (request.method === 'OPTIONS') {
    response.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    response.setHeader('Access-Control-Max-Age', '600');
    response.sendStatus(204);
    return;
  }

  next();
});

app.use(express.json({ limit: '100kb' }));
app.use('/api/v1', apiRouter);
app.use(notFound);
app.use(errorHandler);
