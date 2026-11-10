import { adminSessionLogout, adminLogin, adminMe, getAdminSession, beginAdminWebAuthn, AdminApiError, type RealAdmin } from './adminApiClient';
import { buildApiUrl } from '@wit/utils';
export const startGoogleLogin = () => { window.location.assign(`${buildApiUrl('/auth/google/start')}?application=admin&next=%2Fdashboard`); };
import type { Admin, Permission, Role } from '../types/admin';
export const API_BASE = '/api/v1';
const grants: Partial<Record<Role, Permission[]>> = { principal: ['dashboard:read', 'verification:write', 'content:moderate', 'settings:write', 'business:write'], verification: ['dashboard:read', 'verification:write'], moderator: ['dashboard:read', 'content:moderate'], support: ['dashboard:read'], analyst: ['dashboard:read'] };
export const can = (admin: Admin, permission: Permission) => admin.permissions ? admin.permissions.includes(permission) : (grants[admin.role] ?? []).includes(permission);
let currentSession: Admin | null = null;
function mapAdmin(value: RealAdmin): Admin { const permissionMap = { BUSINESSES_READ: 'business:write', CATALOG_READ: 'dashboard:read', REPORTS_REVIEW: 'content:moderate', CONTENT_MODERATE: 'content:moderate', AUDIT_READ: 'dashboard:read', ADMINS_MANAGE: 'settings:write', PIONEER_MANAGE: 'PIONEER_MANAGE', FINANCE_READ: 'finance:read', FINANCE_MANAGE: 'finance:manage' } as const; return { id: value.user.id, name: value.user.displayName, avatarUrl: value.user.avatarUrl, email: value.user.emailNormalized ?? '', role: value.role, realRole: value.role, permissions: value.permissions.map(permission => permissionMap[permission]) }; }
export const getSession = (): Admin | null => currentSession;
export const authenticateWithPassword = async (email: string, password: string, rememberMe = false) => { currentSession = mapAdmin(await adminLogin(email, password, rememberMe)); return currentSession; };
export const restoreSession = async (): Promise<Admin | null> => { try { await getAdminSession(); currentSession = mapAdmin(await adminMe()); return currentSession; } catch (error) { if (error instanceof AdminApiError && (error.status === 401 || error.status === 403)) { currentSession = null; return null; } throw error; } };

export const authenticateWithPasskey = async () => { const verification = await beginAdminWebAuthn(); if (!verification.verified || !verification.adminSession) throw new Error('La verificación de passkey no pudo crear una sesión administrativa.'); currentSession = mapAdmin(await adminMe()); return currentSession; };
export const logout = async () => { await adminSessionLogout(); currentSession = null; };
