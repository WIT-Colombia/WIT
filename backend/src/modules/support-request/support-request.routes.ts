import { Router, type RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { optionalAuth } from '../../shared/middleware/optional-auth.js';
import { requireAuth } from '../../shared/middleware/require-auth.js';
import { requireTrustedOrigin } from '../../shared/middleware/require-trusted-origin.js';
import { requireAdmin } from '../admin/admin-auth.service.js';
import type { AuthenticatedRequest } from '../../shared/auth/auth-request.js';
import { submitNeed, submitBusinessRequest, listSupportRequests, decideSupportRequest } from './support-request.service.js';

export const supportRequestRouter = Router();
const submitLimit = rateLimit({
  windowMs: 60 * 60 * 1000, limit: 8, standardHeaders: 'draft-8', legacyHeaders: false,
  message: { error: { code: 'SUPPORT_RATE_LIMITED', message: 'Has enviado demasiadas solicitudes. Intenta más tarde.' } },
});
const submitNeedHandler: RequestHandler = async (req, res, next) => {
  try {
    const userId = (req as AuthenticatedRequest).auth?.userId ?? null;
    const request = await submitNeed(userId, req.body ?? {});
    res.setHeader('Cache-Control', 'no-store');
    res.status(201).json({ request });
  } catch (error) { next(error); }
};
const submitBusinessHandler: RequestHandler = async (req, res, next) => {
  try {
    const userId = (req as AuthenticatedRequest).auth.userId;
    const request = await submitBusinessRequest(userId, req.body ?? {});
    res.setHeader('Cache-Control', 'no-store');
    res.status(201).json({ request });
  } catch (error) { next(error); }
};
const adminList: RequestHandler = async (req, res, next) => {
  try {
    const result = await listSupportRequests(req.query.kind, req.query.status, req.query.page, req.query.q);
    res.setHeader('Cache-Control', 'no-store');
    res.json(result);
  } catch (error) { next(error); }
};
const adminDecision: RequestHandler = async (req, res, next) => {
  try {
    const adminId = (req as AuthenticatedRequest).auth.userId;
    const request = await decideSupportRequest(adminId, String(req.params.id), req.body?.status, req.body?.decisionNote);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ request });
  } catch (error) { next(error); }
};

// Public needs may come from guest visitors; server-side validation and rate limiting apply.
supportRequestRouter.post('/public/needs', submitLimit, requireTrustedOrigin, optionalAuth, submitNeedHandler);
supportRequestRouter.post('/business/support-requests', submitLimit, requireTrustedOrigin, requireAuth, submitBusinessHandler);
supportRequestRouter.get('/admin/support-requests', requireAdmin('REPORTS_REVIEW'), adminList);
supportRequestRouter.patch('/admin/support-requests/:id', requireTrustedOrigin, requireAdmin('CONTENT_MODERATE'), adminDecision);
