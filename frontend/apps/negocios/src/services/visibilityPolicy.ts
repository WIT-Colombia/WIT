/** Política de publicación compartida por las pantallas de WIT Negocios. */
export const BUSINESS_VISIBILITY_DAYS = 40;
export const BUSINESS_INITIAL_VISIBILITY_DAYS = 100;
export const BUSINESS_RECOVERY_DAYS = 30;
export const DAY_IN_MS = 24 * 60 * 60 * 1000;

export function addBusinessInitialVisibilityPeriod(from = new Date()): Date {
  return new Date(from.getTime() + BUSINESS_INITIAL_VISIBILITY_DAYS * DAY_IN_MS);
}

export function addBusinessVisibilityPeriod(from = new Date()): Date {
  return new Date(from.getTime() + BUSINESS_VISIBILITY_DAYS * DAY_IN_MS);
}

export function addBusinessRecoveryPeriod(from = new Date()): Date {
  return new Date(from.getTime() + BUSINESS_RECOVERY_DAYS * DAY_IN_MS);
}
