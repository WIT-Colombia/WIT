export type ApiErrorPayload = {
  error?: {
    code?: string;
    message?: string;
    fields?: Record<string, string>;
  };
};

export class BusinessApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryAfterSeconds?: number;
  readonly fields: Record<string, string>;

  constructor(status: number, code: string, message: string, retryAfterSeconds?: number, fields: Record<string, string> = {}) {
    super(message);
    this.name = "BusinessApiError";
    this.status = status;
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
    this.fields = fields;
  }
}

type RuntimeImportMeta = ImportMeta & {
  env?: Record<string, string | undefined>;
};

const configuredBaseUrl = (import.meta as RuntimeImportMeta).env?.VITE_API_BASE_URL?.trim();
export const API_BASE_URL = configuredBaseUrl || "/api/v1";

let accessTokenProvider: (() => string | null) | null = null;
let unauthorizedHandler: (() => Promise<boolean>) | null = null;

/** Registers the in-memory token source used by authenticated Business requests. */
export function configureAccessTokenProvider(provider: (() => string | null) | null): void {
  accessTokenProvider = provider;
}

/** Registers the existing session refresh flow for expired access tokens. */
export function configureUnauthorizedHandler(handler: (() => Promise<boolean>) | null): void {
  unauthorizedHandler = handler;
}

export function buildApiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const base = API_BASE_URL.replace(/\/+$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  if (base.endsWith("/api/v1") && suffix.startsWith("/api/v1/")) return `${base}${suffix.slice("/api/v1".length)}`;
  return `${base}${suffix}`;
}

async function requestJsonInternal<T>(path: string, init: RequestInit, retryUnauthorized: boolean): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  if (init.body !== undefined && !(init.body instanceof FormData) && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (!headers.has("Authorization")) {
    const token = accessTokenProvider?.();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(buildApiUrl(path), {
      ...init,
      credentials: "include",
      headers,
    });
  } catch {
    throw new BusinessApiError(0, "NETWORK_ERROR", "No se pudo conectar con XAMUKO Business.");
  }

  const text = await response.text();
  let payload: T | ApiErrorPayload | null = null;
  try {
    payload = text ? JSON.parse(text) as T | ApiErrorPayload : null;
  } catch {
    payload = null;
  }

  if (response.status === 401 && retryUnauthorized && unauthorizedHandler && !/^\/auth\//.test(path)) {
    const refreshed = await unauthorizedHandler();
    if (refreshed) return requestJsonInternal<T>(path, init, false);
  }

  if (!response.ok) {
    const errorPayload = payload as ApiErrorPayload | null;
    const retryAfterHeader = response.headers.get("Retry-After");
    const retryAfterSeconds = retryAfterHeader && /^\d+$/.test(retryAfterHeader) ? Number(retryAfterHeader) : undefined;
    const baseMessage = errorPayload?.error?.message ?? "No se pudo completar la solicitud.";
    const message = response.status === 429 && retryAfterSeconds !== undefined
      ? `${baseMessage} Puedes volver a intentarlo en ${retryAfterSeconds} segundos.`
      : baseMessage;
    throw new BusinessApiError(
      response.status,
      errorPayload?.error?.code ?? "HTTP_ERROR",
      message,
      retryAfterSeconds,
      errorPayload?.error?.fields ?? {},
    );
  }

  return payload as T;
}

export function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  return requestJsonInternal(path, init, true);
}

export function requestMultipart<T>(path: string, body: FormData, method = "POST"): Promise<T> {
  return requestJsonInternal<T>(path, { method, body }, true);
}

export async function requestPhotoBlob(path: string): Promise<Blob> {
  const headers = new Headers();
  const token = accessTokenProvider?.();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  let response = await fetch(buildApiUrl(path), { credentials: "include", headers });
  if (response.status === 401 && unauthorizedHandler && await unauthorizedHandler()) {
    const retryHeaders = new Headers();
    const refreshedToken = accessTokenProvider?.();
    if (refreshedToken) retryHeaders.set("Authorization", `Bearer ${refreshedToken}`);
    response = await fetch(buildApiUrl(path), { credentials: "include", headers: retryHeaders });
  }
  if (!response.ok) throw new BusinessApiError(response.status, "PHOTO_LOAD_FAILED", "No se pudo cargar la fotografía.");
  return response.blob();
}

export type RealPhoto = { id: string; url: string; altText: string | null; sortOrder: number; isCover: boolean };
export type BusinessReferralLevel = 'BASIC' | 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND';
export type BusinessReferralSummary = { referredUsers: number; currentLevel: BusinessReferralLevel; nextLevel: BusinessReferralLevel | null; nextLevelMinimum: number | null };
export type CatalogLimits = { level: BusinessReferralLevel; plan: "BASIC" | "PRO"; products: { used: number; limit: number | null; available: number | null; unlimited: boolean }; services: { used: number; limit: number | null; available: number | null; unlimited: boolean } };
export type BusinessReview = { id: string; businessId: string; userId: string; author: string; rating: number; comment: string; createdAt: string; updatedAt: string; response: { body: string; createdAt: string; updatedAt: string } | null };
export type BusinessReviewsResponse = { reviews: BusinessReview[]; pagination: { page: number; pageSize: number; total: number; totalPages: number }; summary: { average: number | null; total: number; distribution: Record<string, number> } };
export type RealOffer = { id: string; businessId: string; kind: 'PRODUCT' | 'SERVICE'; name: string; description: string | null; priceAmount: string | null; currency: string | null; priceText: string | null; negotiable: boolean; active: boolean; adultOnly: boolean; publicationStatus: 'UNPUBLISHED' | 'PUBLISHED' | 'REVIEW'; photos: RealPhoto[] };

export type RealBusiness = {
  id: string;
  publicId: string;
  businessAccountId: string;
  name: string;
  sede: string | null;
  adultOnly: boolean;
  slug: string;
  description: string | null;
  category: string | null;
  categoryId: string;
  secondaryCategories: Array<{ id: string; code: string }>;
  email: string | null;
  website: string | null;
  instagram: string | null;
  facebookUrl: string | null;
  xUrl: string | null;
  tiktokUrl: string | null;
  phone: string | null;
  whatsapp: string | null;
  phonePublic: boolean;
  whatsappPublic: boolean;
  emailPublic: boolean;
  coverPhotoId: string | null;
  profilePhotoId: string | null;
  coverImagePosition: { x: number; y: number };
  profileImagePosition: { x: number; y: number };
  completeness: number;
  lifecycleStatus: string;
  publicationStatus: string;
  visibilityStatus: string;
  verificationStatus: string;
  deletionStatus: string;
  publicationReadiness?: { ready: boolean; blockers: string[] };
  role: string | null;
  permissions: string[];
  location: { countryCode: string; regionCode: string | null; regionName: string | null; cityName: string; zoneName: string | null; address: string; additionalAddressInfo: string | null; postalCode: string | null; latitude: string | null; longitude: string | null; visibility: string } | null;
  modalities: RealModality[];
  photos?: RealPhoto[];
  coverPhoto?: RealPhoto | null;
  profilePhoto?: RealPhoto | null;
};

export type ModalityType = "PHYSICAL" | "VIRTUAL" | "DELIVERY";
export type ModalityStatus = "CONFIGURING" | "ACTIVE" | "PAUSED";
export type ModalityContact = { email: string | null; website: string | null; phone: string | null; whatsapp: string | null; instagram?: string | null };
export type ModalityHour = { dayOfWeek: number; isClosed: boolean; opensAt: string | null; closesAt: string | null; timezone: string };
export type RealModality = { id: string; businessId: string; type: ModalityType; status: ModalityStatus; contact: ModalityContact | null; effectiveContact?: ModalityContact; blockers?: string[]; hours: ModalityHour[] };

export const businessApi = {
  list: () => requestJson<{ businesses: RealBusiness[] }>('/businesses'),
  categories: () => requestJson<{ categories: Array<{ id: string; code: string; translations: Array<{ name: string }> }> }>('/business-categories'),
  create: (input: Record<string, unknown>) => requestJson<{ business: RealBusiness }>('/businesses', { method: 'POST', body: JSON.stringify(input) }),
  get: (businessId: string) => requestJson<{ business: RealBusiness }>(`/businesses/${encodeURIComponent(businessId)}`),
  getReferralSummary: (businessId: string) => requestJson<{ referralSummary: BusinessReferralSummary }>(`/businesses/${encodeURIComponent(businessId)}/referral-summary`),
  getCatalogLimits: (businessId: string) => requestJson<CatalogLimits>(`/businesses/${encodeURIComponent(businessId)}/catalog-limits`),
  getFavoriteCount: (businessId: string) => requestJson<{ count: number }>(`/businesses/${encodeURIComponent(businessId)}/favorites/count`),
  getAnalytics: (businessId: string, period: string) => requestJson<{ metrics: { businessViews: number; searchAppearances: number; whatsappClicks: number; phoneClicks: number }; period: string; timezone: string }>(`/businesses/${encodeURIComponent(businessId)}/analytics?period=${encodeURIComponent(period)}`),
  getOfferLikeCounts: (businessId: string) => requestJson<{ offers: Array<{ offerId: string; likeCount: number }> }>(`/businesses/${encodeURIComponent(businessId)}/offers/likes`),
  listReviews: (businessId: string, page = 1, pageSize = 50) => requestJson<BusinessReviewsResponse>(`/public/businesses/${encodeURIComponent(businessId)}/reviews?page=${page}&pageSize=${pageSize}`),
  saveReviewResponse: (reviewId: string, body: string, edit = false) => requestJson<{ response: BusinessReview['response'] }>(`/reviews/${encodeURIComponent(reviewId)}/response`, { method: edit ? 'PATCH' : 'POST', body: JSON.stringify({ body }) }),
  reportReview: (reviewId: string, reason: string, description?: string) => requestJson<{ report: unknown }>(`/reviews/${encodeURIComponent(reviewId)}/reports`, { method: 'POST', body: JSON.stringify({ reason, description }) }),
  listOffers: (businessId: string, kind?: 'PRODUCT' | 'SERVICE') => requestJson<{ offers: RealOffer[] }>(`/businesses/${encodeURIComponent(businessId)}/offers${kind ? `?kind=${kind}` : ''}`),
  createOffer: (businessId: string, input: Record<string, unknown>) => requestJson<{ offer: RealOffer }>(`/businesses/${encodeURIComponent(businessId)}/offers`, { method: 'POST', body: JSON.stringify(input) }),
  updateOffer: (businessId: string, offerId: string, input: Record<string, unknown>) => requestJson<{ offer: RealOffer }>(`/businesses/${encodeURIComponent(businessId)}/offers/${encodeURIComponent(offerId)}`, { method: 'PATCH', body: JSON.stringify(input) }),
  deleteOffer: (businessId: string, offerId: string) => requestJson<void>(`/businesses/${encodeURIComponent(businessId)}/offers/${encodeURIComponent(offerId)}`, { method: 'DELETE' }),
  update: (businessId: string, input: Record<string, unknown>) => requestJson<{ business: RealBusiness }>(`/businesses/${encodeURIComponent(businessId)}`, { method: 'PATCH', body: JSON.stringify(input) }),
  publishBusiness: (businessId: string) => requestJson<{ business: RealBusiness }>(`/businesses/${encodeURIComponent(businessId)}/publish`, { method: 'POST' }),
  requestDeletion: (businessId: string) => requestJson<{ business: RealBusiness }>(`/businesses/${encodeURIComponent(businessId)}/request-deletion`, { method: 'POST' }),
  recoverBusiness: (businessId: string) => requestJson<{ business: RealBusiness }>(`/businesses/${encodeURIComponent(businessId)}/recover`, { method: 'POST' }),
  listModalities: (businessId: string) => requestJson<{ modalities: RealModality[] }>(`/businesses/${encodeURIComponent(businessId)}/modalities`),
  createModality: (businessId: string, type: ModalityType) => requestJson<{ modality: RealModality }>(`/businesses/${encodeURIComponent(businessId)}/modalities`, { method: 'POST', body: JSON.stringify({ type }) }),
  updateModalityContact: (businessId: string, modalityId: string, input: Partial<ModalityContact>) => requestJson<{ modality: RealModality }>(`/businesses/${encodeURIComponent(businessId)}/modalities/${encodeURIComponent(modalityId)}/contact`, { method: 'PUT', body: JSON.stringify(input) }),
  updateModalityHours: (businessId: string, modalityId: string, hours: ModalityHour[]) => requestJson<{ modality: RealModality }>(`/businesses/${encodeURIComponent(businessId)}/modalities/${encodeURIComponent(modalityId)}/hours`, { method: 'PUT', body: JSON.stringify({ hours }) }),
  activateModality: (businessId: string, modalityId: string) => requestJson<{ modality: RealModality }>(`/businesses/${encodeURIComponent(businessId)}/modalities/${encodeURIComponent(modalityId)}/activate`, { method: 'POST' }),
  pauseModality: (businessId: string, modalityId: string) => requestJson<{ modality: RealModality }>(`/businesses/${encodeURIComponent(businessId)}/modalities/${encodeURIComponent(modalityId)}/pause`, { method: 'POST' }),
  reactivateModality: (businessId: string, modalityId: string) => requestJson<{ modality: RealModality }>(`/businesses/${encodeURIComponent(businessId)}/modalities/${encodeURIComponent(modalityId)}/reactivate`, { method: 'POST' }),
  retireModality: (businessId: string, modalityId: string) => requestJson<{ modality: RealModality }>(`/businesses/${encodeURIComponent(businessId)}/modalities/${encodeURIComponent(modalityId)}/retire`, { method: 'POST' }),
  listPhotos: (businessId: string) => requestJson<{ photos: RealPhoto[] }>(`/businesses/${encodeURIComponent(businessId)}/photos`),
  uploadPhoto: (businessId: string, file: File, cover = false) => { const form = new FormData(); form.append('file', file); form.append('cover', String(cover)); return requestMultipart<{ photo: RealPhoto }>(`/businesses/${encodeURIComponent(businessId)}/photos`, form); },
  uploadOfferPhoto: (businessId: string, offerId: string, file: File) => { const form = new FormData(); form.append('file', file); form.append('offerId', offerId); return requestMultipart<{ photo: RealPhoto }>(`/businesses/${encodeURIComponent(businessId)}/photos`, form); },
  uploadCoverPhoto: (businessId: string, file: File, position: { x: number; y: number }) => { const form = new FormData(); form.append('file', file); form.append('positionX', String(position.x)); form.append('positionY', String(position.y)); return requestMultipart<{ photo: RealPhoto }>(`/businesses/${encodeURIComponent(businessId)}/cover-photo`, form); },
  setProfilePhoto: (businessId: string, photoId: string | null, position: { x: number; y: number }) => requestJson<{ photo: RealPhoto | null }>(`/businesses/${encodeURIComponent(businessId)}/profile-photo`, { method: 'PUT', body: JSON.stringify({ photoId, positionX: position.x, positionY: position.y }) }),
  deletePhoto: (businessId: string, photoId: string) => requestJson<void>(`/businesses/${encodeURIComponent(businessId)}/photos/${encodeURIComponent(photoId)}`, { method: 'DELETE' }),
  setPhotoCover: (businessId: string, photoId: string) => requestJson<{ photo: RealPhoto }>(`/businesses/${encodeURIComponent(businessId)}/photos/${encodeURIComponent(photoId)}/cover`, { method: 'POST' }),
  clearCoverPhoto: (businessId: string) => requestJson<void>(`/businesses/${encodeURIComponent(businessId)}/cover-photo`, { method: 'DELETE' }),
  photoBlob: (url: string) => requestPhotoBlob(url),
};
