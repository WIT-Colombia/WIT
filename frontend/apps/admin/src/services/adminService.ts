import { dashboardMock, searchEntities } from '../data/mockData';
import { adminLogin, adminLogout, adminRefresh, type RealAdmin } from './adminApiClient';
import type { Admin, Period, Permission, Role } from '../types/admin';
export const API_BASE = '/api/v1';
const grants: Partial<Record<Role, Permission[]>> = { principal: ['dashboard:read', 'verification:write', 'content:moderate', 'settings:write', 'business:write'], verification: ['dashboard:read', 'verification:write'], moderator: ['dashboard:read', 'content:moderate'], support: ['dashboard:read'], analyst: ['dashboard:read'] };
export const can = (admin: Admin, permission: Permission) => admin.permissions ? admin.permissions.includes(permission) : (grants[admin.role] ?? []).includes(permission);
let currentSession: Admin | null = null;
function mapAdmin(value: RealAdmin): Admin { const permissionMap = { BUSINESSES_READ: 'business:write', CATALOG_READ: 'dashboard:read', REPORTS_REVIEW: 'content:moderate', CONTENT_MODERATE: 'content:moderate', AUDIT_READ: 'dashboard:read', ADMINS_MANAGE: 'settings:write' } as const; return { id: value.user.id, name: value.user.displayName, email: value.user.emailNormalized ?? '', role: value.role, realRole: value.role, permissions: value.permissions.map(permission => permissionMap[permission]) }; }
export const getSession = (): Admin | null => currentSession;
export const restoreSession = async (): Promise<Admin | null> => { try { currentSession = mapAdmin(await adminRefresh()); return currentSession; } catch { currentSession = null; return null; } };
export const login = async (email: string, password: string, remember: boolean) => { if (!email.trim() || password.length < 8) throw new Error('Escribe un correo válido y una contraseña de al menos 8 caracteres.'); currentSession = mapAdmin(await adminLogin(email, password, remember)); return currentSession; };
export const logout = async () => { await adminLogout(); currentSession = null; };
export const getDashboard = async (period: Period) => { await new Promise(resolve => setTimeout(resolve, 350)); return dashboardMock(period); };
export const searchGlobal = (query: string) => searchEntities.filter(item => item.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
