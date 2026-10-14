import type { RequestHandler } from 'express';
import type { AuthenticatedRequest } from '../../shared/auth/auth-request.js';
import { getPhotoContent, deletePhoto, listPhotos, setPhotoCover, uploadPhoto } from './photo.service.js';

const userId = (request: Parameters<RequestHandler>[0]) => (request as AuthenticatedRequest).auth.userId;

export const listPhotosController: RequestHandler = async (req, res, next) => {
  try { res.json({ photos: await listPhotos(userId(req), req.params.businessId as string) }); } catch (error) { next(error); }
};

export const uploadPhotoController: RequestHandler = async (req, res, next) => {
  try {
    const file = req.file;
    const photo = await uploadPhoto(userId(req), req.params.businessId as string, file ? { buffer: file.buffer, mimetype: file.mimetype, size: file.size } : undefined, req.body?.cover === 'true');
    res.status(201).json({ photo });
  } catch (error) { next(error); }
};

export const deletePhotoController: RequestHandler = async (req, res, next) => {
  try { await deletePhoto(userId(req), req.params.businessId as string, req.params.photoId as string); res.status(204).send(); } catch (error) { next(error); }
};

export const setPhotoCoverController: RequestHandler = async (req, res, next) => {
  try { res.json({ photo: await setPhotoCover(userId(req), req.params.businessId as string, req.params.photoId as string) }); } catch (error) { next(error); }
};

export const photoContentController: RequestHandler = async (req, res, next) => {
  try {
    const content = await getPhotoContent(userId(req), req.params.businessId as string, req.params.photoId as string);
    res.type(content.mimeType).sendFile(content.path, error => { if (error && !res.headersSent) next(error); });
  } catch (error) { next(error); }
};
