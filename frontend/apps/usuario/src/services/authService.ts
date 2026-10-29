import { postPasswordOperation } from "@wit/utils";
import { ApiError, requestJson } from "./httpClient";

export type AuthUser = {
  emailVerified: boolean;
  authProviders: Array<"EMAIL" | "GOOGLE" | "APPLE">;
  verificationEmailSent?: boolean;
  id: string;
  publicId: string;
  displayName: string;
  nickname: string | null;
  emailNormalized: string | null;
  avatarUrl: string | null;
  locale: string;
  status: "ACTIVE" | "SUSPENDED" | "DELETED";
  adultContentPreference?: AdultContentPreference;
};

export type AdultContentPreference = {
  enabled: boolean;
  acceptedAt: string | null;
  conditionsVersion: string | null;
  revokedAt: string | null;
  ageVerified: boolean;
};

type AuthResponse = { user: AuthUser; accessToken: string };
type PasswordResetResponse = { user: AuthUser; accessToken?: string; autoLogin?: boolean };
type RegisterResponse = { user: AuthUser };
type Credentials = { email: string; password: string };
type MessageResponse = { message: string };

let accessToken: string | null = null;
let refreshInFlight: Promise<AuthUser> | null = null;
const REMEMBER_SESSION_KEY = "wit-auth-remember-session";
const LAST_EMAIL_KEY = "wit-auth-last-email";

function readRememberSession(): boolean {
  return window.localStorage.getItem(REMEMBER_SESSION_KEY) === "1";
}

export function getRememberedEmail(): string {
  return window.localStorage.getItem(LAST_EMAIL_KEY) ?? "";
}

export function startGoogleLogin(options: { returnTo?: string; consent?: boolean; rememberMe?: boolean } = {}): void {
  const params = new URLSearchParams({ application: "usuario", rememberMe: options.rememberMe ? "1" : "0", consent: options.consent ? "1" : "0" });
  if (options.returnTo) params.set("next", options.returnTo);
  window.location.assign(`/api/v1/auth/google/start?${params.toString()}`);
}

function saveSessionPreference(email: string, rememberMe: boolean): void {
  window.localStorage.setItem(REMEMBER_SESSION_KEY, rememberMe ? "1" : "0");
  if (rememberMe) window.localStorage.setItem(LAST_EMAIL_KEY, email);
  else window.localStorage.removeItem(LAST_EMAIL_KEY);
}

function withAuthorization(init: RequestInit = {}): RequestInit {
  const headers = new Headers(init.headers);
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  return { ...init, headers };
}

/** Uses the in-memory session token when one is available; it never persists it. */
export function requestWithSession<T>(path: string, init: RequestInit = {}): Promise<T> {
  return requestJson<T>(path, withAuthorization(init));
}

export async function requestBlobWithSession(path: string): Promise<Blob> {
  const send = () => fetch(path, { credentials: "include", headers: withAuthorization().headers });
  let response = await send();
  if (response.status === 401) {
    try {
      await refreshSession();
      response = await send();
    } catch {
      // The image can be public to guests; keep the original 401 if there is
      // no restorable session instead of turning it into an unhandled error.
    }
  }
  if (!response.ok) throw new ApiError(response.status, "PHOTO_LOAD_FAILED", "No se pudo cargar la fotografía.");
  return response.blob();
}

export async function register(name: string, credentials: Credentials): Promise<AuthUser> {
  const result = await requestJson<RegisterResponse>("/api/v1/auth/register", { method: "POST", body: JSON.stringify({ name, ...credentials }) });
  return result.user;
}

export async function login(credentials: Credentials, rememberMe = true): Promise<AuthUser> {
  const result = await requestJson<AuthResponse>("/api/v1/auth/login", { method: "POST", body: JSON.stringify({ ...credentials, rememberMe }) });
  accessToken = result.accessToken;
  saveSessionPreference(credentials.email, rememberMe);
  return result.user;
}

export async function refreshSession(): Promise<AuthUser> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = requestJson<AuthResponse>("/api/v1/auth/refresh", { method: "POST", body: JSON.stringify({ rememberMe: readRememberSession() }) })
    .then((result) => { accessToken = result.accessToken; return result.user; })
    .finally(() => { refreshInFlight = null; });
  return refreshInFlight;
}

export async function restoreSession(): Promise<AuthUser> {
  await refreshSession();
  return getMe();
}

export async function getMe(): Promise<AuthUser> {
  try {
    return (await requestJson<{ user: AuthUser }>("/api/v1/auth/me", withAuthorization())).user;
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;
    const refreshed = await refreshSession();
    return (await requestJson<{ user: AuthUser }>("/api/v1/auth/me", withAuthorization())).user ?? refreshed;
  }
}

export async function logout(): Promise<void> {
  try { await requestJson<void>("/api/v1/auth/logout", { method: "POST", body: "{}" }); }
  finally {
    accessToken = null;
    window.localStorage.removeItem(REMEMBER_SESSION_KEY);
    window.localStorage.removeItem(LAST_EMAIL_KEY);
  }
}

export type ProfileUpdate = { name: string; avatarUrl?: string | null };

export async function updateProfile(input: ProfileUpdate): Promise<AuthUser> {
  const result = await requestJson<{ user: AuthUser }>("/api/v1/auth/me", { method: "PATCH", body: JSON.stringify(input), ...withAuthorization() });
  return result.user;
}
export async function uploadAvatar(file: File): Promise<void> {
  const form = new FormData(); form.append("file", file);
  const response = await fetch("/api/v1/auth/me/avatar", { method: "POST", body: form, credentials: "include", headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined });
  if (!response.ok) throw new Error("No se pudo guardar la foto de perfil.");
}

const ADULT_CONTENT_CONDITIONS_VERSION = "2026-10-17";

export async function updateAdultContentPreference(enabled: boolean, conditionsVersion = ADULT_CONTENT_CONDITIONS_VERSION): Promise<AdultContentPreference> {
  const result = await requestWithSession<{ preference: AdultContentPreference }>("/api/v1/auth/me/adult-content", {
    method: "PATCH",
    body: JSON.stringify({ enabled, conditionsVersion }),
  });
  return result.preference;
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await postPasswordOperation<void>("/api/v1/auth/change-password", { currentPassword, newPassword }, "change", accessToken ?? undefined);
}

export async function requestPasswordReset(email: string): Promise<string> {
  const result = await postPasswordOperation<MessageResponse>("/api/v1/auth/password-reset/request", { email }, "request");
  return result.message;
}

export async function confirmPasswordReset(token: string, password: string, rememberMeOverride?: boolean): Promise<{ user: AuthUser; autoLogin: boolean }> {
  const result = await postPasswordOperation<PasswordResetResponse>("/api/v1/auth/password-reset/confirm", { token, password, rememberMe: rememberMeOverride ?? readRememberSession() }, "reset");
  if (result.accessToken) accessToken = result.accessToken;
  return { user: result.user, autoLogin: Boolean(result.accessToken) && result.autoLogin !== false };
}

export async function confirmEmail(token: string): Promise<{ user: AuthUser; autoLogin: boolean }> {
  const result = await requestJson<PasswordResetResponse>("/api/v1/auth/verify-email/confirm", { method: "POST", body: JSON.stringify({ token }) });
  if (result.accessToken) accessToken = result.accessToken;
  return { user: result.user, autoLogin: Boolean(result.accessToken) && result.autoLogin !== false };
}

export async function requestVerification(email: string): Promise<string> {
  const result = await requestJson<MessageResponse>("/api/v1/auth/verify-email/request", { method: "POST", body: JSON.stringify({ email }) });
  return result.message;
}

export function clearAccessToken(): void { accessToken = null; }


export type PreferredLocation = { city: string; region: string | null; country: string; name: string; latitude: number | null; longitude: number | null; mode: "MANUAL" | "GPS"; resolution: "PENDING" | "RESOLVED" | "UNAVAILABLE"; updatedAt: string | null };
export async function getPreferredLocation(): Promise<PreferredLocation | null> {
  return (await requestWithSession<{ location: PreferredLocation | null }>("/api/v1/auth/me/location")).location;
}
export async function savePreferredLocation(input: Omit<PreferredLocation, "updatedAt"> & { clientUpdatedAt?: number }): Promise<PreferredLocation | null> {
  return (await requestWithSession<{ location: PreferredLocation | null }>("/api/v1/auth/me/location", { method: "PUT", body: JSON.stringify(input) })).location;
}
