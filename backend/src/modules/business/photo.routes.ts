import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../../shared/middleware/require-auth.js';
import { requireTrustedOrigin } from '../../shared/middleware/require-trusted-origin.js';
import { clearCoverPhotoController, deletePhotoController, listPhotosController, photoContentController, setPhotoCoverController, setProfilePhotoController, uploadCoverPhotoController, uploadPhotoController } from './photo.controller.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
export const photoRouter = Router();
photoRouter.use('/businesses/:businessId/photos', requireAuth);
photoRouter.get('/businesses/:businessId/photos', listPhotosController);
photoRouter.get('/businesses/:businessId/photos/:photoId/content', photoContentController);
photoRouter.post('/businesses/:businessId/photos', requireTrustedOrigin, upload.single('file'), uploadPhotoController);
photoRouter.post('/businesses/:businessId/cover-photo', requireTrustedOrigin, upload.single('file'), uploadCoverPhotoController);
photoRouter.delete('/businesses/:businessId/cover-photo', requireTrustedOrigin, clearCoverPhotoController);
photoRouter.put('/businesses/:businessId/profile-photo', requireTrustedOrigin, setProfilePhotoController);
photoRouter.delete('/businesses/:businessId/photos/:photoId', requireTrustedOrigin, deletePhotoController);
photoRouter.post('/businesses/:businessId/photos/:photoId/cover', requireTrustedOrigin, setPhotoCoverController);
