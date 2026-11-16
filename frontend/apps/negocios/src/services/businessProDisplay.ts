/** Visibility for the sidebar PRO promotion, based only on the selected business.
 * A missing response is UNKNOWN, never BASIC. Avoids showing a false offer
 * briefly while the authenticated account and its plan are being restored.
 */
export type ResolvedBusinessPlan = { businessId: string; isPro: boolean } | null;

type BusinessProDisplayInput = {
  businessId: string | null | undefined;
  role: "Propietario" | "Colaborador";
  empty: boolean;
  demoPro: boolean;
  resolvedPlan: ResolvedBusinessPlan;
};

export function isBusinessProPreview(pathname: string, search: string): boolean {
  return (pathname === "/preview" || pathname.startsWith("/preview/"))
    && new URLSearchParams(search).get("demoPro") === "1";
}

export function getBusinessProDisplay({
  businessId, role, empty, demoPro, resolvedPlan,
}: BusinessProDisplayInput): { showProBadge: boolean; showProOffer: boolean } {
  const currentPlan = businessId && resolvedPlan?.businessId === businessId
    ? resolvedPlan.isPro : null;
  return {
    showProBadge: demoPro || currentPlan === true,
    showProOffer: !demoPro && !empty && Boolean(businessId)
      && role === "Propietario" && currentPlan === false,
  };
}
