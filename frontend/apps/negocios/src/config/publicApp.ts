import { getPublicBusinessUrl } from "../../../usuario/src/utils/share";

export { getPublicBusinessUrl };

/** Builds the same-tab preview URL used by the Business workspace. */
export function getPublicBusinessPreviewUrl(publicId: string | null | undefined, returnTo: string): string | null {
  const profileUrl = getPublicBusinessUrl(publicId);
  if (!profileUrl) return null;
  const url = new URL(profileUrl);
  url.searchParams.set("preview", "business");
  url.searchParams.set("returnTo", returnTo);
  return url.toString();
}
