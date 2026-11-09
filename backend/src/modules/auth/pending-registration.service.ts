import argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';
import type { EmailApplication } from '../../shared/email/email-brand.js';
import { sendVerificationEmail, sendWelcomeEmail } from '../../shared/email/email-service.js';
import { emailActionLinkExpiresAt } from '../../shared/email/email-link-expiration.js';
import type { RegisterInput } from './auth.schemas.js';
import { findEligibleReferralBusiness } from './business-referral.service.js';
import { createUserFromConfirmedPending } from './pending-registration-confirmation.js';
import { isNicknameCollision } from './nickname.service.js';

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
const freshToken = () => randomBytes(48).toString('base64url');
const normalizeEmail = (email: string) => email.trim().toLocaleLowerCase('en-US');

/**
 * Stage a signup for 15 minutes, without creating a User, AuthIdentity,
 * BusinessReferral or BusinessReferralCounter. Persist only the Argon2 password
 * hash and the SHA-256 hash of the one-time mail token.
 */
export async function beginPendingRegistration(input: RegisterInput, application: EmailApplication) {
  const emailNormalized = normalizeEmail(input.email);
  const existing = await prisma.user.findUnique({ where: { emailNormalized }, select: { id: true } });
  if (existing) throw new AppError(409, 'EMAIL_UNAVAILABLE', 'Este correo ya tiene una cuenta. Inicia sesión.', { email: 'Este correo ya tiene una cuenta. Inicia sesión.' });

  const referralCode = input.referralCode?.trim().toUpperCase() || null;
  if (referralCode) await findEligibleReferralBusiness(prisma, referralCode);

  const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
  const rawToken = freshToken();
  const now = new Date();
  const expiresAt = emailActionLinkExpiresAt(now);

  // Expired requests are not user accounts; clear them opportunistically.
  await prisma.pendingEmailRegistration.deleteMany({ where: { expiresAt: { lte: now } } });
  await prisma.pendingEmailRegistration.upsert({
    where: { emailNormalized },
    create: {
      emailNormalized, displayName: input.name.trim(), passwordHash, referralCode,
      application, tokenHash: hashToken(rawToken), expiresAt,
    },
    update: {
      displayName: input.name.trim(), passwordHash, referralCode,
      application, tokenHash: hashToken(rawToken), expiresAt,
    },
  });

  let verificationEmailSent = true;
  try {
    await sendVerificationEmail(emailNormalized, rawToken, input.name.trim(), application);
  } catch {
    verificationEmailSent = false;
    console.warn('Pending registration verification email could not be sent');
  }
  return { email: emailNormalized, verificationExpiresAt: expiresAt.toISOString(), verificationEmailSent };
}

/** Retry only an unexpired signup intent. Never change its password or referrer. */
export async function resendPendingRegistration(emailNormalized: string): Promise<boolean> {
  const pending = await prisma.pendingEmailRegistration.findUnique({ where: { emailNormalized } });
  if (!pending) return false;
  const now = new Date();
  if (pending.expiresAt <= now) {
    await prisma.pendingEmailRegistration.deleteMany({ where: { id: pending.id, expiresAt: { lte: now } } });
    return true;
  }
  const rawToken = freshToken();
  const expiresAt = emailActionLinkExpiresAt(now);
  const updated = await prisma.pendingEmailRegistration.updateMany({
    where: { id: pending.id, tokenHash: pending.tokenHash, expiresAt: { gt: now } },
    data: { tokenHash: hashToken(rawToken), expiresAt },
  });
  if (updated.count === 1) {
    const application: EmailApplication = pending.application === 'negocios' ? 'negocios' : 'usuario';
    await sendVerificationEmail(pending.emailNormalized, rawToken, pending.displayName, application);
  }
  return true;
}

/**
 * On confirmation only: atomically consume the pending token and create the
 * verified User, EMAIL identity, and (when eligible) one business referral.
 * Deleting the pending row first under the same transaction provides a
 * single-use claim. A rollback restores it if account creation fails.
 */
export async function confirmPendingRegistration(token: string): Promise<string | null> {
  const pending = await prisma.pendingEmailRegistration.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!pending) return null;
  if (pending.expiresAt <= new Date()) throw new AppError(400, 'INVALID_AUTH_TOKEN', 'El enlace no es válido o ya expiró.');

  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      const userId = await prisma.$transaction((tx) =>
        createUserFromConfirmedPending(tx, pending, hashToken(token)),
      );

      // Never welcome someone whose email has not actually been verified.
      try {
        const application: EmailApplication = pending.application === 'negocios' ? 'negocios' : 'usuario';
        await sendWelcomeEmail(pending.emailNormalized, pending.displayName, application);
      } catch {
        console.warn('Confirmed registration welcome email could not be sent');
      }
      return userId;
    } catch (error) {
      if (isNicknameCollision(error)) continue;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppError(409, 'EMAIL_UNAVAILABLE', 'Este correo ya tiene una cuenta. Inicia sesión.');
      }
      throw error;
    }
  }
  throw new AppError(503, 'NICKNAME_GENERATION_UNAVAILABLE', 'No pudimos generar un nickname disponible. Intenta nuevamente.');
}
