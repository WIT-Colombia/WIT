import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../../config/env.js';
import { optionalAuth } from '../../shared/middleware/optional-auth.js';
import { listPublicPromotionsController } from '../business/promotion.controller.js';
import {
  getPublicBusinessController,
  listPublicBusinessesController,
  listPublicNewArrivalsController,
  listPublicOffersController,
  listPublicPhotosController,
  listPublicProductsController,
  listPublicServicesController,
  publicPhotoContentController,
  searchPublicUniversalController,
  listPublicCategoriesController,
} from './public-business.controller.js';
import { listReviewsController } from '../reviews/review.controller.js';
import { publicZoneAvailability, publicUpcomingZone } from '../zones/zone-policy.service.js';
import { AppError } from '../../shared/errors/app-error.js';

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
publicBusinessRouter.get('/zones/next', async (_req, res, next) => {
  try { res.setHeader('Cache-Control','no-store'); res.json(await publicUpcomingZone()); }
  catch(error) { next(error); }
});
publicBusinessRouter.get('/zones/availability', async (req, res, next) => {
  try {
    const city=typeof req.query.city==='string'?req.query.city.trim():'';
    const department=typeof req.query.department==='string'?req.query.department.trim():'';
    if(!city||city.length>160||department.length>160)
      throw new AppError(400,'ZONE_CITY_INVALID','Selecciona una ciudad válida.');
    res.setHeader('Cache-Control','no-store');
    res.json(await publicZoneAvailability(city,department));
  } catch(error) { next(error); }
});
publicBusinessRouter.get('/businesses', listPublicBusinessesController);
publicBusinessRouter.get('/search', searchPublicUniversalController);
publicBusinessRouter.get('/categories', listPublicCategoriesController);
publicBusinessRouter.get('/new-arrivals', listPublicNewArrivalsController);
publicBusinessRouter.get('/businesses/:publicId/products', listPublicProductsController);
publicBusinessRouter.get('/businesses/:publicId/services', listPublicServicesController);
publicBusinessRouter.get('/businesses/:publicId/photos', listPublicPhotosController);
publicBusinessRouter.get('/businesses/:publicId/photos/:photoId/content', publicPhotoContentController);
publicBusinessRouter.get('/businesses/:publicId/offers', listPublicOffersController);
publicBusinessRouter.get('/businesses/:publicId/promotions', listPublicPromotionsController);
publicBusinessRouter.get('/businesses/:businessId/reviews', listReviewsController);
publicBusinessRouter.get('/businesses/:publicId', getPublicBusinessController);
