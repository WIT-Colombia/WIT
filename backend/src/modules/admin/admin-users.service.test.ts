import assert from 'node:assert/strict';
import test from 'node:test';
import { deactivateAdminUser, deletionBlockers, validateAdminUserStatusAction, adminUsersWhere, getUserAnalyticsPeriod, setAdminUserStatus, validateAdminUserSessionReason, revokeAdminUserSessions } from './admin-users.service.js';

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

test('suspender/reactivar exige justificación y acciones válidas', async () => {
  assert.equal(validateAdminUserStatusAction('SUSPEND', 'Se requiere una revisión adicional'), 'SUSPEND');
  assert.equal(validateAdminUserStatusAction('RESTORE', 'Se comprobó el levantamiento de la medida'), 'RESTORE');
  assert.throws(() => validateAdminUserStatusAction('SUSPEND', 'corto'), (error: any) => error.code === 'ADMIN_USER_REASON_REQUIRED');
  assert.throws(() => validateAdminUserStatusAction('DELETE', 'Explicación administrativa suficiente'), (error: any) => error.code === 'ADMIN_USER_ACTION_INVALID');
  await assert.rejects(() => setAdminUserStatus('admin', 'admin', 'SUSPEND', 'Motivo suficientemente detallado'), (error: any) => error.code === 'ADMIN_USER_SELF_MODIFICATION');
});

test('filtros combinados son seguros y diferencian acceso, proveedor y verificación', () => {
  const where = adminUsersWhere({ status: 'ACTIVE', activity: 'never', provider: 'GOOGLE', admin: 'no', registeredFrom: '2026-01-01' });
  assert.equal(where.status, 'ACTIVE');
  assert.deepEqual(where.AND, [{ authIdentities: { some: { provider: 'GOOGLE' } } }, { lastLoginAt: null }]);
  assert.deepEqual(where.adminRoleAssignments, { none: { active: true } });
  assert.ok(where.createdAt);
  assert.throws(() => adminUsersWhere({ registeredFrom: '2026-11-19', registeredTo: '2026-11-10' }), (error: any) => error.code === 'ADMIN_USER_DATE_RANGE_INVALID');
  assert.throws(() => adminUsersWhere({ registeredFrom: '2026-02-30' }), (error: any) => error.code === 'ADMIN_USER_DATE_INVALID');
});

test('la temporalidad admite histórico sin perder ceros ni granularidad mensual', () => {
  assert.equal(getUserAnalyticsPeriod('6m'), '6m');
  assert.equal(getUserAnalyticsPeriod('24m'), '24m');
  assert.equal(getUserAnalyticsPeriod('all'), 'all');
  assert.equal(getUserAnalyticsPeriod('unknown'), '12m');
});

test('proveedor y verificación se combinan sin sobrescribirse', () => {
  const where = adminUsersWhere({ provider: 'GOOGLE', emailVerified: 'yes', activity: 'recent30', lastLoginFrom: '2026-01-01' });
  assert.equal(Array.isArray(where.AND), true);
  assert.equal((where.AND as any[]).length, 4);
});

test('cerrar sesiones exige motivo, no cambia estado ni admite auto-revocación', async () => {
  assert.equal(validateAdminUserSessionReason('Revisión de seguridad solicitada'), 'Revisión de seguridad solicitada');
  assert.throws(() => validateAdminUserSessionReason('corto'), (error: any) => error.code === 'ADMIN_USER_REASON_REQUIRED');
  await assert.rejects(() => revokeAdminUserSessions('admin', 'admin', 'Revisión de seguridad solicitada'), (error: any) => error.code === 'ADMIN_USER_SELF_MODIFICATION');
});


test('el directorio filtra por ciudad preferida sin mezclar estados y relaciones', () => {
  const where = adminUsersWhere({ city: 'Cali', status: 'ACTIVE', relation: 'OWNER' });
  assert.equal(where.preferredLocationCity, 'Cali');
  assert.equal(where.status, 'ACTIVE');
  assert.ok(where.memberships);
  assert.equal(adminUsersWhere({ city: '  Palmira  ' }).preferredLocationCity, 'Palmira');
  assert.equal(adminUsersWhere({ city: '' }).preferredLocationCity, undefined);
  assert.throws(() => adminUsersWhere({ city: 'X'.repeat(161) }),
    (error: any) => error.code === 'ADMIN_USER_CITY_INVALID');
});
