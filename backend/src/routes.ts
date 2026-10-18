import { Router } from 'express';
import { healthRouter } from './modules/health/health.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { businessRouter } from './modules/business/modality.routes.js';
import { businessCrudRouter } from './modules/business/business.routes.js';
import { photoRouter } from './modules/business/photo.routes.js';
import { publicBusinessRouter } from './modules/public-business/public-business.routes.js';
import { offerRouter } from './modules/business/offer.routes.js';
import { adminRouter } from './modules/admin/admin.routes.js';

export const apiRouter = Router();
apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/admin', adminRouter);
apiRouter.use('/public', publicBusinessRouter);
apiRouter.use('/', offerRouter);
apiRouter.use('/', businessCrudRouter);
apiRouter.use('/', photoRouter);
apiRouter.use('/', businessRouter);
