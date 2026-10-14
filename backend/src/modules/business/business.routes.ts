import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/require-auth.js';
import { requireTrustedOrigin } from '../../shared/middleware/require-trusted-origin.js';
import { createBusinessController, getBusinessController, listBusinessesController, listCategoriesController, updateBusinessController } from './business.controller.js';

export const businessCrudRouter = Router();
businessCrudRouter.use(requireAuth);
businessCrudRouter.get('/business-categories', listCategoriesController);
businessCrudRouter.get('/businesses', listBusinessesController);
businessCrudRouter.post('/businesses', requireTrustedOrigin, createBusinessController);
businessCrudRouter.get('/businesses/:businessId', getBusinessController);
businessCrudRouter.patch('/businesses/:businessId', requireTrustedOrigin, updateBusinessController);
