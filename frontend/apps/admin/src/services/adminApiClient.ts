import { API_BASE_URL as API_BASE, buildApiUrl } from '@wit/utils';
export class AdminApiError extends Error { readonly status:number; readonly code:string; constructor(status:number,code:string,message:string){super(message);this.name='AdminApiError';this.status=status;this.code=code;} }
export type AdminPermission = 'BUSINESSES_READ' | 'CATALOG_READ' | 'REPORTS_REVIEW' | 'CONTENT_MODERATE' | 'AUDIT_READ' | 'ADMINS_MANAGE' | 'PIONEER_MANAGE' | 'FINANCE_READ' | 'FINANCE_MANAGE';
export type RealAdmin = { user: { id: string; publicId: string; displayName: string; emailNormalized: string | null; avatarUrl: string | null; locale: string }; role: 'ADMIN' | 'SUPER_ADMIN'; permissions: AdminPermission[] };
export type AdministratorRecord = { id: string; displayName: string; emailNormalized: string | null; status: string; adminRoleAssignments: { role: string; active: boolean }[]; adminPermissionGrants: { permission: string; granted: boolean }[] };
export async function listAdministrators() { return (await request<{ administrators: AdministratorRecord[] }>('/admin/administrators')).administrators; }
export type AdminBusinessRecord = { id: string; publicId: string; name: string; description: string | null; email: string | null; phone: string | null; lifecycleStatus: string; publicationStatus: string; visibilityStatus: string; verificationStatus: string; deletionStatus: string; completeness: number; createdAt: string; updatedAt: string; createdBy: { displayName: string; emailNormalized: string | null }; location: { cityName: string; countryCode: string; address: string } | null; category: { code: string; translations: { locale: string; name: string }[] } };
export type AdminBusinessPage = { businesses: AdminBusinessRecord[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } };
export type AdminBusinessAnalytics = {
  period: '6m' | '12m' | '24m' | '60m' | 'all';
  status: 'all' | 'active' | 'review' | 'inactive';
  timezone: string;
  total: number;
  totalUsers: number;
  totalReviews: number;
  filters: { cities: Array<{ value: string; label: string }>; categories: Array<{ id: string; name: string }> };
  series: Array<{ month: string; registrations: number; cumulative: number; reviews: number; reviewCumulative: number; users: number; userCumulative: number }>;
  definition: string;
};
export function getAdminBusinessAnalytics(filters: { period: string; city: string; categoryId: string; status: string }) {
  const query = new URLSearchParams(filters);
  return request<AdminBusinessAnalytics>('/admin/business-analytics?' + query.toString());
}
export function listAdminBusinesses(q = '', page = 1, pageSize = 20, status = '') { const params = new URLSearchParams({ q, page: String(page), pageSize: String(pageSize) }); if (status) params.set('status', status); return request<AdminBusinessPage>(`/admin/businesses?${params.toString()}`); }
export async function getAdminBusiness(id: string) { return (await request<{ business: AdminBusinessRecord }>(`/admin/businesses/${encodeURIComponent(id)}`)).business; }
export function deleteAdminBusiness(id: string, reason: string, confirmation: string) {
  return request<{ id: string; status: 'DELETED'; message: string }>(
    '/admin/businesses/' + encodeURIComponent(id) + '/delete',
    { method: 'POST', body: JSON.stringify({ reason, confirmation }) },
  );
}

export type AdminCategoryRecord = { id: string; code: string; active: boolean; sortOrder: number; translations: { locale: string; name: string }[]; _count: { businesses: number; offers: number } };
export async function listAdminCategories() { return (await request<{ categories: AdminCategoryRecord[] }>('/admin/categories')).categories; }
export type AdminUserStatus = 'ACTIVE' | 'SUSPENDED' | 'DELETED';
export type AdminUserRecord = {
  id: string; publicId: string; displayName: string; nickname: string | null;
  emailNormalized: string | null; status: AdminUserStatus; avatarUrl: string | null;
  locale: string; createdAt: string; lastLoginAt: string | null;
  ownedBusinesses: number; collaboratingBusinesses: number; createdBusinesses: number; isAdmin: boolean;
};
export type AdminUserPage = {
  users: AdminUserRecord[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};
export type AdminUserOverview = {
  generatedAt: string; total: number; active: number; suspended: number; deleted: number;
  owners: number; collaborators: number; adminCount: number;
  series: Array<{ month: string; registrations: number }>; definition: string;
};
export type AdminUserBusinessLink = {
  id: string; publicId: string; name: string; category: string; city: string | null;
  publicationStatus: string; visibilityStatus: string; role: 'OWNER' | 'COLLABORATOR' | 'CREATOR';
  membershipStatus: string; acceptedAt: string | null; createdAt: string;
};
export type AdminUserProfile = {
  id: string; publicId: string; displayName: string; nickname: string | null;
  emailNormalized: string | null; status: AdminUserStatus; avatarUrl: string | null;
  locale: string; createdAt: string; updatedAt: string; lastLoginAt: string | null;
  preferredLocationCity: string | null; preferredLocationRegion: string | null; preferredLocationCountry: string | null;
  authProviders: Array<{ provider: string; verifiedAt: string | null; createdAt: string }>;
  businesses: AdminUserBusinessLink[];
  businessAccounts: Array<{ id: string; name: string; status: string }>;
  administrativeRoles: string[];
  activity: { reviews: number; favorites: number; offerLikes: number; sessions: number; reports: number; pendingTransfers: number };
  deletion: { allowed: boolean; blockers: string[] };
};
export type AdminUserFilters = { q?: string; page?: number; status?: string; relation?: string };
export function listAdminUsers(filters: AdminUserFilters = {}) {
  const params = new URLSearchParams({ page: String(filters.page ?? 1) });
  if (filters.q) params.set('q', filters.q);
  if (filters.status) params.set('status', filters.status);
  if (filters.relation) params.set('relation', filters.relation);
  return request<AdminUserPage>('/admin/users?' + params.toString());
}
export function getAdminUserOverview() { return request<AdminUserOverview>('/admin/users/overview'); }
export async function getAdminUserProfile(id: string) {
  return (await request<{ user: AdminUserProfile }>('/admin/users/' + encodeURIComponent(id))).user;
}
export async function fetchAdminUserAvatar(id: string): Promise<Blob> {
  const response = await fetch(buildApiUrl('/admin/users/' + encodeURIComponent(id) + '/avatar'),
    headers({ headers: { Accept: 'image/*' } }));
  if (!response.ok) throw new AdminApiError(response.status, 'ADMIN_AVATAR_UNAVAILABLE', 'La fotografía no está disponible.');
  return response.blob();
}
export function deactivateAdminUser(id: string, reason: string, confirmation: string) {
  return request<{ id: string; status: 'DELETED'; message: string }>(
    '/admin/users/' + encodeURIComponent(id) + '/deactivate',
    { method: 'POST', body: JSON.stringify({ reason, confirmation }) },
  );
}
export type AdminContentFilters = { q?:string; kind?:string; status?:string; city?:string; categoryId?:string; period?:string; page?:number };
export type AdminOfferRecord = {
  id:string;internalCode:string;kind:'PRODUCT'|'SERVICE';name:string;description:string|null;
  priceAmount:string|null;currency:string|null;priceText:string|null;negotiable:boolean;
  active:boolean;adultOnly:boolean;publicationStatus:'PUBLISHED'|'REVIEW'|'UNPUBLISHED';
  deletedAt:string|null;createdAt:string;updatedAt:string;
  category:string;photoId:string|null;photoAlt:string|null;likes:number;reports:number;
  business:{id:string;publicId:string;name:string;city:string|null;country:string|null;publicationStatus:string};
};
export type AdminOfferPage = {
  offers:AdminOfferRecord[];
  pagination:{page:number;pageSize:number;total:number;totalPages:number};
};
export type AdminContentInsights = {
  period:string;
  totals:{total:number;products:number;services:number;published:number;inReview:number;unpublished:number;deleted:number};
  series:Array<{month:string;products:number;services:number;total:number}>;
  ranking:Array<{name:string;count:number}>;
  filters:{cities:Array<{value:string;label:string}>;categories:Array<{id:string;name:string}>};
  definition:string;
};
export type AdminContentReport = {
  id:string;reason:string;status:string;createdAt:string;description:string|null;
};
export type AdminContentDetail = AdminOfferRecord & {
  photos:Array<{id:string;altText:string|null}>;
  reportsRecent:AdminContentReport[];canHide:boolean;canRestore:boolean;
};
const contentQuery = (filters:AdminContentFilters) => {
  const params = new URLSearchParams();
  for (const key of ['q','kind','status','city','categoryId','period'] as const)
    if (filters[key]) params.set(key,String(filters[key]));
  if (filters.page) params.set('page',String(filters.page));
  return params.toString();
};
export function listAdminOffers(filters:AdminContentFilters|number={}) {
  return request<AdminOfferPage>('/admin/content?'+contentQuery(typeof filters==='number'?{page:filters}:filters));
}
export function getAdminContentInsights(filters:AdminContentFilters={}) {
  return request<AdminContentInsights>('/admin/content-insights?'+contentQuery(filters));
}
export async function getAdminContentDetail(id:string) {
  return (await request<{offer:AdminContentDetail}>('/admin/content/'+encodeURIComponent(id))).offer;
}
export async function fetchAdminContentPhoto(photoId:string) {
  const response=await fetch(buildApiUrl('/admin/content-photos/'+encodeURIComponent(photoId)),
    headers({headers:{Accept:'image/*'}}));
  if(!response.ok)throw new AdminApiError(response.status,'ADMIN_CONTENT_PHOTO_UNAVAILABLE','La fotografía no está disponible.');
  return response.blob();
}
export function moderateAdminContent(id:string,action:'HIDE'|'RESTORE',reason:string) {
  return request<{id:string;publicationStatus:string;message:string}>(
    '/admin/content/'+encodeURIComponent(id)+'/moderate',{method:'POST',body:JSON.stringify({action,reason})});
}
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
function headers(init: RequestInit = {}) { const value = new Headers(init.headers); if (!['GET', 'HEAD', 'OPTIONS'].includes((init.method ?? 'GET').toUpperCase()) && adminCsrfToken) value.set('X-Admin-CSRF', adminCsrfToken); if (!value.has('Accept')) value.set('Accept', 'application/json'); if (init.body && !(init.body instanceof FormData) && !value.has('Content-Type')) value.set('Content-Type', 'application/json'); if (accessToken) value.set('Authorization', `Bearer ${accessToken}`); return { ...init, headers: value, credentials: 'include' as RequestCredentials }; }
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
export type AdminOfferReportsResponse = {
  reports: AdminOfferReport[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  pendingTotal: number;
};
export function listAdminOfferReports(filters: { page?: number; status?: string; kind?: string; q?: string } = {}) {
  const params = new URLSearchParams({ page: String(filters.page ?? 1), pageSize: '25' });
  if (filters.status && filters.status !== 'ALL') params.set('status', filters.status);
  if (filters.kind && filters.kind !== 'ALL') params.set('kind', filters.kind);
  if (filters.q?.trim()) params.set('q', filters.q.trim());
  return request<AdminOfferReportsResponse>(`/admin/offer-reports?${params.toString()}`);
}
export function listReviewReports(status = '') { return request<{ reports: AdminReviewReport[] }>(`/admin/review-reports${status ? `?status=${encodeURIComponent(status)}` : ''}`); }
export function moderateReviewReport(reportId: string, status: string, reviewStatus: string | undefined, decisionNote: string) { return request(`/admin/review-reports/${encodeURIComponent(reportId)}`, { method: 'PATCH', body: JSON.stringify({ status, reviewStatus, decisionNote }) }); }

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
  // Read the current Admin CSRF token when possible, but still call logout
  // when the server session is already expired: the backend must clear cookies.
  try {
    await getAdminSession();
  } catch (error) {
    const alreadyUnavailable = error instanceof AdminApiError &&
      (error.status === 401 || (error.status === 403 && error.code === 'ADMIN_ACCESS_DENIED'));
    if (!alreadyUnavailable) throw error;
  }

  const revoke = () => request('/admin/auth/logout', { method: 'POST', body: '{}' });
  try {
    await revoke();
  } catch (error) {
    if (error instanceof AdminApiError && error.code === 'ADMIN_CSRF_INVALID') {
      // A concurrently refreshed page may have used an older CSRF value.
      await getAdminSession();
      try {
        await revoke();
      } catch (retryError) {
        if (!(retryError instanceof AdminApiError && retryError.status === 401)) throw retryError;
      }
    } else if (!(error instanceof AdminApiError && error.status === 401)) {
      throw error;
    }
  }
  // Clear local security state only when the backend reported logout/expiration.
  adminCsrfToken = '';
  accessToken = null;
}

export type AdminSupportAttention = {
  counts: Record<string,number>;
  total: number;
  generatedAt: string;
  definition: string;
};
export function getAdminSupportAttention() {
  return request<AdminSupportAttention>('/admin/support-attention');
}

export type OperationalKind = 'needs' | 'business-reports' | 'offer-reports' | 'support' | 'suggestions';
export type OperationalStatus = 'PENDING' | 'UNDER_REVIEW' | 'RESOLVED' | 'REJECTED';
export type OperationalRecord = {
  id: string; title: string; category: string; description: string | null; status: OperationalStatus;
  decisionNote: string | null; createdAt: string; reporter: string; context: string;
  targetPath?: string; targetLabel?: string;
};
export type OperationalResult = { records: OperationalRecord[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } };

export async function listOperationalRecords(kind: OperationalKind, filters: { page?: number; status?: string; q?: string } = {}): Promise<OperationalResult> {
  const p = new URLSearchParams({ page: String(filters.page ?? 1) });
  if (filters.status && filters.status !== 'ALL') p.set('status', filters.status);
  if (filters.q?.trim()) p.set('q', filters.q.trim());
  if (kind === 'business-reports') {
    const result = await request<{ reports: Array<{ id: string; reason: string; description: string; status: OperationalStatus; decisionNote: string | null; createdAt: string; business: { id: string; name: string }; reporter: { displayName: string } | null }>; pagination: OperationalResult['pagination'] }>(`/admin/business-reports?${p}`);
    return { pagination: result.pagination, records: result.reports.map(r => ({ id: r.id, title: r.business?.name ?? 'Negocio', category: r.reason, description: r.description, status: r.status, decisionNote: r.decisionNote, createdAt: r.createdAt, reporter: r.reporter?.displayName ?? 'Visitante', context: 'Negocio reportado', targetPath: r.business?.id ? '/businesses/' + encodeURIComponent(r.business.id) : undefined, targetLabel: 'Abrir ficha del negocio' })) };
  }
  if (kind === 'offer-reports') {
    const result = await request<{ reports: Array<{ id: string; reason: string; description: string | null; status: OperationalStatus; decisionNote: string | null; createdAt: string; offer: { id: string; name: string; kind: string; business: { id: string; name: string } }; reporter: { displayName: string } | null }>; pagination: OperationalResult['pagination'] }>(`/admin/offer-reports?${p}`);
    return { pagination: result.pagination, records: result.reports.map(r => ({ id: r.id, title: r.offer?.name ?? 'Publicación', category: r.reason, description: r.description, status: r.status, decisionNote: r.decisionNote, createdAt: r.createdAt, reporter: r.reporter?.displayName ?? 'Visitante', context: `${r.offer?.kind === 'SERVICE' ? 'Servicio' : 'Producto'} · ${r.offer?.business?.name ?? 'Negocio'}`, targetPath: r.offer?.id ? '/content/' + encodeURIComponent(r.offer.id) : undefined, targetLabel: 'Abrir publicación y moderar' })) };
  }
  const category = kind === 'needs' ? 'NEED' : kind === 'support' ? 'SUPPORT' : 'SUGGESTION';
  p.set('kind', category);
  const result = await request<{ requests: Array<{ id: string; title: string; category: string; description: string | null; status: OperationalStatus; decisionNote: string | null; createdAt: string; locationName: string | null; locationContext: string | null; sender: { displayName: string } | null; business: { id: string; name: string } | null }>; pagination: OperationalResult['pagination'] }>(`/admin/support-requests?${p}`);
  return { pagination: result.pagination, records: result.requests.map(r => ({ id: r.id, title: r.title, category: r.category, description: r.description, status: r.status, decisionNote: r.decisionNote, createdAt: r.createdAt, reporter: r.sender?.displayName ?? 'Visitante', context: kind === 'needs' ? [r.locationName, r.locationContext].filter(Boolean).join(' · ') : (r.business?.name ?? 'Cuenta Business'), targetPath: r.business?.id ? '/businesses/' + encodeURIComponent(r.business.id) : undefined, targetLabel: 'Consultar negocio vinculado' })) };
}

export function decideOperationalRecord(kind: OperationalKind, id: string, status: OperationalStatus, decisionNote: string) {
  const endpoint = kind === 'business-reports' ? 'business-reports' : kind === 'offer-reports' ? 'offer-reports' : 'support-requests';
  return request(`/admin/${endpoint}/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ status, decisionNote }) });
}

export type AdminDocumentSection = 'CORPORATE' | 'LEGAL' | 'CASES';
export function adminDocumentRequest<T>(path: string, init: RequestInit = {}) { return request<T>(`/admin${path}`, init); }
export async function getAdminDocumentBlob(id: string): Promise<Blob> {
  const response = await fetch(buildApiUrl(`/admin/documents/${encodeURIComponent(id)}/content`), headers({ headers: { Accept: 'application/pdf' } }));
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new AdminApiError(response.status, body?.error?.code ?? 'DOCUMENT_UNAVAILABLE', body?.error?.message ?? 'No se pudo consultar el documento.');
  }
  if (!response.headers.get('content-type')?.includes('application/pdf')) throw new Error('El servidor no devolvió un documento PDF.');
  return response.blob();
}
