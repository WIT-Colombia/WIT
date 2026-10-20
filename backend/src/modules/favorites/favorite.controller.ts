import type { RequestHandler } from 'express';
import type { AuthenticatedRequest } from '../../shared/auth/auth-request.js';
import { addFavorite, getFavoriteCount, listFavoriteIds, listFavorites, removeFavorite } from './favorite.service.js';

const userId = (request: Parameters<RequestHandler>[0]) => (request as AuthenticatedRequest).auth.userId;
export const addFavoriteController: RequestHandler = async (req, res, next) => { try { res.status(201).json({ favorite: await addFavorite(userId(req), req.params.businessId as string) }); } catch (error) { next(error); } };
export const removeFavoriteController: RequestHandler = async (req, res, next) => { try { res.json({ favorite: await removeFavorite(userId(req), req.params.businessId as string) }); } catch (error) { next(error); } };
export const listFavoritesController: RequestHandler = async (req, res, next) => { try { res.json({ favorites: await listFavorites(userId(req)) }); } catch (error) { next(error); } };
export const listFavoriteIdsController: RequestHandler = async (req, res, next) => { try { res.json({ businessIds: await listFavoriteIds(userId(req)) }); } catch (error) { next(error); } };
export const favoriteCountController: RequestHandler = async (req, res, next) => { try { res.json({ count: await getFavoriteCount(userId(req), req.params.businessId as string) }); } catch (error) { next(error); } };
