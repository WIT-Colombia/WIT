import assert from 'node:assert/strict';
import test from 'node:test';
import { businessCreateSchema, businessUpdateSchema } from './business.schemas.js';
import { publicationRules } from './business.service.js';

test('business create requires a category and a complete location', () => {
  const result = businessCreateSchema.safeParse({ name: 'Tienda Demo', cityName: 'Palmira', address: 'Calle 1', categoryCode: 'tiendas' });
  assert.equal(result.success, true);
  assert.equal(businessCreateSchema.safeParse({ name: 'Tienda Demo', cityName: 'Palmira', address: 'Calle 1' }).success, false);
});

test('business update accepts partial fields without trusting owner identifiers', () => {
  const result = businessUpdateSchema.safeParse({ name: 'Nombre actualizado' });
  assert.equal(result.success, true);
  if (result.success) assert.equal('ownerId' in result.data, false);
  assert.equal(businessUpdateSchema.safeParse({ publicationStatus: 'PUBLISHED' }).success, false);
  assert.equal(businessCreateSchema.safeParse({ name: 'Tienda Demo', cityName: 'Palmira', address: 'Calle 1', categoryCode: 'tiendas', lifecycleStatus: 'ACTIVE' }).success, false);
});

test('business social links accept only their official platforms and normalize valid values', () => {
  const result = businessUpdateSchema.safeParse({ facebookUrl: 'facebook.com/xamuko', instagram: 'https://www.instagram.com/xamuko/', xUrl: 'x.com/xamuko', tiktokUrl: 'https://tiktok.com/@xamuko' });
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.facebookUrl, 'https://facebook.com/xamuko');
    assert.equal(result.data.instagram, 'https://www.instagram.com/xamuko');
    assert.equal(result.data.xUrl, 'https://x.com/xamuko');
    assert.equal(result.data.tiktokUrl, 'https://tiktok.com/@xamuko');
  }
  assert.equal(businessUpdateSchema.safeParse({ facebookUrl: 'https://instagram.com/xamuko' }).success, false);
  assert.equal(businessUpdateSchema.safeParse({ xUrl: 'https://example.com/xamuko' }).success, false);
  assert.equal(businessUpdateSchema.safeParse({ tiktokUrl: '<script>alert(1)</script>' }).success, false);
});

test('business create accepts one or several commercial modalities', () => {
  const base = { name: 'Tienda Demo', cityName: 'Palmira', address: 'Calle 1', categoryCode: 'tiendas' };
  assert.deepEqual(businessCreateSchema.parse({ ...base, instagram: 'https://instagram.com/tienda', modalityTypes: ['VIRTUAL'] }).modalityTypes, ['VIRTUAL']);
  assert.deepEqual(businessCreateSchema.parse({ ...base, locationVisibility: 'PUBLIC', whatsapp: '+57 3001234567', modalityTypes: ['PHYSICAL', 'DELIVERY'] }).modalityTypes, ['PHYSICAL', 'DELIVERY']);
  assert.equal(businessCreateSchema.safeParse({ ...base, modalityTypes: [] }).success, false);
  assert.equal(businessCreateSchema.safeParse({ ...base, modalityTypes: ['UNKNOWN'] }).success, false);
  const configuration = { type: 'PHYSICAL', contact: { phone: '+57 3001234567' }, hours: [{ dayOfWeek: 1, isClosed: false, opensAt: '08:00', closesAt: '18:00', timezone: 'America/Bogota' }] };
  assert.equal(businessCreateSchema.safeParse({ ...base, locationVisibility: 'PUBLIC', modalityTypes: ['PHYSICAL'], modalityConfigurations: [configuration] }).success, true);
  assert.equal(businessCreateSchema.safeParse({ ...base, modalityTypes: ['PHYSICAL', 'VIRTUAL'], modalityConfigurations: [configuration, configuration] }).success, false);
});

test('aplica requisitos de ubicación por modalidad y permite horarios vacíos', () => {
  const base = { name: 'Tienda Demo', categoryCode: 'tiendas' };
  assert.equal(businessCreateSchema.safeParse({ ...base, instagram: 'https://instagram.com/tienda', modalityTypes: ['VIRTUAL'] }).success, false);
  assert.equal(businessCreateSchema.safeParse({ ...base, cityName: 'Palmira', instagram: 'https://instagram.com/tienda', modalityTypes: ['VIRTUAL'] }).success, true);
  assert.equal(businessCreateSchema.safeParse({ ...base, modalityTypes: ['PHYSICAL'] }).success, false);
  assert.equal(businessCreateSchema.safeParse({ ...base, modalityTypes: ['DELIVERY'] }).success, false);
  assert.equal(businessCreateSchema.safeParse({ ...base, cityName: 'Palmira', whatsapp: '+57 3001234567', modalityTypes: ['DELIVERY'] }).success, true);
  assert.equal(businessCreateSchema.safeParse({ ...base, instagram: 'https://instagram.com/tienda', modalityTypes: ['VIRTUAL', 'DELIVERY'] }).success, false);
  assert.equal(businessCreateSchema.safeParse({ ...base, cityName: 'Palmira', instagram: 'https://instagram.com/tienda', modalityTypes: ['VIRTUAL', 'DELIVERY'] }).success, true);
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

test('la publicación automática conserva sus requisitos y no depende de indicadores de contacto antiguos', () => {
  const base = {
    name: 'Tienda Demo',
    category: { active: true },
    businessAccount: { status: 'ACTIVE' },
    lifecycleStatus: 'DRAFT',
    publicationStatus: 'UNPUBLISHED',
    visibilityStatus: 'REVIEW',
    deletionStatus: 'NONE',
    location: { cityName: 'Palmira', address: 'Calle 1', visibility: 'PUBLIC' },
    modalities: [{ type: 'PHYSICAL' }],
    website: 'https://tienda.example',
    instagram: null,
  };
  assert.equal(publicationRules.canPublishAutomatically(base), true);
  assert.deepEqual(publicationRules.publishedBusinessState, {
    lifecycleStatus: 'ACTIVE', publicationStatus: 'PUBLISHED', visibilityStatus: 'VISIBLE', deletionStatus: 'NONE',
  });

  const noPublicContact = { ...base, website: null, instagram: null, phone: '+57 3001234567', whatsapp: '+57 3001234567', email: 'private@example.test' };
  assert.equal(publicationRules.canPublishAutomatically(noPublicContact), true);
  assert.equal(publicationRules.hasPublicCommercialContact({ phone: '+57 3001234567', phonePublic: false }), true);
  assert.equal(publicationRules.hasPublicCommercialContact({ whatsapp: '+57 3001234567', whatsappPublic: false }), true);
  assert.equal(publicationRules.hasPublicCommercialContact({ email: 'commercial@example.test', emailPublic: false }), true);
  assert.equal(publicationRules.hasPublicCommercialContact({ createdBy: { email: 'owner@example.test' } }), false);
  assert.equal(publicationRules.canPublishAutomatically({ ...noPublicContact, whatsappPublic: true }), true);
  assert.equal(publicationRules.canPublishAutomatically({ ...noPublicContact, emailPublic: true }), true);
  assert.equal(publicationRules.canPublishAutomatically({ ...noPublicContact, phonePublic: true }), true);
  assert.equal(businessCreateSchema.parse({ name: 'Tienda Demo', categoryCode: 'tiendas', phone: '+57 3001234567' }).phonePublic, false);
});

test('los estados suspendidos, ocultos o eliminados no se reactivan mediante autopublicación', () => {
  const base = {
    name: 'Tienda Demo', category: { active: true }, businessAccount: { status: 'ACTIVE' }, lifecycleStatus: 'DRAFT', publicationStatus: 'UNPUBLISHED', visibilityStatus: 'REVIEW', deletionStatus: 'NONE',
    location: { cityName: 'Palmira', address: 'Calle 1', visibility: 'PUBLIC' }, modalities: [{ type: 'PHYSICAL' }], website: 'https://tienda.example', instagram: null,
  };
  assert.equal(publicationRules.canPublishAutomatically({ ...base, businessAccount: { status: 'SUSPENDED' } }), false);
  assert.equal(publicationRules.canPublishAutomatically({ ...base, visibilityStatus: 'HIDDEN' }), false);
  assert.equal(publicationRules.canPublishAutomatically({ ...base, deletionStatus: 'RECOVERY' }), false);
});
