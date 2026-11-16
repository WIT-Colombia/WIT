import { Router, type RequestHandler } from 'express';
import { requireAuth } from '../../shared/middleware/require-auth.js';
import { requireTrustedOrigin } from '../../shared/middleware/require-trusted-origin.js';
import type { AuthenticatedRequest } from '../../shared/auth/auth-request.js';
import {
  listPlatformNotifications, markPlatformNotificationRead, markAllPlatformNotificationsRead, deletePlatformNotification, readPersonalNoticeArtwork,
} from './platform-notifications.service.js';

export const platformNotificationsRouter = Router();
// This router is mounted at /api/v1. Protect each notification route individually;
// a global use(requireAuth) would wrongly block unrelated public and Admin routes.
const privateNotice: RequestHandler = (_req, res, next) => { res.setHeader('Cache-Control', 'private, no-store'); next(); };
const uid = (request: Parameters<RequestHandler>[0]) => (request as AuthenticatedRequest).auth.userId;
platformNotificationsRouter.get('/user/notifications', requireAuth, privateNotice, async (req, res, next) => {
  try { res.json(await listPlatformNotifications(uid(req))); } catch (error) { next(error); }
});
platformNotificationsRouter.post('/user/notifications/read-all', requireAuth, requireTrustedOrigin, privateNotice, async (req, res, next) => {
  try { res.json(await markAllPlatformNotificationsRead(uid(req))); } catch (error) { next(error); }
});
platformNotificationsRouter.post('/user/notifications/:id/read', requireAuth, requireTrustedOrigin, privateNotice, async (req, res, next) => {
  try { res.json(await markPlatformNotificationRead(uid(req), String(req.params.id))); } catch (error) { next(error); }
});
platformNotificationsRouter.get('/user/notifications/:id/artwork', requireAuth, privateNotice, async (req, res, next) => {
  try {
    const photo = await readPersonalNoticeArtwork(uid(req), String(req.params.id));
    res.type(photo.mimeType).send(photo.content);
  } catch (error) { next(error); }
});
platformNotificationsRouter.delete('/user/notifications/:id', requireAuth, requireTrustedOrigin, privateNotice, async (req, res, next) => {
  try { res.json(await deletePlatformNotification(uid(req), String(req.params.id))); } catch (error) { next(error); }
});
