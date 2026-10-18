import assert from 'node:assert/strict';
import test from 'node:test';
import { getAdminContext } from './admin-auth.service.js';

function db(assignments: unknown[], grants: unknown[]) {
  return { adminRoleAssignment: { findMany: async () => assignments }, adminPermissionGrant: { findMany: async () => grants } } as any;
}

test('un usuario sin asignación administrativa no obtiene contexto', async () => {
  assert.equal(await getAdminContext('user-id', db([], [])), null);
});

test('ADMIN recibe únicamente permisos otorgados', async () => {
  const context = await getAdminContext('user-id', db([{ role: 'ADMIN', active: true }], [{ permission: 'CATALOG_READ' }]));
  assert.deepEqual(context, { userId: 'user-id', role: 'ADMIN', permissions: ['CATALOG_READ'] });
});

test('SUPER_ADMIN recibe el conjunto completo de permisos', async () => {
  const context = await getAdminContext('user-id', db([{ role: 'SUPER_ADMIN', active: true }], []));
  assert.equal(context?.role, 'SUPER_ADMIN');
  assert.equal(context?.permissions.includes('ADMINS_MANAGE'), true);
});
