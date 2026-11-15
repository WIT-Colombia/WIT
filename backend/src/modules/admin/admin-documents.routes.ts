import { Router } from 'express';
import type { ErrorRequestHandler } from 'express';
import multer from 'multer';
import { requireTrustedOrigin } from '../../shared/middleware/require-trusted-origin.js';
import { adminFromRequest, requireAdmin } from './admin-auth.service.js';
import { adminDocumentContent, listAdminDocuments, setAdminDocumentDeleted, uploadAdminDocument } from './admin-documents.service.js';
import { DOCUMENT_MAX_BYTES } from './admin-document-storage.js';
import { AppError } from '../../shared/errors/app-error.js';

export const adminDocumentsRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: DOCUMENT_MAX_BYTES, files: 1, fields: 3, parts: 4, fieldSize: 4096 } }).single('file');
adminDocumentsRouter.use(requireAdmin('ADMINS_MANAGE'), (_req, res, next) => { res.setHeader('Cache-Control', 'private, no-store'); next(); });
adminDocumentsRouter.get('/', async (req, res, next) => { try { res.json(await listAdminDocuments(adminFromRequest(req), req.query as any)); } catch (error) { next(error); } });
adminDocumentsRouter.post('/', requireTrustedOrigin, (req, res, next) => upload(req, res, error => {
  if (error) return res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: { code: 'DOCUMENT_UPLOAD_INVALID', message: 'Adjunta un único PDF de máximo 10 MB y revisa los campos.' } });
  void uploadAdminDocument(adminFromRequest(req), req.body, req.file).then(document => res.status(201).json({ document })).catch(next);
}));
adminDocumentsRouter.get('/:id/content', async (req, res, next) => {
  try {
    const document = await adminDocumentContent(adminFromRequest(req), req.params.id);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'; frame-ancestors 'none'");
    res.attachment(document.filename).type('application/pdf').send(document.buffer);
  } catch (error) { next(error); }
});
adminDocumentsRouter.delete('/:id', requireTrustedOrigin, async (req, res, next) => { try { res.json(await setAdminDocumentDeleted(adminFromRequest(req), req.params.id, true, req.body?.reason)); } catch (error) { next(error); } });
adminDocumentsRouter.post('/:id/restore', requireTrustedOrigin, async (req, res, next) => { try { res.json(await setAdminDocumentDeleted(adminFromRequest(req), req.params.id, false, null)); } catch (error) { next(error); } });
const documentError: ErrorRequestHandler = (error, _req, _res, next) => {
  if (error && (error.code === 'P2021' || error.code === 'P2022')) return next(new AppError(503, 'ADMIN_DOCUMENT_MIGRATION_REQUIRED', 'El archivo documental requiere aplicar la actualización del backend.'));
  next(error);
};
adminDocumentsRouter.use(documentError);
