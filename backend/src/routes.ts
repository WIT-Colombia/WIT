import { Router } from 'express';
import { healthRouter } from './modules/health/health.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { businessRouter } from './modules/business/modality.routes.js';
import { businessCrudRouter } from './modules/business/business.routes.js';
import { photoRouter } from './modules/business/photo.routes.js';
import { publicBusinessRouter } from './modules/public-business/public-business.routes.js';
import { offerRouter } from './modules/business/offer.routes.js';
import { adminRouter } from './modules/admin/admin.routes.js';
import { favoriteRouter } from './modules/favorites/favorite.routes.js';
import { analyticsRouter } from './modules/analytics/analytics.routes.js';
import { reviewRouter } from './modules/reviews/review.routes.js';
import { promotionRouter } from './modules/business/promotion.routes.js';
import { collaboratorRouter } from './modules/business/collaborator.routes.js';
import { verificationRouter } from './modules/business/verification.routes.js';
import { ownershipTransferRouter } from './modules/business/ownership-transfer.routes.js';

export const apiRouter = Router();
apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/admin', adminRouter);
apiRouter.use('/public', publicBusinessRouter);
// Public analytics events must be reachable by anonymous visitors before
// routers that apply broad authentication middleware.
apiRouter.use('/', analyticsRouter);
// This router contains both explicitly public read routes and individually
// protected management routes, so mount it before routers with broad auth middleware.
apiRouter.use('/', promotionRouter);
apiRouter.use('/', collaboratorRouter);
apiRouter.use('/', verificationRouter);
apiRouter.use('/', ownershipTransferRouter);
apiRouter.use('/', offerRouter);
apiRouter.use('/', favoriteRouter);
apiRouter.use('/', reviewRouter);
apiRouter.use('/', businessCrudRouter);
apiRouter.use('/', photoRouter);
apiRouter.use('/', businessRouter);
