import argon2 from 'argon2';
import { withUniqueNickname } from './nickname.service.js';
import { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { AppError } from '../../shared/errors/app-error.js';
import { createAccessToken, createRefreshToken, hashRefreshToken } from '../../shared/auth/tokens.js';
import type { LoginInput, RegisterInput } from './auth.schemas.js';
import { sendVerificationRequest } from './auth-token.service.js';
import { sendWelcomeEmail } from '../../shared/email/email-service.js';
import { shouldRequireEmailVerification } from './email-login-policy.js';

const invalidCredentials = () => new AppError(401, 'INVALID_CREDENTIALS', 'Correo o contraseña incorrectos.');
const unverifiedEmail = () => new AppError(403, 'EMAIL_NOT_VERIFIED', 'Verifica tu correo electrónico antes de iniciar sesión.');

function normalizeEmail(email: string): string {
  return email.trim().toLocaleLowerCase('en-US');
}

function refreshExpiresAt(persistent: boolean): Date {
  return new Date(Date.now() + (persistent ? env.refreshTokenTtlDays * 86400 : 8 * 3600) * 1000);
}

export async function issueSession(userId: string, requestMeta?: { userAgent?: string; ipAddress?: string }, persistent = false) {
  const refreshToken = createRefreshToken();
  const session = await prisma.session.create({
    data: {
      userId,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: refreshExpiresAt(persistent),
      userAgent: requestMeta?.userAgent,
      ipAddress: requestMeta?.ipAddress,
    },
  });
  return { accessToken: await createAccessToken({ userId, sessionId: session.id }), refreshToken };
}

export async function register(input: RegisterInput, _requestMeta?: { userAgent?: string; ipAddress?: string }) {
  const emailNormalized = normalizeEmail(input.email);
  const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
  try {
    const user = await withUniqueNickname(prisma, input.name.trim(), (nickname) => prisma.user.create({
      data: {
        displayName: input.name.trim(),
        nickname,
        emailNormalized,
        authIdentities: {
          create: { provider: 'EMAIL', providerSubject: emailNormalized, passwordHash },
        },
      },
      select: { id: true, publicId: true, displayName: true, emailNormalized: true },
    }));
    const result = { user: await getCurrentUser(user.id) };
    let verificationEmailSent = true;
    try { await sendVerificationRequest(emailNormalized); }
    catch { verificationEmailSent = false; console.warn('Registration verification email could not be sent'); }
    try { await sendWelcomeEmail(emailNormalized, user.displayName); }
    catch { console.warn('Registration welcome email could not be sent'); }
    return { ...result, user: { ...result.user, verificationEmailSent } };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new AppError(409, 'EMAIL_UNAVAILABLE', 'Este correo ya tiene una cuenta en WIT. Inicia sesión.', { email: 'Este correo ya tiene una cuenta en WIT. Inicia sesión.' });
    }
    throw error;
  }
}

export async function login(input: LoginInput, requestMeta?: { userAgent?: string; ipAddress?: string }) {
  const emailNormalized = normalizeEmail(input.email);
  const identity = await prisma.authIdentity.findUnique({
    where: { provider_providerSubject: { provider: 'EMAIL', providerSubject: emailNormalized } },
    select: { passwordHash: true, verifiedAt: true, user: { select: { id: true, publicId: true, displayName: true, emailNormalized: true, status: true } } },
  });
  if (!identity?.passwordHash || identity.user.status !== 'ACTIVE') throw invalidCredentials();
  const valid = await argon2.verify(identity.passwordHash, input.password);
  if (!valid) throw invalidCredentials();
  if (shouldRequireEmailVerification(identity.verifiedAt, env.allowUnverifiedEmailLogin)) throw unverifiedEmail();
  await prisma.user.update({ where: { id: identity.user.id }, data: { lastLoginAt: new Date() } });
  return { user: await getCurrentUser(identity.user.id), ...(await issueSession(identity.user.id, requestMeta, input.rememberMe)) };
}

export async function refresh(refreshToken: string, _requestMeta?: { userAgent?: string; ipAddress?: string }) {
  const tokenHash = hashRefreshToken(refreshToken);
  const now = new Date();
  const owner = await prisma.session.findUnique({ where: { tokenHash }, select: { id: true, userId: true, revokedAt: true, expiresAt: true, user: { select: { status: true } } } });
  if (!owner || owner.revokedAt || owner.expiresAt <= now || owner.user.status !== 'ACTIVE') throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'El token de renovación no es válido.');
  const identities = await prisma.authIdentity.findMany({ where: { userId: owner.userId }, select: { verifiedAt: true } });
  if (identities.every((identity) => shouldRequireEmailVerification(identity.verifiedAt, env.allowUnverifiedEmailLogin))) {
    await prisma.session.updateMany({ where: { id: owner.id, revokedAt: null }, data: { revokedAt: now } });
    throw unverifiedEmail();
  }
  // Keep the opaque, hashed session credential stable. Rotating by revoking the
  // session also revoked every access token in other tabs and lost the session
  // whenever a refresh response was interrupted. Absolute expiry never slides.
  const user = await getCurrentUser(owner.userId);
  const active = await prisma.session.updateMany({
    where: { id: owner.id, revokedAt: null, expiresAt: { gt: new Date() } },
    data: { lastSeenAt: new Date() },
  });
  if (active.count !== 1) throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'El token de renovación no es válido.');
  return { user, accessToken: await createAccessToken({ userId: owner.userId, sessionId: owner.id }) };
}

export async function logout(refreshToken: string): Promise<void> {
  await prisma.session.updateMany({ where: { tokenHash: hashRefreshToken(refreshToken), revokedAt: null }, data: { revokedAt: new Date() } });
}

export async function getCurrentUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, publicId: true, displayName: true, nickname: true, emailNormalized: true, avatarUrl: true, locale: true, status: true, adultContentEnabled: true, adultContentAcceptedAt: true, adultContentAcceptedVersion: true, adultContentRevokedAt: true, authIdentities: { select: { provider: true, verifiedAt: true } } } });
  if (!user || user.status !== 'ACTIVE') throw new AppError(401, 'UNAUTHENTICATED', 'Autenticación requerida.');
  const { authIdentities, ...publicUser } = user;
  const { adultContentEnabled, adultContentAcceptedAt, adultContentAcceptedVersion, adultContentRevokedAt, ...userData } = publicUser;
  const privateAvatarKey = userData.avatarUrl?.startsWith('private-avatar:') ? userData.avatarUrl.slice('private-avatar:'.length) : null;
  const avatarVersion = privateAvatarKey?.split('/').at(-1)?.replace(/\.(jpg|png|webp)$/i, '');
  return { ...userData, avatarUrl: privateAvatarKey ? `/api/v1/auth/me/avatar?v=${encodeURIComponent(avatarVersion ?? privateAvatarKey)}` : userData.avatarUrl, authProviders: authIdentities.map((identity) => identity.provider), emailVerified: authIdentities.some((identity) => identity.verifiedAt !== null), adultContentPreference: { enabled: adultContentEnabled, acceptedAt: adultContentAcceptedAt, conditionsVersion: adultContentAcceptedVersion, revokedAt: adultContentRevokedAt, ageVerified: false } };
}
