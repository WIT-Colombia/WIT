import type { RequestHandler } from 'express';
import type { AuthenticatedRequest } from '../../shared/auth/auth-request.js';
import { adminFromRequest } from '../admin/admin-auth.service.js';
import { decideVerification, getVerification, listVerificationRequests, replaceVerification, submitVerification, verificationDocument } from './verification.service.js';

const userId = (req: Parameters<RequestHandler>[0]) => (req as AuthenticatedRequest).auth.userId;
const file = (req: Parameters<RequestHandler>[0]) => req.file ? { buffer: req.file.buffer, mimetype: req.file.mimetype, size: req.file.size } : undefined;

export const getVerificationController: RequestHandler = async (req, res, next) => { try { res.json({ verification: await getVerification(userId(req), String(req.params.businessId)) }); } catch (e) { next(e); } };
export const submitVerificationController: RequestHandler = async (req, res, next) => { try { res.status(201).json({ verification: await submitVerification(userId(req), String(req.params.businessId), file(req) as any) }); } catch (e) { next(e); } };
export const replaceVerificationController: RequestHandler = async (req, res, next) => { try { res.json({ verification: await replaceVerification(userId(req), String(req.params.businessId), file(req) as any) }); } catch (e) { next(e); } };
export const listVerificationController: RequestHandler = async (req, res, next) => { try { res.json({ requests: await listVerificationRequests(adminFromRequest(req)) }); } catch (e) { next(e); } };
export const verificationDocumentController: RequestHandler = async (req, res, next) => { try { const doc = await verificationDocument(adminFromRequest(req), String(req.params.requestId)); res.type(doc.mimeType).sendFile(doc.path, error => { if (error && !res.headersSent) next(error); }); } catch (e) { next(e); } };
export const decisionVerificationController: RequestHandler = async (req, res, next) => { try { const body = req.body ?? {}; const action = body.action; if (!['APPROVE', 'REQUEST_INFORMATION', 'REJECT'].includes(action)) return res.status(400).json({ error: 'INVALID_ACTION' }); const result = await decideVerification(adminFromRequest(req), String(req.params.requestId), action, typeof body.reason === 'string' ? body.reason : '', body.nameConfirmed === true); res.json({ verification: result }); } catch (e) { next(e); } };
