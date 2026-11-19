/** Visibility for the sidebar PRO promotion, based only on the selected business.
 * A missing response is UNKNOWN, never BASIC. Avoids showing a false offer
 * briefly while the authenticated account and its plan are being restored.
 */
export type ResolvedBusinessPlan = { businessId: string; isPro: boolean } | null;

type BusinessProDisplayInput = {
  businessId: string | null | undefined;
  role: "Propietario" | "Colaborador";
  empty: boolean;
  resolvedPlan: ResolvedBusinessPlan;
};

export function getBusinessProDisplay({
  businessId, role, empty, resolvedPlan,
}: BusinessProDisplayInput): { showProBadge: boolean; showProOffer: boolean } {
  const currentPlan = businessId && resolvedPlan?.businessId === businessId
    ? resolvedPlan.isPro : null;
  return {
    showProBadge: currentPlan === true,
    showProOffer: !empty && Boolean(businessId)
      && role === "Propietario" && currentPlan === false,
  };
}
