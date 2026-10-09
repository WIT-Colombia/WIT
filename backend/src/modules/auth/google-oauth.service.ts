import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { parseCookie, stringifySetCookie } from 'cookie';
import { jwtVerify, createRemoteJWKSet, type JWTPayload } from 'jose';
import type { Request, Response } from 'express';
import { env } from '../../config/env.js';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';

const GOOGLE_STATE_COOKIE = 'wit_google_oauth_state';
const GOOGLE_STATE_PATH = '/api/v1/auth/google';
const GOOGLE_STATE_TTL_SECONDS = 10 * 60;
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];
const googleKeys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

export type GoogleFlow = 'login' | 'link';
export type GoogleState = {
  state: string;
  nonce: string;
  verifier: string;
  returnTo: string;
  flow: GoogleFlow;
  rememberMe: boolean;
  consent: boolean;
  userId?: string;
};

export type GoogleProfile = {
  subject: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
};

function requireGoogleConfig(): { clientId: string; clientSecret: string; redirectUri: string } {
  if (!env.googleClientId || !env.googleClientSecret) {
    throw new AppError(503, 'GOOGLE_NOT_CONFIGURED', 'El inicio de sesión con Google no está disponible.');
  }
  return { clientId: env.googleClientId, clientSecret: env.googleClientSecret, redirectUri: env.googleRedirectUri };
}

function encode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function decode(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function sign(value: string): string {
  return createHmac('sha256', env.accessTokenSecret).update(value).digest('base64url');
}

function packState(state: GoogleState): string {
  const payload = encode(JSON.stringify(state));
  return `${payload}.${sign(payload)}`;
}

function unpackState(value: string): GoogleState {
  const [payload, signature] = value.split('.');
  if (!payload || !signature) throw new AppError(400, 'GOOGLE_STATE_INVALID', 'La solicitud de Google no es válida.');
  const expected = Buffer.from(sign(payload));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) throw new AppError(400, 'GOOGLE_STATE_INVALID', 'La solicitud de Google no es válida.');
  let parsed: unknown;
  try { parsed = JSON.parse(decode(payload)); } catch { throw new AppError(400, 'GOOGLE_STATE_INVALID', 'La solicitud de Google no es válida.'); }
  if (!parsed || typeof parsed !== 'object') throw new AppError(400, 'GOOGLE_STATE_INVALID', 'La solicitud de Google no es válida.');
  const candidate = parsed as Partial<GoogleState>;
  if (typeof candidate.state !== 'string' || typeof candidate.nonce !== 'string' || typeof candidate.verifier !== 'string' || typeof candidate.returnTo !== 'string' || (candidate.flow !== 'login' && candidate.flow !== 'link')) {
    throw new AppError(400, 'GOOGLE_STATE_INVALID', 'La solicitud de Google no es válida.');
  }
  return candidate as GoogleState;
}

export function safeGoogleReturnTo(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/register')) return '/home';
  return value;
}

export function setGoogleStateCookie(response: Response, state: GoogleState): void {
  response.appendHeader('Set-Cookie', stringifySetCookie({ name: GOOGLE_STATE_COOKIE, value: packState(state), httpOnly: true, secure: env.nodeEnv === 'production', sameSite: 'lax', path: GOOGLE_STATE_PATH, maxAge: GOOGLE_STATE_TTL_SECONDS }));
}

export function clearGoogleStateCookie(response: Response): void {
  response.appendHeader('Set-Cookie', stringifySetCookie({ name: GOOGLE_STATE_COOKIE, value: '', httpOnly: true, secure: env.nodeEnv === 'production', sameSite: 'lax', path: GOOGLE_STATE_PATH, maxAge: 0 }));
}

export function getGoogleState(request: Request): GoogleState {
  const raw = parseCookie(request.headers.cookie ?? '')[GOOGLE_STATE_COOKIE];
  if (!raw) throw new AppError(400, 'GOOGLE_STATE_INVALID', 'La solicitud de Google no es válida.');
  return unpackState(raw);
}

export function createGoogleAuthorization(requested: { flow: GoogleFlow; returnTo?: unknown; rememberMe?: boolean; consent?: boolean; userId?: string }): { state: GoogleState; url: string } {
  const { clientId, redirectUri } = requireGoogleConfig();
  const state: GoogleState = {
    state: randomBytes(32).toString('base64url'),
    nonce: randomBytes(32).toString('base64url'),
    verifier: randomBytes(32).toString('base64url'),
    returnTo: safeGoogleReturnTo(requested.returnTo),
    flow: requested.flow,
    rememberMe: requested.rememberMe === true,
    consent: requested.consent === true,
    ...(requested.userId ? { userId: requested.userId } : {}),
  };
  const challenge = createHash('sha256').update(state.verifier).digest('base64url');
  const params = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: 'code', scope: 'openid email profile', state: state.state, nonce: state.nonce, code_challenge: challenge, code_challenge_method: 'S256', access_type: 'online', prompt: 'select_account' });
  return { state, url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` };
}

async function exchangeCode(code: string, state: GoogleState): Promise<string> {
  const { clientId, clientSecret, redirectUri } = requireGoogleConfig();
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code', code_verifier: state.verifier }) });
  if (!response.ok) throw new AppError(502, 'GOOGLE_PROVIDER_ERROR', 'No se pudo completar la autenticación con Google.');
  const body = await response.json() as { id_token?: unknown };
  if (typeof body.id_token !== 'string') throw new AppError(502, 'GOOGLE_PROVIDER_ERROR', 'No se pudo completar la autenticación con Google.');
  return body.id_token;
}

function claimString(payload: JWTPayload, key: string): string | undefined {
  return typeof payload[key] === 'string' ? payload[key] : undefined;
}

export async function verifyGoogleCode(code: string, state: GoogleState): Promise<GoogleProfile> {
  const { clientId } = requireGoogleConfig();
  const idToken = await exchangeCode(code, state);
  const verified = await jwtVerify(idToken, googleKeys, { issuer: GOOGLE_ISSUERS, audience: clientId });
  if (verified.payload.nonce !== state.nonce || verified.payload.email_verified !== true) throw new AppError(401, 'GOOGLE_IDENTITY_INVALID', 'No se pudo verificar la cuenta de Google.');
  const subject = claimString(verified.payload, 'sub');
  const email = claimString(verified.payload, 'email')?.trim().toLocaleLowerCase('en-US');
  if (!subject || !email) throw new AppError(401, 'GOOGLE_IDENTITY_INVALID', 'No se pudo verificar la cuenta de Google.');
  return { subject, email, displayName: claimString(verified.payload, 'name')?.trim() || email.split('@')[0], avatarUrl: claimString(verified.payload, 'picture') ?? null };
}

export async function resolveGoogleUser(profile: GoogleProfile, state: GoogleState): Promise<{ userId: string; created: boolean }> {
  return prisma.$transaction(async (transaction) => {
    const existingIdentity = await transaction.authIdentity.findUnique({ where: { provider_providerSubject: { provider: 'GOOGLE', providerSubject: profile.subject } }, select: { userId: true, user: { select: { status: true } } } });
    if (existingIdentity) {
      if (existingIdentity.user.status !== 'ACTIVE') throw new AppError(403, 'ACCOUNT_UNAVAILABLE', 'La cuenta no está disponible.');
      if (state.flow === 'link' && state.userId !== existingIdentity.userId) throw new AppError(409, 'GOOGLE_IDENTITY_IN_USE', 'Esta cuenta de Google ya está vinculada a otra cuenta.');
      return { userId: existingIdentity.userId, created: false };
    }
    if (state.flow === 'link') {
      if (!state.userId) throw new AppError(400, 'GOOGLE_LINK_INVALID', 'No se pudo iniciar la vinculación.');
      const owner = await transaction.user.findUnique({ where: { id: state.userId }, select: { id: true, status: true, emailNormalized: true } });
      if (!owner || owner.status !== 'ACTIVE') throw new AppError(401, 'UNAUTHENTICATED', 'Autenticación requerida.');
      const emailOwner = await transaction.user.findUnique({ where: { emailNormalized: profile.email }, select: { id: true } });
      if (emailOwner && emailOwner.id !== owner.id) throw new AppError(409, 'GOOGLE_EMAIL_IN_USE', 'El correo de Google ya pertenece a otra cuenta.');
      await transaction.authIdentity.create({ data: { userId: owner.id, provider: 'GOOGLE', providerSubject: profile.subject, verifiedAt: new Date() } });
      return { userId: owner.id, created: false };
    }
    const emailOwner = await transaction.user.findUnique({ where: { emailNormalized: profile.email }, select: { id: true } });
    if (emailOwner) throw new AppError(409, 'GOOGLE_LINK_REQUIRED', 'Inicia sesión con tu cuenta WIT para vincular Google.');
    if (!state.consent) throw new AppError(400, 'GOOGLE_CONSENT_REQUIRED', 'Acepta los términos para crear tu cuenta con Google.');
    const user = await transaction.user.create({ data: { displayName: profile.displayName.slice(0, 120), emailNormalized: profile.email, avatarUrl: profile.avatarUrl, authIdentities: { create: { provider: 'GOOGLE', providerSubject: profile.subject, verifiedAt: new Date() } } }, select: { id: true } });
    return { userId: user.id, created: true };
  });
}

export async function findSessionUserId(refreshToken: string): Promise<string | undefined> {
  const record = await prisma.session.findUnique({ where: { tokenHash: createHash('sha256').update(refreshToken).digest('hex') }, select: { userId: true, revokedAt: true, expiresAt: true } });
  return record && !record.revokedAt && record.expiresAt > new Date() ? record.userId : undefined;
}
