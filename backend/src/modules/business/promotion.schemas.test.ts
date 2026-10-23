import assert from 'node:assert/strict';
import test from 'node:test';
import { promotionCreateSchema, promotionUpdateSchema } from './promotion.schemas.js';

const validOffer = {
  type: 'OFFER', title: 'Oferta de prueba', description: 'Descuento por tiempo limitado',
  originalPrice: 20000, promotionalPrice: 15000,
  startsAt: '2026-10-20T10:00:00.000Z', endsAt: '2026-10-27T10:00:00.000Z', recurrence: 'NONE',
};

test('acepta una oferta válida y una promoción sin precios', () => {
  assert.equal(promotionCreateSchema.safeParse(validOffer).success, true);
  assert.equal(promotionCreateSchema.safeParse({ ...validOffer, type: 'PROMOTION', originalPrice: null, promotionalPrice: null }).success, true);
});

test('rechaza campos desconocidos, título vacío y fechas mal formadas', () => {
  assert.equal(promotionCreateSchema.safeParse({ ...validOffer, surprise: true }).success, false);
  assert.equal(promotionCreateSchema.safeParse({ ...validOffer, title: '  ' }).success, false);
  assert.equal(promotionCreateSchema.safeParse({ ...validOffer, endsAt: 'fecha inválida' }).success, false);
});

test('permite actualizar parcialmente sin permitir sobrescribir la clave idempotente', () => {
  assert.equal(promotionUpdateSchema.safeParse({ title: 'Título editado' }).success, true);
  assert.equal(promotionUpdateSchema.safeParse({ idempotencyKey: 'b6e1023b-07f5-41bb-bc5e-1cd40e49b16b' }).success, false);
});
