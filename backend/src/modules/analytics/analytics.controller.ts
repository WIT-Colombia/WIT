import type { RequestHandler } from 'express';
import type { AuthenticatedRequest } from '../../shared/auth/auth-request.js';
import { getBusinessAnalytics, recordAnalyticsEvent, type AnalyticsPeriod } from './analytics.service.js';

const actor = (req: Parameters<RequestHandler>[0]) => (req as AuthenticatedRequest).auth?.userId;
export const recordAnalyticsController: RequestHandler = async (req, res, next) => { try { res.status(201).json(await recordAnalyticsEvent({ businessId: String(req.body?.businessId ?? ''), eventType: String(req.body?.eventType ?? ''), dedupeKey: typeof req.body?.dedupeKey === 'string' ? req.body.dedupeKey : undefined, actorUserId: actor(req) })); } catch (error) { next(error); } };
export const getAnalyticsController: RequestHandler = async (req, res, next) => { try { const raw = String(req.query.period ?? 'month'); const period = ['day', 'week', 'month', 'year', 'all'].includes(raw) ? raw as AnalyticsPeriod : 'month'; res.json(await getBusinessAnalytics(actor(req)!, String(req.params.businessId), period)); } catch (error) { next(error); } };
