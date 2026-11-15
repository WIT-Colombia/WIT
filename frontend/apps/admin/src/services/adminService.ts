import { adminSessionLogout, adminLogin, adminMe, getAdminSession, beginAdminWebAuthn, AdminApiError, type RealAdmin } from './adminApiClient';
import { buildApiUrl } from '@wit/utils';
export const startGoogleLogin = () => { window.location.assign(`${buildApiUrl('/auth/google/start')}?application=admin&next=%2Fdashboard`); };
import type { Admin, Permission, Role } from '../types/admin';
export const API_BASE = '/api/v1';
const grants: Partial<Record<Role, Permission[]>> = { principal: ['dashboard:read', 'verification:write', 'content:moderate', 'settings:write', 'business:write'], verification: ['dashboard:read', 'verification:write'], moderator: ['dashboard:read', 'content:moderate'], support: ['dashboard:read'], analyst: ['dashboard:read'] };
export const can = (admin: Admin, permission: Permission) => admin.permissions ? admin.permissions.includes(permission) : (grants[admin.role] ?? []).includes(permission);
let currentSession: Admin | null = null;
// Prevent an older session refresh from restoring Admin after logout.
let sessionEpoch = 0;
function mapAdmin(value: RealAdmin): Admin { const permissionMap = { BUSINESSES_READ: 'business:write', CATALOG_READ: 'dashboard:read', REPORTS_REVIEW: 'content:moderate', CONTENT_MODERATE: 'content:moderate', AUDIT_READ: 'dashboard:read', ADMINS_MANAGE: 'settings:write', PIONEER_MANAGE: 'PIONEER_MANAGE', FINANCE_READ: 'finance:read', FINANCE_MANAGE: 'finance:manage' } as const; return { id: value.user.id, name: value.user.displayName, avatarUrl: value.user.avatarUrl, email: value.user.emailNormalized ?? '', role: value.role, realRole: value.role, permissions: value.permissions.map(permission => permissionMap[permission]) }; }
export const getSession = (): Admin | null => currentSession;
export const authenticateWithPassword = async (email: string, password: string, rememberMe = false) => {
  const epoch = ++sessionEpoch;
  const result = mapAdmin(await adminLogin(email, password, rememberMe));
  if (epoch === sessionEpoch) currentSession = result;
  return currentSession;
};

export const restoreSession = async (): Promise<Admin | null> => {
  const epoch = sessionEpoch;
  try {
    await getAdminSession();
    const session = mapAdmin(await adminMe());
    if (epoch === sessionEpoch) currentSession = session;
    return currentSession;
  } catch (error) {
    // A previous refresh is not allowed to change the state after sign-out.
    if (epoch !== sessionEpoch) return currentSession;
    if (error instanceof AdminApiError && (error.status === 401 || error.status === 403)) {
      currentSession = null;
      return null;
    }
    throw error;
  }
};

export const authenticateWithPasskey = async () => {
  const epoch = ++sessionEpoch;
  const verification = await beginAdminWebAuthn();
  if (!verification.verified || !verification.adminSession)
    throw new Error('La verificación de passkey no pudo crear una sesión administrativa.');
  const result = mapAdmin(await adminMe());
  if (epoch === sessionEpoch) currentSession = result;
  return currentSession;
};

export const logout = async () => {
  // Mark the start before the network call; reject stale refresh results.
  ++sessionEpoch;
  await adminSessionLogout();
  // Do not announce a successful sign-out unless the API confirmed revocation.
  currentSession = null;
};
