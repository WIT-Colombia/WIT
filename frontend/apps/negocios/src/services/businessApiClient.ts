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
  if (init.body !== undefined && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
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

export type RealBusiness = {
  id: string;
  publicId: string;
  businessAccountId: string;
  name: string;
  slug: string;
  description: string | null;
  category: string | null;
  categoryId: string;
  secondaryCategories: Array<{ id: string; code: string }>;
  email: string | null;
  website: string | null;
  instagram: string | null;
  phone: string | null;
  whatsapp: string | null;
  completeness: number;
  lifecycleStatus: string;
  publicationStatus: string;
  visibilityStatus: string;
  verificationStatus: string;
  deletionStatus: string;
  role: string | null;
  permissions: string[];
  location: { countryCode: string; regionCode: string | null; regionName: string | null; cityName: string; zoneName: string | null; address: string; additionalAddressInfo: string | null; postalCode: string | null; latitude: string | null; longitude: string | null; visibility: string } | null;
  modalities: RealModality[];
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
  update: (businessId: string, input: Record<string, unknown>) => requestJson<{ business: RealBusiness }>(`/businesses/${encodeURIComponent(businessId)}`, { method: 'PATCH', body: JSON.stringify(input) }),
  listModalities: (businessId: string) => requestJson<{ modalities: RealModality[] }>(`/businesses/${encodeURIComponent(businessId)}/modalities`),
  createModality: (businessId: string, type: ModalityType) => requestJson<{ modality: RealModality }>(`/businesses/${encodeURIComponent(businessId)}/modalities`, { method: 'POST', body: JSON.stringify({ type }) }),
  updateModalityContact: (businessId: string, modalityId: string, input: Partial<ModalityContact>) => requestJson<{ modality: RealModality }>(`/businesses/${encodeURIComponent(businessId)}/modalities/${encodeURIComponent(modalityId)}/contact`, { method: 'PUT', body: JSON.stringify(input) }),
  updateModalityHours: (businessId: string, modalityId: string, hours: ModalityHour[]) => requestJson<{ modality: RealModality }>(`/businesses/${encodeURIComponent(businessId)}/modalities/${encodeURIComponent(modalityId)}/hours`, { method: 'PUT', body: JSON.stringify({ hours }) }),
  activateModality: (businessId: string, modalityId: string) => requestJson<{ modality: RealModality }>(`/businesses/${encodeURIComponent(businessId)}/modalities/${encodeURIComponent(modalityId)}/activate`, { method: 'POST' }),
  pauseModality: (businessId: string, modalityId: string) => requestJson<{ modality: RealModality }>(`/businesses/${encodeURIComponent(businessId)}/modalities/${encodeURIComponent(modalityId)}/pause`, { method: 'POST' }),
  reactivateModality: (businessId: string, modalityId: string) => requestJson<{ modality: RealModality }>(`/businesses/${encodeURIComponent(businessId)}/modalities/${encodeURIComponent(modalityId)}/reactivate`, { method: 'POST' }),
  retireModality: (businessId: string, modalityId: string) => requestJson<{ modality: RealModality }>(`/businesses/${encodeURIComponent(businessId)}/modalities/${encodeURIComponent(modalityId)}/retire`, { method: 'POST' }),
};
