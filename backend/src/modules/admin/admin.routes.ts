import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { AppError } from '../../shared/errors/app-error.js';
import { getAdminDashboardStats } from './admin-dashboard.service.js';
import { requireTrustedOrigin } from '../../shared/middleware/require-trusted-origin.js';
import { adminMeController, administratorsController, assignRoleController, permissionController, revokeRoleController, pioneerRegistryController, pioneerClaimController, pioneerAssignController, pioneerBrandReviewController } from './admin.controller.js';
import { requireAdmin, adminFromRequest } from './admin-auth.service.js';
import { decisionVerificationController, listVerificationController, verificationDocumentController } from '../business/verification.controller.js';
import { deleteAdminBusiness, getAdminBusiness, listAdminBusinesses, getAdminBusinessesFilters, getAdminBusinessesOverview, getAdminBusinessHistory, getAdminBusinessCoverPhoto, setAdminBusinessVisibility, setAdminBusinessVerification, setAdminBusinessVerificationStatus, setAdminBusinessPlan } from './admin-businesses.service.js';
import { getAdminBusinessAnalytics } from './admin-business-analytics.service.js';
import { listAdminVisibilityAudit, listAdminSecurityAudit } from './admin-visibility-audit.service.js';
import { listAdminSubscriptions } from './admin-subscriptions.service.js';
import { recordActivity, recordCatalog, recordPhoto, recordPhotos, recordReviews, setAdminRecordOfferState } from './admin-business-record.service.js';
import { getAdminSupportAttention } from './admin-support-attention.service.js';
import { listAdminContent, getAdminContentInsights, getAdminContentDetail, getAdminContentPhoto } from './admin-content.service.js';
import { controlAdminContent, controlAdminContentBulk, editAdminContent, getAdminContentHistory, removeAdminContentPhoto, type ContentControlAction } from './admin-content-control.service.js';
import { listAdminUsersExtended, getAdminUserOverview, getAdminUserAnalytics, getAdminUserHistory, getAdminUserProfile, deactivateAdminUser, setAdminUserStatus, revokeAdminUserSessions } from './admin-users.service.js';
import { prisma } from '../../config/prisma.js';
import { Prisma } from '../../generated/prisma/client.js';
import { adminZoneRegistry, decideZone } from '../zones/zones.service.js';
import { readOwnAvatar } from '../auth/avatar.service.js';
import { adminDocumentsRouter } from './admin-documents.routes.js';

import { getPaidPlanAvailability, setPaidPlanAvailability, isPaidPlanEnabled, paidPlanKey, paidPlanUpdate } from './paid-plans.service.js';

export const adminRouter = Router();
adminRouter.get('/paid-plans', requireAdmin(), async (_req, res, next) => {
  try { res.setHeader('Cache-Control', 'no-store'); res.json(await getPaidPlanAvailability()); }
  catch (error) { next(error); }
});
adminRouter.put('/paid-plans/:key', requireTrustedOrigin, requireAdmin(), async (req, res, next) => {
  try {
    const key = paidPlanKey.parse(req.params.key);
    const { enabled, reason } = paidPlanUpdate.parse(req.body);
    res.setHeader('Cache-Control', 'no-store');
    res.json(await setPaidPlanAvailability(adminFromRequest(req), key, enabled, reason));
  } catch (error) { next(error); }
});
adminRouter.use('/documents', adminDocumentsRouter);
adminRouter.get('/me', requireAdmin(), adminMeController);
// Platform-wide business visibility audit. Restricted independently from business details.
adminRouter.get('/audit/visibility', requireAdmin('AUDIT_READ'), async (req, res, next) => {
  try {
    res.setHeader('Cache-Control', 'private, no-store');
    res.json(await listAdminVisibilityAudit({
      page: Number(req.query.page ?? 1),
      kind: String(req.query.kind ?? 'ALL'),
      search: String(req.query.search ?? ''),
    }));
  } catch (error) { next(error); }
});
// Security-access audit is more sensitive than business moderation and is superadmin-only.
adminRouter.get('/audit/security', requireAdmin('AUDIT_READ'), async (req, res, next) => {
  try {
    if (adminFromRequest(req).role !== 'SUPER_ADMIN')
      throw new AppError(403, 'ADMIN_SUPER_ADMIN_REQUIRED', 'Solo el superadministrador puede consultar cambios de accesos.');
    res.setHeader('Cache-Control', 'private, no-store');
    res.json(await listAdminSecurityAudit({
      page: Number(req.query.page ?? 1), kind: String(req.query.kind ?? 'ALL'),
    }));
  } catch (error) { next(error); }
});
adminRouter.get('/businesses', requireAdmin('BUSINESSES_READ'), async (req, res, next) => {
  try { res.setHeader('Cache-Control', 'no-store'); res.json(await listAdminBusinesses({ q: String(req.query.q ?? ''), page: Number(req.query.page) || 1, pageSize: Number(req.query.pageSize) || 20, status: String(req.query.status ?? ''), city: String(req.query.city ?? ''), categoryId: String(req.query.categoryId ?? ''), visibility: String(req.query.visibility ?? ''), verification: String(req.query.verification ?? ''), plan: String(req.query.plan ?? ''), restriction: String(req.query.restriction ?? ''), from: String(req.query.from ?? ''), to: String(req.query.to ?? ''), order: String(req.query.order ?? '') })); }
  catch (error) { next(error); }
});
adminRouter.get('/businesses/overview', requireAdmin('BUSINESSES_READ'), async (_req, res, next) => {
  try { res.setHeader('Cache-Control', 'no-store'); res.json(await getAdminBusinessesOverview()); } catch (error) { next(error); }
});
adminRouter.get('/subscriptions', requireAdmin('BUSINESSES_READ'), async (req, res, next) => {
  try {
    res.setHeader('Cache-Control', 'private, no-store');
    res.json(await listAdminSubscriptions({
      page: Number(req.query.page) || 1, pageSize: Number(req.query.pageSize) || 12,
      q: String(req.query.q ?? ''), status: String(req.query.status ?? ''), view: String(req.query.view ?? 'ALL'),
    }));
  } catch (error) { next(error); }
});
adminRouter.get('/business-photos/:photoId', requireAdmin('BUSINESSES_READ'), async (req, res, next) => {
  try {
    const photo = await getAdminBusinessCoverPhoto(String(req.params.photoId));
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.type(photo.mimeType).send(photo.buffer);
  } catch (error) { next(error); }
});
adminRouter.get('/businesses/filters', requireAdmin('BUSINESSES_READ'), async (_req, res, next) => {
  try { res.setHeader('Cache-Control', 'no-store'); res.json(await getAdminBusinessesFilters()); } catch (error) { next(error); }
});
adminRouter.get('/businesses/:id/history', requireAdmin('BUSINESSES_READ'), async (req, res, next) => {
  try { res.setHeader('Cache-Control', 'no-store'); res.json(await getAdminBusinessHistory(String(req.params.id), Number(req.query.page ?? 1), Number(req.query.pageSize ?? 60), String(req.query.kind ?? 'ALL'), String(req.query.search ?? ''))); } catch (error) { next(error); }
});
const recordRead: RequestHandler = (_req, res, next) => { res.setHeader('Cache-Control', 'private, no-store'); next(); };
adminRouter.get('/businesses/:id/catalog', requireAdmin('BUSINESSES_READ'), recordRead, async (req, res, next) => {
  try { if (!adminFromRequest(req).permissions.includes('CATALOG_READ')) throw new AppError(403, 'ADMIN_PERMISSION_DENIED', 'Necesitas permiso de catálogo.'); res.json(await recordCatalog(String(req.params.id), req.query)); } catch (error) { next(error); }
});
// State transitions are protected independently from read-only catalog access.
adminRouter.post('/businesses/:id/catalog/:offerId/state',
  requireTrustedOrigin, requireAdmin('CONTENT_MODERATE'), async (req, res, next) => {
    try {
      const context = adminFromRequest(req);
      const input = z.object({
        action: z.enum(['ACTIVATE', 'DEACTIVATE', 'DELETE']),
        reason: z.string().trim().min(12).max(500),
      }).strict().safeParse(req.body);
      if (!input.success) throw new AppError(400, 'ADMIN_OFFER_INVALID_INPUT', 'Selecciona una acción e indica un motivo de 12 a 500 caracteres.');
      if (input.data.action === 'DELETE' && context.role !== 'SUPER_ADMIN')
        throw new AppError(403, 'ADMIN_SUPER_ADMIN_REQUIRED', 'Solo el administrador principal puede eliminar publicaciones.');
      if (!context.permissions.includes('CATALOG_READ'))
        throw new AppError(403, 'ADMIN_PERMISSION_DENIED', 'Necesitas acceso al catálogo.');
      res.setHeader('Cache-Control', 'no-store');
      res.json(await setAdminRecordOfferState(String(req.params.id), String(req.params.offerId),
        context.userId, input.data.action, input.data.reason));
    } catch (error) { next(error); }
  });
adminRouter.get('/businesses/:id/reviews', requireAdmin('BUSINESSES_READ'), recordRead, async (req, res, next) => {
  try { if (!adminFromRequest(req).permissions.includes('REPORTS_REVIEW')) throw new AppError(403, 'ADMIN_PERMISSION_DENIED', 'Necesitas permiso para consultar opiniones.'); res.json(await recordReviews(String(req.params.id), req.query)); } catch (error) { next(error); }
});
adminRouter.get('/businesses/:id/photos', requireAdmin('BUSINESSES_READ'), recordRead, async (req, res, next) => {
  try { res.json(await recordPhotos(String(req.params.id), req.query, adminFromRequest(req).permissions.includes('CATALOG_READ'))); } catch (error) { next(error); }
});
adminRouter.get('/businesses/:id/photos/:photoId/content', requireAdmin('BUSINESSES_READ'), recordRead, async (req, res, next) => {
  try { const photo = await recordPhoto(String(req.params.id), String(req.params.photoId), adminFromRequest(req).permissions.includes('CATALOG_READ')); res.setHeader('X-Content-Type-Options', 'nosniff'); res.type(photo.mimeType).send(photo.buffer); } catch (error) { next(error); }
});
adminRouter.get('/businesses/:id/activity', requireAdmin('BUSINESSES_READ'), recordRead, async (req, res, next) => {
  try { res.json(await recordActivity(String(req.params.id), String(req.query.period ?? 'month'))); } catch (error) { next(error); }
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

adminRouter.post('/businesses/:id/verification-status', requireTrustedOrigin, requireAdmin('BUSINESSES_READ'), async (req, res, next) => {
  try {
    const context = adminFromRequest(req);
    if (context.role !== 'SUPER_ADMIN')
      throw new AppError(403, 'ADMIN_SUPER_ADMIN_REQUIRED', 'Solo el administrador principal puede cambiar la verificación de un negocio.');
    const action = String(req.body?.action ?? '');
    const expected = action === 'VERIFY' ? 'VERIFICAR' : action === 'UNVERIFY' ? 'SIN VERIFICAR' : '';
    if (!expected || req.body?.confirmation !== expected)
      throw new AppError(400, 'ADMIN_VERIFICATION_CONFIRMATION_REQUIRED', 'Confirma la decisión escribiendo ' + (expected || 'la opción correspondiente') + '.');
    res.setHeader('Cache-Control', 'no-store');
    res.json(await setAdminBusinessVerificationStatus(String(req.params.id), context.userId, action, String(req.body?.reason ?? '')));
  } catch (error) { next(error); }
});

adminRouter.post('/businesses/:id/verify', requireTrustedOrigin, requireAdmin('BUSINESSES_READ'), async (req, res, next) => {
  try {
    const context = adminFromRequest(req);
    if (context.role !== 'SUPER_ADMIN') throw new AppError(403, 'ADMIN_SUPER_ADMIN_REQUIRED', 'Solo el administrador principal puede verificar manualmente un negocio.');
    if (req.body?.confirmation !== 'VERIFICAR') throw new AppError(400, 'ADMIN_VERIFICATION_CONFIRMATION_REQUIRED', 'Confirma la revisión documental escribiendo VERIFICAR.');
    res.setHeader('Cache-Control', 'no-store');
    res.json(await setAdminBusinessVerification(String(req.params.id), context.userId, String(req.body?.reason ?? '')));
  } catch (error) { next(error); }
});
adminRouter.post('/businesses/:id/plan', requireTrustedOrigin, requireAdmin('BUSINESSES_READ'), async (req, res, next) => {
  try {
    const context = adminFromRequest(req);
    if (context.role !== 'SUPER_ADMIN') throw new AppError(403, 'ADMIN_SUPER_ADMIN_REQUIRED', 'Solo el administrador principal puede asignar planes.');
    if (req.body?.confirmation !== String(req.body?.plan ?? '')) throw new AppError(400, 'ADMIN_PLAN_CONFIRMATION_REQUIRED', 'Confirma el plan que deseas asignar.');
    if (req.body?.plan === 'PRO' && !(await isPaidPlanEnabled('businessPro'))) throw new AppError(409, 'BUSINESS_PRO_DISABLED', 'Business PRO está desactivado en Admin. No se pueden asignar nuevas suscripciones.');
    res.setHeader('Cache-Control', 'no-store');
    res.json(await setAdminBusinessPlan(String(req.params.id), context.userId, String(req.body?.plan ?? ''), String(req.body?.reason ?? '')));
  } catch (error) { next(error); }
});
// This is a read-only, business-scoped report register. Decisions remain in
// the central moderation workflow. Never expose reporter details without REPORTS_REVIEW.
adminRouter.get('/businesses/:id/reports', requireAdmin('BUSINESSES_READ'), async (req, res, next) => {
  try {
    if (!adminFromRequest(req).permissions.includes('REPORTS_REVIEW'))
      throw new AppError(403, 'ADMIN_PERMISSION_DENIED', 'Necesitas permiso para consultar reportes.');
    const identifier = String(req.params.id);
    const business = await prisma.business.findFirst({
      where: { OR: [{ id: identifier }, { publicId: identifier }] }, select: { id: true },
    });
    if (!business) throw new AppError(404, 'ADMIN_BUSINESS_NOT_FOUND', 'Negocio no encontrado.');
    const page = Math.max(1, Math.min(100000, Math.trunc(Number(req.query.page) || 1)));
    const pageSize = 12;
    const status = String(req.query.status ?? '');
    const reason = String(req.query.reason ?? '');
    const search = String(req.query.q ?? '').trim().slice(0, 100);
    const from = String(req.query.from ?? ''), to = String(req.query.to ?? '');
    const allowedStatuses = ['PENDING', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED'] as const;
    const allowedReasons = ['IMPERSONATION', 'FALSE_INFORMATION', 'SUSPECTED_FRAUD', 'INAPPROPRIATE_CONTENT', 'OTHER'] as const;
    if (status && !allowedStatuses.includes(status as typeof allowedStatuses[number]))
      throw new AppError(400, 'ADMIN_REPORT_STATUS_INVALID', 'Estado de reporte inválido.');
    if (reason && !allowedReasons.includes(reason as typeof allowedReasons[number]))
      throw new AppError(400, 'ADMIN_REPORT_REASON_INVALID', 'Motivo de reporte inválido.');
    const parseDay = (day: string) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day))
        throw new AppError(400, 'ADMIN_REPORT_DATE_INVALID', 'La fecha del filtro no es válida.');
      const date = new Date(day + 'T05:00:00.000Z'); // America/Bogota, UTC-5 year-round
      if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== day)
        throw new AppError(400, 'ADMIN_REPORT_DATE_INVALID', 'La fecha del filtro no es válida.');
      return date;
    };
    const fromDate = from ? parseDay(from) : null;
    const toDate = to ? parseDay(to) : null;
    if (fromDate && toDate && fromDate > toDate)
      throw new AppError(400, 'ADMIN_REPORT_DATE_RANGE_INVALID', 'La fecha inicial no puede superar la final.');
    const where: Prisma.BusinessReportWhereInput = {
      businessId: business.id,
      ...(status ? { status: status as typeof allowedStatuses[number] } : {}),
      ...(reason ? { reason: reason as typeof allowedReasons[number] } : {}),
      ...((fromDate || toDate) ? { createdAt: {
        ...(fromDate ? { gte: fromDate } : {}),
        ...(toDate ? { lt: new Date(toDate.getTime() + 86400000) } : {}),
      } } : {}),
    };
    if (search) {
      const titles: Record<typeof allowedReasons[number], string> = {
        IMPERSONATION: 'Suplantación de identidad', FALSE_INFORMATION: 'Información falsa',
        SUSPECTED_FRAUD: 'Posible fraude', INAPPROPRIATE_CONTENT: 'Contenido inapropiado',
        OTHER: 'Otro motivo',
      };
      const normalized = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase().replace(/_/g, ' ');
      const term = normalized(search);
      where.OR = [
        { description: { contains: search } },
        { reporter: { is: { displayName: { contains: search } } } },
        ...allowedReasons.filter(value => normalized(value).includes(term) || normalized(titles[value]).includes(term))
          .map(value => ({ reason: value })),
      ];
    }
    const [reports, total, grouped] = await prisma.$transaction([
      prisma.businessReport.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: pageSize, skip: (page - 1) * pageSize,
        select: { id: true, reason: true, description: true, status: true,
          decisionNote: true, createdAt: true, updatedAt: true,
          reporter: { select: { displayName: true } } } }),
      prisma.businessReport.count({ where }),
      prisma.businessReport.groupBy({ by: ['status'], where: { businessId: business.id }, _count: { _all: true } }),
    ]);
    const summary = { total: 0, pending: 0, reviewing: 0, resolved: 0, rejected: 0, finalized: 0 };
    for (const row of grouped) {
      const count = row._count._all;
      summary.total += count;
      if (row.status === 'PENDING') summary.pending = count;
      if (row.status === 'UNDER_REVIEW') summary.reviewing = count;
      if (row.status === 'RESOLVED') summary.resolved = count;
      if (row.status === 'REJECTED') summary.rejected = count;
    }
    summary.finalized = summary.resolved + summary.rejected;
    res.setHeader('Cache-Control', 'private, no-store');
    res.json({ reports, summary, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } });
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
      interval: String(req.query.interval ?? ''),
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
    const [categories, groupedOffers] = await Promise.all([
      prisma.category.findMany({
        orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
        select: { id: true, code: true, active: true, sortOrder: true,
          translations: { select: { locale: true, name: true } },
          _count: { select: { businesses: true } } },
      }),
      // Respect an offer's explicit category and inherit the business's primary category
      // when the offer has no category. Match Admin -> Contenido filters.
      prisma.$queryRaw<Array<{ categoryId: string; kind: 'PRODUCT' | 'SERVICE'; total: bigint }>>`
        SELECT COALESCE(o.categoryId, b.categoryId) AS categoryId, o.kind, COUNT(*) AS total
        FROM BusinessOffer AS o
        INNER JOIN Business AS b ON b.id = o.businessId
        WHERE o.deletedAt IS NULL
        GROUP BY COALESCE(o.categoryId, b.categoryId), o.kind
      `,
    ]);
    const counts = new Map<string, { products: number; services: number }>();
    for (const entry of groupedOffers) {
      const current = counts.get(entry.categoryId) ?? { products: 0, services: 0 };
      if (entry.kind === 'PRODUCT') current.products += Number(entry.total);
      if (entry.kind === 'SERVICE') current.services += Number(entry.total);
      counts.set(entry.categoryId, current);
    }
    res.json({ categories: categories.map(category => {
      const { products, services } = counts.get(category.id) ?? { products: 0, services: 0 };
      return { ...category, productCount: products, serviceCount: services,
        _count: { ...category._count, offers: products + services } };
    }) });
  } catch (error) { next(error); }
});
adminRouter.get('/users', requireAdmin('ADMINS_MANAGE'), async (req, res, next) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    res.json(await listAdminUsersExtended({
      q: String(req.query.q ?? ''), status: String(req.query.status ?? ''),
      relation: String(req.query.relation ?? ''), city: String(req.query.city ?? ''), page: Number(req.query.page) || 1,
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
function parseContent<T>(schema:z.ZodType<T>,value:unknown):T {
  const result=schema.safeParse(value);
  if(!result.success)throw new AppError(400,'ADMIN_CONTENT_INVALID_INPUT','Revisa los campos y la justificación.');
  return result.data;
}
const contentActionSchema=z.object({
  action:z.enum(['HIDE','REVIEW','RELEASE','DELETE','RESTORE']),
  reason:z.string().trim().min(12).max(500),
}).strict();
const contentEditSchema=z.object({
  reason:z.string().trim().min(12).max(500),
  changes:z.object({
    name:z.string().trim().min(2).max(180).optional(),
    description:z.string().max(5000).nullable().optional(),
    priceAmount:z.string().regex(/^[0-9]{1,10}([.][0-9]{1,2})?$/).nullable().optional(),
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
  try{res.setHeader('Cache-Control','no-store');res.json(await getAdminContentHistory(String(req.params.id),Number(req.query.page)||1));}
  catch(error){next(error);}
});
adminRouter.post('/content/moderate-bulk',requireTrustedOrigin,requireAdmin('CONTENT_MODERATE'),async(req,res,next)=>{
  try{
    const input=parseContent(z.object({ids:z.array(z.string().uuid()).min(1).max(25),
      action:z.enum(['HIDE','REVIEW']),reason:z.string().trim().min(12).max(500)}).strict(),req.body);
    res.setHeader('Cache-Control','no-store');
    res.json(await controlAdminContentBulk(input.ids,adminFromRequest(req).userId,input.action,input.reason));
  }catch(error){next(error);}
});
adminRouter.patch('/content/:id',requireTrustedOrigin,requireAdmin('CONTENT_MODERATE'),async(req,res,next)=>{
  try{
    const input=parseContent(contentEditSchema,req.body);
    res.setHeader('Cache-Control','no-store');
    res.json(await editAdminContent(String(req.params.id),adminFromRequest(req).userId,input.changes,input.reason));
  }catch(error){next(error);}
});
adminRouter.delete('/content-photos/:photoId',requireTrustedOrigin,requireAdmin('CONTENT_MODERATE'),async(req,res,next)=>{
  try{
    const context=adminFromRequest(req);
    if(context.role!=='SUPER_ADMIN')return res.status(403).json({error:{code:'ADMIN_SUPER_ADMIN_REQUIRED',message:'Solo el administrador principal puede retirar fotografías.'}});
    const input=parseContent(z.object({reason:z.string().trim().min(12).max(500)}).strict(),req.body);
    res.setHeader('Cache-Control','no-store');
    res.json(await removeAdminContentPhoto(String(req.params.photoId),context.userId,input.reason));
  }catch(error){next(error);}
});
adminRouter.post('/content/:id/moderate',requireTrustedOrigin,requireAdmin('CONTENT_MODERATE'),async(req,res,next)=>{
  try{
    const input=parseContent(contentActionSchema,req.body);
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

const zoneDecisionSchema = z.object({
  scope: z.enum(['MUNICIPALITY','DEPARTMENT']),
  code: z.string().regex(/^\\d{2}(?:\\d{3})?$/),
  state: z.enum(['CLOSED','SCHEDULED','OPEN','PAUSED']),
  opensAt: z.string().datetime({offset:true}).nullable().optional(),
  reason: z.string().trim().min(12).max(500),
}).strict();
adminRouter.get('/zones', requireAdmin(), async (req,res,next)=>{
  try{res.setHeader('Cache-Control','no-store');res.json(await adminZoneRegistry(adminFromRequest(req)));}
  catch(error){next(error);}
});
adminRouter.put('/zones', requireTrustedOrigin, requireAdmin(), async(req,res,next)=>{
  try{
    const result=zoneDecisionSchema.safeParse(req.body);
    if(!result.success)throw new AppError(400,'INVALID_ZONE','Revisa la zona, la programación y el motivo.');
    res.setHeader('Cache-Control','no-store');
    res.json({zone:await decideZone(adminFromRequest(req),result.data)});
  }catch(error){next(error);}
});

adminRouter.get('/pioneers', requireAdmin('PIONEER_MANAGE'), pioneerRegistryController);
adminRouter.post('/pioneers/claims/:claimId/review', requireTrustedOrigin, requireAdmin('PIONEER_MANAGE'), pioneerClaimController);
adminRouter.post('/pioneers/brands/:brandId/assign', requireTrustedOrigin, requireAdmin('PIONEER_MANAGE'), pioneerAssignController);
adminRouter.post('/pioneers/brands/:brandId/verify', requireTrustedOrigin, requireAdmin('PIONEER_MANAGE'), pioneerBrandReviewController);
adminRouter.get('/support-attention', requireAdmin(), async (req, res, next) => {
  try {
    res.setHeader('Cache-Control', 'private, no-store');
    res.json(await getAdminSupportAttention(adminFromRequest(req)));
  } catch (error) { next(error); }
});
adminRouter.get('/verifications', requireAdmin('BUSINESSES_READ'), listVerificationController);
adminRouter.get('/verifications/:requestId/document', requireAdmin('BUSINESSES_READ'), verificationDocumentController);
adminRouter.post('/verifications/:requestId/decision', requireTrustedOrigin, requireAdmin('CONTENT_MODERATE'), decisionVerificationController);
