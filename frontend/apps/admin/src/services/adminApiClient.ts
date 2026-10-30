export class AdminApiError extends Error { readonly status:number; readonly code:string; constructor(status:number,code:string,message:string){super(message);this.name='AdminApiError';this.status=status;this.code=code;} }
export type AdminPermission = 'BUSINESSES_READ' | 'CATALOG_READ' | 'REPORTS_REVIEW' | 'CONTENT_MODERATE' | 'AUDIT_READ' | 'ADMINS_MANAGE' | 'PIONEER_MANAGE' | 'FINANCE_READ' | 'FINANCE_MANAGE';
export type RealAdmin = { user: { id: string; publicId: string; displayName: string; emailNormalized: string | null; avatarUrl: string | null; locale: string }; role: 'ADMIN' | 'SUPER_ADMIN'; permissions: AdminPermission[] };
export type AdminReview = { id: string; rating: number; comment: string; status: string; createdAt: string; business: { name: string; publicId: string }; user: { displayName: string }; response: { body: string } | null; reports: { id: string; status: string; reason: string }[] };
export type AdminReviewsResponse = { reviews: AdminReview[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } };
export type AdminReviewReport = { id: string; reason: string; description: string | null; status: string; createdAt: string; review: { id: string; rating: number; comment: string; business: { name: string; publicId: string }; user: { displayName: string } }; reporter: { displayName: string } };
const API_BASE = '/api/v1';
let accessToken: string | null = null;
export async function fetchOwnAvatar(path = `${API_BASE}/auth/me/avatar`): Promise<Blob> { const response = await fetch(path, headers()); if (!response.ok) throw new Error('No se pudo cargar la foto de perfil.'); return response.blob(); }
function headers(init: RequestInit = {}) { const value = new Headers(init.headers); value.set('Accept', 'application/json'); if (init.body && !value.has('Content-Type')) value.set('Content-Type', 'application/json'); if (accessToken) value.set('Authorization', `Bearer ${accessToken}`); return { ...init, headers: value, credentials: 'include' as RequestCredentials }; }
async function request<T>(path: string, init: RequestInit = {}) { const response = await fetch(`${API_BASE}${path}`, headers(init)); const payload = await response.json().catch(() => null) as { error?: { code?: string; message?: string } } & T; if (!response.ok) { const code=payload?.error?.code ?? 'UNKNOWN_ERROR'; const message=payload?.error?.message ?? 'No se pudo completar la solicitud.'; throw new AdminApiError(response.status, code, message); } return payload; }
export async function adminLogin(email: string, password: string, rememberMe: boolean) { const result = await request<{ user: RealAdmin['user']; accessToken: string }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password, rememberMe }) }); accessToken = result.accessToken; return adminMe(); }
export async function adminMe() { return (await request<{ admin: RealAdmin }>('/admin/me')).admin; }
export async function adminRefresh() { const result = await request<{ user: RealAdmin['user']; accessToken: string }>('/auth/refresh', { method: 'POST', body: JSON.stringify({ rememberMe: false }) }); accessToken = result.accessToken; return adminMe(); }
export async function adminLogout() { try { await request('/auth/logout', { method: 'POST', body: '{}' }); } finally { accessToken = null; } }
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

const adminCsrf = () => document.cookie.split('; ').find(item => item.startsWith('xamuko_admin_csrf='))?.split('=').slice(1).join('=') ?? '';
function fromBase64Url(value: string) { const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4); return Uint8Array.from(atob(padded), char => char.charCodeAt(0)); }
function toBase64Url(value: ArrayBuffer) { return btoa(String.fromCharCode(...new Uint8Array(value))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
export async function getAdminSession() { return request<{ authenticated: boolean; userId: string }>('/admin/auth/session'); }
export async function beginAdminWebAuthn() {
  const options = await request<any>('/admin/auth/webauthn/options');
  const credential = await navigator.credentials.get({ publicKey: { ...options, challenge: fromBase64Url(options.challenge), allowCredentials: (options.allowCredentials ?? []).map((item: any) => ({ ...item, id: fromBase64Url(item.id) })) } }) as PublicKeyCredential | null;
  if (!credential) throw new AdminApiError(400, 'ADMIN_WEBAUTHN_CANCELLED', 'La verificación de passkey fue cancelada.');
  const response = credential.response as AuthenticatorAssertionResponse;
  return request<{ verified: boolean; adminSession: boolean }>('/admin/auth/webauthn/verify', { method: 'POST', headers: { 'X-Admin-CSRF': adminCsrf() }, body: JSON.stringify({ id: credential.id, rawId: toBase64Url(credential.rawId), type: credential.type, response: { clientDataJSON: toBase64Url(response.clientDataJSON), authenticatorData: toBase64Url(response.authenticatorData), signature: toBase64Url(response.signature), userHandle: response.userHandle ? toBase64Url(response.userHandle) : null } }) });
}
export async function beginAdminPasskeyActivation(code: string) {
  const options = await request<any>('/admin/auth/passkey/activation/options', { headers: { 'X-Admin-Activation-Code': code } });
  return { ...options, challenge: fromBase64Url(options.challenge), user: { ...options.user, id: fromBase64Url(options.user.id) }, excludeCredentials: (options.excludeCredentials ?? []).map((item: any) => ({ ...item, id: fromBase64Url(item.id) })) };
}
export async function finishAdminPasskeyActivation(code: string, credential: PublicKeyCredential) {
  const response = credential.response as AuthenticatorAttestationResponse;
  return request('/admin/auth/passkey/activation/verify', { method: 'POST', headers: { 'X-Admin-Activation-Code': code }, body: JSON.stringify({ id: credential.id, rawId: toBase64Url(credential.rawId), type: credential.type, response: { clientDataJSON: toBase64Url(response.clientDataJSON), attestationObject: toBase64Url(response.attestationObject), transports: response.getTransports?.() ?? [] } }) });
}

export async function adminSessionLogout() { return request('/admin/auth/logout', { method: 'POST', headers: { 'X-Admin-CSRF': adminCsrf() }, body: '{}' }); }
