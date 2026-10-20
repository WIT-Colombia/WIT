import type { RequestHandler } from 'express';
import type { AuthenticatedRequest } from '../../shared/auth/auth-request.js';
import { addOfferLike, getOfferLikeStatus, getOfferLikesBatch, listBusinessOfferLikeCounts, listUserOfferLikes, removeOfferLike } from './offer-like.service.js';

const userId = (request: Parameters<RequestHandler>[0]) => (request as AuthenticatedRequest).auth.userId;
const identifier = (request: Parameters<RequestHandler>[0]) => request.params.offerId as string;

export const offerLikeStatusController: RequestHandler = async (req, res, next) => { try { res.json({ like: await getOfferLikeStatus(userId(req), identifier(req)) }); } catch (error) { next(error); } };
export const addOfferLikeController: RequestHandler = async (req, res, next) => { try { res.status(201).json({ like: await addOfferLike(userId(req), identifier(req)) }); } catch (error) { next(error); } };
export const removeOfferLikeController: RequestHandler = async (req, res, next) => { try { res.json({ like: await removeOfferLike(userId(req), identifier(req)) }); } catch (error) { next(error); } };
export const offerLikesBatchController: RequestHandler = async (req, res, next) => {
  try {
    const raw = typeof req.query.offerIds === 'string' ? req.query.offerIds : '';
    res.json(await getOfferLikesBatch(userId(req), raw.split(',')));
  } catch (error) { next(error); }
};

export const listUserOfferLikesController: RequestHandler = async (req, res, next) => {
  try {
    const page = Number(req.query.page ?? 1);
    const pageSize = Number(req.query.pageSize ?? 20);
    res.json(await listUserOfferLikes(userId(req), page, pageSize));
  } catch (error) { next(error); }
};

export const businessOfferLikeCountsController: RequestHandler = async (req, res, next) => {
  try { res.json(await listBusinessOfferLikeCounts(userId(req), req.params.businessId as string)); } catch (error) { next(error); }
};
