import argon2 from 'argon2';
import { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { AppError } from '../../shared/errors/app-error.js';
import { createAccessToken, createRefreshToken, hashRefreshToken } from '../../shared/auth/tokens.js';
import type { LoginInput, RegisterInput } from './auth.schemas.js';
import { sendVerificationRequest } from './auth-token.service.js';

const invalidCredentials = () => new AppError(401, 'INVALID_CREDENTIALS', 'Correo o contraseña incorrectos.');
const unverifiedEmail = () => new AppError(403, 'EMAIL_NOT_VERIFIED', 'Verifica tu correo electrónico antes de iniciar sesión.');

function normalizeEmail(email: string): string {
  return email.trim().toLocaleLowerCase('en-US');
}

function refreshExpiresAt(): Date {
  return new Date(Date.now() + env.refreshTokenTtlDays * 24 * 60 * 60 * 1000);
}

export async function issueSession(userId: string, requestMeta?: { userAgent?: string; ipAddress?: string }) {
  const refreshToken = createRefreshToken();
  const session = await prisma.session.create({
    data: {
      userId,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: refreshExpiresAt(),
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
    const user = await prisma.user.create({
      data: {
        displayName: input.name.trim(),
        emailNormalized,
        authIdentities: {
          create: { provider: 'EMAIL', providerSubject: emailNormalized, passwordHash },
        },
      },
      select: { id: true, publicId: true, displayName: true, emailNormalized: true },
    });
    const result = { user: await getCurrentUser(user.id) };
    let verificationEmailSent = true;
    try { await sendVerificationRequest(emailNormalized); }
    catch { verificationEmailSent = false; console.warn('Registration verification email could not be sent'); }
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
  if (!identity.verifiedAt) throw unverifiedEmail();
  await prisma.user.update({ where: { id: identity.user.id }, data: { lastLoginAt: new Date() } });
  return { user: await getCurrentUser(identity.user.id), ...(await issueSession(identity.user.id, requestMeta)) };
}

export async function refresh(refreshToken: string, requestMeta?: { userAgent?: string; ipAddress?: string }) {
  const tokenHash = hashRefreshToken(refreshToken);
  const now = new Date();
  const owner = await prisma.session.findUnique({ where: { tokenHash }, select: { id: true, userId: true, revokedAt: true, expiresAt: true, user: { select: { status: true } } } });
  if (!owner || owner.revokedAt || owner.expiresAt <= now || owner.user.status !== 'ACTIVE') throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'El token de renovación no es válido.');
  const identities = await prisma.authIdentity.findMany({ where: { userId: owner.userId }, select: { verifiedAt: true } }).catch(() => []);
  if (!identities.some((identity) => identity.verifiedAt !== null)) {
    await prisma.session.updateMany({ where: { id: owner.id, revokedAt: null }, data: { revokedAt: now } });
    throw unverifiedEmail();
  }
  return prisma.$transaction(async (transaction) => {
    const session = await transaction.session.findUnique({ where: { tokenHash }, include: { user: true } });
    if (!session || session.revokedAt || session.expiresAt <= now || session.user.status !== 'ACTIVE') {
      throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'El token de renovación no es válido.');
    }
    const revoked = await transaction.session.updateMany({ where: { id: session.id, revokedAt: null }, data: { revokedAt: now } });
    if (revoked.count !== 1) throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'El token de renovación no es válido.');
    const nextRefreshToken = createRefreshToken();
    const nextSession = await transaction.session.create({
      data: { userId: session.userId, tokenHash: hashRefreshToken(nextRefreshToken), expiresAt: refreshExpiresAt(), userAgent: requestMeta?.userAgent, ipAddress: requestMeta?.ipAddress },
    });
    return {
      user: await getCurrentUser(session.userId),
      accessToken: await createAccessToken({ userId: session.userId, sessionId: nextSession.id }),
      refreshToken: nextRefreshToken,
    };
  });
}

export async function logout(refreshToken: string): Promise<void> {
  await prisma.session.updateMany({ where: { tokenHash: hashRefreshToken(refreshToken), revokedAt: null }, data: { revokedAt: new Date() } });
}

export async function getCurrentUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, publicId: true, displayName: true, emailNormalized: true, avatarUrl: true, locale: true, status: true, authIdentities: { select: { provider: true, verifiedAt: true } } } });
  if (!user || user.status !== 'ACTIVE') throw new AppError(401, 'UNAUTHENTICATED', 'Autenticación requerida.');
  const { authIdentities, ...publicUser } = user;
  return { ...publicUser, authProviders: authIdentities.map((identity) => identity.provider), emailVerified: authIdentities.some((identity) => identity.verifiedAt !== null) };
}
