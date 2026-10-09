export type ApiErrorPayload = { error?: { code?: string; message?: string; fields?: Record<string, string> } };

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string, public readonly retryAfterSeconds?: number, public readonly fields: Record<string, string> = {}) {
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
    const retryAfterHeader = response.headers.get("Retry-After");
    const retryAfterSeconds = retryAfterHeader && /^\d+$/.test(retryAfterHeader) ? Number(retryAfterHeader) : undefined;
    const baseMessage = errorPayload?.error?.message ?? "No se pudo completar la solicitud.";
    const message = response.status === 429 && retryAfterSeconds !== undefined
      ? `${baseMessage} Puedes volver a intentarlo en ${retryAfterSeconds} segundos.`
      : baseMessage;
    throw new ApiError(response.status, errorPayload?.error?.code ?? "HTTP_ERROR", message, retryAfterSeconds, errorPayload?.error?.fields ?? {});
  }
  return payload as T;
}
