import type { RequestHandler } from 'express';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../../shared/auth/auth-request.js';
import { AppError } from '../../shared/errors/app-error.js';
import { activateModality, createModality, getModalityDetail, listModalities, pauseModality, reactivateModality, retireModality, updateContact, updateHours } from './modality.service.js';
import { contactSchema, createModalitySchema, hoursSchema } from './modality.schemas.js';

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new AppError(400, 'INVALID_INPUT', 'Revisa los datos ingresados.');
  return result.data;
}
const ids = (request: Parameters<RequestHandler>[0]) => ({ userId: (request as AuthenticatedRequest).auth.userId, businessId: request.params.businessId as string, modalityId: request.params.modalityId as string });
const meta = (request: Parameters<RequestHandler>[0]) => ({ ipAddress: request.ip });

export const listModalitiesController: RequestHandler = async (req, res, next) => { try { const { userId, businessId } = ids(req); res.json({ modalities: await listModalities(userId, businessId) }); } catch (e) { next(e); } };
export const getModalityController: RequestHandler = async (req, res, next) => { try { const { userId, businessId, modalityId } = ids(req); res.json({ modality: await getModalityDetail(userId, businessId, modalityId) }); } catch (e) { next(e); } };
export const createModalityController: RequestHandler = async (req, res, next) => { try { const { userId, businessId } = ids(req); res.status(201).json({ modality: await createModality(userId, businessId, parse(createModalitySchema, req.body), meta(req)) }); } catch (e) { next(e); } };
export const updateContactController: RequestHandler = async (req, res, next) => { try { const { userId, businessId, modalityId } = ids(req); res.json({ modality: await updateContact(userId, businessId, modalityId, parse(contactSchema, req.body), meta(req)) }); } catch (e) { next(e); } };
export const updateHoursController: RequestHandler = async (req, res, next) => { try { const { userId, businessId, modalityId } = ids(req); res.json({ modality: await updateHours(userId, businessId, modalityId, parse(hoursSchema, req.body), meta(req)) }); } catch (e) { next(e); } };
const stateController = (operation: (u: string, b: string, m: string, meta: { ipAddress?: string }) => Promise<unknown>): RequestHandler => async (req, res, next) => { try { const { userId, businessId, modalityId } = ids(req); res.json({ modality: await operation(userId, businessId, modalityId, meta(req)) }); } catch (e) { next(e); } };
export const activateController = stateController(activateModality);
export const pauseController = stateController(pauseModality);
export const reactivateController = stateController(reactivateModality);
export const retireController = stateController(retireModality);
