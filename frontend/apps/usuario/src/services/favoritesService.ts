import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { requestWithSession } from "./authService";
import { getFavoriteIds as getLocalFavoriteIds, toggleFavorite as toggleLocalFavorite } from "./userDataService";

let ids = new Set<string>();
let loadedUserId: string | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());
const isPublicId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

async function loadForUser(userId: string) {
  if (loadedUserId === userId || loading) return loading;
  loading = requestWithSession<{ businessIds: string[] }>("/api/v1/favorites/ids")
    .then((result) => { ids = new Set(result.businessIds); loadedUserId = userId; notify(); })
    .catch(() => { ids = new Set(); loadedUserId = userId; notify(); })
    .finally(() => { loading = null; });
  return loading;
}

export function clearFavorites() { ids = new Set(); loadedUserId = null; notify(); }

export function useFavorites() {
  const { user, status } = useAuth();
  const [, rerender] = useState(0);
  useEffect(() => { const listener = () => rerender((value) => value + 1); listeners.add(listener); return () => { listeners.delete(listener); }; }, []);
  useEffect(() => { if (status === "authenticated" && user) void loadForUser(user.id); else if (status === "anonymous") clearFavorites(); }, [status, user]);
  const toggle = useCallback(async (businessId: string) => {
    if (!isPublicId(businessId) || status !== "authenticated") {
      toggleLocalFavorite(businessId); notify(); return;
    }
    const saved = ids.has(businessId);
    if (saved) ids.delete(businessId); else ids.add(businessId);
    notify();
    try {
      await requestWithSession(`/api/v1/businesses/${encodeURIComponent(businessId)}/favorite`, { method: saved ? "DELETE" : "POST" });
    } catch (error) {
      if (saved) ids.add(businessId); else ids.delete(businessId);
      notify(); throw error;
    }
  }, [status]);
  return { favorites: status === "authenticated" ? Array.from(ids) : getLocalFavoriteIds(), toggleFavorite: toggle };
}

export function getSynchronousFavoriteIds() { return loadedUserId ? Array.from(ids) : getLocalFavoriteIds(); }
