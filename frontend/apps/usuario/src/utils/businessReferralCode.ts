/**
 * A lossless, stable XAMUKO referral code built from Business.publicId (UUID).
 * The backend validates the same canonical format; no new codes are stored.
 */
export function businessReferralCode(publicId: string): string | null {
  if (!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(publicId)) return null;
  return `XMK-${publicId.replace(/-/g, "").toUpperCase()}`;
}

export function isValidBusinessReferralCode(value: string): boolean {
  return /^XMK-[A-F0-9]{32}$/i.test(value.trim());
}
