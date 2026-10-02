import { businesses, products, services, type Review } from "../data/mockData";

const FAVORITES_KEY = "wit-favorites";
const LIKES_KEY = "wit-likes";
const REVIEWS_KEY = "wit-user-reviews";
const NEEDS_KEY = "wit-user-needs";
const REPORTS_KEY = "wit-user-reports";
const NOTIFICATIONS_KEY = "wit-notifications";
const PROFILE_KEY = "wit-profile";
const SETTINGS_KEY = "wit-settings";
const PREVIEW_SESSION_KEY = "wit-preview-user-session";

function readIds(key: string): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? "[]") as unknown;
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch { return []; }
}

const businessIds = new Set(businesses.map((business) => business.id));
const productIds = new Set(products.map((product) => product.id));
const likeableIds = new Set([...productIds, ...services.map((service) => service.id)]);

function keepKnownIds(key: string, known: Set<string>): string[] {
  const stored = readIds(key);
  const filtered = stored.filter((id) => known.has(id));
  if (filtered.length !== stored.length) localStorage.setItem(key, JSON.stringify(filtered));
  return filtered;
}

export function getFavoriteIds(): string[] { return keepKnownIds(FAVORITES_KEY, businessIds); }
export function getLikeIds(): string[] { return keepKnownIds(LIKES_KEY, likeableIds); }

function toggleId(key: string, id: string): string[] {
  const current = readIds(key);
  const next = current.includes(id) ? current.filter((value) => value !== id) : [...current, id];
  localStorage.setItem(key, JSON.stringify(next));
  return next;
}

export function toggleFavorite(id: string): string[] { return businessIds.has(id) ? toggleId(FAVORITES_KEY, id) : getFavoriteIds(); }
export function toggleLike(id: string): string[] { return likeableIds.has(id) ? toggleId(LIKES_KEY, id) : getLikeIds(); }

export type UserReview = Review & { isMock?: boolean };
export function getUserReviews(): UserReview[] {
  try { return JSON.parse(localStorage.getItem(REVIEWS_KEY) ?? "[]") as UserReview[]; } catch { return []; }
}
export function saveUserReview(review: UserReview): void { localStorage.setItem(REVIEWS_KEY, JSON.stringify([review, ...getUserReviews()])); }

export type UserNeed = { id: string; title: string; category: string; description: string; location: { id: string; name: string; context: string }; createdAt: string };
export function getUserNeeds(): UserNeed[] {
  try { return JSON.parse(localStorage.getItem(NEEDS_KEY) ?? "[]") as UserNeed[]; } catch { return []; }
}
export function saveUserNeed(need: UserNeed): void { localStorage.setItem(NEEDS_KEY, JSON.stringify([need, ...getUserNeeds()])); }

export type UserReport = { id: string; targetType: "business" | "product" | "service" | "review"; targetId: string; targetName: string; category: string; description: string; createdAt: string };
export function getUserReports(): UserReport[] {
  try { return JSON.parse(localStorage.getItem(REPORTS_KEY) ?? "[]") as UserReport[]; } catch { return []; }
}
export function saveUserReport(report: UserReport): void { localStorage.setItem(REPORTS_KEY, JSON.stringify([report, ...getUserReports()])); }

export type UserNotification = { id: string; title: string; body: string; date: string; read: boolean };
const defaultNotifications: UserNotification[] = [
  { id: "welcome", title: "Te damos la bienvenida a WIT", body: "Empieza buscando eso que necesitas cerca de ti.", date: "Hoy", read: false },
  { id: "saved-tip", title: "Guarda los lugares que te interesan", body: "Toca el corazón de una ficha para volver a ella después.", date: "Ayer", read: false },
];
export function getNotifications(): UserNotification[] {
  try {
    const saved = localStorage.getItem(NOTIFICATIONS_KEY);
    return saved ? JSON.parse(saved) as UserNotification[] : defaultNotifications;
  } catch { return defaultNotifications; }
}
export function markNotificationRead(id: string): UserNotification[] {
  const next = getNotifications().map((notification) => notification.id === id ? { ...notification, read: true } : notification);
  localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(next));
  return next;
}
export function markAllNotificationsRead(): UserNotification[] {
  const next = getNotifications().map((notification) => ({ ...notification, read: true }));
  localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(next));
  return next;
}

export type UserProfile = { name: string; email: string; city: string };
export function getProfile(): UserProfile {
  try { return { name: "", email: "", city: "", ...JSON.parse(localStorage.getItem(PROFILE_KEY) ?? "{}") as Partial<UserProfile> }; } catch { return { name: "", email: "", city: "" }; }
}
export function saveProfile(profile: UserProfile): void { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); }
// Temporary browser-session access lets the UI be previewed before real auth is connected.
export function isUserAuthenticated(): boolean { return sessionStorage.getItem(PREVIEW_SESSION_KEY) === "active"; }
export function startPreviewUserSession(): void { sessionStorage.setItem(PREVIEW_SESSION_KEY, "active"); }
export function signOutUser(): void { sessionStorage.removeItem(PREVIEW_SESSION_KEY); }

export type UserSettings = { nearbyUpdates: boolean; availabilityUpdates: boolean; reducedMotion: boolean };
const defaultSettings: UserSettings = { nearbyUpdates: true, availabilityUpdates: true, reducedMotion: false };
export function getSettings(): UserSettings {
  try { return { ...defaultSettings, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}") as Partial<UserSettings> }; } catch { return defaultSettings; }
}
export function saveSettings(settings: UserSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  if (typeof document !== "undefined") document.documentElement.dataset.reducedMotion = String(settings.reducedMotion);
}
