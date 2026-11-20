/**
 * Visual-only Plus walkthrough, never a paid subscription or an API entitlement.
 * The frontend match is a convenience gate; production Plus operations remain
 * exclusively authorized by the backend.
 */
export function canUsePlusVisualPreview(user: {
  emailNormalized: string | null; emailVerified: boolean; status: string;
} | null | undefined): boolean {
  return user?.emailVerified === true && user?.status === 'ACTIVE'
    && user.emailNormalized?.trim().toLowerCase() === 'administradoreswit@gmail.com';
}
