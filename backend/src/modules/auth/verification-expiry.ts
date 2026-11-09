/** This hard limit also applies to older links issued under a longer TTL. */
export const EMAIL_VERIFICATION_MAX_AGE_MS = 15 * 60 * 1000;

/** Every issuance has its own 15-minute window, including a successful resend. */
export function verificationDeadline(issuedAt: Date, ttlMs: number): Date {
  return new Date(issuedAt.getTime() + ttlMs);
}
