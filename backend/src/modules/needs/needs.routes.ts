import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import { requireAuth } from '../../shared/middleware/require-auth.js';
import { requireTrustedOrigin } from '../../shared/middleware/require-trusted-origin.js';
import { requireAdmin } from '../admin/admin-auth.service.js';
import type { AuthenticatedRequest } from '../../shared/auth/auth-request.js';

export const needsRouter = Router();
const schema = z.object({ title: z.string().trim().min(3).max(90), category: z.string().trim().min(1).max(160), description: z.string().trim().max(320), location: z.object({ id: z.string().max(160), name: z.string().max(240), context: z.string().max(240) }).strict() }).strict();
const states = ['PENDING', 'IN_REVIEW', 'RESOLVED', 'DISCARDED'] as const;
needsRouter.post('/needs', requireAuth, requireTrustedOrigin, async (req, res, next) => {
 try { const parsed = schema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: { code: 'INVALID_NEED', message: 'Revisa la información de tu solicitud.' } });
 const { title, category, description, location } = parsed.data;
 const need = await prisma.userNeed.create({ data: { userId: (req as AuthenticatedRequest).auth.userId, title, category, description, locationId: location.id, locationName: location.name, locationContext: location.context } });
 res.status(201).json({ need: { id: need.id, createdAt: need.createdAt, status: need.status } }); } catch (error) { next(error); }
});
needsRouter.get('/admin/user-needs', requireAdmin('REPORTS_REVIEW'), async (req, res, next) => {
 try { const q = String(req.query.q ?? '').trim().slice(0,100); const state = String(req.query.status ?? ''); const page = Math.max(1, Math.min(100000, Number(req.query.page) || 1));
 const where = { ...(states.some(s => s === state) ? { status: state } : {}), ...(q ? { OR: [{ title: { contains: q } }, { category: { contains: q } }, { locationName: { contains: q } }, { user: { displayName: { contains: q } } }] } : {}) };
 const [total, needs] = await Promise.all([prisma.userNeed.count({ where }), prisma.userNeed.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page-1)*20, take: 20, include: { user: { select: { displayName: true, emailNormalized: true } } } })]);
 res.setHeader('Cache-Control','no-store'); res.json({ needs, pagination: { page, total, totalPages: Math.ceil(total/20) } }); } catch(error) { next(error); }
});
needsRouter.patch('/admin/user-needs/:id', requireTrustedOrigin, requireAdmin('CONTENT_MODERATE'), async (req,res,next) => {
 try { const parsed = z.object({ status: z.enum(states) }).strict().safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: { code:'INVALID_STATUS', message:'Estado inválido.' } });
 const existing = await prisma.userNeed.findUnique({ where: { id: String(req.params.id) } }); if (!existing) return res.status(404).json({ error: { code:'NEED_NOT_FOUND', message:'Solicitud no encontrada.' } });
 const need = await prisma.userNeed.update({ where: { id: existing.id }, data: { status: parsed.data.status } }); res.json({ need }); } catch(error) { next(error); }
});
