/** Suppress generated, device-local Business notices after a confirmed deletion.
 * Server-backed notices are deleted through the authenticated API instead.
 * The key is scoped to the signed-in user (or the isolated demo).
 */
const keyFor = (owner: string) => `xamuko-business-dismissed-notifications:${owner}`;

function readDismissed(owner: string | null): string[] {
  if (!owner) return [];
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(keyFor(owner)) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string").slice(-500) : [];
  } catch { return []; }
}

export function wasBusinessNotificationDismissed(owner: string | null, id: string): boolean {
  return readDismissed(owner).includes(id);
}

export function rememberBusinessNotificationDismissal(owner: string | null, id: string): void {
  if (!owner) return;
  try {
    const previous = readDismissed(owner);
    localStorage.setItem(keyFor(owner), JSON.stringify([...new Set([...previous, id])].slice(-500)));
  } catch { /* A failed local cache write must not block removing the current card. */ }
}
