import type { Prisma } from '../../generated/prisma/client.js';
import { AppError } from '../../shared/errors/app-error.js';

const UUID_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const REFERRAL_PATTERN = /^XMK-([A-F0-9]{32})$/;

/**
 * Lossless, stable, business-unique referral code derived from Business.publicId.
 * No parallel code table, randomness, truncation, or collision risk.
 */
export function referralCodeForBusiness(publicId: string): string | null {
  return UUID_PATTERN.test(publicId) ? `XMK-${publicId.replace(/-/g, '').toUpperCase()}` : null;
}

export function publicIdForReferralCode(value: string): string | null {
  const compact = REFERRAL_PATTERN.exec(value.trim().toUpperCase())?.[1];
  if (!compact) return null;
  return `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20)}`.toLowerCase();
}

/**
 * Check a submitted referral while it is still pending; this never creates a
 * BusinessReferral or changes the business counter.
 */
export async function findEligibleReferralBusiness(
  db: Pick<Prisma.TransactionClient, 'business'>,
  referralCode: string,
) {
  const publicId = publicIdForReferralCode(referralCode);
  if (!publicId) throw new AppError(400, 'INVALID_REFERRAL_CODE', 'El código de referido no es válido.');
  const business = await db.business.findFirst({
    where: {
      publicId,
      lifecycleStatus: 'ACTIVE',
      publicationStatus: 'PUBLISHED',
      visibilityStatus: 'VISIBLE',
      deletionStatus: 'NONE',
    },
    select: { id: true, createdById: true },
  });
  if (!business) throw new AppError(400, 'INVALID_REFERRAL_CODE', 'El código de referido no corresponde a un negocio disponible.');
  return business;
}

/**
 * Called only when a NEW user account is created, inside the user-creation
 * database transaction. A failed or invalid referral rolls back signup.
 */
export async function attributeNewUserReferral(
  tx: Pick<Prisma.TransactionClient, 'business' | 'businessReferral' | 'businessReferralCounter'>,
  userId: string,
  referralCode?: string,
): Promise<void> {
  if (!referralCode?.trim()) return;
  const business = await findEligibleReferralBusiness(tx, referralCode);
  if (business.createdById === userId) throw new AppError(400, 'REFERRAL_SELF_NOT_ALLOWED', 'El propietario no puede ser su propio referido.');
  const inserted = await tx.businessReferral.createMany({
    data: { businessId: business.id, referredUserId: userId, validatedAt: new Date() },
    skipDuplicates: true,
  });
  if (inserted.count !== 1) return;
  await tx.businessReferralCounter.upsert({
    where: { businessId: business.id },
    create: { businessId: business.id, validReferralCount: 1 },
    update: { validReferralCount: { increment: 1 } },
  });
}
