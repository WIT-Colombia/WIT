import { postPasswordOperation } from "@wit/utils";
export class AdminApiError extends Error { readonly status:number; readonly code:string; constructor(status:number,code:string,message:string){super(message);this.name='AdminApiError';this.status=status;this.code=code;} }
export type AdminPermission = 'BUSINESSES_READ' | 'CATALOG_READ' | 'REPORTS_REVIEW' | 'CONTENT_MODERATE' | 'AUDIT_READ' | 'ADMINS_MANAGE' | 'PIONEER_MANAGE';
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
let refreshInFlight: Promise<RealAdmin> | null = null;
export function adminRefresh(): Promise<RealAdmin> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const result = await request<{ user: RealAdmin['user']; accessToken: string }>('/auth/refresh', { method: 'POST', body: JSON.stringify({ rememberMe: false }) });
    accessToken = result.accessToken;
    return adminMe();
  })().finally(() => { refreshInFlight = null; });
  return refreshInFlight;
}
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

export function adminRequestPasswordReset(email: string) {
  return postPasswordOperation<{ message: string }>(`${API_BASE}/auth/password-reset/request`, { email }, 'request');
}
export function adminChangePassword(currentPassword: string, newPassword: string) {
  return postPasswordOperation<void>(`${API_BASE}/auth/change-password`, { currentPassword, newPassword }, 'change', accessToken ?? undefined);
}
