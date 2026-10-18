import type { RequestHandler } from 'express';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../../shared/auth/auth-request.js';
import { AppError } from '../../shared/errors/app-error.js';
import { createOffer, listOffers, updateOffer } from './offer.service.js';
import { offerCreateSchema, offerUpdateSchema } from './offer.schemas.js';

function parse<T>(schema: z.ZodType<T>, value: unknown): T { const result = schema.safeParse(value); if (!result.success) throw new AppError(400, 'INVALID_INPUT', 'Revisa los datos ingresados.'); return result.data; }
const userId = (request: Parameters<RequestHandler>[0]) => (request as AuthenticatedRequest).auth.userId;
const meta = (request: Parameters<RequestHandler>[0]) => ({ ipAddress: request.ip });

export const listOffersController: RequestHandler = async (req, res, next) => { try { const kind = req.query.kind === 'PRODUCT' || req.query.kind === 'SERVICE' ? req.query.kind : undefined; res.json({ offers: await listOffers(userId(req), req.params.businessId as string, kind) }); } catch (error) { next(error); } };
export const createOfferController: RequestHandler = async (req, res, next) => { try { res.status(201).json({ offer: await createOffer(userId(req), req.params.businessId as string, parse(offerCreateSchema, req.body), meta(req)) }); } catch (error) { next(error); } };
export const updateOfferController: RequestHandler = async (req, res, next) => { try { res.json({ offer: await updateOffer(userId(req), req.params.businessId as string, req.params.offerId as string, parse(offerUpdateSchema, req.body), meta(req)) }); } catch (error) { next(error); } };
