/** Política única de publicación de establecimientos en WIT. */
export const BUSINESS_VISIBILITY_DAYS = 40;
export const BUSINESS_RECOVERY_DAYS = 30;
export const DAY_IN_MS = 24 * 60 * 60 * 1000;

export function addBusinessVisibilityPeriod(from = new Date()): Date {
  return new Date(from.getTime() + BUSINESS_VISIBILITY_DAYS * DAY_IN_MS);
}

export function addBusinessRecoveryPeriod(from = new Date()): Date {
  return new Date(from.getTime() + BUSINESS_RECOVERY_DAYS * DAY_IN_MS);
}
