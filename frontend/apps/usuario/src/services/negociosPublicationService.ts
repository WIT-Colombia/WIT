type NegociosCatalogItem = { name?: string; active?: boolean };
type NegociosBusiness = { name?: string; catalog?: NegociosCatalogItem[] };

/** Uses the shared demo storage so a disabled offer is not shown in WIT Usuarios. */
export function isOfferPublished(businessName: string, offerName: string): boolean {
  try {
    const raw = localStorage.getItem("wit-negocios-demo:businesses");
    if (!raw) return true;
    const businesses = JSON.parse(raw) as NegociosBusiness[];
    const business = businesses.find((item) => item.name === businessName);
    const offer = business?.catalog?.find((item) => item.name === offerName);
    return offer ? offer.active !== false : true;
  } catch {
    return true;
  }
}

/** A business stays public only while its 40-day visibility window is active. */
export type BusinessPublicationState = "verified" | "pending" | "hidden";

export function getBusinessPublicationState(businessName: string): BusinessPublicationState {
  try {
    const businessesRaw = localStorage.getItem("wit-negocios-demo:businesses");
    const preferencesRaw = localStorage.getItem("wit-negocios-demo:preferences");
    if (!businessesRaw || !preferencesRaw) return "verified";
    const storedBusinesses = JSON.parse(businessesRaw) as Array<{ name?: string; status?: string }>;
    const storedBusiness = storedBusinesses.find(item => item.name === businessName);
    if (!storedBusiness) return "verified";
    const preferences = JSON.parse(preferencesRaw) as { profileVisible?: boolean; visibilityUntil?: string | null; visibilityByBusiness?: Record<string, { profileVisible?: boolean; visibilityUntil?: string | null }> };
    const businessVisibility = preferences.visibilityByBusiness?.[businessName];
    const profileVisible = businessVisibility?.profileVisible ?? preferences.profileVisible;
    const visibilityUntil = businessVisibility?.visibilityUntil ?? preferences.visibilityUntil;
    if (storedBusiness.status === "Eliminado" || profileVisible === false) return "hidden";
    if (!visibilityUntil || new Date(visibilityUntil).getTime() <= Date.now()) return "hidden";
    return storedBusiness.status === "Verificado" ? "verified" : "pending";
  } catch {
    return "verified";
  }
}

export function isBusinessPublished(businessName: string): boolean {
  return getBusinessPublicationState(businessName) !== "hidden";
}
