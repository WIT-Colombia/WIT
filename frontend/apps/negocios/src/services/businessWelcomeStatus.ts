import { useEffect, useState } from "react";

const EVENT = "xamuko-business-account-welcome-updated";
export const businessAccountWelcomeKey = (accountId: string) => `xamuko-business-account-welcome:${accountId}`;

export function isBusinessAccountWelcomeUnread(accountId?: string | null): boolean {
  if (!accountId || typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(businessAccountWelcomeKey(accountId));
    if (!raw) return true;
    const record = JSON.parse(raw) as { read?: boolean; dismissed?: boolean };
    return !record.read && !record.dismissed;
  } catch { return true; }
}

export function announceBusinessAccountWelcomeUpdate(accountId: string) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(EVENT, { detail: { accountId } }));
}

export function useBusinessAccountWelcomeUnread(accountId?: string | null): boolean {
  const [state, setState] = useState<{ accountId: string | null; unread: boolean }>({
    accountId: accountId ?? null,
    unread: isBusinessAccountWelcomeUnread(accountId),
  });
  useEffect(() => {
    const refresh = () => setState({ accountId: accountId ?? null, unread: isBusinessAccountWelcomeUnread(accountId) });
    refresh();
    window.addEventListener(EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => { window.removeEventListener(EVENT, refresh); window.removeEventListener("storage", refresh); };
  }, [accountId]);
  return state.accountId === (accountId ?? null) && state.unread;
}
