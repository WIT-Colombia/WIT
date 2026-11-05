import { consumePasswordResetToken } from './password-reset.js';
import { consumeVerificationToken } from './verification-confirmation.js';
import { createHash, randomBytes } from 'node:crypto';
import { prisma } from '../../config/prisma.js';
import { sendPasswordResetEmail, sendSecurityNotificationEmail, sendVerificationEmail } from '../../shared/email/email-service.js';

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

export async function confirmEmail(token: string): Promise<string> {
  const record = await prisma.$transaction((transaction) => consumeVerificationToken(transaction, token));
  return record.userId;
}

export async function sendPasswordResetRequest(emailNormalized: string): Promise<void> {
  const identity = await prisma.authIdentity.findUnique({
    where: { provider_providerSubject: { provider: 'EMAIL', providerSubject: emailNormalized } },
    select: { userId: true, verifiedAt: true, user: { select: { displayName: true, emailNormalized: true, status: true } } },
  });
  if (!identity || !identity.verifiedAt || identity.user.status !== 'ACTIVE') return;
  const token = await issueToken(identity.userId, 'PASSWORD_RESET', 30 * 60 * 1000);
  await sendPasswordResetEmail(identity.user.emailNormalized ?? emailNormalized, token, identity.user.displayName);
}

export async function resetPassword(token: string, passwordHash: string): Promise<string> {
  const user = await prisma.$transaction((transaction) => consumePasswordResetToken(transaction, token, passwordHash));
  if (user?.emailNormalized) {
    try { await sendSecurityNotificationEmail(user.emailNormalized, user.displayName, 'Se cambió la contraseña de tu cuenta'); }
    catch { console.warn('Password security notification could not be sent'); }
  }
  return user.id;
}
