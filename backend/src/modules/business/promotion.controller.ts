import type { RequestHandler } from 'express';
import type { AuthenticatedRequest } from '../../shared/auth/auth-request.js';
import { promotionCreateSchema, promotionUpdateSchema } from './promotion.schemas.js';
import { createPromotion, deletePromotion, deletePromotionPhoto, finishPromotion, getPromotionPhotoContent, getPublicPromotion, getPublicPromotionPhoto, listPromotions, listPublicPromotions, recordPromotionView, updatePromotion, uploadPromotionPhoto } from './promotion.service.js';

const actor = (req: Parameters<RequestHandler>[0]) => (req as AuthenticatedRequest).auth.userId;
const parseBody = <T>(schema: { parse(input: unknown): T }, body: unknown) => schema.parse(body);
const sendPhoto = (handler: (req: Parameters<RequestHandler>[0]) => Promise<{ path: string; mimeType: string }>): RequestHandler => async (req, res, next) => {
  try { const photo = await handler(req); res.type(photo.mimeType).sendFile(photo.path, error => { if (error && !res.headersSent) next(error); }); } catch (error) { next(error); }
};

export const listPromotionsController: RequestHandler = async (req, res, next) => { try { res.json(await listPromotions(actor(req), req.params.businessId as string)); } catch (error) { next(error); } };
export const createPromotionController: RequestHandler = async (req, res, next) => { try { res.status(201).json({ promotion: await createPromotion(actor(req), req.params.businessId as string, parseBody(promotionCreateSchema, req.body)) }); } catch (error) { next(error); } };
export const updatePromotionController: RequestHandler = async (req, res, next) => { try { res.json({ promotion: await updatePromotion(actor(req), req.params.businessId as string, req.params.promotionId as string, parseBody(promotionUpdateSchema, req.body)) }); } catch (error) { next(error); } };
export const finishPromotionController: RequestHandler = async (req, res, next) => { try { res.json({ promotion: await finishPromotion(actor(req), req.params.businessId as string, req.params.promotionId as string) }); } catch (error) { next(error); } };
export const deletePromotionController: RequestHandler = async (req, res, next) => { try { await deletePromotion(actor(req), req.params.businessId as string, req.params.promotionId as string); res.status(204).send(); } catch (error) { next(error); } };
export const uploadPromotionPhotoController: RequestHandler = async (req, res, next) => { try { const file = req.file; const photo = await uploadPromotionPhoto(actor(req), req.params.businessId as string, req.params.promotionId as string, file ? { buffer: file.buffer, mimetype: file.mimetype, size: file.size } : undefined); res.status(201).json({ photo }); } catch (error) { next(error); } };
export const deletePromotionPhotoController: RequestHandler = async (req, res, next) => { try { await deletePromotionPhoto(actor(req), req.params.businessId as string, req.params.promotionId as string, req.params.photoId as string); res.status(204).send(); } catch (error) { next(error); } };
export const promotionPhotoContentController = sendPhoto(req => getPromotionPhotoContent(actor(req), req.params.businessId as string, req.params.promotionId as string, req.params.photoId as string));
export const publicPromotionPhotoController = sendPhoto(req => getPublicPromotionPhoto(req.params.promotionId as string, req.params.photoId as string));
export const listPublicPromotionsController: RequestHandler = async (req, res, next) => { try { res.json({ promotions: await listPublicPromotions(req.params.publicId as string) }); } catch (error) { next(error); } };
export const getPublicPromotionController: RequestHandler = async (req, res, next) => { try { res.json({ promotion: await getPublicPromotion(req.params.promotionId as string) }); } catch (error) { next(error); } };
export const recordPromotionViewController: RequestHandler = async (req, res, next) => { try { const key = typeof req.body?.dedupeKey === 'string' ? req.body.dedupeKey : undefined; res.status(201).json(await recordPromotionView(req.params.promotionId as string, key)); } catch (error) { next(error); } };
