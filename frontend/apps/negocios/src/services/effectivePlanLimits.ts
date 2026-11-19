import type { CatalogLimits, PromotionLimits } from './businessApiClient';
import { recognitionLevels } from '../config/businessRecognition';

/** A disabled master switch never leaves a stale PRO quota visible in Business.
 * The backend still enforces these limits authoritatively on every write.
 */
export function effectiveCatalogLimits(limits: CatalogLimits | null, businessProEnabled: boolean): CatalogLimits | null {
  if (!limits || limits.plan !== 'PRO' || businessProEnabled) return limits;
  const level = recognitionLevels.find(item => item.level === limits.level);
  if (!level) return null; // Do not invent an entitlement if recognition data is unknown.
  const products = { used: limits.products.used, limit: level.productLimit,
    available: Math.max(0, level.productLimit - limits.products.used), unlimited: false };
  const services = { used: limits.services.used, limit: level.serviceLimit,
    available: Math.max(0, level.serviceLimit - limits.services.used), unlimited: false };
  return { ...limits, plan: 'BASIC', products, services };
}

/** Business Basic retains its single active promotion; historical rows are not deleted. */
export function effectivePromotionLimits(limits: PromotionLimits | null, businessProEnabled: boolean): PromotionLimits | null {
  if (!limits || limits.plan !== 'PRO' || businessProEnabled) return limits;
  return { ...limits, plan: 'BASIC', maxActive: 1, maxPhotos: 1,
    canSchedule: false, canRecur: false, detailedAnalytics: false };
}
