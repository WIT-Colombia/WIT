import { Router } from 'express';
import { optionalAuth } from '../../shared/middleware/optional-auth.js';
import {
  getPublicBusinessController,
  listPublicBusinessesController,
  listPublicOffersController,
  listPublicPhotosController,
  listPublicProductsController,
  listPublicServicesController,
  publicPhotoContentController,
} from './public-business.controller.js';

export const publicBusinessRouter = Router();
publicBusinessRouter.use(optionalAuth);
publicBusinessRouter.get('/businesses', listPublicBusinessesController);
publicBusinessRouter.get('/businesses/:publicId/products', listPublicProductsController);
publicBusinessRouter.get('/businesses/:publicId/services', listPublicServicesController);
publicBusinessRouter.get('/businesses/:publicId/photos', listPublicPhotosController);
publicBusinessRouter.get('/businesses/:publicId/photos/:photoId/content', publicPhotoContentController);
publicBusinessRouter.get('/businesses/:publicId/offers', listPublicOffersController);
publicBusinessRouter.get('/businesses/:publicId', getPublicBusinessController);
