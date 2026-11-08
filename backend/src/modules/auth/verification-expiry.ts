/** Keep an active email-verification window fixed when a link is resent. */
export function verificationDeadline(now: Date, previousExpiry: Date | null, ttlMs: number): Date {
  if (previousExpiry && previousExpiry.getTime() > now.getTime()) return previousExpiry;
  return new Date(now.getTime() + ttlMs);
}
