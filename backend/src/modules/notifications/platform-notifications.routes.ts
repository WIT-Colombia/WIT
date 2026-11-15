import { Router, type RequestHandler } from 'express';
import { requireAuth } from '../../shared/middleware/require-auth.js';
import { requireTrustedOrigin } from '../../shared/middleware/require-trusted-origin.js';
import type { AuthenticatedRequest } from '../../shared/auth/auth-request.js';
import {
  listPlatformNotifications, markPlatformNotificationRead, markAllPlatformNotificationsRead, deletePlatformNotification,
} from './platform-notifications.service.js';

export const platformNotificationsRouter = Router();
platformNotificationsRouter.use(requireAuth);
platformNotificationsRouter.use((_req, res, next) => { res.setHeader('Cache-Control', 'private, no-store'); next(); });
const uid = (request: Parameters<RequestHandler>[0]) => (request as AuthenticatedRequest).auth.userId;
platformNotificationsRouter.get('/notifications', async (req, res, next) => {
  try { res.json(await listPlatformNotifications(uid(req))); } catch (error) { next(error); }
});
platformNotificationsRouter.post('/notifications/read-all', requireTrustedOrigin, async (req, res, next) => {
  try { res.json(await markAllPlatformNotificationsRead(uid(req))); } catch (error) { next(error); }
});
platformNotificationsRouter.post('/notifications/:id/read', requireTrustedOrigin, async (req, res, next) => {
  try { res.json(await markPlatformNotificationRead(uid(req), String(req.params.id))); } catch (error) { next(error); }
});
platformNotificationsRouter.delete('/notifications/:id', requireTrustedOrigin, async (req, res, next) => {
  try { res.json(await deletePlatformNotification(uid(req), String(req.params.id))); } catch (error) { next(error); }
});
