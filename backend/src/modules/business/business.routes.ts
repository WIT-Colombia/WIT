import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/require-auth.js';
import { requireTrustedOrigin } from '../../shared/middleware/require-trusted-origin.js';
import { createBusinessController, getBusinessController, getBusinessReferralSummaryController, listBusinessesController, listCategoriesController, updateBusinessController, requestDeletionController, recoverBusinessController, publishBusinessController, getVisibilityController, renewVisibilityController, setVisibilityController } from './business.controller.js';

export const businessCrudRouter = Router();
businessCrudRouter.use(requireAuth);
businessCrudRouter.get('/business-categories', listCategoriesController);
businessCrudRouter.get('/businesses', listBusinessesController);
businessCrudRouter.post('/businesses', requireTrustedOrigin, createBusinessController);
businessCrudRouter.get('/businesses/:businessId/referral-summary', getBusinessReferralSummaryController);
businessCrudRouter.get('/businesses/:businessId', getBusinessController);
businessCrudRouter.patch('/businesses/:businessId', requireTrustedOrigin, updateBusinessController);
businessCrudRouter.post('/businesses/:businessId/publish', requireTrustedOrigin, publishBusinessController);
businessCrudRouter.get('/businesses/:businessId/visibility', getVisibilityController);
businessCrudRouter.post('/businesses/:businessId/visibility/renew', requireTrustedOrigin, renewVisibilityController);
businessCrudRouter.post('/businesses/:businessId/visibility', requireTrustedOrigin, setVisibilityController);
businessCrudRouter.post('/businesses/:businessId/request-deletion', requireTrustedOrigin, requestDeletionController);
businessCrudRouter.post('/businesses/:businessId/recover', requireTrustedOrigin, recoverBusinessController);
