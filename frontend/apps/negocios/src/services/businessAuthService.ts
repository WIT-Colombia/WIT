import { normalizeImageForUpload } from "@wit/utils";
import { BusinessApiError, buildApiUrl, configureAccessTokenProvider, configureUnauthorizedHandler, requestJson, requestPhotoBlob } from "./businessApiClient";

export type BusinessAuthUser = {
  id: string;
  publicId: string;
  displayName: string;
  nickname: string | null;
  emailNormalized: string | null;
  avatarUrl: string | null;
  locale: string;
  status: "ACTIVE" | "SUSPENDED" | "DELETED";
  emailVerified: boolean;
  authProviders: string[];
  verificationEmailSent?: boolean;
  verificationExpiresAt?: string;
};

type AuthResponse = { user: BusinessAuthUser; accessToken: string };
export type PendingBusinessRegistration = {
  email: string;
  verificationExpiresAt: string;
  verificationEmailSent: boolean;
};
type RegisterResponse = { pending: PendingBusinessRegistration };

export type BusinessSessionState =
  | { status: "unchecked" }
  | { status: "authenticated"; user: BusinessAuthUser }
  | { status: "unauthenticated" }
  | { status: "error"; error: unknown };

const REMEMBER_SESSION_KEY = "xamuko-business-remember-session";
const LAST_EMAIL_KEY = "xamuko-business-last-email";
let accessToken: string | null = null;
let refreshInFlight: Promise<BusinessAuthUser> | null = null;
let sessionRevision = 0;
function adoptAccessToken(token: string): void {
  sessionRevision += 1;
  accessToken = token;
}
let refreshBlockedUntil = 0;
let refreshBlockError: BusinessApiError | null = null;
let sessionState: BusinessSessionState = { status: "unchecked" };

configureAccessTokenProvider(() => accessToken);
configureUnauthorizedHandler(async () => {
  try {
    await refreshSession();
    return true;
  } catch (error) {
    // A failed connection or rate limit is not proof of a revoked session.
    throw error;
  }
});

function storage(): Storage | undefined {
  return typeof window === "undefined" ? undefined : window.localStorage;
}

function saveSessionPreference(email: string, rememberMe: boolean): void {
  const localStorage = storage();
  if (!localStorage) return;
  if (rememberMe) {
    localStorage.setItem(REMEMBER_SESSION_KEY, "1");
    localStorage.setItem(LAST_EMAIL_KEY, email);
  } else {
    localStorage.removeItem(REMEMBER_SESSION_KEY);
    localStorage.removeItem(LAST_EMAIL_KEY);
  }
}

function withAuthorization(init: RequestInit = {}): RequestInit {
  const headers = new Headers(init.headers);
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  return { ...init, headers };
}

export function getRememberedEmail(): string {
  return storage()?.getItem(LAST_EMAIL_KEY) ?? "";
}

export function getSessionState(): BusinessSessionState {
  return sessionState;
}

export function resolveBusinessNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/inicio";
  try {
    const path = new URL(value, "http://xamuko-business.local").pathname;
    if (["/login", "/registro", "/recuperar", "/bienvenida"].includes(path)) return "/inicio";
  } catch {
    return "/inicio";
  }
  return value;
}

export async function updateProfile(input: { name: string; nickname?: string; avatarUrl?: string | null }): Promise<BusinessAuthUser> {
  const result = await requestJson<{ user: BusinessAuthUser }>("/auth/me", { method: "PATCH", body: JSON.stringify(input), ...withAuthorization() });
  sessionState = { status: "authenticated", user: result.user };
  return result.user;
}

export async function uploadAvatar(file: File): Promise<void> {
  const normalized = await normalizeImageForUpload(file);
  const form = new FormData();
  form.append("file", normalized);
  const send = () => fetch(buildApiUrl("/auth/me/avatar"), {
    method: "POST",
    body: form,
    credentials: "include",
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  });
  let response = await send();
  if (response.status === 401) {
    await refreshSession();
    response = await send();
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: { code?: string; message?: string } } | null;
    throw new BusinessApiError(response.status, payload?.error?.code ?? "AVATAR_UPLOAD_FAILED", payload?.error?.message ?? "No se pudo guardar la foto de perfil.");
  }
}

export function getAvatarBlob(path = "/api/v1/auth/me/avatar"): Promise<Blob> {
  return requestPhotoBlob(path);
}

export async function isVerifiedFirstRegistrationAvailable(): Promise<boolean> {
  try {
    const response = await fetch(buildApiUrl("/auth/registration-policy"), {
      credentials: "include", headers: { Accept: "application/json" }, cache: "no-store",
    });
    if (!response.ok) return false;
    const policy = await response.json() as { emailVerificationRequiredBeforeCreation?: boolean };
    return policy.emailVerificationRequiredBeforeCreation === true;
  } catch {
    return false;
  }
}

export async function register(name: string, email: string, password: string): Promise<PendingBusinessRegistration> {
  if (!(await isVerifiedFirstRegistrationAvailable())) {
    throw new BusinessApiError(503, "REGISTRATION_UPGRADE_PENDING", "Estamos actualizando el registro seguro por correo. Intenta nuevamente más tarde.");
  }
  const result = await requestJson<RegisterResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ name, email, password }),
  });
  return result.pending;
}

export async function login(email: string, password: string, rememberMe = false): Promise<BusinessAuthUser> {
  const result = await requestJson<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password, rememberMe }),
  });
  adoptAccessToken(result.accessToken);
  saveSessionPreference(email, rememberMe);
  const confirmed = (await requestJson<{ user: BusinessAuthUser }>("/auth/me", withAuthorization())).user;
  sessionState = { status: "authenticated", user: confirmed };
  return confirmed;
}

export async function refreshSession(): Promise<BusinessAuthUser> {
  if (refreshInFlight) return refreshInFlight;
  if (Date.now() < refreshBlockedUntil && refreshBlockError) throw refreshBlockError;
  const revision = sessionRevision;
  refreshInFlight = requestJson<AuthResponse>("/auth/refresh", {
    method: "POST",
    body: "{}",
  })
    .then((result) => {
      if (revision === sessionRevision) {
        accessToken = result.accessToken;
        refreshBlockedUntil = 0;
        refreshBlockError = null;
        sessionState = { status: "authenticated", user: result.user };
      }
      return result.user;
    })
    .catch((error: unknown) => {
      if (revision === sessionRevision && error instanceof BusinessApiError && error.status === 429 && error.retryAfterSeconds) {
        refreshBlockedUntil = Date.now() + error.retryAfterSeconds * 1000;
        refreshBlockError = error;
      }
      throw error;
    })
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

export async function getMe(): Promise<BusinessAuthUser> {
  try {
    return (await requestJson<{ user: BusinessAuthUser }>("/auth/me", withAuthorization())).user;
  } catch (error) {
    if (!(error instanceof BusinessApiError) || error.status !== 401) throw error;
    const refreshed = await refreshSession();
    return (await requestJson<{ user: BusinessAuthUser }>("/auth/me", withAuthorization())).user ?? refreshed;
  }
}

export async function restoreSession(): Promise<BusinessSessionState> {
  const revision = sessionRevision;
  try {
    const user = await refreshSession();
    if (revision !== sessionRevision) return sessionState;
    sessionState = { status: "authenticated", user };
    return sessionState;
  } catch (error) {
    if (revision !== sessionRevision) return sessionState;
    if (error instanceof BusinessApiError && error.status === 401) {
      sessionState = { status: "unauthenticated" };
      return sessionState;
    }
    sessionState = { status: "error", error };
    return sessionState;
  }
}

export function startGoogleLogin(options: { returnTo?: string; consent?: boolean; rememberMe?: boolean } = {}): void {
  const params = new URLSearchParams({
    application: "negocios",
    rememberMe: options.rememberMe ? "1" : "0",
    consent: options.consent ? "1" : "0",
  });
  if (options.returnTo) params.set("next", options.returnTo);
  window.location.assign(`${buildApiUrl("/auth/google/start")}?${params.toString()}`);
}

export async function logout(): Promise<void> {
  await refreshInFlight?.catch(() => undefined);
  await requestJson<void>("/auth/logout", { method: "POST", body: "{}" });
  {
    sessionRevision += 1;
    accessToken = null;
    const localStorage = storage();
    localStorage?.removeItem(REMEMBER_SESSION_KEY);
    localStorage?.removeItem(LAST_EMAIL_KEY);
    sessionState = { status: "unauthenticated" };
  }
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await requestJson<void>('/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }), ...withAuthorization() });
}

export function applyEmailConfirmationResult(result: { user: BusinessAuthUser; accessToken?: string; autoLogin?: boolean }): { user: BusinessAuthUser; autoLogin: boolean } {
  const hasValidAccessToken = typeof result.accessToken === "string" && result.accessToken.trim().length > 0;
  const autoLogin = hasValidAccessToken && result.autoLogin !== false;
  sessionRevision += 1;
  if (autoLogin) {
    accessToken = result.accessToken as string;
    sessionState = { status: "authenticated", user: result.user };
  } else {
    accessToken = null;
    sessionState = { status: "unauthenticated" };
  }
  return { user: result.user, autoLogin };
}

export async function confirmEmail(token: string): Promise<{ user: BusinessAuthUser; autoLogin: boolean }> {
  const result = await requestJson<{ user: BusinessAuthUser; accessToken?: string; autoLogin?: boolean }>('/auth/verify-email/confirm', { method: 'POST', body: JSON.stringify({ token }) });
  return applyEmailConfirmationResult(result);
}

export async function requestVerification(email: string): Promise<{ message: string; verificationExpiresAt?: string }> {
  return requestJson<{ message: string; verificationExpiresAt?: string }>('/auth/verify-email/request', {
    method: 'POST', body: JSON.stringify({ email }),
  });
}

export async function requestPasswordReset(email: string): Promise<string> {
  const result = await requestJson<{ message: string }>("/auth/password-reset/request", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
  return result.message;
}

export async function confirmPasswordReset(token: string, password: string, rememberMe = false): Promise<{ autoLogin: boolean }> {
  const result = await requestJson<{ accessToken?: string; autoLogin?: boolean }>("/auth/password-reset/confirm", {
    method: "POST",
    body: JSON.stringify({ token, password, rememberMe }),
  });
  if (result.accessToken) adoptAccessToken(result.accessToken);
  return { autoLogin: Boolean(result.accessToken) && result.autoLogin !== false };
}

export function clearAccessToken(): void {
  sessionRevision += 1;
  accessToken = null;
  sessionState = { status: "unauthenticated" };
}
