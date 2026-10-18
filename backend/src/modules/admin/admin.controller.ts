import type { RequestHandler } from 'express';
import { z } from 'zod';
import { AppError } from '../../shared/errors/app-error.js';
import type { AuthenticatedRequest } from '../../shared/auth/auth-request.js';
import { adminFromRequest, adminSession, assignRole, listAdministrators, revokeRole, setPermission } from './admin-auth.service.js';

const roleSchema = z.object({ role: z.enum(['ADMIN', 'SUPER_ADMIN']), reason: z.string().trim().min(3).max(500) }).strict();
const permissionSchema = z.object({ permission: z.enum(['BUSINESSES_READ', 'CATALOG_READ', 'REPORTS_REVIEW', 'CONTENT_MODERATE', 'AUDIT_READ', 'ADMINS_MANAGE']), granted: z.boolean(), reason: z.string().trim().min(3).max(500) }).strict();
function parse<T>(schema: z.ZodType<T>, value: unknown): T { const result = schema.safeParse(value); if (!result.success) throw new AppError(400, 'INVALID_INPUT', 'Revisa los datos ingresados.'); return result.data; }
const userId = (request: Parameters<RequestHandler>[0]) => (request as AuthenticatedRequest).auth.userId;
export const adminMeController: RequestHandler = async (req, res, next) => { try { res.json({ admin: await adminSession(userId(req)) }); } catch (error) { next(error); } };
export const administratorsController: RequestHandler = async (req, res, next) => { try { res.json({ administrators: await listAdministrators(adminFromRequest(req)) }); } catch (error) { next(error); } };
export const assignRoleController: RequestHandler = async (req, res, next) => { try { const input = parse(roleSchema, req.body); res.status(201).json({ assignment: await assignRole(adminFromRequest(req), req.params.userId as string, input.role, input.reason) }); } catch (error) { next(error); } };
export const revokeRoleController: RequestHandler = async (req, res, next) => { try { const input = parse(z.object({ reason: z.string().trim().min(3).max(500) }).strict(), req.body); res.json({ assignment: await revokeRole(adminFromRequest(req), req.params.userId as string, req.params.role as 'ADMIN' | 'SUPER_ADMIN', input.reason) }); } catch (error) { next(error); } };
export const permissionController: RequestHandler = async (req, res, next) => { try { const input = parse(permissionSchema, req.body); res.json({ permission: await setPermission(adminFromRequest(req), req.params.userId as string, input.permission, input.granted, input.reason) }); } catch (error) { next(error); } };
