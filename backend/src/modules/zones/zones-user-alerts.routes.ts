import { Router, type RequestHandler } from 'express';
import { requireAuth } from '../../shared/middleware/require-auth.js';
import { requireTrustedOrigin } from '../../shared/middleware/require-trusted-origin.js';
import type { AuthenticatedRequest } from '../../shared/auth/auth-request.js';
import {
  getRegisteredZoneAlert, subscribeRegisteredZoneAlert, unsubscribeRegisteredZoneAlert,
} from './zones-user-alerts.service.js';

export const zoneUserAlertsRouter = Router();
const privateResponse: RequestHandler = (_req, res, next) => {
  res.setHeader('Cache-Control', 'private, no-store');
  next();
};
const userId = (req: Parameters<RequestHandler>[0]) => (req as AuthenticatedRequest).auth.userId;

zoneUserAlertsRouter.get('/user/zones/alerts/:code', requireAuth, privateResponse, async (req, res, next) => {
  try { res.json(await getRegisteredZoneAlert(userId(req), String(req.params.code))); }
  catch (error) { next(error); }
});
zoneUserAlertsRouter.post('/user/zones/alerts/:code', requireAuth, requireTrustedOrigin, privateResponse, async (req, res, next) => {
  try { res.json(await subscribeRegisteredZoneAlert(userId(req), String(req.params.code))); }
  catch (error) { next(error); }
});
zoneUserAlertsRouter.delete('/user/zones/alerts/:code', requireAuth, requireTrustedOrigin, privateResponse, async (req, res, next) => {
  try { res.json(await unsubscribeRegisteredZoneAlert(userId(req), String(req.params.code))); }
  catch (error) { next(error); }
});
