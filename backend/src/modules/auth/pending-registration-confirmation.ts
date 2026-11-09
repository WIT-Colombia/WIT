import type { PendingEmailRegistration, Prisma } from '../../generated/prisma/client.js';
import { AppError } from '../../shared/errors/app-error.js';
import { attributeNewUserReferral } from './business-referral.service.js';
import { createAvailableNickname } from './nickname.service.js';

/**
 * The only point at which an email/password signup becomes a real user.
 * The pending token is atomically consumed in the same database transaction.
 * Tests exercise this function with a synthetic transaction, no real accounts.
 */
export async function createUserFromConfirmedPending(
  tx: Prisma.TransactionClient,
  pending: PendingEmailRegistration,
  tokenHash: string,
): Promise<string> {
  const now = new Date();
  const consumed = await tx.pendingEmailRegistration.deleteMany({
    where: { id: pending.id, tokenHash, expiresAt: { gt: now } },
  });
  if (consumed.count !== 1) throw new AppError(400, 'INVALID_AUTH_TOKEN', 'El enlace no es válido o ya expiró.');

  const nickname = await createAvailableNickname(tx, pending.displayName);
  const user = await tx.user.create({
    data: {
      displayName: pending.displayName,
      nickname,
      emailNormalized: pending.emailNormalized,
      authIdentities: {
        create: {
          provider: 'EMAIL', providerSubject: pending.emailNormalized,
          passwordHash: pending.passwordHash, verifiedAt: now,
        },
      },
    },
    select: { id: true },
  });

  if (pending.referralCode) {
    try {
      // A business that disappears during the 15-minute window must not
      // prevent a verified person from receiving their account.
      await attributeNewUserReferral(tx, user.id, pending.referralCode);
    } catch (error) {
      if (!(error instanceof AppError) || !['INVALID_REFERRAL_CODE', 'REFERRAL_SELF_NOT_ALLOWED'].includes(error.code)) throw error;
    }
  }
  return user.id;
}
