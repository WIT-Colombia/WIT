import assert from 'node:assert/strict';
import test from 'node:test';
import { deleteAdminBusiness } from './admin-businesses.service.js';

test('la eliminación administrativa del negocio requiere un motivo suficiente', async () => {
  await assert.rejects(
    () => deleteAdminBusiness('negocio', 'admin', 'demasiado corto'),
    (error: any) => {
      assert.equal(error.code, 'ADMIN_BUSINESS_REASON_REQUIRED');
      assert.equal(error.statusCode, 400);
      return true;
    },
  );
});

test('la eliminación administrativa del negocio rechaza motivos excesivamente largos', async () => {
  await assert.rejects(
    () => deleteAdminBusiness('negocio', 'admin', 'a'.repeat(501)),
    (error: any) => {
      assert.equal(error.code, 'ADMIN_BUSINESS_REASON_REQUIRED');
      return true;
    },
  );
});
