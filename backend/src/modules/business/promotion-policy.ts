export type PromotionPlan = 'BASIC' | 'PRO';
export type PromotionRecurrence = 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
export type PromotionState = 'SCHEDULED' | 'ACTIVE' | 'FINISHED';

export function canManagePromotion(role: string | undefined, permissions: Array<{ permission: string; allowed: boolean }>) {
  return role === 'OWNER' || permissions.some(item => item.permission === 'MANAGE_PROMOTIONS' && item.allowed);
}

export function promotionValidationError(input: { type: 'OFFER' | 'PROMOTION'; originalPrice: number | null; promotionalPrice: number | null; startsAt: Date; endsAt: Date; recurrence: PromotionRecurrence; recurrenceUntil?: Date | null }, plan: PromotionPlan, now = new Date()): string | null {
  if (input.endsAt <= input.startsAt) return 'PROMOTION_DATE_RANGE_INVALID';
  if (input.type === 'OFFER' && (input.originalPrice === null || input.promotionalPrice === null || input.promotionalPrice >= input.originalPrice)) return 'PROMOTION_DISCOUNT_INVALID';
  if (input.type === 'PROMOTION' && input.originalPrice !== null) return 'PROMOTION_ORIGINAL_PRICE_NOT_ALLOWED';
  if (plan === 'BASIC' && input.startsAt.getTime() > now.getTime() + 60_000) return 'PROMOTION_SCHEDULING_PRO_ONLY';
  if (plan === 'BASIC' && input.recurrence !== 'NONE') return 'PROMOTION_RECURRENCE_PRO_ONLY';
  if (input.recurrence === 'NONE' && input.recurrenceUntil) return 'PROMOTION_RECURRENCE_INVALID';
  if (input.recurrence !== 'NONE' && (!input.recurrenceUntil || input.recurrenceUntil <= input.endsAt)) return 'PROMOTION_RECURRENCE_INVALID';
  if (input.recurrenceUntil && input.recurrenceUntil.getTime() > now.getTime() + 5 * 366 * 86_400_000) return 'PROMOTION_RECURRENCE_TOO_LONG';
  return null;
}

export function promotionEntitlements(plan: PromotionPlan) {
  return { maxActive: plan === 'PRO' ? 10 : 1, maxPhotos: plan === 'PRO' ? 4 : 1, canSchedule: plan === 'PRO', canRecur: plan === 'PRO', detailedAnalytics: plan === 'PRO' };
}

function nextOccurrence(date: Date, recurrence: PromotionRecurrence) {
  const next = new Date(date);
  if (recurrence === 'DAILY') next.setDate(next.getDate() + 1);
  else if (recurrence === 'WEEKLY') next.setDate(next.getDate() + 7);
  else if (recurrence === 'MONTHLY') { const day = next.getDate(); next.setMonth(next.getMonth() + 1); if (next.getDate() < day) next.setDate(0); }
  return next;
}

export function promotionState(input: { active: boolean; startsAt: Date; endsAt: Date; recurrence: PromotionRecurrence; recurrenceUntil?: Date | null }, now = new Date()): PromotionState {
  if (!input.active || input.endsAt <= input.startsAt) return 'FINISHED';
  if (input.recurrence === 'NONE' || !input.recurrenceUntil) {
    if (now < input.startsAt) return 'SCHEDULED';
    return now <= input.endsAt ? 'ACTIVE' : 'FINISHED';
  }
  if (now < input.startsAt) return 'SCHEDULED';
  const duration = input.endsAt.getTime() - input.startsAt.getTime();
  let occurrence = new Date(input.startsAt);
  for (let index = 0; index < 5000 && occurrence <= input.recurrenceUntil; index += 1) {
    const occurrenceEnd = new Date(occurrence.getTime() + duration);
    if (now >= occurrence && now <= occurrenceEnd) return 'ACTIVE';
    const next = nextOccurrence(occurrence, input.recurrence);
    if (now < next) return 'SCHEDULED';
    occurrence = next;
  }
  return 'FINISHED';
}

export function canCreatePromotion(plan: PromotionPlan, activeCount: number) {
  return activeCount < promotionEntitlements(plan).maxActive;
}
