import type { RequestHandler } from 'express';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../../shared/auth/auth-request.js';
import { AppError } from '../../shared/errors/app-error.js';
import { createBusiness, getBusiness, listBusinesses, listCategories, updateBusiness, requestBusinessDeletion, recoverBusiness } from './business.service.js';
import { businessCreateSchema, businessUpdateSchema } from './business.schemas.js';

function parse<T>(schema: z.ZodType<T>, value: unknown): T { const result = schema.safeParse(value); if (!result.success) throw new AppError(400, 'INVALID_INPUT', 'Revisa los datos ingresados.'); return result.data; }
const userId = (request: Parameters<RequestHandler>[0]) => (request as AuthenticatedRequest).auth.userId;
const meta = (request: Parameters<RequestHandler>[0]) => ({ ipAddress: request.ip });

export const listBusinessesController: RequestHandler = async (req, res, next) => { try { res.json({ businesses: await listBusinesses(userId(req)) }); } catch (error) { next(error); } };
export const listCategoriesController: RequestHandler = async (_req, res, next) => { try { res.json({ categories: await listCategories() }); } catch (error) { next(error); } };
export const createBusinessController: RequestHandler = async (req, res, next) => { try { res.status(201).json({ business: await createBusiness(userId(req), parse(businessCreateSchema, req.body), meta(req)) }); } catch (error) { next(error); } };
export const getBusinessController: RequestHandler = async (req, res, next) => { try { res.json({ business: await getBusiness(userId(req), req.params.businessId as string) }); } catch (error) { next(error); } };
export const updateBusinessController: RequestHandler = async (req, res, next) => { try { res.json({ business: await updateBusiness(userId(req), req.params.businessId as string, parse(businessUpdateSchema, req.body), meta(req)) }); } catch (error) { next(error); } };
export const requestDeletionController: RequestHandler = async (req, res, next) => { try { res.json({ business: await requestBusinessDeletion(userId(req), req.params.businessId as string, meta(req)) }); } catch (error) { next(error); } };
export const recoverBusinessController: RequestHandler = async (req, res, next) => { try { res.json({ business: await recoverBusiness(userId(req), req.params.businessId as string, meta(req)) }); } catch (error) { next(error); } };
