export type ApiErrorPayload = { error?: { code?: string; message?: string } };

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

export async function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers,
  });
  const text = await response.text();
  let payload: T | ApiErrorPayload | null = null;
  try { payload = text ? JSON.parse(text) as T | ApiErrorPayload : null; } catch { /* handled as an empty response */ }
  if (!response.ok) {
    const errorPayload = payload as ApiErrorPayload | null;
    throw new ApiError(response.status, errorPayload?.error?.code ?? "HTTP_ERROR", errorPayload?.error?.message ?? "No se pudo completar la solicitud.");
  }
  return payload as T;
}
