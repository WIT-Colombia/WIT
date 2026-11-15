import { Router, type RequestHandler } from 'express';
import { getAdminDashboardStats } from './admin-dashboard.service.js';
import { requireTrustedOrigin } from '../../shared/middleware/require-trusted-origin.js';
import { adminMeController, administratorsController, assignRoleController, permissionController, revokeRoleController, pioneerRegistryController, pioneerClaimController, pioneerAssignController } from './admin.controller.js';
import { requireAdmin, adminFromRequest } from './admin-auth.service.js';
import { decisionVerificationController, listVerificationController, verificationDocumentController } from '../business/verification.controller.js';
import { getAdminBusiness, listAdminBusinesses } from './admin-businesses.service.js';
import { getAdminBusinessAnalytics } from './admin-business-analytics.service.js';
import { listAdminContent, getAdminContentInsights, getAdminContentDetail, getAdminContentPhoto, moderateAdminContent } from './admin-content.service.js';
import { listAdminUsersExtended, getAdminUserOverview, getAdminUserProfile, deactivateAdminUser } from './admin-users.service.js';
import { prisma } from '../../config/prisma.js';
import { readOwnAvatar } from '../auth/avatar.service.js';
import { adminDocumentsRouter } from './admin-documents.routes.js';

export const adminRouter = Router();
adminRouter.use('/documents', adminDocumentsRouter);
adminRouter.get('/me', requireAdmin(), adminMeController);
adminRouter.get('/businesses', requireAdmin('BUSINESSES_READ'), async (req, res, next) => {
  try { res.setHeader('Cache-Control', 'no-store'); res.json(await listAdminBusinesses({ q: String(req.query.q ?? ''), page: Number(req.query.page) || 1, pageSize: Number(req.query.pageSize) || 20, status: String(req.query.status ?? '') })); }
  catch (error) { next(error); }
});
// Prefer an unambiguous endpoint that cannot match /businesses/:id.
// Keep /businesses/analytics as a compatibility alias for existing clients.
const businessAnalyticsHandler: RequestHandler = async (req, res, next) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    res.json(await getAdminBusinessAnalytics({
      period: String(req.query.period ?? ''),
      city: String(req.query.city ?? ''),
      categoryId: String(req.query.categoryId ?? ''),
      status: String(req.query.status ?? ''),
    }));
  } catch (error) { next(error); }
};
adminRouter.get('/business-analytics', requireAdmin('BUSINESSES_READ'), businessAnalyticsHandler);
adminRouter.get('/businesses/analytics', requireAdmin('BUSINESSES_READ'), businessAnalyticsHandler);
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
adminRouter.get('/users', requireAdmin('ADMINS_MANAGE'), async (req, res, next) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    res.json(await listAdminUsersExtended({
      q: String(req.query.q ?? ''), status: String(req.query.status ?? ''),
      relation: String(req.query.relation ?? ''), page: Number(req.query.page) || 1,
    }));
  } catch (error) { next(error); }
});
adminRouter.get('/users/overview', requireAdmin('ADMINS_MANAGE'), async (_req, res, next) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    res.json(await getAdminUserOverview());
  } catch (error) { next(error); }
});
adminRouter.get('/users/:id/avatar', requireAdmin('ADMINS_MANAGE'), async (req, res, next) => {
  try {
    const avatar = await readOwnAvatar(String(req.params.id));
    res.setHeader('Cache-Control', 'private, no-store');
    res.type(avatar.mimeType).send(avatar.content);
  } catch (error) { next(error); }
});
adminRouter.get('/users/:id', requireAdmin('ADMINS_MANAGE'), async (req, res, next) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    res.json(await getAdminUserProfile(String(req.params.id)));
  } catch (error) { next(error); }
});
adminRouter.post('/users/:id/deactivate', requireTrustedOrigin, requireAdmin('ADMINS_MANAGE'), async (req, res, next) => {
  try {
    const context = adminFromRequest(req);
    if (context.role !== 'SUPER_ADMIN') {
      res.status(403).json({ error: { code: 'ADMIN_SUPER_ADMIN_REQUIRED', message: 'Solo el administrador principal puede dar de baja cuentas.' } });
      return;
    }
    const confirmed = req.body?.confirmation === 'ELIMINAR';
    if (!confirmed) {
      res.status(400).json({ error: { code: 'ADMIN_USER_CONFIRMATION_REQUIRED', message: 'Escribe ELIMINAR para confirmar la baja administrativa.' } });
      return;
    }
    res.setHeader('Cache-Control', 'no-store');
    res.json(await deactivateAdminUser(String(req.params.id), context.userId, String(req.body?.reason ?? '')));
  } catch (error) { next(error); }
});
// Content access is administrative and independent of business membership.
const contentFilters = (query: Record<string, unknown>) => ({
  q:String(query.q ?? ''),kind:String(query.kind ?? ''),status:String(query.status ?? ''),
  city:String(query.city ?? ''),categoryId:String(query.categoryId ?? ''),
  period:String(query.period ?? ''),page:Number(query.page) || 1,
});
adminRouter.get('/content', requireAdmin('CATALOG_READ'), async (req,res,next) => {
  try{res.setHeader('Cache-Control','no-store');res.json(await listAdminContent(contentFilters(req.query)));}
  catch(error){next(error);}
});
adminRouter.get('/content-insights', requireAdmin('CATALOG_READ'), async (req,res,next) => {
  try{res.setHeader('Cache-Control','no-store');res.json(await getAdminContentInsights(contentFilters(req.query)));}
  catch(error){next(error);}
});
adminRouter.get('/content-photos/:photoId', requireAdmin('CATALOG_READ'), async (req,res,next) => {
  try{
    const photo=await getAdminContentPhoto(String(req.params.photoId));
    res.setHeader('Cache-Control','private, no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.type(photo.mimeType).send(photo.buffer);
  }catch(error){next(error);}
});
adminRouter.get('/content/:id', requireAdmin('CATALOG_READ'), async (req,res,next) => {
  try{res.setHeader('Cache-Control','no-store');res.json(await getAdminContentDetail(String(req.params.id)));}
  catch(error){next(error);}
});
adminRouter.post('/content/:id/moderate', requireTrustedOrigin, requireAdmin('CONTENT_MODERATE'), async(req,res,next)=>{
  try{
    const action=req.body?.action;
    if(action!=='HIDE'&&action!=='RESTORE')return res.status(400).json({error:{code:'ADMIN_CONTENT_ACTION_INVALID',message:'Selecciona una acción válida.'}});
    const actor=adminFromRequest(req);
    res.setHeader('Cache-Control','no-store');
    res.json(await moderateAdminContent(String(req.params.id),actor.userId,action,String(req.body?.reason??'')));
  }catch(error){next(error);}
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
