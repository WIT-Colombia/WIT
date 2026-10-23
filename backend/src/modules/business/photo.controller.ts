import type { RequestHandler } from 'express';
import type { AuthenticatedRequest } from '../../shared/auth/auth-request.js';
import { clearCoverPhoto, getPhotoContent, deletePhoto, listPhotos, setPhotoCover, setProfilePhoto, uploadCoverPhoto, uploadPhoto } from './photo.service.js';

const userId = (request: Parameters<RequestHandler>[0]) => (request as AuthenticatedRequest).auth.userId;

export const listPhotosController: RequestHandler = async (req, res, next) => {
  try { res.json({ photos: await listPhotos(userId(req), req.params.businessId as string) }); } catch (error) { next(error); }
};

export const uploadPhotoController: RequestHandler = async (req, res, next) => {
  try {
    const file = req.file;
    const photo = await uploadPhoto(userId(req), req.params.businessId as string, file ? { buffer: file.buffer, mimetype: file.mimetype, size: file.size } : undefined, req.body?.cover === 'true', typeof req.body?.offerId === 'string' ? req.body.offerId : undefined);
    res.status(201).json({ photo });
  } catch (error) { next(error); }
};

export const deletePhotoController: RequestHandler = async (req, res, next) => {
  try { await deletePhoto(userId(req), req.params.businessId as string, req.params.photoId as string); res.status(204).send(); } catch (error) { next(error); }
};

export const setPhotoCoverController: RequestHandler = async (req, res, next) => {
  try { res.json({ photo: await setPhotoCover(userId(req), req.params.businessId as string, req.params.photoId as string, req.body?.positionX, req.body?.positionY) }); } catch (error) { next(error); }
};

export const uploadCoverPhotoController: RequestHandler = async (req, res, next) => {
  try {
    const file = req.file;
    const positionX = req.body?.positionX === undefined ? undefined : Number(req.body.positionX);
    const positionY = req.body?.positionY === undefined ? undefined : Number(req.body.positionY);
    const photo = await uploadCoverPhoto(userId(req), req.params.businessId as string, file ? { buffer: file.buffer, mimetype: file.mimetype, size: file.size } : undefined, positionX, positionY);
    res.status(201).json({ photo });
  } catch (error) { next(error); }
};

export const clearCoverPhotoController: RequestHandler = async (req, res, next) => {
  try { await clearCoverPhoto(userId(req), req.params.businessId as string); res.status(204).send(); } catch (error) { next(error); }
};

export const setProfilePhotoController: RequestHandler = async (req, res, next) => {
  try {
    const photo = await setProfilePhoto(userId(req), req.params.businessId as string, req.body?.photoId, req.body?.positionX, req.body?.positionY);
    res.json({ photo });
  } catch (error) { next(error); }
};

export const photoContentController: RequestHandler = async (req, res, next) => {
  try {
    const content = await getPhotoContent(userId(req), req.params.businessId as string, req.params.photoId as string);
    res.type(content.mimeType).sendFile(content.path, error => { if (error && !res.headersSent) next(error); });
  } catch (error) { next(error); }
};
