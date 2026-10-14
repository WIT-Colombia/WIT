import { Router } from 'express';
import { healthRouter } from './modules/health/health.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { businessRouter } from './modules/business/modality.routes.js';
import { businessCrudRouter } from './modules/business/business.routes.js';
import { photoRouter } from './modules/business/photo.routes.js';

export const apiRouter = Router();
apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/', businessCrudRouter);
apiRouter.use('/', photoRouter);
apiRouter.use('/', businessRouter);
