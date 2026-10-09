import { ApiError, requestJson } from "./httpClient";

export type AuthUser = {
  emailVerified: boolean;
  authProviders: Array<"EMAIL" | "GOOGLE" | "APPLE" | "FACEBOOK">;
  verificationEmailSent?: boolean;
  id: string;
  publicId: string;
  displayName: string;
  emailNormalized: string | null;
  avatarUrl: string | null;
  locale: string;
  status: "ACTIVE" | "SUSPENDED" | "DELETED";
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
  const params = new URLSearchParams({ rememberMe: options.rememberMe ? "1" : "0", consent: options.consent ? "1" : "0" });
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

export type ProfileUpdate = { name: string };

export async function updateProfile(input: ProfileUpdate): Promise<AuthUser> {
  const result = await requestJson<{ user: AuthUser }>("/api/v1/auth/me", { method: "PATCH", body: JSON.stringify(input), ...withAuthorization() });
  return result.user;
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await requestJson<void>("/api/v1/auth/change-password", { method: "POST", body: JSON.stringify({ currentPassword, newPassword }), ...withAuthorization() });
}

export async function requestPasswordReset(email: string): Promise<string> {
  const result = await requestJson<MessageResponse>("/api/v1/auth/password-reset/request", { method: "POST", body: JSON.stringify({ email }) });
  return result.message;
}

export async function confirmPasswordReset(token: string, password: string): Promise<{ user: AuthUser; autoLogin: boolean }> {
  const result = await requestJson<PasswordResetResponse>("/api/v1/auth/password-reset/confirm", { method: "POST", body: JSON.stringify({ token, password, rememberMe: readRememberSession() }) });
  if (result.accessToken) accessToken = result.accessToken;
  return { user: result.user, autoLogin: Boolean(result.accessToken) && result.autoLogin !== false };
}

export async function confirmEmail(token: string): Promise<void> {
  await requestJson<void>("/api/v1/auth/verify-email/confirm", { method: "POST", body: JSON.stringify({ token }) });
}

export async function requestVerification(email: string): Promise<string> {
  const result = await requestJson<MessageResponse>("/api/v1/auth/verify-email/request", { method: "POST", body: JSON.stringify({ email }) });
  return result.message;
}

export function clearAccessToken(): void { accessToken = null; }
