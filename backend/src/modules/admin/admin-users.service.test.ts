import assert from 'node:assert/strict';
import test from 'node:test';
import { deactivateAdminUser, deletionBlockers } from './admin-users.service.js';

test('la baja administrativa reconoce dependencias de propiedad y roles', () => {
  assert.deepEqual(deletionBlockers({ ownBusinesses: 0, createdBusinesses: 0, businessAccounts: 0, adminRoles: 0 }), []);
  const blockers = deletionBlockers({ ownBusinesses: 1, createdBusinesses: 1, businessAccounts: 1, adminRoles: 1 });
  assert.equal(blockers.length, 4);
  assert.match(blockers[0], /propietario/);
  assert.match(blockers[1], /creador/);
  assert.match(blockers[2], /cuentas de negocio/);
  assert.match(blockers[3], /rol administrativo/);
});

test('la baja rechaza motivos insuficientes sin acceder a MySQL', async () => {
  await assert.rejects(() => deactivateAdminUser('usuario', 'administrador', 'muy corto'), (error: any) => {
    assert.equal(error.code, 'ADMIN_USER_REASON_REQUIRED');
    assert.equal(error.statusCode, 400);
    return true;
  });
});

test('el administrador no puede eliminar su propia cuenta', async () => {
  await assert.rejects(() => deactivateAdminUser('admin-id', 'admin-id', 'Motivo suficientemente detallado'), (error: any) => {
    assert.equal(error.code, 'ADMIN_USER_SELF_DELETE');
    assert.equal(error.statusCode, 403);
    return true;
  });
});
