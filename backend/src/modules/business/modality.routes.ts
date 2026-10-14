import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/require-auth.js';
import { requireTrustedOrigin } from '../../shared/middleware/require-trusted-origin.js';
import { activateController, createModalityController, getModalityController, listModalitiesController, pauseController, reactivateController, retireController, updateContactController, updateHoursController } from './modality.controller.js';

export const businessRouter = Router();
businessRouter.use('/businesses/:businessId/modalities', requireAuth);
businessRouter.get('/businesses/:businessId/modalities', listModalitiesController);
businessRouter.post('/businesses/:businessId/modalities', requireTrustedOrigin, createModalityController);
businessRouter.get('/businesses/:businessId/modalities/:modalityId', getModalityController);
businessRouter.put('/businesses/:businessId/modalities/:modalityId/contact', requireTrustedOrigin, updateContactController);
businessRouter.put('/businesses/:businessId/modalities/:modalityId/hours', requireTrustedOrigin, updateHoursController);
businessRouter.post('/businesses/:businessId/modalities/:modalityId/activate', requireTrustedOrigin, activateController);
businessRouter.post('/businesses/:businessId/modalities/:modalityId/pause', requireTrustedOrigin, pauseController);
businessRouter.post('/businesses/:businessId/modalities/:modalityId/reactivate', requireTrustedOrigin, reactivateController);
businessRouter.post('/businesses/:businessId/modalities/:modalityId/retire', requireTrustedOrigin, retireController);
