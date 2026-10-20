import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/require-auth.js';
import { requireTrustedOrigin } from '../../shared/middleware/require-trusted-origin.js';
import { catalogLimitsController, createOfferController, deleteOfferController, listOffersController, updateOfferController } from './offer.controller.js';

export const offerRouter = Router();
offerRouter.use(requireAuth);
offerRouter.get('/businesses/:businessId/offers', listOffersController);
offerRouter.get('/businesses/:businessId/catalog-limits', catalogLimitsController);
offerRouter.post('/businesses/:businessId/offers', requireTrustedOrigin, createOfferController);
offerRouter.patch('/businesses/:businessId/offers/:offerId', requireTrustedOrigin, updateOfferController);
offerRouter.delete('/businesses/:businessId/offers/:offerId', requireTrustedOrigin, deleteOfferController);
