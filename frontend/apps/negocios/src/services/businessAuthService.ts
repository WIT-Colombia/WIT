import { BusinessApiError, buildApiUrl, configureAccessTokenProvider, configureUnauthorizedHandler, requestJson } from "./businessApiClient";

export type BusinessAuthUser = {
  id: string;
  publicId: string;
  displayName: string;
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
  refreshInFlight = requestJson<AuthResponse>("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ rememberMe: readRememberMe() } satisfies SessionPreference),
  })
    .then((result) => {
      accessToken = result.accessToken;
      sessionState = { status: "authenticated", user: result.user };
      return result.user;
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

export function clearAccessToken(): void {
  accessToken = null;
  sessionState = { status: "unauthenticated" };
}
