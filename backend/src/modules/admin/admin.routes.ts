import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { getAdminDashboardStats } from './admin-dashboard.service.js';
import { requireTrustedOrigin } from '../../shared/middleware/require-trusted-origin.js';
import { adminMeController, administratorsController, assignRoleController, permissionController, revokeRoleController, pioneerRegistryController, pioneerClaimController, pioneerAssignController } from './admin.controller.js';
import { requireAdmin, adminFromRequest } from './admin-auth.service.js';
import { decisionVerificationController, listVerificationController, verificationDocumentController } from '../business/verification.controller.js';
import { deleteAdminBusiness, getAdminBusiness, listAdminBusinesses, getAdminBusinessesFilters, getAdminBusinessesOverview, getAdminBusinessHistory, setAdminBusinessVisibility } from './admin-businesses.service.js';
import { getAdminBusinessAnalytics } from './admin-business-analytics.service.js';
import { getAdminSupportAttention } from './admin-support-attention.service.js';
import { listAdminContent, getAdminContentInsights, getAdminContentDetail, getAdminContentPhoto } from './admin-content.service.js';
import { controlAdminContent, controlAdminContentBulk, editAdminContent, getAdminContentHistory, removeAdminContentPhoto, type ContentControlAction } from './admin-content-control.service.js';
import { listAdminUsersExtended, getAdminUserOverview, getAdminUserAnalytics, getAdminUserHistory, getAdminUserProfile, deactivateAdminUser, setAdminUserStatus, revokeAdminUserSessions } from './admin-users.service.js';
import { prisma } from '../../config/prisma.js';
import { readOwnAvatar } from '../auth/avatar.service.js';
import { adminDocumentsRouter } from './admin-documents.routes.js';

export const adminRouter = Router();
adminRouter.use('/documents', adminDocumentsRouter);
adminRouter.get('/me', requireAdmin(), adminMeController);
adminRouter.get('/businesses', requireAdmin('BUSINESSES_READ'), async (req, res, next) => {
  try { res.setHeader('Cache-Control', 'no-store'); res.json(await listAdminBusinesses({ q: String(req.query.q ?? ''), page: Number(req.query.page) || 1, pageSize: Number(req.query.pageSize) || 20, status: String(req.query.status ?? ''), city: String(req.query.city ?? ''), categoryId: String(req.query.categoryId ?? ''), visibility: String(req.query.visibility ?? ''), verification: String(req.query.verification ?? ''), plan: String(req.query.plan ?? ''), restriction: String(req.query.restriction ?? ''), from: String(req.query.from ?? ''), to: String(req.query.to ?? ''), order: String(req.query.order ?? '') })); }
  catch (error) { next(error); }
});
adminRouter.get('/businesses/overview', requireAdmin('BUSINESSES_READ'), async (_req, res, next) => {
  try { res.setHeader('Cache-Control', 'no-store'); res.json(await getAdminBusinessesOverview()); } catch (error) { next(error); }
});
adminRouter.get('/businesses/filters', requireAdmin('BUSINESSES_READ'), async (_req, res, next) => {
  try { res.setHeader('Cache-Control', 'no-store'); res.json(await getAdminBusinessesFilters()); } catch (error) { next(error); }
});
adminRouter.get('/businesses/:id/history', requireAdmin('BUSINESSES_READ'), async (req, res, next) => {
  try { res.setHeader('Cache-Control', 'no-store'); res.json(await getAdminBusinessHistory(String(req.params.id))); } catch (error) { next(error); }
});
adminRouter.post('/businesses/:id/visibility', requireTrustedOrigin, requireAdmin('BUSINESSES_READ'), async (req, res, next) => {
  try {
    const context = adminFromRequest(req);
    if (context.role !== 'SUPER_ADMIN')
      return res.status(403).json({ error: { code: 'ADMIN_SUPER_ADMIN_REQUIRED', message: 'Solo el administrador principal puede imponer o levantar medidas administrativas.' } });
    res.setHeader('Cache-Control', 'no-store');
    res.json(await setAdminBusinessVisibility(String(req.params.id), context.userId, String(req.body?.action ?? ''), String(req.body?.reason ?? '')));
  } catch (error) { next(error); }
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
adminRouter.post('/businesses/:id/delete', requireTrustedOrigin, requireAdmin('BUSINESSES_READ'), async (req, res, next) => {
  try {
    const context = adminFromRequest(req);
    if (context.role !== 'SUPER_ADMIN')
      return res.status(403).json({ error: { code: 'ADMIN_SUPER_ADMIN_REQUIRED', message: 'Solo el administrador principal puede eliminar negocios.' } });
    if (req.body?.confirmation !== 'ELIMINAR')
      return res.status(400).json({ error: { code: 'ADMIN_BUSINESS_CONFIRMATION_REQUIRED', message: 'Escribe ELIMINAR para confirmar la baja del negocio.' } });
    res.setHeader('Cache-Control', 'no-store');
    res.json(await deleteAdminBusiness(String(req.params.id), context.userId, String(req.body?.reason ?? '')));
  } catch (error) { next(error); }
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
      provider: String(req.query.provider ?? ''), emailVerified: String(req.query.emailVerified ?? ''),
      admin: String(req.query.admin ?? ''), activity: String(req.query.activity ?? ''),
      registeredFrom: String(req.query.registeredFrom ?? ''), registeredTo: String(req.query.registeredTo ?? ''),
      lastLoginFrom: String(req.query.lastLoginFrom ?? ''), lastLoginTo: String(req.query.lastLoginTo ?? ''),
      order: String(req.query.order ?? ''),
    }));
  } catch (error) { next(error); }
});
adminRouter.get('/users/overview', requireAdmin('ADMINS_MANAGE'), async (_req, res, next) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    res.json(await getAdminUserOverview());
  } catch (error) { next(error); }
});
adminRouter.get('/users/capabilities', requireAdmin('ADMINS_MANAGE'), (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const context = adminFromRequest(req);
  res.json({ userManagement: true, canManageStatus: context.role === 'SUPER_ADMIN', analytics: true });
});
adminRouter.get('/users/analytics', requireAdmin('ADMINS_MANAGE'), async (req, res, next) => {
  try { res.setHeader('Cache-Control', 'no-store'); res.json(await getAdminUserAnalytics(String(req.query.period ?? '12m'))); }
  catch (error) { next(error); }
});
adminRouter.get('/users/:id/history', requireAdmin('ADMINS_MANAGE'), async (req, res, next) => {
  try { res.setHeader('Cache-Control', 'no-store'); res.json(await getAdminUserHistory(String(req.params.id))); }
  catch (error) { next(error); }
});
adminRouter.post('/users/:id/status', requireTrustedOrigin, requireAdmin('ADMINS_MANAGE'), async (req, res, next) => {
  try {
    const context = adminFromRequest(req);
    if (context.role !== 'SUPER_ADMIN') {
      res.status(403).json({ error: { code: 'ADMIN_SUPER_ADMIN_REQUIRED', message: 'Solo el administrador principal puede suspender o reactivar usuarios.' } });
      return;
    }
    res.setHeader('Cache-Control', 'no-store');
    res.json(await setAdminUserStatus(String(req.params.id), context.userId, String(req.body?.action ?? ''), String(req.body?.reason ?? '')));
  } catch (error) { next(error); }
});
adminRouter.post('/users/:id/sessions/revoke', requireTrustedOrigin, requireAdmin('ADMINS_MANAGE'), async (req, res, next) => {
  try {
    const context = adminFromRequest(req);
    if (context.role !== 'SUPER_ADMIN') {
      res.status(403).json({ error: { code: 'ADMIN_SUPER_ADMIN_REQUIRED', message: 'Solo el administrador principal puede cerrar las sesiones de otra cuenta.' } });
      return;
    }
    res.setHeader('Cache-Control', 'no-store');
    res.json(await revokeAdminUserSessions(String(req.params.id), context.userId, String(req.body?.reason ?? '')));
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
  businessId:String(query.businessId ?? ''),order:String(query.order ?? ''),
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
const contentActionSchema=z.object({
  action:z.enum(['HIDE','REVIEW','RELEASE','DELETE','RESTORE']),
  reason:z.string().trim().min(12).max(500),
}).strict();
const contentEditSchema=z.object({
  reason:z.string().trim().min(12).max(500),
  changes:z.object({
    name:z.string().trim().min(2).max(180).optional(),
    description:z.string().max(5000).nullable().optional(),
    priceAmount:z.string().regex(/^\\d{1,10}(\\.\\d{1,2})?$/).nullable().optional(),
    currency:z.string().regex(/^[A-Z]{3}$/).nullable().optional(),
    priceText:z.string().max(180).nullable().optional(),
    negotiable:z.boolean().optional(),
    adultOnly:z.boolean().optional(),
    categoryId:z.string().uuid().nullable().optional(),
  }).strict().refine(value=>Object.keys(value).length>0),
}).strict();
adminRouter.get('/content-capabilities',requireAdmin('CATALOG_READ'),(req,res)=>{
  const context=adminFromRequest(req);res.setHeader('Cache-Control','no-store');
  res.json({canModerate:context.permissions.includes('CONTENT_MODERATE'),
    canDelete:context.role==='SUPER_ADMIN'&&context.permissions.includes('CONTENT_MODERATE')});
});
adminRouter.get('/content/:id/history',requireAdmin('CATALOG_READ'),async(req,res,next)=>{
  try{res.setHeader('Cache-Control','no-store');res.json(await getAdminContentHistory(String(req.params.id)));}
  catch(error){next(error);}
});
adminRouter.post('/content/moderate-bulk',requireTrustedOrigin,requireAdmin('CONTENT_MODERATE'),async(req,res,next)=>{
  try{
    const input=z.object({ids:z.array(z.string().uuid()).min(1).max(25),
      action:z.enum(['HIDE','REVIEW']),reason:z.string().trim().min(12).max(500)}).strict().parse(req.body);
    res.setHeader('Cache-Control','no-store');
    res.json(await controlAdminContentBulk(input.ids,adminFromRequest(req).userId,input.action,input.reason));
  }catch(error){next(error);}
});
adminRouter.patch('/content/:id',requireTrustedOrigin,requireAdmin('CONTENT_MODERATE'),async(req,res,next)=>{
  try{
    const input=contentEditSchema.parse(req.body);
    res.setHeader('Cache-Control','no-store');
    res.json(await editAdminContent(String(req.params.id),adminFromRequest(req).userId,input.changes,input.reason));
  }catch(error){next(error);}
});
adminRouter.delete('/content-photos/:photoId',requireTrustedOrigin,requireAdmin('CONTENT_MODERATE'),async(req,res,next)=>{
  try{
    const context=adminFromRequest(req);
    if(context.role!=='SUPER_ADMIN')return res.status(403).json({error:{code:'ADMIN_SUPER_ADMIN_REQUIRED',message:'Solo el administrador principal puede retirar fotografías.'}});
    const input=z.object({reason:z.string().trim().min(12).max(500)}).strict().parse(req.body);
    res.setHeader('Cache-Control','no-store');
    res.json(await removeAdminContentPhoto(String(req.params.photoId),context.userId,input.reason));
  }catch(error){next(error);}
});
adminRouter.post('/content/:id/moderate',requireTrustedOrigin,requireAdmin('CONTENT_MODERATE'),async(req,res,next)=>{
  try{
    const input=contentActionSchema.parse(req.body);
    const context=adminFromRequest(req);
    if(['DELETE','RESTORE'].includes(input.action)&&context.role!=='SUPER_ADMIN')
      return res.status(403).json({error:{code:'ADMIN_SUPER_ADMIN_REQUIRED',message:'Solo el administrador principal puede eliminar o recuperar publicaciones.'}});
    res.setHeader('Cache-Control','no-store');
    res.json(await controlAdminContent(String(req.params.id),context.userId,input.action as ContentControlAction,input.reason));
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
adminRouter.get('/support-attention', requireAdmin(), async (req, res, next) => {
  try {
    res.setHeader('Cache-Control', 'private, no-store');
    res.json(await getAdminSupportAttention(adminFromRequest(req)));
  } catch (error) { next(error); }
});
adminRouter.get('/verifications', requireAdmin('BUSINESSES_READ'), listVerificationController);
adminRouter.get('/verifications/:requestId/document', requireAdmin('BUSINESSES_READ'), verificationDocumentController);
adminRouter.post('/verifications/:requestId/decision', requireTrustedOrigin, requireAdmin('CONTENT_MODERATE'), decisionVerificationController);
