import test from 'node:test';
import assert from 'node:assert/strict';
import { contactSchema, hoursSchema, modalityDayOfWeek, modalityHourSchema } from './modality.schemas.js';

test('valida contactos y rechaza correo inválido', () => {
  assert.equal(contactSchema.safeParse({ email: 'business@example.com' }).success, true);
  assert.equal(contactSchema.safeParse({ email: 'not-an-email' }).success, false);
  assert.equal(contactSchema.safeParse({ phone: '1'.repeat(32), whatsapp: '1'.repeat(32) }).success, true);
  assert.equal(contactSchema.safeParse({ phone: '1'.repeat(33) }).success, false);
  assert.equal(contactSchema.safeParse({ whatsapp: '1'.repeat(33) }).success, false);
});
test('valida horarios HH:mm y coherencia', () => {
  assert.equal(modalityHourSchema.safeParse({ dayOfWeek: 1, isClosed: false, opensAt: '08:00', closesAt: '17:00' }).success, true);
  assert.equal(modalityHourSchema.safeParse({ dayOfWeek: 1, isClosed: false, opensAt: '17:00', closesAt: '08:00' }).success, false);
  assert.equal(modalityHourSchema.safeParse({ dayOfWeek: 1, isClosed: true, opensAt: null, closesAt: null }).success, true);
});
test('rechaza días duplicados y más de siete entradas', () => {
  assert.equal(hoursSchema.safeParse({ hours: [{ dayOfWeek: 1 }, { dayOfWeek: 1 }] }).success, false);
  assert.equal(hoursSchema.safeParse({ hours: Array.from({ length: 8 }, (_, dayOfWeek) => ({ dayOfWeek })) }).success, false);
});
test('usa la misma convención 0-6 que Date#getDay', () => {
  assert.deepEqual(modalityDayOfWeek, { SUNDAY: 0, MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4, FRIDAY: 5, SATURDAY: 6 });
});
