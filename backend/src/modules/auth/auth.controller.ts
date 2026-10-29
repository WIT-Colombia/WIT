import { finishPasswordReset } from './password-reset.js';
import type { RequestHandler } from 'express';
import { AppError } from '../../shared/errors/app-error.js';
import type { AuthenticatedRequest } from '../../shared/auth/auth-request.js';
import { getCurrentUser, issuePasswordResetSession, issueSession, login, logout, refresh, register } from './auth.service.js';
import { changePassword, updateAdultContentPreference, updateProfile } from './account.service.js';
import { loginSchema, registerSchema } from './auth.schemas.js';
import { adultContentPreferenceSchema, changePasswordSchema, emailRequestSchema, emailTokenSchema, passwordResetConfirmSchema, profileUpdateSchema, sessionPreferenceSchema } from './auth.schemas.js';
import { confirmEmail, resetPassword, sendPasswordResetRequest, sendVerificationRequest } from './auth-token.service.js';
import argon2 from 'argon2';
import { clearRefreshCookie, getRefreshToken, setRefreshCookie } from '../../shared/auth/refresh-cookie.js';
import { env } from '../../config/env.js';
import { createGoogleAuthorization, clearGoogleStateCookie, findSessionUserId, getGoogleState, resolveGoogleUser, safeGoogleReturnTo, setGoogleStateCookie, verifyGoogleCode, type GoogleApplication } from './google-oauth.service.js';
import { createGoogleDiagnostic, logGoogleDiagnostic, type GoogleDiagnosticCategory, type GoogleDiagnosticStage } from './google-diagnostics.js';
import { GoogleOAuthDiagnosticError } from './google-oauth.service.js';
import { getPreferredLocation, savePreferredLocation } from './location.service.js';
import { preferredLocationSchema } from './location.schemas.js';
import { readOwnAvatar, uploadAvatar } from './avatar.service.js';

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
  const publicError = error instanceof GoogleOAuthDiagnosticError ? error.publicError : error;
  return publicError instanceof AppError && ['GOOGLE_NOT_CONFIGURED', 'GOOGLE_STATE_INVALID', 'GOOGLE_APPLICATION_INVALID', 'GOOGLE_PROVIDER_ERROR', 'GOOGLE_IDENTITY_INVALID', 'GOOGLE_LINK_REQUIRED', 'GOOGLE_CONSENT_REQUIRED', 'GOOGLE_IDENTITY_IN_USE', 'GOOGLE_EMAIL_IN_USE'].includes(publicError.code) ? publicError.code : 'GOOGLE_AUTH_FAILED';
}

function googleApplication(value: unknown): GoogleApplication {
  if (value === undefined || value === '') return 'usuario';
  if (value === 'usuario' || value === 'negocios') return value;
  throw new AppError(400, 'GOOGLE_APPLICATION_INVALID', 'La aplicación de inicio de sesión no es válida.');
}

function googleCallbackUrl(application: GoogleApplication, query: Record<string, string>): string {
  const url = new URL('/auth/google/callback', env.googleFrontendUrls[application]);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  return url.toString();
}

export const googleStartController: RequestHandler = (request, response, next) => {
  try {
    const authorization = createGoogleAuthorization({ application: googleApplication(request.query.application), flow: 'login', returnTo: request.query.next, rememberMe: request.query.rememberMe === '1', consent: request.query.consent === '1' });
    setGoogleStateCookie(response, authorization.state);
    response.redirect(authorization.url);
  } catch (error) { next(error); }
};

export const googleLinkStartController: RequestHandler = (request, response, next) => {
  try {
    const auth = (request as AuthenticatedRequest).auth;
    const authorization = createGoogleAuthorization({ application: 'usuario', flow: 'link', userId: auth.userId, returnTo: request.body?.next ?? '/settings', consent: true });
    setGoogleStateCookie(response, authorization.state);
    response.status(200).json({ url: authorization.url });
  } catch (error) { next(error); }
};

export const googleCallbackController: RequestHandler = async (request, response) => {
  let stateReturnTo = '/home';
  let stateApplication: GoogleApplication = 'usuario';
  let stage: GoogleDiagnosticStage = 'state';
  let category: GoogleDiagnosticCategory = 'unknown';
  try {
    const state = getGoogleState(request);
    stateReturnTo = state.returnTo;
    stateApplication = state.application;
    const code = typeof request.query.code === 'string' ? request.query.code : '';
    if (!code) { category = 'client_cancelled'; throw new AppError(400, 'GOOGLE_AUTH_CANCELLED', 'La autenticación con Google fue cancelada.'); }
    stage = 'code_exchange';
    const profile = await verifyGoogleCode(code, state);
    if (state.flow === 'link') {
      const refreshToken = getRefreshToken(request);
      const linkedUserId = refreshToken ? await findSessionUserId(refreshToken) : undefined;
      if (!linkedUserId || linkedUserId !== state.userId) throw new AppError(401, 'UNAUTHENTICATED', 'Autenticación requerida.');
    }
    stage = 'user_resolution';
    let resolved: Awaited<ReturnType<typeof resolveGoogleUser>>;
    try { resolved = await resolveGoogleUser(profile, state); } catch (error) { throw new GoogleOAuthDiagnosticError('user_resolution', error instanceof AppError ? 'application_rejected' : 'database_failure', error); }
    if (state.flow === 'login') {
      stage = 'session_creation';
      let session: Awaited<ReturnType<typeof issueSession>>;
      try { session = await issueSession(resolved.userId, meta(request)); } catch (error) { throw new GoogleOAuthDiagnosticError('session_creation', 'session_failure', error); }
      setRefreshCookie(response, session.refreshToken, state.rememberMe);
    }
    clearGoogleStateCookie(response);
    response.redirect(googleCallbackUrl(state.application, { next: safeGoogleReturnTo(state.returnTo), linked: state.flow === 'link' ? '1' : '0' }));
  } catch (error) {
    if (error instanceof GoogleOAuthDiagnosticError) {
      stage = error.stage;
      category = error.category;
    } else if (error instanceof AppError && error.code === 'GOOGLE_STATE_INVALID') {
      category = 'state_invalid';
    }
    logGoogleDiagnostic(createGoogleDiagnostic(stage, category));
    clearGoogleStateCookie(response);
    response.redirect(googleCallbackUrl(stateApplication, { error: googleErrorCode(error), next: safeGoogleReturnTo(stateReturnTo) }));
  }
};

export const registerController: RequestHandler = async (request, response, next) => { try { const result = await register(parse(registerSchema, request.body), meta(request)); response.status(201).json(result); } catch (error) { next(error); } };
export const loginController: RequestHandler = async (request, response, next) => { try { const input = parse(loginSchema, request.body); const result = await login(input, meta(request)); setRefreshCookie(response, result.refreshToken, input.rememberMe); const { refreshToken: _refreshToken, ...publicResult } = result; response.status(200).json(publicResult); } catch (error) { next(error); } };
export const refreshController: RequestHandler = async (request, response, next) => { try { const token = getRefreshToken(request); if (!token) throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'El token de renovación no es válido.'); const preference = parse(sessionPreferenceSchema, request.body ?? {}); const result = await refresh(token, meta(request)); setRefreshCookie(response, result.refreshToken, preference.rememberMe); const { refreshToken: _refreshToken, ...publicResult } = result; response.status(200).json(publicResult); } catch (error) { next(error); } };
export const logoutController: RequestHandler = async (request, response, next) => { try { const token = getRefreshToken(request); if (token) await logout(token); clearRefreshCookie(response); response.status(204).send(); } catch (error) { next(error); } };
export const meController: RequestHandler = async (request, response, next) => { try { response.status(200).json({ user: await getCurrentUser((request as AuthenticatedRequest).auth.userId) }); } catch (error) { next(error); } };
export const requestVerificationController: RequestHandler = async (request, response, next) => { try { const { email } = parse(emailRequestSchema, request.body); await sendVerificationRequest(email.trim().toLocaleLowerCase('en-US')); response.status(202).json({ message: 'Si la cuenta es elegible, recibirás un correo.' }); } catch (error) { next(error); } };
export const confirmEmailController: RequestHandler = async (request, response, next) => {
  try {
    const userId = await confirmEmail(parse(emailTokenSchema, request.body).token);
    const user = await getCurrentUser(userId);
    try {
      const session = await issueSession(userId, meta(request));
      setRefreshCookie(response, session.refreshToken, false);
      response.status(200).json({ user, accessToken: session.accessToken, autoLogin: true });
    } catch {
      clearRefreshCookie(response);
      response.status(200).json({ user, autoLogin: false });
    }
  } catch (error) { next(error); }
};
export const requestPasswordResetController: RequestHandler = async (request, response, next) => { try { const { email } = parse(emailRequestSchema, request.body); await sendPasswordResetRequest(email.trim().toLocaleLowerCase('en-US')); response.status(202).json({ message: 'Si la cuenta existe, recibirás instrucciones para continuar.' }); } catch (error) { next(error); } };
export const confirmPasswordResetController: RequestHandler = async (request, response, next) => {
  try {
    const input = parse(passwordResetConfirmSchema, request.body);
    const userId = await resetPassword(input.token, await argon2.hash(input.password, { type: argon2.argon2id }));
    const result = await finishPasswordReset(userId, () => getCurrentUser(userId), () => issuePasswordResetSession(userId, meta(request)));
    if (result.session) {
      setRefreshCookie(response, result.session.refreshToken, input.rememberMe);
      response.status(200).json({ user: result.user, accessToken: result.session.accessToken });
    } else {
      clearRefreshCookie(response);
      response.status(200).json({ user: result.user, autoLogin: false });
    }
  } catch (error) { next(error); }
};

export const updateProfileController: RequestHandler = async (request, response, next) => { try { const auth = (request as AuthenticatedRequest).auth; const user = await updateProfile(auth.userId, parse(profileUpdateSchema, request.body)); response.status(200).json({ user }); } catch (error) { next(error); } };
export const uploadAvatarController: RequestHandler = async (request, response, next) => { try { const auth = (request as AuthenticatedRequest).auth; await uploadAvatar(auth.userId, request.file ? { buffer: request.file.buffer, mimetype: request.file.mimetype, size: request.file.size } : undefined); response.status(204).send(); } catch (error) { next(error); } };
export const ownAvatarController: RequestHandler = async (request, response, next) => { try { const avatar = await readOwnAvatar((request as AuthenticatedRequest).auth.userId); response.setHeader('Cache-Control', 'private, no-store'); response.type(avatar.mimeType).send(avatar.content); } catch (error) { next(error); } };
export const updateAdultContentPreferenceController: RequestHandler = async (request, response, next) => { try { const auth = (request as AuthenticatedRequest).auth; const preference = await updateAdultContentPreference(auth.userId, parse(adultContentPreferenceSchema, request.body)); response.status(200).json({ preference }); } catch (error) { next(error); } };
export const getPreferredLocationController: RequestHandler = async (request, response, next) => { try { response.status(200).json({ location: await getPreferredLocation((request as AuthenticatedRequest).auth.userId) }); } catch (error) { next(error); } };
export const savePreferredLocationController: RequestHandler = async (request, response, next) => { try { const location = await savePreferredLocation((request as AuthenticatedRequest).auth.userId, parse(preferredLocationSchema, request.body)); response.status(200).json({ location }); } catch (error) { next(error); } };
export const changePasswordController: RequestHandler = async (request, response, next) => { try { const auth = (request as AuthenticatedRequest).auth; await changePassword(auth.userId, auth.sessionId, parse(changePasswordSchema, request.body)); response.status(204).send(); } catch (error) { next(error); } };
