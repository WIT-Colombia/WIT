/** Every issuance has its own 15-minute window, including a successful resend. */
export function verificationDeadline(issuedAt: Date, ttlMs: number): Date {
  return new Date(issuedAt.getTime() + ttlMs);
}
