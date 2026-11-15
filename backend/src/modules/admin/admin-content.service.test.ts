import assert from 'node:assert/strict';
import test from 'node:test';
import { moderateAdminContent } from './admin-content.service.js';

test('la moderación administrativa rechaza acciones desconocidas sin tocar la base de datos', async () => {
  await assert.rejects(
    () => moderateAdminContent('ejemplo','admin','INVALID' as 'HIDE','Motivo con longitud suficiente'),
    (error: any) => {
      assert.equal(error.code,'ADMIN_CONTENT_ACTION_INVALID');
      assert.equal(error.statusCode,400);
      return true;
    },
  );
});
test('la moderación exige una justificación suficientemente específica', async () => {
  for(const action of ['HIDE','RESTORE'] as const){
    await assert.rejects(
      () => moderateAdminContent('ejemplo','admin',action,'Corto'),
      (error: any) => {
        assert.equal(error.code,'ADMIN_CONTENT_REASON_REQUIRED');
        assert.equal(error.statusCode,400);
        return true;
      },
    );
  }
});
