export const API_BASE_URL = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.VITE_API_BASE_URL?.trim() || "https://api.xamuko.com/api/v1";

export function buildApiUrl(path: string): string {
  if (/^https?:\\/\\//i.test(path)) return path;
  const base = API_BASE_URL.replace(/\\/+$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  if (base.endsWith("/api/v1") && suffix.startsWith("/api/v1/")) return `${base}${suffix.slice("/api/v1".length)}`;
  return `${base}${suffix}`;
}
