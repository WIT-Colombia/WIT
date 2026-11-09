/** Maximum age of any email-verification link, including legacy tokens. */
export const EMAIL_VERIFICATION_MAX_AGE_MS = 15 * 60 * 1000;

/** A fresh 15-minute verification window starts with every successful issuance. */
export function verificationDeadline(issuedAt: Date, ttlMs: number): Date {
  return new Date(issuedAt.getTime() + ttlMs);
}
