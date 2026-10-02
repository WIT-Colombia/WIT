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
