import { consumeVerificationToken } from './verification-confirmation.js';
import { createHash, randomBytes } from 'node:crypto';
import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { AppError } from '../../shared/errors/app-error.js';
import { sendPasswordResetEmail, sendSecurityNotificationEmail, sendVerificationEmail } from '../../shared/email/email-service.js';
import type { EmailApplication } from '../../shared/email/email-brand.js';

type TokenType = 'EMAIL_VERIFICATION' | 'PASSWORD_RESET';
type IssuedToken = { rawToken: string; expiresAt: Date };

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

async function issueToken(userId: string, type: TokenType, ttlMs: number): Promise<IssuedToken> {
  const rawToken = randomBytes(48).toString('base64url');
  return prisma.$transaction(async (transaction) => {
    const now = new Date();
    // Resending invalidates the earlier link without extending its first 15-minute window.
    const previous = type === 'EMAIL_VERIFICATION' ? await transaction.authToken.findFirst({
      where: { userId, type, consumedAt: null, expiresAt: { gt: now } },
      orderBy: { createdAt: 'desc' },
      select: { expiresAt: true },
    }) : null;
    const expiresAt = previous?.expiresAt ?? new Date(now.getTime() + ttlMs);
    await transaction.authToken.updateMany({
      where: { userId, type, consumedAt: null, expiresAt: { gt: now } },
      data: { consumedAt: now },
    });
    await transaction.authToken.create({ data: { userId, type, tokenHash: hashToken(rawToken), expiresAt } });
    return { rawToken, expiresAt };
  });
}


export async function sendVerificationRequest(emailNormalized: string, application: EmailApplication = 'usuario'): Promise<{ expiresAt: Date } | null> {
  const identity = await prisma.authIdentity.findUnique({
    where: { provider_providerSubject: { provider: 'EMAIL', providerSubject: emailNormalized } },
    select: { userId: true, verifiedAt: true, user: { select: { displayName: true, emailNormalized: true, status: true } } },
  });
  if (!identity || identity.verifiedAt || identity.user.status !== 'ACTIVE') return null;
  const { rawToken, expiresAt } = await issueToken(identity.userId, 'EMAIL_VERIFICATION', env.emailVerificationTtlMinutes * 60 * 1000);
  await sendVerificationEmail(identity.user.emailNormalized ?? emailNormalized, rawToken, identity.user.displayName, application);
  return { expiresAt };
}

export async function confirmEmail(token: string): Promise<string> {
  const record = await prisma.$transaction((transaction) => consumeVerificationToken(transaction, token));
  return record.userId;
}

export async function sendPasswordResetRequest(emailNormalized: string, application: EmailApplication = 'usuario'): Promise<void> {
  const identity = await prisma.authIdentity.findUnique({
    where: { provider_providerSubject: { provider: 'EMAIL', providerSubject: emailNormalized } },
    select: { userId: true, verifiedAt: true, user: { select: { displayName: true, emailNormalized: true, status: true } } },
  });
  if (!identity || !identity.verifiedAt || identity.user.status !== 'ACTIVE') return;
  const { rawToken } = await issueToken(identity.userId, 'PASSWORD_RESET', 30 * 60 * 1000);
  await sendPasswordResetEmail(identity.user.emailNormalized ?? emailNormalized, rawToken, identity.user.displayName, application);
}

export async function resetPassword(token: string, passwordHash: string): Promise<string> {
  const userId = await prisma.$transaction(async (transaction) => {
    const record = await transaction.authToken.findUnique({ where: { tokenHash: hashToken(token) } });
    const now = new Date();
    if (!record || record.type !== 'PASSWORD_RESET' || record.consumedAt || record.expiresAt <= now) {
      throw new AppError(400, 'INVALID_AUTH_TOKEN', 'El enlace no es válido o ya expiró.');
    }
    const identity = await transaction.authIdentity.findFirst({ where: { userId: record.userId, provider: 'EMAIL' }, select: { verifiedAt: true } });
    if (!identity?.verifiedAt) throw new AppError(403, 'EMAIL_NOT_VERIFIED', 'Verifica tu correo electrónico antes de recuperar el acceso.');
    const consumed = await transaction.authToken.updateMany({ where: { id: record.id, consumedAt: null, expiresAt: { gt: now } }, data: { consumedAt: now } });
    if (consumed.count !== 1) throw new AppError(400, 'INVALID_AUTH_TOKEN', 'El enlace no es válido o ya expiró.');
    await transaction.authIdentity.updateMany({ where: { userId: record.userId, provider: 'EMAIL' }, data: { passwordHash } });
    await transaction.session.updateMany({ where: { userId: record.userId, revokedAt: null }, data: { revokedAt: now } });
    return record.userId;
  });
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { emailNormalized: true, displayName: true } });
  if (user?.emailNormalized) {
    try { await sendSecurityNotificationEmail(user.emailNormalized, user.displayName, 'Se cambió la contraseña de tu cuenta'); }
    catch { console.warn('Password security notification could not be sent'); }
  }
  return userId;
}
