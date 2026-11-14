import { Router, type RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { optionalAuth } from '../../shared/middleware/optional-auth.js';
import { requireTrustedOrigin } from '../../shared/middleware/require-trusted-origin.js';
import type { AuthenticatedRequest } from '../../shared/auth/auth-request.js';
import { requireAdmin } from '../admin/admin-auth.service.js';
import { listOfferReports, submitOfferReport } from './offer-report.service.js';

export const offerReportRouter = Router();

const limitOfferReports = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { code: 'OFFER_REPORT_RATE_LIMITED', message: 'Has enviado demasiados reportes. Intenta nuevamente más tarde.' } },
});

const submit: RequestHandler = async (request, response, next) => {
  try {
    const reporterId = (request as AuthenticatedRequest).auth?.userId ?? null;
    const report = await submitOfferReport(String(request.params.offerId), reporterId, request.body?.reason, request.body?.description);
    response.setHeader('Cache-Control', 'no-store');
    response.status(201).json({ report });
  } catch (error) { next(error); }
};

const adminList: RequestHandler = async (request, response, next) => {
  try {
    const reports = await listOfferReports(
      request.query.status,
      Number(request.query.page) || 1,
      Number(request.query.pageSize) || 25,
    );
    response.setHeader('Cache-Control', 'no-store');
    response.json(reports);
  } catch (error) { next(error); }
};

// Anonymous and signed-in visitors may report offers; rate limits and trusted-origin
// checks protect the endpoint. Reporter identity is always read from verified auth.
offerReportRouter.post('/public/offers/:offerId/reports', limitOfferReports, requireTrustedOrigin, optionalAuth, submit);
// Do not add requireAuth here: Admin uses its own secure, permission-gated session.
offerReportRouter.get('/admin/offer-reports', requireAdmin('REPORTS_REVIEW'), adminList);
