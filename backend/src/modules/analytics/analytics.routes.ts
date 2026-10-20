import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../../config/env.js';
import { optionalAuth } from '../../shared/middleware/optional-auth.js';
import { requireAuth } from '../../shared/middleware/require-auth.js';
import { getAnalyticsController, recordAnalyticsController } from './analytics.controller.js';

export const analyticsRouter = Router();
analyticsRouter.post('/public/analytics/events', rateLimit({ windowMs: 60_000, limit: env.nodeEnv === 'development' ? 300 : 60, standardHeaders: 'draft-8', legacyHeaders: false }), optionalAuth, recordAnalyticsController);
analyticsRouter.get('/businesses/:businessId/analytics', requireAuth, getAnalyticsController);
