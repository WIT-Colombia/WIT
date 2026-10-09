import { consumeVerificationToken } from './verification-confirmation.js';
import { createHash, randomBytes } from 'node:crypto';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';
import { sendPasswordResetEmail, sendVerificationEmail } from '../../shared/email/email-service.js';

type TokenType = 'EMAIL_VERIFICATION' | 'PASSWORD_RESET';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

async function issueToken(userId: string, type: TokenType, ttlMs: number): Promise<string> {
  const rawToken = randomBytes(48).toString('base64url');
  const now = new Date();
  await prisma.$transaction(async (transaction) => {
    await transaction.authToken.updateMany({
      where: { userId, type, consumedAt: null, expiresAt: { gt: now } },
      data: { consumedAt: now },
    });
    await transaction.authToken.create({
      data: { userId, type, tokenHash: hashToken(rawToken), expiresAt: new Date(now.getTime() + ttlMs) },
    });
  });
  return rawToken;
}


export async function sendVerificationRequest(emailNormalized: string): Promise<void> {
  const identity = await prisma.authIdentity.findUnique({
    where: { provider_providerSubject: { provider: 'EMAIL', providerSubject: emailNormalized } },
    select: { userId: true, verifiedAt: true, user: { select: { displayName: true, emailNormalized: true, status: true } } },
  });
  if (!identity || identity.verifiedAt || identity.user.status !== 'ACTIVE') return;
  const token = await issueToken(identity.userId, 'EMAIL_VERIFICATION', 24 * 60 * 60 * 1000);
  await sendVerificationEmail(identity.user.emailNormalized ?? emailNormalized, token, identity.user.displayName);
}

export async function confirmEmail(token: string): Promise<void> {
  await prisma.$transaction((transaction) => consumeVerificationToken(transaction, token));
}

export async function sendPasswordResetRequest(emailNormalized: string): Promise<void> {
  const identity = await prisma.authIdentity.findUnique({
    where: { provider_providerSubject: { provider: 'EMAIL', providerSubject: emailNormalized } },
    select: { userId: true, user: { select: { displayName: true, emailNormalized: true, status: true } } },
  });
  if (!identity || identity.user.status !== 'ACTIVE') return;
  const token = await issueToken(identity.userId, 'PASSWORD_RESET', 30 * 60 * 1000);
  await sendPasswordResetEmail(identity.user.emailNormalized ?? emailNormalized, token, identity.user.displayName);
}

export async function resetPassword(token: string, passwordHash: string): Promise<void> {
  await prisma.$transaction(async (transaction) => {
    const record = await transaction.authToken.findUnique({ where: { tokenHash: hashToken(token) } });
    const now = new Date();
    if (!record || record.type !== 'PASSWORD_RESET' || record.consumedAt || record.expiresAt <= now) {
      throw new AppError(400, 'INVALID_AUTH_TOKEN', 'El enlace no es válido o ya expiró.');
    }
    const consumed = await transaction.authToken.updateMany({ where: { id: record.id, consumedAt: null, expiresAt: { gt: now } }, data: { consumedAt: now } });
    if (consumed.count !== 1) throw new AppError(400, 'INVALID_AUTH_TOKEN', 'El enlace no es válido o ya expiró.');
    await transaction.authIdentity.updateMany({ where: { userId: record.userId, provider: 'EMAIL' }, data: { passwordHash } });
    await transaction.session.updateMany({ where: { userId: record.userId, revokedAt: null }, data: { revokedAt: now } });
  });
}
