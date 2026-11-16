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
import { nextPublicZoneLaunch, publicZoneStatus } from '../zones/zones.service.js';

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
publicBusinessRouter.get('/zones/next-launch',async(_req,res,next)=>{
  try{res.setHeader('Cache-Control','no-store');res.json({next:await nextPublicZoneLaunch(),serverTime:new Date().toISOString()});}
  catch(error){next(error);}
});
publicBusinessRouter.get('/zones/status',async(req,res,next)=>{
  try{
    const city=String(req.query.city??'').trim(), region=String(req.query.region??'').trim();
    if(city.length<1||city.length>160||region.length>160) return res.status(400).json({error:{code:'ZONE_INVALID_QUERY',message:'Selecciona una ciudad válida.'}});
    res.setHeader('Cache-Control','no-store');
    res.json({zone:await publicZoneStatus({city,region:region||undefined}),serverTime:new Date().toISOString()});
  }catch(error){next(error);}
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
