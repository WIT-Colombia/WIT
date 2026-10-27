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
export type AnalyticsOfferRanking = {
  offerId: string;
  code: string | null;
  name: string;
  kind: 'PRODUCT' | 'SERVICE' | null;
  value: number;
  photoUrl?: string | null;
};
export type BusinessAnalyticsSummary = {
  period: string;
  timezone: string;
  window: { start: string | null; end: string };
  metrics: {
    businessViews: number;
    searchAppearances: number;
    whatsappClicks: number;
    phoneClicks: number;
    promotionViews: number;
    currentFavorites: number;
    reviewsCount: number;
    averageRating: number | null;
  };
  series: {
    visits: Array<{ date: string; value: number }>;
    hourlyActivity: Array<{ hour: number; value: number }>;
    weekdayActivity: Array<{ weekday: number; value: number }>;
    ratings: Array<{ date: string; average: number | null; count: number }>;
    favoriteAcquisitions: Array<{ date: string; value: number }>;
  };
  rankings: {
    offerLikes: AnalyticsOfferRanking[];
    leastLikedOffers: Array<AnalyticsOfferRanking & { createdAt: string; eligibleSince: string; observedDays: number }>;
    mostViewedPromotions: Array<{ promotionId: string; title: string; value: number }>;
  };
  definitions: Record<'visits' | 'activity' | 'ratings' | 'favorites' | 'offerLikes' | 'leastLikedOffers' | 'promotionViews', string>;
};
export type BusinessStatisticsDashboard = {
  period: 'day' | 'week' | 'month' | 'year' | 'all';
  timezone: string;
  window: { start: string | null; end: string };
  access: { referralCount: number; referralGoal: number; nextLevel: string | null; nextLevelMinimum: number | null; unlockedReferralStatistics: number; referralsUnlocked: boolean; proUnlocked: boolean };
  metrics: { businessViews: number; searchAppearances: number; whatsappClicks: number; phoneClicks: number; directionsClicks: number; currentFavorites: number };
  previous: { businessViews: number; searchAppearances: number; whatsappClicks: number; phoneClicks: number; directionsClicks: number } | null;
  trends: Record<'businessViews' | 'searchAppearances' | 'whatsappClicks' | 'phoneClicks' | 'directionsClicks', Array<{ label: string; value: number }>>;
  referral?: { offerLikes?: number; reviewsCount?: number; averageRating?: number | null; ratingCount?: number };
  pro?: {
    contactRate: number | null;
    hourlyActivity: Array<{ label: string; value: number }>;
    weekdayActivity: Array<{ label: string; value: number }>;
    promotionViews: number;
    mostViewedPromotions: Array<{ id: string; title: string; value: number }>;
    ratingEvolution: Array<{ label: string; value: number }>;
    favoriteAcquisitions: Array<{ label: string; value: number }>;
  };
};
export type OfferViewRanking = {
  period: 'day' | 'week' | 'month' | 'year' | 'all';
  timezone: string;
  window: { start: string | null; end: string };
  offers: Array<{ offerId: string; name: string; kind: 'PRODUCT' | 'SERVICE'; value: number }>;
};
export type BusinessReviewsResponse = { reviews: BusinessReview[]; pagination: { page: number; pageSize: number; total: number; totalPages: number }; summary: { average: number | null; total: number; distribution: Record<string, number> } };
export type RealOffer = { id: string; businessId: string; internalCode: string; kind: 'PRODUCT' | 'SERVICE'; name: string; description: string | null; category: string | null; priceAmount: string | null; currency: string | null; priceText: string | null; negotiable: boolean; active: boolean; adultOnly: boolean; publicationStatus: 'UNPUBLISHED' | 'PUBLISHED' | 'REVIEW'; photos: RealPhoto[] };
export type BusinessPromotion = { id: string; businessId: string; type: 'OFFER' | 'PROMOTION'; title: string; description: string; conditions: string | null; category: string | null; relatedOfferId: string | null; originalPrice: string | null; promotionalPrice: string | null; startsAt: string; endsAt: string; recurrence: 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY'; recurrenceUntil: string | null; active: boolean; state: 'SCHEDULED' | 'ACTIVE' | 'FINISHED'; viewCount: number; photos: Array<{ id: string; url: string; sortOrder: number }> };
export type PromotionLimits = { plan: 'BASIC' | 'PRO'; maxActive: number; activeCount: number; maxPhotos: number; canSchedule: boolean; canRecur: boolean; summary: { active: number; scheduled: number; finished: number; totalViews: number }; detailedAnalytics: boolean };

export type RealBusiness = {
  id: string;
  publicId: string;
  businessAccountId: string;
  name: string;
  pioneerNumber: number | null;
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

export type BusinessMembership = { id:string; businessId:string; userId:string; role:'OWNER'|'COLLABORATOR'; status:'INVITED'|'ACTIVE'|'SUSPENDED'|'REJECTED'|'REVOKED'|'EXPIRED'; invitedAt:string; acceptedAt:string|null; expiresAt:string|null; user:{id:string;displayName:string;nickname:string|null;emailNormalized:string|null;avatarUrl:string|null;lastLoginAt:string|null}; permissions:Array<{permission:string;allowed:boolean}> };
export type ResolvedCollaboratorRecipient = { publicId:string; displayName:string; nickname:string; avatarUrl:string|null };
export type PersistedBusinessNotification = {id:string;userId:string;businessId:string;membershipId:string|null;type:'COLLABORATION_INVITATION'|'COLLABORATION_UPDATE';title:string;message:string;readAt:string|null;createdAt:string;business:{id:string;name:string;profilePhoto:{url:string}|null;memberships:Array<{user:{displayName:string}}>};membership:{id:string;status:string;expiresAt:string|null;permissions:Array<{permission:string;allowed:boolean}>}|null};

export type ModalityType = "PHYSICAL" | "VIRTUAL" | "DELIVERY";
export type ModalityStatus = "CONFIGURING" | "ACTIVE" | "PAUSED";
export type ModalityContact = { email: string | null; website: string | null; phone: string | null; whatsapp: string | null; instagram?: string | null };
export type ModalityHour = { dayOfWeek: number; isClosed: boolean; opensAt: string | null; closesAt: string | null; timezone: string };
export type RealModality = { id: string; businessId: string; type: ModalityType; status: ModalityStatus; contact: ModalityContact | null; effectiveContact?: ModalityContact; blockers?: string[]; hours: ModalityHour[] };
export type BusinessVisibility = { businessId: string; publicId: string; visibilityStatus: string; createdAt: string; isWithinPeriod: boolean; period: { id: string; kind: string; startsAt: string; expiresAt: string; requestedAt: string } | null };

export const businessApi = {
  listCollaborators: (businessId:string) => requestJson<{memberships:BusinessMembership[]}>(`/businesses/${encodeURIComponent(businessId)}/collaborators`),
  resolveCollaboratorRecipient: (businessId:string, nickname:string) => requestJson<{recipient:ResolvedCollaboratorRecipient}>(`/businesses/${encodeURIComponent(businessId)}/collaborators/resolve`,{method:'POST',body:JSON.stringify({nickname})}),
  inviteCollaborator: (businessId:string, identifier:string, permissions:string[]) => requestJson<{membership:BusinessMembership}>(`/businesses/${encodeURIComponent(businessId)}/collaborators/invitations`,{method:'POST',body:JSON.stringify({identifier,permissions})}),
  updateCollaboratorPermissions: (membershipId:string,permissions:string[]) => requestJson(`/memberships/${encodeURIComponent(membershipId)}/permissions`,{method:'PUT',body:JSON.stringify({permissions})}),
  suspendCollaborator: (membershipId:string) => requestJson(`/memberships/${encodeURIComponent(membershipId)}/suspend`,{method:'POST'}),
  reactivateCollaborator: (membershipId:string) => requestJson(`/memberships/${encodeURIComponent(membershipId)}/reactivate`,{method:'POST'}),
  revokeCollaborator: (membershipId:string) => requestJson(`/memberships/${encodeURIComponent(membershipId)}/revoke`,{method:'POST'}),
  cancelCollaboratorInvitation: (membershipId:string) => requestJson(`/memberships/${encodeURIComponent(membershipId)}/cancel`,{method:'POST'}),
  leaveBusiness: (businessId:string) => requestJson(`/businesses/${encodeURIComponent(businessId)}/leave`,{method:'POST'}),
  respondCollaboratorInvitation: (membershipId:string,accept:boolean) => requestJson(`/memberships/${encodeURIComponent(membershipId)}/${accept?'accept':'reject'}`,{method:'POST'}),
  listBusinessNotifications: () => requestJson<{notifications:PersistedBusinessNotification[]}>('/notifications'),
  markBusinessNotificationRead: (id:string) => requestJson(`/notifications/${encodeURIComponent(id)}/read`,{method:'POST'}),
  list: () => requestJson<{ businesses: RealBusiness[] }>('/businesses'),
  categories: () => requestJson<{ categories: Array<{ id: string; code: string; translations: Array<{ name: string }> }> }>('/business-categories'),
  create: (input: Record<string, unknown>) => requestJson<{ business: RealBusiness }>('/businesses', { method: 'POST', body: JSON.stringify(input) }),
  get: (businessId: string) => requestJson<{ business: RealBusiness }>(`/businesses/${encodeURIComponent(businessId)}`),
  getReferralSummary: (businessId: string) => requestJson<{ referralSummary: BusinessReferralSummary }>(`/businesses/${encodeURIComponent(businessId)}/referral-summary`),
  getCatalogLimits: (businessId: string) => requestJson<CatalogLimits>(`/businesses/${encodeURIComponent(businessId)}/catalog-limits`),
  getFavoriteCount: (businessId: string) => requestJson<{ count: number }>(`/businesses/${encodeURIComponent(businessId)}/favorites/count`),
  getStatisticsDashboard: (businessId: string, period: string, signal?: AbortSignal) => requestJson<BusinessStatisticsDashboard>(`/businesses/${encodeURIComponent(businessId)}/analytics?period=${encodeURIComponent(period)}`, { signal }),
  getOfferViewRanking: (businessId: string, period: string, signal?: AbortSignal) => requestJson<OfferViewRanking>(`/businesses/${encodeURIComponent(businessId)}/analytics/offer-views?period=${encodeURIComponent(period)}`, { signal }),
  getOfferLikeCounts: (businessId: string) => requestJson<{ offers: Array<{ offerId: string; likeCount: number }> }>(`/businesses/${encodeURIComponent(businessId)}/offers/likes`),
  listReviews: (businessId: string, page = 1, pageSize = 50) => requestJson<BusinessReviewsResponse>(`/public/businesses/${encodeURIComponent(businessId)}/reviews?page=${page}&pageSize=${pageSize}`),
  saveReviewResponse: (reviewId: string, body: string, edit = false) => requestJson<{ response: BusinessReview['response'] }>(`/reviews/${encodeURIComponent(reviewId)}/response`, { method: edit ? 'PATCH' : 'POST', body: JSON.stringify({ body }) }),
  reportReview: (reviewId: string, reason: string, description?: string) => requestJson<{ report: unknown }>(`/reviews/${encodeURIComponent(reviewId)}/reports`, { method: 'POST', body: JSON.stringify({ reason, description }) }),
  listOffers: (businessId: string, kind?: 'PRODUCT' | 'SERVICE', query?: string) => requestJson<{ offers: RealOffer[] }>(`/businesses/${encodeURIComponent(businessId)}/offers?${new URLSearchParams({ ...(kind ? { kind } : {}), ...(query ? { q: query } : {}) }).toString()}`),
  createOffer: (businessId: string, input: Record<string, unknown>) => requestJson<{ offer: RealOffer }>(`/businesses/${encodeURIComponent(businessId)}/offers`, { method: 'POST', body: JSON.stringify(input) }),
  updateOffer: (businessId: string, offerId: string, input: Record<string, unknown>) => requestJson<{ offer: RealOffer }>(`/businesses/${encodeURIComponent(businessId)}/offers/${encodeURIComponent(offerId)}`, { method: 'PATCH', body: JSON.stringify(input) }),
  deleteOffer: (businessId: string, offerId: string) => requestJson<void>(`/businesses/${encodeURIComponent(businessId)}/offers/${encodeURIComponent(offerId)}`, { method: 'DELETE' }),
  listPromotions: (businessId: string) => requestJson<{ promotions: BusinessPromotion[]; limits: PromotionLimits }>(`/businesses/${encodeURIComponent(businessId)}/promotions`),
  createPromotion: (businessId: string, input: Record<string, unknown>) => requestJson<{ promotion: BusinessPromotion }>(`/businesses/${encodeURIComponent(businessId)}/promotions`, { method: 'POST', body: JSON.stringify(input) }),
  updatePromotion: (businessId: string, promotionId: string, input: Record<string, unknown>) => requestJson<{ promotion: BusinessPromotion }>(`/businesses/${encodeURIComponent(businessId)}/promotions/${encodeURIComponent(promotionId)}`, { method: 'PATCH', body: JSON.stringify(input) }),
  finishPromotion: (businessId: string, promotionId: string) => requestJson<{ promotion: BusinessPromotion }>(`/businesses/${encodeURIComponent(businessId)}/promotions/${encodeURIComponent(promotionId)}/finish`, { method: 'POST' }),
  deletePromotion: (businessId: string, promotionId: string) => requestJson<void>(`/businesses/${encodeURIComponent(businessId)}/promotions/${encodeURIComponent(promotionId)}`, { method: 'DELETE' }),
  uploadPromotionPhoto: (businessId: string, promotionId: string, file: File) => { const form = new FormData(); form.append('file', file); return requestMultipart<{ photo: RealPhoto }>(`/businesses/${encodeURIComponent(businessId)}/promotions/${encodeURIComponent(promotionId)}/photos`, form); },
  deletePromotionPhoto: (businessId: string, promotionId: string, photoId: string) => requestJson<void>(`/businesses/${encodeURIComponent(businessId)}/promotions/${encodeURIComponent(promotionId)}/photos/${encodeURIComponent(photoId)}`, { method: 'DELETE' }),
  update: (businessId: string, input: Record<string, unknown>) => requestJson<{ business: RealBusiness }>(`/businesses/${encodeURIComponent(businessId)}`, { method: 'PATCH', body: JSON.stringify(input) }),
  publishBusiness: (businessId: string) => requestJson<{ business: RealBusiness }>(`/businesses/${encodeURIComponent(businessId)}/publish`, { method: 'POST' }),
  getVisibility: (businessId: string) => requestJson<{ visibility: BusinessVisibility }>(`/businesses/${encodeURIComponent(businessId)}/visibility`),
  renewVisibility: (businessId: string) => requestJson<{ visibility: BusinessVisibility }>(`/businesses/${encodeURIComponent(businessId)}/visibility/renew`, { method: 'POST' }),
  setVisibility: (businessId: string, visible: boolean) => requestJson<{ visibility: BusinessVisibility }>(`/businesses/${encodeURIComponent(businessId)}/visibility`, { method: 'POST', body: JSON.stringify({ visible }) }),
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
  setPhotoCover: (businessId: string, photoId: string, position: { x: number; y: number }) => requestJson<{ photo: RealPhoto }>(`/businesses/${encodeURIComponent(businessId)}/photos/${encodeURIComponent(photoId)}/cover`, { method: 'POST', body: JSON.stringify({ positionX: position.x, positionY: position.y }) }),
  resolveTransferRecipient: (businessId: string, nickname: string) => requestJson<{ recipient: { id: string; nickname: string; displayName: string } }>(`/businesses/${encodeURIComponent(businessId)}/ownership-transfers/resolve`, { method: 'POST', body: JSON.stringify({ nickname }) }),
  requestOwnershipTransfer: (businessId: string, recipientId: string) => requestJson<{ transfer: { id: string; expiresAt: string | null } }>(`/businesses/${encodeURIComponent(businessId)}/ownership-transfers`, { method: 'POST', body: JSON.stringify({ recipientId }) }),
  listReceivedOwnershipTransfers: () => requestJson<{ transfers: Array<{ id: string; status: string; expiresAt: string | null; requestedAt: string; business: { id: string; name: string }; fromUser: { displayName: string; nickname: string | null } }> }>('/ownership-transfers/received'),
  listSentOwnershipTransfers: (businessId: string) => requestJson<{ transfers: Array<{ id: string; status: string; expiresAt: string | null; requestedAt: string; toUser: { displayName: string; nickname: string | null } }> }>(`/businesses/${encodeURIComponent(businessId)}/ownership-transfers/sent`),
  respondOwnershipTransfer: (transferId: string, accept: boolean) => requestJson(`/ownership-transfers/${encodeURIComponent(transferId)}/respond`, { method: 'POST', body: JSON.stringify({ accept }) }),
  cancelOwnershipTransfer: (transferId: string) => requestJson(`/ownership-transfers/${encodeURIComponent(transferId)}/cancel`, { method: 'POST' }),
  clearCoverPhoto: (businessId: string) => requestJson<void>(`/businesses/${encodeURIComponent(businessId)}/cover-photo`, { method: 'DELETE' }),
  getVerification: (businessId: string) => requestJson<{ verification: { businessId: string; status: string; businessNameAtRequest?: string; documentSizeBytes?: number; documentDeletionStatus?: string; requestedAt?: string; updatedAt?: string; resolvedAt?: string | null } }>(`/businesses/${encodeURIComponent(businessId)}/verification`),
  submitVerification: (businessId: string, file: File) => { const form = new FormData(); form.append('file', file); return requestMultipart<{ verification: unknown }>(`/businesses/${encodeURIComponent(businessId)}/verification`, form); },
  replaceVerification: (businessId: string, file: File) => { const form = new FormData(); form.append('file', file); return requestMultipart<{ verification: unknown }>(`/businesses/${encodeURIComponent(businessId)}/verification/document`, form, 'PUT'); },
  photoBlob: (url: string) => requestPhotoBlob(url),
};
