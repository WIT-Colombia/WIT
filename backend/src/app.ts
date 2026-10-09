import express from 'express';
import { apiRouter } from './routes.js';
import { errorHandler } from './shared/middleware/error-handler.js';
import { notFound } from './shared/middleware/not-found.js';

export const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));
app.use('/api/v1', apiRouter);
app.use(notFound);
app.use(errorHandler);
