import { BusinessApiError, buildApiUrl, configureAccessTokenProvider, configureUnauthorizedHandler, requestJson } from "./businessApiClient";

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
};

type AuthResponse = { user: BusinessAuthUser; accessToken: string };
type RegisterResponse = { user: BusinessAuthUser };
type SessionPreference = { rememberMe: boolean };

export type BusinessSessionState =
  | { status: "unchecked" }
  | { status: "authenticated"; user: BusinessAuthUser }
  | { status: "unauthenticated" }
  | { status: "error"; error: unknown };

const REMEMBER_SESSION_KEY = "xamuko-business-remember-session";
const LAST_EMAIL_KEY = "xamuko-business-last-email";
let accessToken: string | null = null;
let refreshInFlight: Promise<BusinessAuthUser> | null = null;
let refreshBlockedUntil = 0;
let refreshBlockError: BusinessApiError | null = null;
let sessionState: BusinessSessionState = { status: "unchecked" };

configureAccessTokenProvider(() => accessToken);
configureUnauthorizedHandler(async () => {
  try {
    await refreshSession();
    return true;
  } catch {
    return false;
  }
});

function storage(): Storage | undefined {
  return typeof window === "undefined" ? undefined : window.localStorage;
}

function readRememberMe(): boolean {
  return storage()?.getItem(REMEMBER_SESSION_KEY) === "1";
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
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/mis-negocios";
  try {
    const path = new URL(value, "http://xamuko-business.local").pathname;
    if (["/login", "/registro", "/recuperar", "/bienvenida"].includes(path)) return "/mis-negocios";
  } catch {
    return "/mis-negocios";
  }
  return value;
}

export async function updateProfile(input: { name: string; nickname?: string; avatarUrl?: string | null }): Promise<BusinessAuthUser> {
  const result = await requestJson<{ user: BusinessAuthUser }>("/auth/me", { method: "PATCH", body: JSON.stringify(input), ...withAuthorization() });
  sessionState = { status: "authenticated", user: result.user };
  return result.user;
}

export async function uploadAvatar(file: File): Promise<void> {
  const form = new FormData(); form.append("file", file);
  const response = await fetch(buildApiUrl("/auth/me/avatar"), { method: "POST", body: form, credentials: "include", headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined });
  if (!response.ok) throw new Error("No se pudo guardar la foto de perfil.");
}
export async function getAvatarBlob(path = "/api/v1/auth/me/avatar"): Promise<Blob> {
  const response = await fetch(buildApiUrl(path), { credentials: "include", headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined });
  if (!response.ok) throw new Error("No se pudo cargar la foto de perfil.");
  return response.blob();
}

export async function register(name: string, email: string, password: string): Promise<BusinessAuthUser> {
  const result = await requestJson<RegisterResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ name, email, password }),
  });
  return result.user;
}

export async function login(email: string, password: string, rememberMe = false): Promise<BusinessAuthUser> {
  const result = await requestJson<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password, rememberMe }),
  });
  accessToken = result.accessToken;
  saveSessionPreference(email, rememberMe);
  const confirmed = (await requestJson<{ user: BusinessAuthUser }>("/auth/me", withAuthorization())).user;
  sessionState = { status: "authenticated", user: confirmed };
  return confirmed;
}

export async function refreshSession(): Promise<BusinessAuthUser> {
  if (refreshInFlight) return refreshInFlight;
  if (Date.now() < refreshBlockedUntil && refreshBlockError) throw refreshBlockError;
  refreshInFlight = requestJson<AuthResponse>("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ rememberMe: readRememberMe() } satisfies SessionPreference),
  })
    .then((result) => {
      accessToken = result.accessToken;
      refreshBlockedUntil = 0;
      refreshBlockError = null;
      sessionState = { status: "authenticated", user: result.user };
      return result.user;
    })
    .catch((error: unknown) => {
      if (error instanceof BusinessApiError && error.status === 429 && error.retryAfterSeconds) {
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
  try {
    const user = await refreshSession();
    sessionState = { status: "authenticated", user };
    return sessionState;
  } catch (error) {
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
    rememberMe: options.rememberMe ? "1" : "0",
    consent: options.consent ? "1" : "0",
  });
  if (options.returnTo) params.set("next", options.returnTo);
  window.location.assign(`${buildApiUrl("/auth/google/start")}?${params.toString()}`);
}

export async function logout(): Promise<void> {
  try {
    await requestJson<void>("/auth/logout", { method: "POST", body: "{}" });
  } finally {
    accessToken = null;
    const localStorage = storage();
    localStorage?.removeItem(REMEMBER_SESSION_KEY);
    localStorage?.removeItem(LAST_EMAIL_KEY);
    sessionState = { status: "unauthenticated" };
  }
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
  if (result.accessToken) accessToken = result.accessToken;
  return { autoLogin: Boolean(result.accessToken) && result.autoLogin !== false };
}

export function clearAccessToken(): void {
  accessToken = null;
  sessionState = { status: "unauthenticated" };
}
