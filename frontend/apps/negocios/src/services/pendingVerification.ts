// Temporary display data only. Expiry comes from the backend, never from a restarted page timer.
const PENDING_EMAIL_KEY = "xamuko-business-pending-verification-email";

export type PendingVerification = { email: string; expiresAt: string | null; emailSent: boolean };
const validEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());

export function rememberPendingVerificationEmail(value: string, expiresAt?: string, emailSent = true): void {
  const email = value.trim().toLocaleLowerCase("en-US");
  if (!validEmail(email)) return;
  const expiry = expiresAt && Number.isFinite(Date.parse(expiresAt)) ? expiresAt : null;
  try {
    window.sessionStorage.setItem(PENDING_EMAIL_KEY, JSON.stringify({ email, expiresAt: expiry, emailSent }));
  } catch {
    // Session storage may be unavailable in privacy-restricted browsers.
  }
}

export function getPendingVerification(): PendingVerification {
  try {
    const stored = window.sessionStorage.getItem(PENDING_EMAIL_KEY) ?? "";
    // Backwards compatibility for any pending registration from the old interface.
    if (validEmail(stored)) return { email: stored.trim().toLocaleLowerCase("en-US"), expiresAt: null, emailSent: true };
    const parsed: unknown = JSON.parse(stored);
    if (!parsed || typeof parsed !== "object" || !("email" in parsed)) throw new Error("No registration");
    const record = parsed as Record<string, unknown>;
    if (typeof record.email !== "string" || !validEmail(record.email)) throw new Error("Invalid email");
    return {
      email: record.email.trim().toLocaleLowerCase("en-US"),
      expiresAt: typeof record.expiresAt === "string" && Number.isFinite(Date.parse(record.expiresAt)) ? record.expiresAt : null,
      emailSent: record.emailSent !== false,
    };
  } catch {
    return { email: "", expiresAt: null, emailSent: false };
  }
}

export function getPendingVerificationEmail(): string {
  return getPendingVerification().email;
}

export function clearPendingVerificationEmail(): void {
  try { window.sessionStorage.removeItem(PENDING_EMAIL_KEY); }
  catch { /* Some browsers restrict storage. */ }
}
