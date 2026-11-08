

// Private to this browser tab: never pass the registration address through the URL.
// The backend still decides whether the address has an eligible unverified account.
const PENDING_EMAIL_KEY = "xamuko-business-pending-verification-email";
function validateEmail(value: string): boolean {
  return !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

export function rememberPendingVerificationEmail(value: string): void {
  const email = value.trim().toLocaleLowerCase("en-US");
  if (validateEmail(email)) return;
  try {
    window.sessionStorage.setItem(PENDING_EMAIL_KEY, email);
  } catch {
    // Browsers can restrict sessionStorage; registration still works normally.
  }
}

export function getPendingVerificationEmail(): string {
  try {
    const stored = window.sessionStorage.getItem(PENDING_EMAIL_KEY) ?? "";
    return validateEmail(stored) ? "" : stored;
  } catch {
    return "";
  }
}

export function clearPendingVerificationEmail(): void {
  try {
    window.sessionStorage.removeItem(PENDING_EMAIL_KEY);
  } catch {
    // No storage access available.
  }
}
