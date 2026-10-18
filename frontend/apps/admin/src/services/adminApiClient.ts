export type AdminPermission = 'BUSINESSES_READ' | 'CATALOG_READ' | 'REPORTS_REVIEW' | 'CONTENT_MODERATE' | 'AUDIT_READ' | 'ADMINS_MANAGE';
export type RealAdmin = { user: { id: string; publicId: string; displayName: string; emailNormalized: string | null; avatarUrl: string | null; locale: string }; role: 'ADMIN' | 'SUPER_ADMIN'; permissions: AdminPermission[] };
const API_BASE = '/api/v1';
let accessToken: string | null = null;
function headers(init: RequestInit = {}) { const value = new Headers(init.headers); value.set('Accept', 'application/json'); if (init.body && !value.has('Content-Type')) value.set('Content-Type', 'application/json'); if (accessToken) value.set('Authorization', `Bearer ${accessToken}`); return { ...init, headers: value, credentials: 'include' as RequestCredentials }; }
async function request<T>(path: string, init: RequestInit = {}) { const response = await fetch(`${API_BASE}${path}`, headers(init)); const payload = await response.json().catch(() => null) as { error?: { message?: string } } & T; if (!response.ok) throw new Error(payload?.error?.message ?? 'No se pudo completar la solicitud.'); return payload; }
export async function adminLogin(email: string, password: string, rememberMe: boolean) { const result = await request<{ user: RealAdmin['user']; accessToken: string }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password, rememberMe }) }); accessToken = result.accessToken; return adminMe(); }
export async function adminMe() { return (await request<{ admin: RealAdmin }>('/admin/me')).admin; }
export async function adminRefresh() { const result = await request<{ user: RealAdmin['user']; accessToken: string }>('/auth/refresh', { method: 'POST', body: JSON.stringify({ rememberMe: false }) }); accessToken = result.accessToken; return adminMe(); }
export async function adminLogout() { try { await request('/auth/logout', { method: 'POST', body: '{}' }); } finally { accessToken = null; } }
