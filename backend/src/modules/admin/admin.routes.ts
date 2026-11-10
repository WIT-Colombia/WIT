import { Router } from 'express';
import { getAdminDashboardStats } from './admin-dashboard.service.js';
import { requireTrustedOrigin } from '../../shared/middleware/require-trusted-origin.js';
import { adminMeController, administratorsController, assignRoleController, permissionController, revokeRoleController, pioneerRegistryController, pioneerClaimController, pioneerAssignController } from './admin.controller.js';
import { requireAdmin } from './admin-auth.service.js';
import { decisionVerificationController, listVerificationController, verificationDocumentController } from '../business/verification.controller.js';
import { getAdminBusiness, listAdminBusinesses } from './admin-businesses.service.js';
import { prisma } from '../../config/prisma.js';

export const adminRouter = Router();
adminRouter.get('/me', requireAdmin(), adminMeController);
adminRouter.get('/businesses', requireAdmin('BUSINESSES_READ'), async (req, res, next) => {
  try { res.setHeader('Cache-Control', 'no-store'); res.json(await listAdminBusinesses({ q: String(req.query.q ?? ''), page: Number(req.query.page) || 1, pageSize: Number(req.query.pageSize) || 20 })); }
  catch (error) { next(error); }
});
adminRouter.get('/businesses/:id', requireAdmin('BUSINESSES_READ'), async (req, res, next) => {
  try { res.setHeader('Cache-Control', 'no-store'); const business = await getAdminBusiness(String(req.params.id)); if (!business) return res.status(404).json({ error: { code: 'BUSINESS_NOT_FOUND', message: 'No encontramos el negocio.' } }); res.json({ business }); }
  catch (error) { next(error); }
});
adminRouter.get('/categories', requireAdmin('CATALOG_READ'), async (_req, res, next) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    const categories = await prisma.category.findMany({
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
      select: { id: true, code: true, active: true, sortOrder: true, translations: { select: { locale: true, name: true } }, _count: { select: { businesses: true, offers: true } } },
    });
    res.json({ categories });
  } catch (error) { next(error); }
});
adminRouter.get('/dashboard/stats', requireAdmin(), async (_req, res, next) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    res.json(await getAdminDashboardStats());
  } catch (error) { next(error); }
});
adminRouter.get('/administrators', requireAdmin('ADMINS_MANAGE'), administratorsController);
adminRouter.post('/administrators/:userId/roles', requireTrustedOrigin, requireAdmin('ADMINS_MANAGE'), assignRoleController);
adminRouter.post('/administrators/:userId/roles/:role/revoke', requireTrustedOrigin, requireAdmin('ADMINS_MANAGE'), revokeRoleController);
adminRouter.put('/administrators/:userId/permissions', requireTrustedOrigin, requireAdmin('ADMINS_MANAGE'), permissionController);

adminRouter.get('/pioneers', requireAdmin('PIONEER_MANAGE'), pioneerRegistryController);
adminRouter.post('/pioneers/claims/:claimId/review', requireTrustedOrigin, requireAdmin('PIONEER_MANAGE'), pioneerClaimController);
adminRouter.post('/pioneers/brands/:brandId/assign', requireTrustedOrigin, requireAdmin('PIONEER_MANAGE'), pioneerAssignController);
adminRouter.get('/verifications', requireAdmin('BUSINESSES_READ'), listVerificationController);
adminRouter.get('/verifications/:requestId/document', requireAdmin('BUSINESSES_READ'), verificationDocumentController);
adminRouter.post('/verifications/:requestId/decision', requireTrustedOrigin, requireAdmin('CONTENT_MODERATE'), decisionVerificationController);
