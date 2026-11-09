/**
 * Single source of truth for the validity of XAMUKO verification and
 * password-reset links. Both email bodies and auth token issuance must use it.
 */
export const EMAIL_ACTION_LINK_TTL_MINUTES = 15;
export const EMAIL_ACTION_LINK_TTL_MS = EMAIL_ACTION_LINK_TTL_MINUTES * 60 * 1000;

export function emailActionLinkExpiresAt(issuedAt: Date): Date {
  return new Date(issuedAt.getTime() + EMAIL_ACTION_LINK_TTL_MS);
}
