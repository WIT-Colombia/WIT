import test from 'node:test';
import assert from 'node:assert/strict';
import { modalityRules } from './modality.service.js';

test('transiciones de modalidad', () => {
  assert.equal(modalityRules.transition('CONFIGURING', 'ACTIVE'), true);
  assert.equal(modalityRules.transition('ACTIVE', 'PAUSED'), true);
  assert.equal(modalityRules.transition('CONFIGURING', 'PAUSED'), false);
  assert.equal(modalityRules.transition('PAUSED', 'CONFIGURING'), true);
});
test('activación exige ubicación pública para modalidad física y cobertura para domicilio', () => {
  const base = { type: 'PHYSICAL', business: { location: null }, hours: [] };
  assert.equal(modalityRules.activationBlockers(base).length, 1);
  const ready = { type: 'PHYSICAL', business: { location: { visibility: 'PUBLIC', address: 'Calle 1' } }, hours: [], contact: null };
  assert.equal(modalityRules.activationBlockers(ready).length, 0);
  assert.equal(modalityRules.activationBlockers({ type: 'DELIVERY', business: { ...ready.business, whatsapp: '+57 3001234567', location: { ...ready.business.location, cityName: 'Palmira' } }, hours: ready.hours, contact: null }).length, 0);
});
test('Virtual se activa con WhatsApp y no exige cobertura, correo, teléfono ni horarios', () => {
  assert.equal(modalityRules.activationBlockers({ type: 'VIRTUAL', business: { location: null, whatsapp: '+57 3001234567' }, hours: [], contact: null }).length, 0);
  assert.equal(modalityRules.activationBlockers({ type: 'VIRTUAL', business: { location: null }, hours: [], contact: null }).length, 1);
});
test('la activación usa el contacto general cuando la modalidad no lo personaliza', () => {
  const ready = { type: 'PHYSICAL', business: { email: 'negocio@example.com', location: { visibility: 'PUBLIC', address: 'Calle 1' } }, hours: [{ isClosed: false, opensAt: '08:00', closesAt: '17:00' }], contact: null };
  assert.equal(modalityRules.activationBlockers(ready).length, 0);
});
test('evalúa todos los requisitos de las modalidades activas de forma independiente', () => {
  const prospectiveBusiness = { location: { cityName: 'Palmira' }, whatsapp: null, website: null, instagram: null, phone: null, email: null };
  const activeModalities = [{ type: 'VIRTUAL', business: prospectiveBusiness, contact: null }, { type: 'DELIVERY', business: prospectiveBusiness, contact: null }];
  const affected = activeModalities.filter(modality => modalityRules.activationBlockers(modality).length > 0).map(modality => modality.type);
  assert.deepEqual(affected, ['VIRTUAL', 'DELIVERY']);
});
test('ignora contactos vacíos y no usa contactos específicos para validar', () => {
  const business = { location: { cityName: 'Palmira' }, whatsapp: '   ', phone: null, email: null, website: null, instagram: null };
  assert.equal(modalityRules.activationBlockers({ type: 'DELIVERY', business, contact: { whatsapp: '   ' } }).length, 1);
  assert.equal(modalityRules.activationBlockers({ type: 'DELIVERY', business, contact: { whatsapp: '+57 3001234567' } }).length, 1);
});
