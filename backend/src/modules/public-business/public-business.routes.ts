import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../../config/env.js';
import { optionalAuth } from '../../shared/middleware/optional-auth.js';
import {
  getPublicBusinessController,
  listPublicBusinessesController,
  listPublicOffersController,
  listPublicPhotosController,
  listPublicProductsController,
  listPublicServicesController,
  publicPhotoContentController,
  searchPublicUniversalController,
} from './public-business.controller.js';
import { listReviewsController } from '../reviews/review.controller.js';

export const publicBusinessRouter = Router();
const publicReadRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: env.nodeEnv === 'development' ? 300 : 120,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_request, response) => {
    response.setHeader('Retry-After', '60');
    response.status(429).json({ error: { code: 'PUBLIC_RATE_LIMITED', message: 'Demasiadas consultas. Intenta de nuevo en un momento.' } });
  },
});
publicBusinessRouter.use(publicReadRateLimit);
publicBusinessRouter.use(optionalAuth);
publicBusinessRouter.get('/businesses', listPublicBusinessesController);
publicBusinessRouter.get('/search', searchPublicUniversalController);
publicBusinessRouter.get('/businesses/:publicId/products', listPublicProductsController);
publicBusinessRouter.get('/businesses/:publicId/services', listPublicServicesController);
publicBusinessRouter.get('/businesses/:publicId/photos', listPublicPhotosController);
publicBusinessRouter.get('/businesses/:publicId/photos/:photoId/content', publicPhotoContentController);
publicBusinessRouter.get('/businesses/:publicId/offers', listPublicOffersController);
publicBusinessRouter.get('/businesses/:businessId/reviews', listReviewsController);
publicBusinessRouter.get('/businesses/:publicId', getPublicBusinessController);
