/**
 * Completes the browser-side part of the Google OAuth callback.
 *
 * The callback route is deliberately deterministic: once the backend session
 * has been restored, every Google sign-in lands on the authenticated home
 * screen. The optional `next` query parameter is not used as a redirect
 * target so an OAuth response cannot send the user to a stale or unexpected
 * screen.
 */
export async function completeGoogleCallback(
  restore: () => Promise<void>,
  _next: string | null,
): Promise<string> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("SESSION_TIMEOUT")), 8000);
  });

  try {
    await Promise.race([restore(), timeout]);
    return "/home";
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}
