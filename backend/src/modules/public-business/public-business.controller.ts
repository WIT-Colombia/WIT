import type { RequestHandler } from 'express';
import {
  getPublicBusiness,
  getPublicPhotoContent,
  listPublicBusinesses,
  listPublicOffersForBusiness,
  listPublicPhotos,
  listPublicProducts,
  listPublicServices,
  parsePublicBusinessListInput,
} from './public-business.service.js';
import type { AuthenticatedRequest } from '../../shared/auth/auth-request.js';

const viewer = (request: Parameters<RequestHandler>[0]) => ({ userId: (request as AuthenticatedRequest).auth?.userId });

export const listPublicBusinessesController: RequestHandler = async (req, res, next) => {
  try { res.json(await listPublicBusinesses(parsePublicBusinessListInput(req.query), undefined, viewer(req))); } catch (error) { next(error); }
};
export const getPublicBusinessController: RequestHandler = async (req, res, next) => {
  try { res.json({ business: await getPublicBusiness(req.params.publicId as string, undefined, viewer(req)) }); } catch (error) { next(error); }
};
export const listPublicProductsController: RequestHandler = async (req, res, next) => {
  try { res.json({ products: await listPublicProducts(req.params.publicId as string, undefined, viewer(req)) }); } catch (error) { next(error); }
};
export const listPublicServicesController: RequestHandler = async (req, res, next) => {
  try { res.json({ services: await listPublicServices(req.params.publicId as string, undefined, viewer(req)) }); } catch (error) { next(error); }
};
export const listPublicPhotosController: RequestHandler = async (req, res, next) => {
  try { res.json({ photos: await listPublicPhotos(req.params.publicId as string, undefined, viewer(req)) }); } catch (error) { next(error); }
};
export const listPublicOffersController: RequestHandler = async (req, res, next) => {
  try { res.json({ offers: await listPublicOffersForBusiness(req.params.publicId as string, undefined, viewer(req)) }); } catch (error) { next(error); }
};
export const publicPhotoContentController: RequestHandler = async (req, res, next) => {
  try {
    const content = await getPublicPhotoContent(req.params.publicId as string, req.params.photoId as string, undefined, viewer(req));
    res.set('Cache-Control', 'public, max-age=3600').type(content.mimeType).sendFile(content.path, error => { if (error && !res.headersSent) next(error); });
  } catch (error) { next(error); }
};
