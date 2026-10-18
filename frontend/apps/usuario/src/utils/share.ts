const configuredPublicAppUrl = import.meta.env.VITE_USUARIO_PUBLIC_URL?.trim() ?? "";
const publicAppBaseUrl = (configuredPublicAppUrl || (import.meta.env.DEV ? "http://127.0.0.1:5173" : "")).replace(/\/+$/, "");

export function getPublicBusinessUrl(publicId?: string | null): string | null {
  const identifier = publicId?.trim();
  if (!identifier || !publicAppBaseUrl) return null;
  return `${publicAppBaseUrl}/business/${encodeURIComponent(identifier)}`;
}

export async function shareLink(title: string, text: string, url: string): Promise<"shared" | "copied" | "unavailable"> {
  if (navigator.share) {
    try { await navigator.share({ title, text, url }); return "shared"; }
    catch (error) { if (error instanceof Error && error.name === "AbortError") return "unavailable"; }
  }
  if (navigator.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(url); return "copied"; } catch { return "unavailable"; }
  }
  return "unavailable";
}
