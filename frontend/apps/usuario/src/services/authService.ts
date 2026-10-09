import { ApiError, requestJson } from "./httpClient";

export type AuthUser = {
  emailVerified: boolean;
  verificationEmailSent?: boolean;
  id: string;
  publicId: string;
  displayName: string;
  emailNormalized: string | null;
  phoneCountryCode: string | null;
  phoneNumber: string | null;
  avatarUrl: string | null;
  locale: string;
  status: "ACTIVE" | "SUSPENDED" | "DELETED";
};

type AuthResponse = { user: AuthUser; accessToken: string };
type Credentials = { email: string; password: string };
type MessageResponse = { message: string };

let accessToken: string | null = null;
let refreshInFlight: Promise<AuthUser> | null = null;

function withAuthorization(init: RequestInit = {}): RequestInit {
  const headers = new Headers(init.headers);
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  return { ...init, headers };
}

export async function register(name: string, credentials: Credentials): Promise<AuthUser> {
  const result = await requestJson<AuthResponse>("/api/v1/auth/register", { method: "POST", body: JSON.stringify({ name, ...credentials }) });
  accessToken = result.accessToken;
  return result.user;
}

export async function login(credentials: Credentials): Promise<AuthUser> {
  const result = await requestJson<AuthResponse>("/api/v1/auth/login", { method: "POST", body: JSON.stringify(credentials) });
  accessToken = result.accessToken;
  return result.user;
}

export async function refreshSession(): Promise<AuthUser> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = requestJson<AuthResponse>("/api/v1/auth/refresh", { method: "POST", body: "{}" })
    .then((result) => { accessToken = result.accessToken; return result.user; })
    .finally(() => { refreshInFlight = null; });
  return refreshInFlight;
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
  finally { accessToken = null; }
}

export async function requestPasswordReset(email: string): Promise<string> {
  const result = await requestJson<MessageResponse>("/api/v1/auth/password-reset/request", { method: "POST", body: JSON.stringify({ email }) });
  return result.message;
}

export async function confirmPasswordReset(token: string, password: string): Promise<void> {
  await requestJson<void>("/api/v1/auth/password-reset/confirm", { method: "POST", body: JSON.stringify({ token, password }) });
}

export async function confirmEmail(token: string): Promise<void> {
  await requestJson<void>("/api/v1/auth/verify-email/confirm", { method: "POST", body: JSON.stringify({ token }) });
}

export async function requestVerification(email: string): Promise<string> {
  const result = await requestJson<MessageResponse>("/api/v1/auth/verify-email/request", { method: "POST", body: JSON.stringify({ email }) });
  return result.message;
}

export function clearAccessToken(): void { accessToken = null; }
