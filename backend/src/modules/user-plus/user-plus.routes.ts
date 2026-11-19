import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../shared/middleware/require-auth.js';
import { requireTrustedOrigin } from '../../shared/middleware/require-trusted-origin.js';
import type { AuthenticatedRequest } from '../../shared/auth/auth-request.js';
import {
  plusStatus, plusOverview, setPlusPreferences, plusRadar,
  addPlusCollection, deletePlusCollection, addPlusCollectionItem, deletePlusCollectionItem,
  addPlusSearch, deletePlusSearch, addPlusWatch, deletePlusWatch, plusPriceHistory, plusCompare,
} from './user-plus.service.js';

const uuid = z.string().uuid();
const collectionPayload = z.object({ title: z.string().trim().min(1).max(80) }).strict();
const itemPayload = z.object({ targetType: z.enum(['BUSINESS', 'OFFER']), targetId: uuid }).strict();
const searchPayload = z.object({
  title: z.string().trim().min(1).max(80),
  query: z.string().trim().max(160),
  category: z.string().trim().max(120).nullable().optional(),
  city: z.string().trim().max(120).nullable().optional(),
  openNow: z.boolean().optional(),
  minRating: z.number().min(0).max(5).nullable().optional(),
  sort: z.enum(['recommended', 'rating', 'distance']).optional(),
}).strict();
const prefsPayload = z.object({
  radarEnabled: z.boolean().optional(), priceAlertsEnabled: z.boolean().optional(),
}).strict();
const watchPayload = z.object({ offerId: uuid }).strict();
export const userPlusRouter = Router();
userPlusRouter.use(requireAuth);
userPlusRouter.use((_req, res, next) => { res.setHeader('Cache-Control', 'private, no-store'); next(); });
const uid = (req: Parameters<RequestHandler>[0]) => (req as AuthenticatedRequest).auth.userId;
const route = (work: (req: Parameters<RequestHandler>[0]) => Promise<unknown>): RequestHandler =>
  async (req, res, next) => { try { res.json(await work(req)); } catch (error) { next(error); } };
userPlusRouter.get('/status', route(req => plusStatus(uid(req))));
userPlusRouter.get('/overview', route(req => plusOverview(uid(req))));
userPlusRouter.get('/radar', route(req => plusRadar(uid(req))));
userPlusRouter.put('/preferences', requireTrustedOrigin, route(req => setPlusPreferences(uid(req), prefsPayload.parse(req.body))));
userPlusRouter.post('/collections', requireTrustedOrigin, route(req => addPlusCollection(uid(req), collectionPayload.parse(req.body).title)));
userPlusRouter.delete('/collections/:id', requireTrustedOrigin, route(req => deletePlusCollection(uid(req), uuid.parse(req.params.id))));
userPlusRouter.post('/collections/:id/items', requireTrustedOrigin, route(req => {
  const { targetType, targetId } = itemPayload.parse(req.body);
  return addPlusCollectionItem(uid(req), uuid.parse(req.params.id), targetType, targetId);
}));
userPlusRouter.delete('/collections/:id/items/:itemId', requireTrustedOrigin,
  route(req => deletePlusCollectionItem(uid(req), uuid.parse(req.params.id), uuid.parse(req.params.itemId))));
userPlusRouter.post('/searches', requireTrustedOrigin, route(req => addPlusSearch(uid(req), searchPayload.parse(req.body))));
userPlusRouter.delete('/searches/:id', requireTrustedOrigin, route(req => deletePlusSearch(uid(req), uuid.parse(req.params.id))));
userPlusRouter.post('/watches', requireTrustedOrigin, route(req => addPlusWatch(uid(req), watchPayload.parse(req.body).offerId)));
userPlusRouter.delete('/watches/:id', requireTrustedOrigin, route(req => deletePlusWatch(uid(req), uuid.parse(req.params.id))));
userPlusRouter.get('/watches/:offerId/history', route(req => plusPriceHistory(uid(req), uuid.parse(req.params.offerId))));
userPlusRouter.get('/compare', route(req => plusCompare(uid(req), z.array(uuid).max(4).parse(
  typeof req.query.ids === 'string' ? req.query.ids.split(',').filter(Boolean) : [],
))));
