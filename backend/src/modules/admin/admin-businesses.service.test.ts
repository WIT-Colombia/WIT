import assert from 'node:assert/strict';
import test from 'node:test';
import { deleteAdminBusiness, validateAdminVisibilityAction, adminBusinessWhere, restoredAdminBusinessVisibility } from './admin-businesses.service.js';

test('la eliminación administrativa del negocio requiere un motivo suficiente', async () => {
  await assert.rejects(
    () => deleteAdminBusiness('negocio', 'admin', 'corto'),
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

test('las medidas de visibilidad administrativa requieren motivo suficiente', () => {
  assert.equal(validateAdminVisibilityAction('HIDE', 'Incumplimiento de los requisitos'), 'HIDE');
  assert.equal(validateAdminVisibilityAction('SUSPEND', 'Conducta pendiente de revisión'), 'SUSPEND');
  assert.equal(validateAdminVisibilityAction('RESTORE', 'Se subsanó el problema comunicado'), 'RESTORE');
  assert.throws(() => validateAdminVisibilityAction('HIDE', 'corto'), (error: any) => error.code === 'ADMIN_BUSINESS_REASON_REQUIRED');
  assert.throws(() => validateAdminVisibilityAction('PURGE', 'Una explicación suficiente'), (error: any) => error.code === 'ADMIN_VISIBILITY_ACTION_INVALID');
});

test('el filtro por bloqueo no se confunde con el ocultamiento voluntario', () => {
  const adminRestricted = adminBusinessWhere({ visibility: 'ADMIN_HIDDEN' });
  assert.deepEqual(adminRestricted.administrativeRestriction, { not: null });
  const ownerHidden = adminBusinessWhere({ visibility: 'HIDDEN', restriction: 'NONE' });
  assert.equal(ownerHidden.visibilityStatus, 'HIDDEN');
  assert.equal(ownerHidden.administrativeRestriction, null);
});

test('la restitución conserva el ocultamiento voluntario y nunca crea días de visibilidad', () => {
  const now = new Date('2026-11-16T10:00:00.000Z');
  const period = { startsAt: new Date('2026-10-01T10:00:00.000Z'), expiresAt: new Date('2026-11-10T10:00:00.000Z') };
  assert.equal(restoredAdminBusinessVisibility('HIDDEN', period, now), 'HIDDEN');
  assert.equal(restoredAdminBusinessVisibility('REVIEW', period, now), 'REVIEW');
  assert.equal(restoredAdminBusinessVisibility('VISIBLE', period, now), 'EXPIRED');
  assert.equal(restoredAdminBusinessVisibility('VISIBLE', { ...period, expiresAt: new Date('2026-12-01T10:00:00.000Z') }, now), 'VISIBLE');
});
