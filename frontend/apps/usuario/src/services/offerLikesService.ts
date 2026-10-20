import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { requestWithSession } from "./authService";
import { getLikeIds as getLocalLikeIds, toggleLike as toggleLocalLike } from "./userDataService";

type LikeState = { liked: boolean; count: number; loading?: boolean; error?: boolean };
const states = new Map<string, LikeState>();
const listeners = new Set<() => void>();
const loadedKeys = new Set<string>();
const pending = new Map<string, Promise<void>>();
const mutationVersions = new Map<string, number>();
const notify = () => listeners.forEach((listener) => listener());
export const isRealOfferId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

export function clearOfferLikes() { states.clear(); loadedKeys.clear(); pending.clear(); mutationVersions.clear(); notify(); }

async function load(ids: string[], userId: string) {
  const realIds = [...new Set(ids.filter(isRealOfferId))].sort();
  if (!realIds.length) return;
  const key = `${userId}:${realIds.join(",")}`;
  if (loadedKeys.has(key)) return;
  const active = pending.get(key);
  if (active) return active;
  const versionsAtStart = new Map(realIds.map((id) => [id, mutationVersions.get(id) ?? 0]));
  const task = requestWithSession<{ likes: Array<{ offerId: string; liked: boolean; count: number }> }>(`/api/v1/offers/likes?offerIds=${realIds.map(encodeURIComponent).join(",")}`)
    .then((result) => { result.likes.forEach((like) => { if ((mutationVersions.get(like.offerId) ?? 0) === versionsAtStart.get(like.offerId)) states.set(like.offerId, like); }); loadedKeys.add(key); notify(); })
    .catch(() => { realIds.forEach((id) => states.set(id, { ...(states.get(id) ?? { liked: false, count: 0 }), error: true })); notify(); })
    .finally(() => { pending.delete(key); });
  pending.set(key, task);
  return task;
}

export function useOfferLikes(ids: string[]) {
  const { user, status } = useAuth();
  const [, rerender] = useState(0);
  const realIds = useMemo(() => ids.filter(isRealOfferId), [ids]);
  useEffect(() => { const listener = () => rerender((value) => value + 1); listeners.add(listener); return () => { listeners.delete(listener); }; }, []);
  useEffect(() => { if (status === "authenticated" && user) void load(realIds, user.id); else if (status === "anonymous") clearOfferLikes(); }, [realIds, status, user]);
  const toggle = useCallback(async (id: string) => {
    if (!isRealOfferId(id) || status !== "authenticated") { toggleLocalLike(id); notify(); return; }
    const previous = states.get(id) ?? { liked: false, count: 0 };
    mutationVersions.set(id, (mutationVersions.get(id) ?? 0) + 1);
    const liked = !previous.liked;
    states.set(id, { ...previous, liked, count: Math.max(0, previous.count + (liked ? 1 : -1)), loading: true, error: false }); notify();
    try {
      const result = await requestWithSession<{ like: { liked: boolean; count: number } }>(`/api/v1/offers/${encodeURIComponent(id)}/like`, { method: liked ? "POST" : "DELETE" });
      states.set(id, { ...result.like }); notify();
    } catch (error) { states.set(id, { ...previous, error: true }); notify(); throw error; }
  }, [status]);
  const get = useCallback((id: string): LikeState => states.get(id) ?? (getLocalLikeIds().includes(id) ? { liked: true, count: 1 } : { liked: false, count: 0 }), []);
  return { get, toggle, loading: realIds.some((id) => states.get(id)?.loading), error: realIds.some((id) => states.get(id)?.error) };
}

export type UserOfferLike = {
  offerId: string; likedAt: string;
  likeCount: number; kind: "PRODUCT" | "SERVICE";
  name: string; description?: string | null;
  priceAmount?: number | string | null; priceText?: string | null; currency?: string | null; negotiable: boolean;
  business: { id: string; publicId: string; name: string };
  photo?: { url?: string | null; storageKey?: string | null } | null;
};
export async function listUserOfferLikes(page = 1, pageSize = 20) {
  return requestWithSession<{ items: UserOfferLike[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } }>(`/api/v1/offers/likes/mine?page=${page}&pageSize=${pageSize}`);
}
