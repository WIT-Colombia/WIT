import { Router } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { env } from '../../config/env.js';
import { optionalAuth } from '../../shared/middleware/optional-auth.js';
import { requireAuth } from '../../shared/middleware/require-auth.js';
import { requireTrustedOrigin } from '../../shared/middleware/require-trusted-origin.js';
import { createPromotionController, deletePromotionController, deletePromotionPhotoController, finishPromotionController, getPublicPromotionController, listPromotionsController, listPublicPromotionsController, promotionPhotoContentController, publicPromotionPhotoController, recordPromotionViewController, updatePromotionController, uploadPromotionPhotoController } from './promotion.controller.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
export const promotionRouter = Router();

promotionRouter.get('/public/businesses/:publicId/promotions', listPublicPromotionsController);
promotionRouter.get('/public/promotions/:promotionId', getPublicPromotionController);
promotionRouter.get('/public/promotions/:promotionId/photos/:photoId', publicPromotionPhotoController);
promotionRouter.post('/public/promotions/:promotionId/views', rateLimit({ windowMs: 60_000, limit: env.nodeEnv === 'development' ? 180 : 30, standardHeaders: 'draft-8', legacyHeaders: false }), optionalAuth, recordPromotionViewController);

promotionRouter.get('/businesses/:businessId/promotions', requireAuth, listPromotionsController);
promotionRouter.get('/businesses/:businessId/promotions/:promotionId/photos/:photoId/content', requireAuth, promotionPhotoContentController);
promotionRouter.post('/businesses/:businessId/promotions', requireAuth, requireTrustedOrigin, createPromotionController);
promotionRouter.patch('/businesses/:businessId/promotions/:promotionId', requireAuth, requireTrustedOrigin, updatePromotionController);
promotionRouter.post('/businesses/:businessId/promotions/:promotionId/finish', requireAuth, requireTrustedOrigin, finishPromotionController);
promotionRouter.delete('/businesses/:businessId/promotions/:promotionId', requireAuth, requireTrustedOrigin, deletePromotionController);
promotionRouter.post('/businesses/:businessId/promotions/:promotionId/photos', requireAuth, requireTrustedOrigin, upload.single('file'), uploadPromotionPhotoController);
promotionRouter.delete('/businesses/:businessId/promotions/:promotionId/photos/:photoId', requireAuth, requireTrustedOrigin, deletePromotionPhotoController);
