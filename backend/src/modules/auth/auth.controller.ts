import type { RequestHandler } from 'express';
import { AppError } from '../../shared/errors/app-error.js';
import type { AuthenticatedRequest } from '../../shared/auth/auth-request.js';
import { getCurrentUser, issueSession, login, logout, refresh, register } from './auth.service.js';
import { changePassword, updateProfile } from './account.service.js';
import { loginSchema, registerSchema } from './auth.schemas.js';
import { changePasswordSchema, emailRequestSchema, emailTokenSchema, passwordResetConfirmSchema, profileUpdateSchema, sessionPreferenceSchema } from './auth.schemas.js';
import { confirmEmail, resetPassword, sendPasswordResetRequest, sendVerificationRequest } from './auth-token.service.js';
import argon2 from 'argon2';
import { clearRefreshCookie, getRefreshToken, setRefreshCookie } from '../../shared/auth/refresh-cookie.js';
import { env } from '../../config/env.js';
import { createGoogleAuthorization, clearGoogleStateCookie, findSessionUserId, getGoogleState, resolveGoogleUser, safeGoogleReturnTo, setGoogleStateCookie, verifyGoogleCode } from './google-oauth.service.js';

function parse<T>(schema: { safeParse: (value: unknown) => { success: boolean; data?: T; error?: { issues: Array<{ path: PropertyKey[] }> } } }, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    const fields: Record<string, string> = {};
    for (const issue of result.error?.issues ?? []) {
      const field = String(issue.path[0] ?? '');
      if (field && !fields[field]) {
        fields[field] = field === 'name'
          ? 'Ingresa tu nombre.'
          : field === 'email'
            ? 'Ingresa un correo electrónico válido.'
            : field === 'password' || field === 'newPassword'
              ? 'Tu contraseña debe tener al menos 8 caracteres.'
              : 'Revisa este campo.';
      }
    }
    throw new AppError(400, 'INVALID_INPUT', 'Revisa los datos ingresados.', fields);
  }
  return result.data as T;
}

const meta = (request: Parameters<RequestHandler>[0]) => ({ userAgent: request.get('user-agent')?.slice(0, 512), ipAddress: request.ip });

function googleErrorCode(error: unknown): string {
  return error instanceof AppError && ['GOOGLE_NOT_CONFIGURED', 'GOOGLE_STATE_INVALID', 'GOOGLE_PROVIDER_ERROR', 'GOOGLE_IDENTITY_INVALID', 'GOOGLE_LINK_REQUIRED', 'GOOGLE_CONSENT_REQUIRED', 'GOOGLE_IDENTITY_IN_USE', 'GOOGLE_EMAIL_IN_USE'].includes(error.code) ? error.code : 'GOOGLE_AUTH_FAILED';
}

function googleCallbackUrl(query: Record<string, string>): string {
  const url = new URL('/auth/google/callback', env.googleFrontendUrl);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  return url.toString();
}

export const googleStartController: RequestHandler = (request, response, next) => {
  try {
    const authorization = createGoogleAuthorization({ flow: 'login', returnTo: request.query.next, rememberMe: request.query.rememberMe === '1', consent: request.query.consent === '1' });
    setGoogleStateCookie(response, authorization.state);
    response.redirect(authorization.url);
  } catch (error) { next(error); }
};

export const googleLinkStartController: RequestHandler = (request, response, next) => {
  try {
    const auth = (request as AuthenticatedRequest).auth;
    const authorization = createGoogleAuthorization({ flow: 'link', userId: auth.userId, returnTo: request.body?.next ?? '/settings', consent: true });
    setGoogleStateCookie(response, authorization.state);
    response.status(200).json({ url: authorization.url });
  } catch (error) { next(error); }
};

export const googleCallbackController: RequestHandler = async (request, response) => {
  let stateReturnTo = '/home';
  try {
    const state = getGoogleState(request);
    stateReturnTo = state.returnTo;
    const code = typeof request.query.code === 'string' ? request.query.code : '';
    if (!code) throw new AppError(400, 'GOOGLE_AUTH_CANCELLED', 'La autenticación con Google fue cancelada.');
    const profile = await verifyGoogleCode(code, state);
    if (state.flow === 'link') {
      const refreshToken = getRefreshToken(request);
      const linkedUserId = refreshToken ? await findSessionUserId(refreshToken) : undefined;
      if (!linkedUserId || linkedUserId !== state.userId) throw new AppError(401, 'UNAUTHENTICATED', 'Autenticación requerida.');
    }
    const resolved = await resolveGoogleUser(profile, state);
    if (state.flow === 'login') {
      const session = await issueSession(resolved.userId, meta(request));
      setRefreshCookie(response, session.refreshToken, state.rememberMe);
    }
    clearGoogleStateCookie(response);
    response.redirect(googleCallbackUrl({ next: safeGoogleReturnTo(state.returnTo), linked: state.flow === 'link' ? '1' : '0' }));
  } catch (error) {
    clearGoogleStateCookie(response);
    response.redirect(googleCallbackUrl({ error: googleErrorCode(error), next: safeGoogleReturnTo(stateReturnTo) }));
  }
};

export const registerController: RequestHandler = async (request, response, next) => { try { const result = await register(parse(registerSchema, request.body), meta(request)); response.status(201).json(result); } catch (error) { next(error); } };
export const loginController: RequestHandler = async (request, response, next) => { try { const input = parse(loginSchema, request.body); const result = await login(input, meta(request)); setRefreshCookie(response, result.refreshToken, input.rememberMe); const { refreshToken: _refreshToken, ...publicResult } = result; response.status(200).json(publicResult); } catch (error) { next(error); } };
export const refreshController: RequestHandler = async (request, response, next) => { try { const token = getRefreshToken(request); if (!token) throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'El token de renovación no es válido.'); const preference = parse(sessionPreferenceSchema, request.body ?? {}); const result = await refresh(token, meta(request)); setRefreshCookie(response, result.refreshToken, preference.rememberMe); const { refreshToken: _refreshToken, ...publicResult } = result; response.status(200).json(publicResult); } catch (error) { next(error); } };
export const logoutController: RequestHandler = async (request, response, next) => { try { const token = getRefreshToken(request); if (token) await logout(token); clearRefreshCookie(response); response.status(204).send(); } catch (error) { next(error); } };
export const meController: RequestHandler = async (request, response, next) => { try { response.status(200).json({ user: await getCurrentUser((request as AuthenticatedRequest).auth.userId) }); } catch (error) { next(error); } };
export const requestVerificationController: RequestHandler = async (request, response, next) => { try { const { email } = parse(emailRequestSchema, request.body); await sendVerificationRequest(email.trim().toLocaleLowerCase('en-US')); response.status(202).json({ message: 'Si la cuenta es elegible, recibirás un correo.' }); } catch (error) { next(error); } };
export const confirmEmailController: RequestHandler = async (request, response, next) => { try { await confirmEmail(parse(emailTokenSchema, request.body).token); response.status(204).send(); } catch (error) { next(error); } };
export const requestPasswordResetController: RequestHandler = async (request, response, next) => { try { const { email } = parse(emailRequestSchema, request.body); await sendPasswordResetRequest(email.trim().toLocaleLowerCase('en-US')); response.status(202).json({ message: 'Si la cuenta existe, recibirás instrucciones para continuar.' }); } catch (error) { next(error); } };
export const confirmPasswordResetController: RequestHandler = async (request, response, next) => {
  try {
    const input = parse(passwordResetConfirmSchema, request.body);
    const userId = await resetPassword(input.token, await argon2.hash(input.password, { type: argon2.argon2id }));
    const user = await getCurrentUser(userId);
    try {
      const session = await issueSession(userId, meta(request));
      setRefreshCookie(response, session.refreshToken, input.rememberMe);
      response.status(200).json({ user, accessToken: session.accessToken });
    } catch {
      clearRefreshCookie(response);
      response.status(200).json({ user, autoLogin: false });
    }
  } catch (error) { next(error); }
};

export const updateProfileController: RequestHandler = async (request, response, next) => { try { const auth = (request as AuthenticatedRequest).auth; const user = await updateProfile(auth.userId, parse(profileUpdateSchema, request.body)); response.status(200).json({ user }); } catch (error) { next(error); } };
export const changePasswordController: RequestHandler = async (request, response, next) => { try { const auth = (request as AuthenticatedRequest).auth; await changePassword(auth.userId, auth.sessionId, parse(changePasswordSchema, request.body)); response.status(204).send(); } catch (error) { next(error); } };
