import assert from 'node:assert/strict';
import test from 'node:test';
import { canCreatePromotion, canManagePromotion, promotionEntitlements, promotionState, promotionValidationError } from './promotion-policy.js';

test('Básico permite una publicación y Pro diez, con fotos y funciones según plan', () => {
  assert.deepEqual(promotionEntitlements('BASIC'), { maxActive: 1, maxPhotos: 1, canSchedule: false, canRecur: false, detailedAnalytics: false });
  assert.deepEqual(promotionEntitlements('PRO'), { maxActive: 10, maxPhotos: 4, canSchedule: true, canRecur: true, detailedAnalytics: true });
  assert.equal(canCreatePromotion('BASIC', 0), true);
  assert.equal(canCreatePromotion('BASIC', 1), false);
  assert.equal(canCreatePromotion('PRO', 9), true);
  assert.equal(canCreatePromotion('PRO', 10), false);
});

test('solo propietarios o colaboradores con permiso de promociones pueden administrar publicaciones', () => {
  assert.equal(canManagePromotion('OWNER', []), true);
  assert.equal(canManagePromotion('COLLABORATOR', [{ permission: 'MANAGE_PROMOTIONS', allowed: true }]), true);
  assert.equal(canManagePromotion('COLLABORATOR', [{ permission: 'MANAGE_PROMOTIONS', allowed: false }]), false);
  assert.equal(canManagePromotion('COLLABORATOR', [{ permission: 'MANAGE_CATALOG', allowed: true }]), false);
  assert.equal(canManagePromotion('COLLABORATOR', [{ permission: 'EDIT_BUSINESS', allowed: true }]), false);
});

test('valida precios, fechas y funciones Pro en el servidor', () => {
  const now = new Date('2026-10-21T12:00:00.000Z');
  const base = { type: 'OFFER' as const, originalPrice: 20000, promotionalPrice: 15000, startsAt: now, endsAt: new Date('2026-10-28T12:00:00.000Z'), recurrence: 'NONE' as const };
  assert.equal(promotionValidationError({ ...base, promotionalPrice: 20000 }, 'BASIC', now), 'PROMOTION_DISCOUNT_INVALID');
  assert.equal(promotionValidationError({ ...base, endsAt: now }, 'BASIC', now), 'PROMOTION_DATE_RANGE_INVALID');
  assert.equal(promotionValidationError({ ...base, startsAt: new Date(now.getTime() + 3_600_000) }, 'BASIC', now), 'PROMOTION_SCHEDULING_PRO_ONLY');
  assert.equal(promotionValidationError({ ...base, recurrence: 'DAILY', recurrenceUntil: new Date('2026-11-01T12:00:00.000Z') }, 'BASIC', now), 'PROMOTION_RECURRENCE_PRO_ONLY');
  assert.equal(promotionValidationError({ ...base, recurrence: 'DAILY', recurrenceUntil: new Date('2026-11-01T12:00:00.000Z') }, 'PRO', now), null);
});

test('el estado sencillo sigue las fechas y la finalización manual', () => {
  const startsAt = new Date('2026-01-01T10:00:00Z');
  const endsAt = new Date('2026-01-01T12:00:00Z');
  assert.equal(promotionState({ active: true, startsAt, endsAt, recurrence: 'NONE' }, new Date('2026-01-01T09:00:00Z')), 'SCHEDULED');
  assert.equal(promotionState({ active: true, startsAt, endsAt, recurrence: 'NONE' }, new Date('2026-01-01T11:00:00Z')), 'ACTIVE');
  assert.equal(promotionState({ active: true, startsAt, endsAt, recurrence: 'NONE' }, new Date('2026-01-01T13:00:00Z')), 'FINISHED');
  assert.equal(promotionState({ active: false, startsAt, endsAt, recurrence: 'NONE' }, new Date('2026-01-01T11:00:00Z')), 'FINISHED');
});

test('una recurrencia queda activa en sus ventanas y programada entre ellas', () => {
  const startsAt = new Date('2026-01-01T10:00:00Z');
  const endsAt = new Date('2026-01-01T11:00:00Z');
  const input = { active: true, startsAt, endsAt, recurrence: 'DAILY' as const, recurrenceUntil: new Date('2026-01-04T12:00:00Z') };
  assert.equal(promotionState(input, new Date('2026-01-02T10:30:00Z')), 'ACTIVE');
  assert.equal(promotionState(input, new Date('2026-01-02T12:00:00Z')), 'SCHEDULED');
  assert.equal(promotionState(input, new Date('2026-01-05T12:00:00Z')), 'FINISHED');
});
