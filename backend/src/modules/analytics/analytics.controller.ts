import type { RequestHandler } from 'express';
import type { AuthenticatedRequest } from '../../shared/auth/auth-request.js';
import { recordAnalyticsEvent } from './analytics.service.js';
import { getBusinessStatistics, getOfferViewRanking, type StatisticsPeriod } from './statistics.service.js';

const actor = (req: Parameters<RequestHandler>[0]) => (req as AuthenticatedRequest).auth?.userId;
export const recordAnalyticsController: RequestHandler = async (req, res, next) => { try {
  const context = req.body?.context;
  res.status(201).json(await recordAnalyticsEvent({
    businessId: String(req.body?.businessId ?? ''), eventType: String(req.body?.eventType ?? ''),
    offerId: typeof req.body?.offerId === 'string' ? req.body.offerId : undefined,
    dedupeKey: typeof req.body?.dedupeKey === 'string' ? req.body.dedupeKey : undefined,
    actorUserId: actor(req), context: context && typeof context === 'object' ? context : undefined,
  }));
} catch (error) { next(error); } };
export const getAnalyticsController: RequestHandler = async (req, res, next) => { try { const raw = String(req.query.period ?? 'month'); const period = ['day', 'week', 'month', 'year', 'all'].includes(raw) ? raw as StatisticsPeriod : 'month'; res.json(await getBusinessStatistics(actor(req)!, String(req.params.businessId), period)); } catch (error) { next(error); } };
export const getOfferViewRankingController: RequestHandler = async (req, res, next) => { try { const raw = String(req.query.period ?? 'month'); const period = ['day', 'week', 'month', 'year', 'all'].includes(raw) ? raw as StatisticsPeriod : 'month'; res.json(await getOfferViewRanking(actor(req)!, String(req.params.businessId), period)); } catch (error) { next(error); } };
