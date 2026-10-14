import assert from 'node:assert/strict';
import test from 'node:test';
import { businessCreateSchema, businessUpdateSchema } from './business.schemas.js';

test('business create requires a category and a complete location', () => {
  const result = businessCreateSchema.safeParse({ name: 'Tienda Demo', cityName: 'Palmira', address: 'Calle 1', categoryCode: 'tiendas' });
  assert.equal(result.success, true);
  assert.equal(businessCreateSchema.safeParse({ name: 'Tienda Demo', cityName: 'Palmira', address: 'Calle 1' }).success, false);
});

test('business update accepts partial fields without trusting owner identifiers', () => {
  const result = businessUpdateSchema.safeParse({ name: 'Nombre actualizado' });
  assert.equal(result.success, true);
  if (result.success) assert.equal('ownerId' in result.data, false);
});

test('business create accepts one or several commercial modalities', () => {
  const base = { name: 'Tienda Demo', cityName: 'Palmira', address: 'Calle 1', categoryCode: 'tiendas' };
  assert.deepEqual(businessCreateSchema.parse({ ...base, instagram: '@tienda', modalityTypes: ['VIRTUAL'] }).modalityTypes, ['VIRTUAL']);
  assert.deepEqual(businessCreateSchema.parse({ ...base, locationVisibility: 'PUBLIC', whatsapp: '+57 3001234567', modalityTypes: ['PHYSICAL', 'DELIVERY'] }).modalityTypes, ['PHYSICAL', 'DELIVERY']);
  assert.equal(businessCreateSchema.safeParse({ ...base, modalityTypes: [] }).success, false);
  assert.equal(businessCreateSchema.safeParse({ ...base, modalityTypes: ['UNKNOWN'] }).success, false);
  const configuration = { type: 'PHYSICAL', contact: { phone: '+57 3001234567' }, hours: [{ dayOfWeek: 1, isClosed: false, opensAt: '08:00', closesAt: '18:00', timezone: 'America/Bogota' }] };
  assert.equal(businessCreateSchema.safeParse({ ...base, locationVisibility: 'PUBLIC', modalityTypes: ['PHYSICAL'], modalityConfigurations: [configuration] }).success, true);
  assert.equal(businessCreateSchema.safeParse({ ...base, modalityTypes: ['PHYSICAL', 'VIRTUAL'], modalityConfigurations: [configuration, configuration] }).success, false);
});

test('aplica requisitos de ubicación por modalidad y permite horarios vacíos', () => {
  const base = { name: 'Tienda Demo', categoryCode: 'tiendas' };
  assert.equal(businessCreateSchema.safeParse({ ...base, instagram: '@tienda', modalityTypes: ['VIRTUAL'] }).success, false);
  assert.equal(businessCreateSchema.safeParse({ ...base, cityName: 'Palmira', instagram: '@tienda', modalityTypes: ['VIRTUAL'] }).success, true);
  assert.equal(businessCreateSchema.safeParse({ ...base, modalityTypes: ['PHYSICAL'] }).success, false);
  assert.equal(businessCreateSchema.safeParse({ ...base, modalityTypes: ['DELIVERY'] }).success, false);
  assert.equal(businessCreateSchema.safeParse({ ...base, cityName: 'Palmira', whatsapp: '+57 3001234567', modalityTypes: ['DELIVERY'] }).success, true);
  assert.equal(businessCreateSchema.safeParse({ ...base, instagram: '@tienda', modalityTypes: ['VIRTUAL', 'DELIVERY'] }).success, false);
  assert.equal(businessCreateSchema.safeParse({ ...base, cityName: 'Palmira', instagram: '@tienda', modalityTypes: ['VIRTUAL', 'DELIVERY'] }).success, true);
  assert.equal(businessCreateSchema.safeParse({ ...base, cityName: 'Palmira', whatsapp: '+57 3001234567', modalityTypes: ['DELIVERY'], modalityConfigurations: [{ type: 'DELIVERY', contact: { whatsapp: '   ' } }] }).success, true);
  assert.equal(businessCreateSchema.safeParse({ ...base, cityName: 'Palmira', modalityTypes: ['DELIVERY'], modalityConfigurations: [{ type: 'DELIVERY', contact: { whatsapp: '+57 3001234567' } }] }).success, false);
  assert.equal(businessCreateSchema.safeParse({ ...base, cityName: 'Palmira', address: 'Calle 1', locationVisibility: 'PUBLIC', modalityTypes: ['PHYSICAL'], modalityConfigurations: [{ type: 'PHYSICAL', hours: [] }] }).success, true);
});


test('business categories support optional unique secondary codes', () => {
  const base = { name: 'Tienda Demo', cityName: 'Palmira', address: 'Calle 1', categoryCode: 'restaurantes' };
  assert.equal(businessCreateSchema.safeParse({ ...base, secondaryCategoryCodes: ['cafeterias', 'panaderias-y-reposterias'] }).success, true);
  assert.equal(businessCreateSchema.safeParse({ ...base, secondaryCategoryCodes: ['cafeterias', 'cafeterias'] }).success, false);
  assert.equal(businessCreateSchema.safeParse({ ...base, secondaryCategoryCodes: ['restaurantes'] }).success, false);
  assert.equal(businessUpdateSchema.safeParse({ secondaryCategoryCodes: ['cafeterias'] }).success, true);
});


test('business location accepts optional additional address information up to 200 characters', () => {
  const base = { name: 'Tienda Demo', cityName: 'Palmira', address: 'Calle 1', categoryCode: 'tiendas' };
  assert.equal(businessCreateSchema.safeParse({ ...base, additionalAddressInfo: 'Centro Comercial La Nube, local 204' }).success, true);
  assert.equal(businessCreateSchema.safeParse({ ...base, additionalAddressInfo: '' }).success, true);
  assert.equal(businessCreateSchema.safeParse({ ...base, additionalAddressInfo: 'a'.repeat(200) }).success, true);
  assert.equal(businessCreateSchema.safeParse({ ...base, additionalAddressInfo: 'a'.repeat(201) }).success, false);
  assert.equal(businessUpdateSchema.safeParse({ additionalAddressInfo: null }).success, true);
});
