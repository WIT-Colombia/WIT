import { API_BASE_URL as API_BASE, buildApiUrl } from '@wit/utils';
export class AdminApiError extends Error { readonly status:number; readonly code:string; constructor(status:number,code:string,message:string){super(message);this.name='AdminApiError';this.status=status;this.code=code;} }
export type AdminPermission = 'BUSINESSES_READ' | 'CATALOG_READ' | 'REPORTS_REVIEW' | 'CONTENT_MODERATE' | 'AUDIT_READ' | 'ADMINS_MANAGE' | 'PIONEER_MANAGE' | 'FINANCE_READ' | 'FINANCE_MANAGE';
export type RealAdmin = { user: { id: string; publicId: string; displayName: string; emailNormalized: string | null; avatarUrl: string | null; locale: string }; role: 'ADMIN' | 'SUPER_ADMIN'; permissions: AdminPermission[] };
export type AdministratorRecord = { id: string; displayName: string; emailNormalized: string | null; status: string; adminRoleAssignments: { role: string; active: boolean }[]; adminPermissionGrants: { permission: string; granted: boolean }[] };
export async function listAdministrators() { return (await request<{ administrators: AdministratorRecord[] }>('/admin/administrators')).administrators; }
export type AdminBusinessRecord = { id: string; publicId: string; name: string; description: string | null; email: string | null; phone: string | null; lifecycleStatus: string; publicationStatus: string; visibilityStatus: string; verificationStatus: string; deletionStatus: string; completeness: number; createdAt: string; updatedAt: string; createdBy: { displayName: string; emailNormalized: string | null }; location: { cityName: string; countryCode: string; address: string } | null; category: { translations: { name: string }[] } };
export type AdminBusinessPage = { businesses: AdminBusinessRecord[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } };
export function listAdminBusinesses(q = '', page = 1, pageSize = 3, status = '') { const params = new URLSearchParams({ q, page: String(page), pageSize: String(pageSize) }); if (status) params.set('status', status); return request<AdminBusinessPage>(`/admin/businesses?${params.toString()}`); }
export async function getAdminBusiness(id: string) { return (await request<{ business: AdminBusinessRecord }>(`/admin/businesses/${encodeURIComponent(id)}`)).business; }
export type AdminCategoryRecord = { id: string; code: string; active: boolean; sortOrder: number; translations: { locale: string; name: string }[]; _count: { businesses: number; offers: number } };
export async function listAdminCategories() { return (await request<{ categories: AdminCategoryRecord[] }>('/admin/categories')).categories; }
export type AdminUserRecord = { id: string; publicId: string; displayName: string; emailNormalized: string | null; status: string; createdAt: string; lastLoginAt: string | null };
export type AdminUserPage = { users: AdminUserRecord[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } };
export function listAdminUsers(q = '', page = 1) { return request<AdminUserPage>(`/admin/users?q=${encodeURIComponent(q)}&page=${page}`); }
export type AdminOfferRecord = { id: string; name: string; kind: string; active: boolean; publicationStatus: string; deletedAt: string | null; updatedAt: string; business: { id: string; name: string } };
export type AdminOfferPage = { offers: AdminOfferRecord[]; pagination: { page: number; total: number; totalPages: number } };
export function listAdminOffers(page = 1) { return request<AdminOfferPage>(`/admin/content?page=${page}`); }
export type AdminDashboardStats = {
  generatedAt: string;
  totals: { users: number; businesses: number; businessesVerified: number; reviewsPublished: number; businessProActive: number };
  businessStatuses: { published: number; unpublished: number; review: number };
  userStatuses: { active: number; suspended: number };
  subscriptions: { proActive: number; proPending: number; proExpiring30Days: number; plus: null };
  monthly: Array<{ month: string; users: number; businesses: number; reviews: number }>;
  revenue: null;
};
export type AdminReview = { id: string; rating: number; comment: string; status: string; createdAt: string; business: { name: string; publicId: string }; user: { displayName: string }; response: { body: string } | null; reports: { id: string; status: string; reason: string }[] };
export type AdminReviewsResponse = { reviews: AdminReview[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } };
export type AdminReviewReport = { id: string; reason: string; description: string | null; status: string; createdAt: string; review: { id: string; rating: number; comment: string; business: { name: string; publicId: string }; user: { displayName: string } }; reporter: { displayName: string } };
let accessToken: string | null = null;
// The API cookie belongs to api.xamuko.com and cannot be read by the Admin UI.
// Recover its CSRF counterpart through credentialed, CORS-protected API responses.
let adminCsrfToken = '';
export async function fetchOwnAvatar(path = `${API_BASE}/auth/me/avatar`): Promise<Blob> {
  // Regular user avatars require a Bearer token. Admin has a separate,
  // HttpOnly cookie scoped to /api/v1/admin, so use its protected endpoint.
  const ownPath = path.replace(/^\/api\/v1\/auth\/me\/avatar(?=\?|$)/, `${API_BASE}/admin/auth/me/avatar`);
  const target = /^https?:\/\//i.test(ownPath) ? ownPath : buildApiUrl(ownPath);
  const response = await fetch(target, headers({ headers: { Accept: 'image/*' } }));
  if (!response.ok) throw new Error('No se pudo cargar la foto de perfil.');
  return response.blob();
}
function headers(init: RequestInit = {}) { const value = new Headers(init.headers); if (!['GET', 'HEAD', 'OPTIONS'].includes((init.method ?? 'GET').toUpperCase()) && adminCsrfToken) value.set('X-Admin-CSRF', adminCsrfToken); if (!value.has('Accept')) value.set('Accept', 'application/json'); if (init.body && !value.has('Content-Type')) value.set('Content-Type', 'application/json'); if (accessToken) value.set('Authorization', `Bearer ${accessToken}`); return { ...init, headers: value, credentials: 'include' as RequestCredentials }; }
async function request<T>(path: string, init: RequestInit = {}) { const response = await fetch(buildApiUrl(path), headers(init)); const payload = await response.json().catch(() => null) as { error?: { code?: string; message?: string }; csrfToken?: unknown } & T; if (!response.ok) { const code=payload?.error?.code ?? 'UNKNOWN_ERROR'; const message=payload?.error?.message ?? 'No se pudo completar la solicitud.'; if (code === 'ADMIN_REAUTH_REQUIRED') window.location.assign('/login?reauth=1'); throw new AdminApiError(response.status, code, message); } if (payload && typeof payload.csrfToken === 'string') adminCsrfToken = payload.csrfToken; return payload; }
export async function adminLogin(email: string, password: string, rememberMe: boolean) { return (await request<{ admin: RealAdmin }>('/admin/auth/password', { method: 'POST', body: JSON.stringify({ email, password, rememberMe }) })).admin; }
export function getAdminDashboardStats() { return request<AdminDashboardStats>('/admin/dashboard/stats'); }
export async function adminMe() { return (await request<{ admin: RealAdmin }>('/admin/me')).admin; }
export async function adminRefresh() { const result = await request<{ user: RealAdmin['user']; accessToken: string }>('/auth/refresh', { method: 'POST', body: JSON.stringify({ rememberMe: false }) }); accessToken = result.accessToken; return adminMe(); }
export async function adminLogout() { try { await request('/auth/logout', { method: 'POST', body: '{}' }); } finally { accessToken = null; } }
/* Contrato preparado para la futura API de reportes de ofertas.
   El frontend nunca inventa registros ni los obtiene de localStorage de Usuarios. */
export type AdminOfferReport = {
  id: string;
  reason: string;
  description: string | null;
  status: 'PENDING' | 'UNDER_REVIEW' | 'RESOLVED' | 'REJECTED';
  createdAt: string;
  offer: { id: string; name: string; kind: 'PRODUCT' | 'SERVICE'; business: { id: string; name: string } };
  reporter: { displayName: string } | null;
};
export function listAdminOfferReports() {
  return request<{ reports: AdminOfferReport[] }>('/admin/offer-reports');
}
export function listReviewReports(status = '') { return request<{ reports: AdminReviewReport[] }>(`/admin/review-reports${status ? `?status=${encodeURIComponent(status)}` : ''}`); }
export function moderateReviewReport(reportId: string, status: string, reviewStatus: string, decisionNote: string) { return request(`/admin/review-reports/${encodeURIComponent(reportId)}`, { method: 'PATCH', body: JSON.stringify({ status, reviewStatus, decisionNote }) }); }

export function listAdminReviews(page = 1, pageSize = 20) { return request<AdminReviewsResponse>(`/admin/reviews?page=${page}&pageSize=${pageSize}`); }

export type PioneerAssignment = { id: string; number: number; assignedAt: string; brand: { id: string; legalName: string; verification: string } };
export type PioneerBrand = { id: string; legalName: string; verification: string; businesses: { id: string; publicId: string; name: string; publicationStatus: string; visibilityStatus: string }[]; claims: { id: string; claimantId: string; reviewedById: string | null; reviewedAt: string | null }[] };
export type PioneerRegistry = { max: number; available: number; brands: PioneerBrand[]; assignments: PioneerAssignment[] };
export function listPioneers() { return request<PioneerRegistry>('/admin/pioneers'); }
export function reviewPioneerClaim(claimId: string, approve: boolean, reason: string) { return request(`/admin/pioneers/claims/${encodeURIComponent(claimId)}/review`, { method: 'POST', body: JSON.stringify({ approve, reason }) }); }
export function assignPioneer(brandId: string, reason: string) { return request(`/admin/pioneers/brands/${encodeURIComponent(brandId)}/assign`, { method: 'POST', body: JSON.stringify({ reason }) }); }

export type AdminVerificationRequest = { id: string; businessId: string; status: string; businessNameAtRequest: string; documentType: string; documentSizeBytes: number; documentDeletionStatus: string; requestedAt: string; updatedAt: string; resolvedAt: string | null; business?: { id: string; publicId: string; name: string; createdBy?: { displayName: string; emailNormalized: string | null } }; requester?: { displayName: string; emailNormalized: string | null } };
export function listVerificationRequests() { return request<{ requests: AdminVerificationRequest[] }>('/admin/verifications'); }
export function decideVerification(requestId: string, action: 'APPROVE' | 'REQUEST_INFORMATION' | 'REJECT', reason: string, nameConfirmed: boolean) { return request<{ verification: AdminVerificationRequest }>(`/admin/verifications/${encodeURIComponent(requestId)}/decision`, { method: 'POST', body: JSON.stringify({ action, reason, nameConfirmed }) }); }
export function verificationDocumentUrl(requestId: string) { return `${API_BASE}/admin/verifications/${encodeURIComponent(requestId)}/document`; }
export async function fetchVerificationDocument(requestId: string) { const response = await fetch(verificationDocumentUrl(requestId), headers({})); if (!response.ok) throw new AdminApiError(response.status, 'DOCUMENT_UNAVAILABLE', 'El documento ya no está disponible.'); return response.blob(); }

export type FinanceSummary = { period: { start: string; end: string }; totals: { usd: number; cop: number }; billing?: { costExplorer: { unblendedUsd: number; netUnblendedUsd: number; lastUpdatedAt: string | null; provisional: boolean }; projectEstimate: { usd: number; lastUpdatedAt: string } | null; promotionalCredits: { usedUsd: number; remainingUsd: number; lastUpdatedAt: string } | null; amountDue: { usd: number; lastUpdatedAt: string } | null; notes: string[] }; budgets: Array<{ id: string; name: string; amountCop: string | number; provider?: { name: string } | null }>; providers: Array<{ id: string; name: string; kind: string; services: Array<{ id: string; name: string; sku?: string | null }> }>; consumptions: Array<{ id: string; externalId: string; amountUsd: string | number; amountCop: string | number; creditsUsd: string | number; dataKind: string; periodStart: string; periodEnd: string; provider: { name: string }; service?: { name: string } | null }>; lastSync: Array<{ id: string; status: string; startedAt: string; finishedAt?: string | null; provider: { name: string } }> };
export function getFinanceSummary(start?: string, end?: string) { const query = start && end ? `?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}` : ''; return request<FinanceSummary>(`/admin/finance/summary${query}`); }
export type FreeTierUsage = { service: string; usageType: string; actual: number; forecasted: number | null; limit: number | null; unit: string; region: string; freeTierType: string };
export function getAwsFreeTierUsage(service?: string) { return request<{ available: boolean; reason?: string; usages: FreeTierUsage[]; lastUpdatedAt: string | null }>(`/admin/finance/aws/free-tier${service ? `?service=${encodeURIComponent(service)}` : ''}`); }
export function getFinanceRecords() { return request<{ providers: any[]; budgets: any[]; invoices: any[]; payments: any[]; alerts: any[] }>('/admin/finance/records'); }
export function createFinanceProvider(input: unknown) { return request('/admin/finance/providers', { method: 'POST', body: JSON.stringify(input) }); }
export function createFinanceBudget(input: unknown) { return request('/admin/finance/budgets', { method: 'POST', body: JSON.stringify(input) }); }
export function createFinanceConsumption(input: unknown) { return request('/admin/finance/consumptions/manual', { method: 'POST', body: JSON.stringify(input) }); }
export function createFinanceInvoice(input: unknown) { return request('/admin/finance/invoices', { method: 'POST', body: JSON.stringify(input) }); }
export function createFinancePayment(input: unknown) { return request('/admin/finance/payments', { method: 'POST', body: JSON.stringify(input) }); }
export function acknowledgeFinanceAlert(id: string) { return request(`/admin/finance/alerts/${encodeURIComponent(id)}/acknowledge`, { method: 'PATCH', body: '{}' }); }
export function updateFinanceProvider(id: string, input: unknown) { return request(`/admin/finance/providers/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input) }); }
export function updateFinanceBudget(id: string, input: unknown) { return request(`/admin/finance/budgets/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input) }); }
export function updateFinanceConsumption(id: string, input: unknown) { return request(`/admin/finance/consumptions/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input) }); }
export function updateFinanceInvoice(id: string, input: unknown) { return request(`/admin/finance/invoices/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input) }); }
export function updateFinancePayment(id: string, input: unknown) { return request(`/admin/finance/payments/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input) }); }
export function getFinanceAudit() { return request<{ entries: Array<{ id: string; entityType: string; entityId: string; action: string; reason: string; createdAt: string }> }>('/admin/finance/audit'); }

const adminCsrf = () => adminCsrfToken;
function fromBase64Url(value: string) { const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4); return Uint8Array.from(atob(padded), char => char.charCodeAt(0)); }
function toBase64Url(value: ArrayBuffer) { return btoa(String.fromCharCode(...new Uint8Array(value))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
export async function getAdminSession() { return request<{ authenticated: boolean; userId: string }>('/admin/auth/session'); }
export async function beginAdminWebAuthn(rememberMe = false) {
  const options = await request<any>('/admin/auth/webauthn/options');
  const credential = await navigator.credentials.get({ publicKey: { ...options, challenge: fromBase64Url(options.challenge), allowCredentials: (options.allowCredentials ?? []).map((item: any) => ({ ...item, id: fromBase64Url(item.id) })) } }) as PublicKeyCredential | null;
  if (!credential) throw new AdminApiError(400, 'ADMIN_WEBAUTHN_CANCELLED', 'La verificación de passkey fue cancelada.');
  const response = credential.response as AuthenticatorAssertionResponse;
  return request<{ verified: boolean; adminSession: boolean }>('/admin/auth/webauthn/verify', { method: 'POST', headers: { 'X-Admin-CSRF': adminCsrf() }, body: JSON.stringify({ rememberMe, id: credential.id, rawId: toBase64Url(credential.rawId), type: credential.type, response: { clientDataJSON: toBase64Url(response.clientDataJSON), authenticatorData: toBase64Url(response.authenticatorData), signature: toBase64Url(response.signature), userHandle: response.userHandle ? toBase64Url(response.userHandle) : null } }) });
}
export async function beginAdminPasskeyActivation(code: string) {
  const options = await request<any>('/admin/auth/passkey/activation/options', { headers: { 'X-Admin-Activation-Code': code } });
  return { ...options, challenge: fromBase64Url(options.challenge), user: { ...options.user, id: fromBase64Url(options.user.id) }, excludeCredentials: (options.excludeCredentials ?? []).map((item: any) => ({ ...item, id: fromBase64Url(item.id) })) };
}
export async function finishAdminPasskeyActivation(code: string, credential: PublicKeyCredential) {
  const response = credential.response as AuthenticatorAttestationResponse;
  return request('/admin/auth/passkey/activation/verify', { method: 'POST', headers: { 'X-Admin-Activation-Code': code }, body: JSON.stringify({ id: credential.id, rawId: toBase64Url(credential.rawId), type: credential.type, response: { clientDataJSON: toBase64Url(response.clientDataJSON), attestationObject: toBase64Url(response.attestationObject), transports: response.getTransports?.() ?? [] } }) });
}

export async function adminSessionLogout() {
  try {
    // Refresh the token tied to the currently authenticated Admin cookie.
    await getAdminSession();
    try {
      await request('/admin/auth/logout', { method: 'POST', body: '{}' });
    } catch (error) {
      if (!(error instanceof AdminApiError && error.code === 'ADMIN_CSRF_INVALID')) throw error;
      // A concurrent session refresh may have changed the token; retry once.
      await getAdminSession();
      await request('/admin/auth/logout', { method: 'POST', body: '{}' });
    }
  } catch (error) {
    // The server has already invalidated or expired this session.
    if (!(error instanceof AdminApiError && error.status === 401)) throw error;
  }
  // Never drop the local CSRF token while an active Admin session might remain.
  adminCsrfToken = '';
  accessToken = null;
}
