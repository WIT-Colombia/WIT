import { Router, type RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { optionalAuth } from '../../shared/middleware/optional-auth.js';
import { requireTrustedOrigin } from '../../shared/middleware/require-trusted-origin.js';
import type { AuthenticatedRequest } from '../../shared/auth/auth-request.js';
import { requireAdmin } from '../admin/admin-auth.service.js';
import { listBusinessReports, submitBusinessReport, decideBusinessReport } from './business-report.service.js';

export const businessReportRouter = Router();
const limitReports = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 3,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { code: 'REPORT_RATE_LIMITED', message: 'Has enviado demasiados reportes. Intenta de nuevo más tarde.' } },
});
const submit: RequestHandler = async (request, response, next) => {
  try {
    const userId = (request as AuthenticatedRequest).auth?.userId ?? null;
    const report = await submitBusinessReport(String(request.params.businessId), userId, request.body?.reason, request.body?.description);
    response.status(201).json({ report });
  } catch (error) { next(error); }
};
const adminList: RequestHandler = async (request, response, next) => {
  try {
    response.json(await listBusinessReports(request.query.status, Number(request.query.page) || 1, Number(request.query.pageSize) || 25, request.query.q));
  } catch (error) { next(error); }
};

businessReportRouter.post('/public/businesses/:businessId/reports', limitReports, requireTrustedOrigin, optionalAuth, submit);
businessReportRouter.get('/admin/business-reports', requireAdmin('REPORTS_REVIEW'), adminList);
businessReportRouter.patch('/admin/business-reports/:id', requireTrustedOrigin, requireAdmin('CONTENT_MODERATE'), async (req, res, next) => {
  try {
    const report = await decideBusinessReport((req as AuthenticatedRequest).auth.userId, String(req.params.id), req.body?.status, req.body?.decisionNote);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ report });
  } catch (error) { next(error); }
});
