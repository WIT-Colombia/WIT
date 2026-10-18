import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/require-auth.js';
import { requireTrustedOrigin } from '../../shared/middleware/require-trusted-origin.js';
import { createOfferController, listOffersController, updateOfferController } from './offer.controller.js';

export const offerRouter = Router();
offerRouter.use(requireAuth);
offerRouter.get('/businesses/:businessId/offers', listOffersController);
offerRouter.post('/businesses/:businessId/offers', requireTrustedOrigin, createOfferController);
offerRouter.patch('/businesses/:businessId/offers/:offerId', requireTrustedOrigin, updateOfferController);
