import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/require-auth.js';
import { requireTrustedOrigin } from '../../shared/middleware/require-trusted-origin.js';
import { addFavoriteController, favoriteCountController, listFavoriteIdsController, listFavoritesController, removeFavoriteController } from './favorite.controller.js';
import { addOfferLikeController, businessOfferLikeCountsController, listUserOfferLikesController, offerLikeStatusController, offerLikesBatchController, removeOfferLikeController } from './offer-like.controller.js';

export const favoriteRouter = Router();
favoriteRouter.use(requireAuth);
favoriteRouter.get('/favorites', listFavoritesController);
favoriteRouter.get('/favorites/ids', listFavoriteIdsController);
favoriteRouter.get('/businesses/:businessId/favorites/count', favoriteCountController);
favoriteRouter.post('/businesses/:businessId/favorite', requireTrustedOrigin, addFavoriteController);
favoriteRouter.delete('/businesses/:businessId/favorite', requireTrustedOrigin, removeFavoriteController);

favoriteRouter.get('/businesses/:businessId/offers/likes', businessOfferLikeCountsController);
favoriteRouter.get('/offers/likes/mine', listUserOfferLikesController);
favoriteRouter.get('/offers/likes', offerLikesBatchController);
favoriteRouter.get('/offers/:offerId/like', offerLikeStatusController);
favoriteRouter.post('/offers/:offerId/like', requireTrustedOrigin, addOfferLikeController);
favoriteRouter.delete('/offers/:offerId/like', requireTrustedOrigin, removeOfferLikeController);
