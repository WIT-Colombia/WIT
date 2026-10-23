import assert from 'node:assert/strict';
import test from 'node:test';
import { canManageBusinessPhoto } from './photo-access.js';

const grant = (permission: string, allowed = true) => ({ permission, allowed });

test('el propietario puede administrar todas las fotografías', () => {
  assert.equal(canManageBusinessPhoto({ role: 'OWNER', permissions: [] }, 'EDIT_BUSINESS'), true);
  assert.equal(canManageBusinessPhoto({ role: 'OWNER', permissions: [] }, 'MANAGE_CATALOG'), true);
});

test('las fotografías del perfil y portada requieren EDIT_BUSINESS', () => {
  assert.equal(canManageBusinessPhoto({ role: 'COLLABORATOR', permissions: [grant('EDIT_BUSINESS')] }, 'EDIT_BUSINESS'), true);
  assert.equal(canManageBusinessPhoto({ role: 'COLLABORATOR', permissions: [grant('MANAGE_CATALOG')] }, 'EDIT_BUSINESS'), false);
  assert.equal(canManageBusinessPhoto({ role: 'COLLABORATOR', permissions: [grant('EDIT_BUSINESS', false)] }, 'EDIT_BUSINESS'), false);
});

test('las fotografías de productos y servicios requieren MANAGE_CATALOG', () => {
  assert.equal(canManageBusinessPhoto({ role: 'COLLABORATOR', permissions: [grant('MANAGE_CATALOG')] }, 'MANAGE_CATALOG'), true);
  assert.equal(canManageBusinessPhoto({ role: 'COLLABORATOR', permissions: [grant('EDIT_BUSINESS')] }, 'MANAGE_CATALOG'), false);
  assert.equal(canManageBusinessPhoto({ role: 'COLLABORATOR', permissions: [grant('MANAGE_PROMOTIONS')] }, 'MANAGE_CATALOG'), false);
});
