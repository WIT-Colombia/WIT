import { describe, expect, it } from 'vitest';
import { getUserManagementAction } from '../utils/adminUserManagement';

describe('Acciones seguras de gestión de usuarios', () => {
  it('no permite suspender la cuenta de un administrador ni la cuenta propia', () => {
    expect(getUserManagementAction({ id: 'self', status: 'ACTIVE', isAdmin: false }, true, 'self')).toBeNull();
    expect(getUserManagementAction({ id: 'admin', status: 'ACTIVE', isAdmin: true }, true, 'self')).toBeNull();
  });
  it('solo ofrece suspender o reactivar para cuentas elegibles', () => {
    expect(getUserManagementAction({ id: 'u1', status: 'ACTIVE', isAdmin: false }, true, 'self')).toBe('SUSPEND');
    expect(getUserManagementAction({ id: 'u1', status: 'SUSPENDED', isAdmin: false }, true, 'self')).toBe('RESTORE');
    expect(getUserManagementAction({ id: 'u1', status: 'DELETED', isAdmin: false }, true, 'self')).toBeNull();
    expect(getUserManagementAction({ id: 'u1', status: 'ACTIVE', isAdmin: false }, false, 'self')).toBeNull();
  });
});
