export const PASSWORD_RESET_REQUEST_MESSAGE = 'Si la cuenta existe y puede recuperar el acceso, recibirás instrucciones por correo.';
export class PasswordOperationError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) { super(message); this.status = status; this.code = code; }
}
/** Enforce the existing backend contract, including rejecting a proxy's HTML 200 page. */
export async function postPasswordOperation<T>(url: string, body: Record<string, unknown>, operation: 'request' | 'reset' | 'change', authorization?: string): Promise<T> {
  const password = operation === 'change' ? body.newPassword : body.password;
  if (operation !== 'request' && (typeof password !== 'string' || password.length < 8 || password.length > 128)) throw new PasswordOperationError(0, 'INVALID_PASSWORD', 'La contraseña debe tener entre 8 y 128 caracteres.');
  if (operation === 'reset' && (typeof body.token !== 'string' || body.token.length < 32 || body.token.length > 256)) throw new PasswordOperationError(0, 'INVALID_AUTH_TOKEN', 'El enlace no es válido o ya expiró. Solicita uno nuevo.');
  let response: Response;
  try {
    response = await fetch(url, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(authorization ? { Authorization: `Bearer ${authorization}` } : {}) }, body: JSON.stringify(body) });
  } catch { throw new PasswordOperationError(0, 'NETWORK_ERROR', 'No se pudo conectar. No pudimos confirmar la operación; intenta nuevamente.'); }
  const text = await response.text();
  let payload: { message?: string; user?: { id?: string }; accessToken?: string; autoLogin?: boolean; error?: { code?: string; message?: string } } | null = null;
  try { payload = text ? JSON.parse(text) : null; } catch { /* Fail closed below. */ }
  if (!response.ok) {
    const retry = response.headers.get('Retry-After');
    const message = typeof payload?.error?.message === 'string' ? payload.error.message : 'No se pudo completar la operación.';
    throw new PasswordOperationError(response.status, payload?.error?.code || 'HTTP_ERROR', `${message}${response.status === 429 && retry && /^\d+$/.test(retry) ? ` Intenta nuevamente en ${retry} segundos.` : ''}`);
  }
  const valid = operation === 'change' ? response.status === 204 && text === ''
    : operation === 'request' ? response.status === 202 && typeof payload?.message === 'string'
    : response.status === 200 && typeof payload?.user?.id === 'string' && (typeof payload?.accessToken === 'string' && payload.accessToken.length > 0 || payload?.autoLogin === false);
  if (!valid) throw new PasswordOperationError(response.status, 'INVALID_RESPONSE', 'La respuesta no permite confirmar la operación. Intenta nuevamente.');
  return payload as T;
}
