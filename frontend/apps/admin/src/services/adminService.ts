import { dashboardMock, mockAdmin, searchEntities } from '../data/mockData';
import type { Admin, Period, Permission, Role } from '../types/admin';
export const API_BASE = '/api/v1'; // Future adapter; no network requests in this stage.
const grants: Record<Role, Permission[]> = { principal: ['dashboard:read', 'verification:write', 'content:moderate', 'settings:write', 'business:write'], verification: ['dashboard:read', 'verification:write'], moderator: ['dashboard:read', 'content:moderate'], support: ['dashboard:read'], analyst: ['dashboard:read'] };
export const can = (admin: Admin, permission: Permission) => grants[admin.role].includes(permission);
const key = 'wit-admin-demo-session';
export const getSession = (): Admin | null => { try { const raw = sessionStorage.getItem(key) || localStorage.getItem(key); if (!raw) return null; const value = JSON.parse(raw); return value.id === mockAdmin.id && value.role === 'principal' ? mockAdmin : null; } catch { return null; } };
export const login = async (email: string, password: string, remember: boolean) => { if (!email.trim() || password.length < 4) throw new Error('Escribe un correo válido y una contraseña de al menos 4 caracteres.'); await new Promise(resolve => setTimeout(resolve, 350)); sessionStorage.removeItem(key); localStorage.removeItem(key); (remember ? localStorage : sessionStorage).setItem(key, JSON.stringify(mockAdmin)); return mockAdmin; };
export const logout = () => { sessionStorage.removeItem(key); localStorage.removeItem(key); };
export const getDashboard = async (period: Period) => { await new Promise(resolve => setTimeout(resolve, 350)); return dashboardMock(period); };
export const searchGlobal = (query: string) => searchEntities.filter(item => item.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
