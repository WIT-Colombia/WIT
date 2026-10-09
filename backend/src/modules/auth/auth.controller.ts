import type { RequestHandler } from 'express';
import { AppError } from '../../shared/errors/app-error.js';
import type { AuthenticatedRequest } from '../../shared/auth/auth-request.js';
import { getCurrentUser, login, logout, refresh, register } from './auth.service.js';
import { loginSchema, logoutSchema, refreshSchema, registerSchema } from './auth.schemas.js';
import { emailRequestSchema, emailTokenSchema, passwordResetConfirmSchema } from './auth.schemas.js';
import { confirmEmail, resetPassword, sendPasswordResetRequest, sendVerificationRequest } from './auth-token.service.js';
import argon2 from 'argon2';

function parse<T>(schema: { safeParse: (value: unknown) => { success: boolean; data?: T } }, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new AppError(400, 'INVALID_INPUT', 'Los datos enviados no son válidos.');
  return result.data as T;
}

const meta = (request: Parameters<RequestHandler>[0]) => ({ userAgent: request.get('user-agent')?.slice(0, 512), ipAddress: request.ip });

export const registerController: RequestHandler = async (request, response, next) => { try { response.status(201).json(await register(parse(registerSchema, request.body), meta(request))); } catch (error) { next(error); } };
export const loginController: RequestHandler = async (request, response, next) => { try { response.status(200).json(await login(parse(loginSchema, request.body), meta(request))); } catch (error) { next(error); } };
export const refreshController: RequestHandler = async (request, response, next) => { try { response.status(200).json(await refresh(parse(refreshSchema, request.body).refreshToken, meta(request))); } catch (error) { next(error); } };
export const logoutController: RequestHandler = async (request, response, next) => { try { await logout(parse(logoutSchema, request.body).refreshToken); response.status(204).send(); } catch (error) { next(error); } };
export const meController: RequestHandler = async (request, response, next) => { try { response.status(200).json({ user: await getCurrentUser((request as AuthenticatedRequest).auth.userId) }); } catch (error) { next(error); } };
export const requestVerificationController: RequestHandler = async (request, response, next) => { try { const { email } = parse(emailRequestSchema, request.body); await sendVerificationRequest(email.trim().toLocaleLowerCase('en-US')); response.status(202).json({ message: 'Si la cuenta es elegible, recibirás un correo.' }); } catch (error) { next(error); } };
export const confirmEmailController: RequestHandler = async (request, response, next) => { try { await confirmEmail(parse(emailTokenSchema, request.body).token); response.status(204).send(); } catch (error) { next(error); } };
export const requestPasswordResetController: RequestHandler = async (request, response, next) => { try { const { email } = parse(emailRequestSchema, request.body); await sendPasswordResetRequest(email.trim().toLocaleLowerCase('en-US')); response.status(202).json({ message: 'Si la cuenta existe, recibirás instrucciones para continuar.' }); } catch (error) { next(error); } };
export const confirmPasswordResetController: RequestHandler = async (request, response, next) => { try { const input = parse(passwordResetConfirmSchema, request.body); await resetPassword(input.token, await argon2.hash(input.password, { type: argon2.argon2id })); response.status(204).send(); } catch (error) { next(error); } };
