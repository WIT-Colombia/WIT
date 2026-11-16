import { describe, expect, it } from "vitest";
import { getBusinessProDisplay, isBusinessProPreview } from "./businessProDisplay";

const selected = "panaderia-patico";
const base = {
  businessId: selected,
  role: "Propietario" as const,
  empty: false,
  demoPro: false,
};

describe("Business: tarjeta promocional Pro en el sidebar", () => {
  it("nunca muestra el anuncio antes de conocer el plan (ni un primer render)", () => {
    expect(getBusinessProDisplay({ ...base, resolvedPlan: null })).toEqual({
      showProBadge: false, showProOffer: false,
    });
    expect(getBusinessProDisplay({ ...base, businessId: null, resolvedPlan: null })).toEqual({
      showProBadge: false, showProOffer: false,
    });
  });

  it("no muestra publicidad a un negocio PRO confirmado, ni antes de confirmarlo", () => {
    const initial = getBusinessProDisplay({ ...base, resolvedPlan: null });
    const resolved = getBusinessProDisplay({ ...base, resolvedPlan: { businessId: selected, isPro: true } });
    expect(initial.showProOffer).toBe(false);
    expect(resolved).toEqual({ showProBadge: true, showProOffer: false });
  });

  it("muestra el anuncio solo al propietario de un negocio BASIC confirmado", () => {
    const free = { ...base, resolvedPlan: { businessId: selected, isPro: false } };
    expect(getBusinessProDisplay(free)).toEqual({ showProBadge: false, showProOffer: true });
    expect(getBusinessProDisplay({ ...free, role: "Colaborador" })).toEqual({
      showProBadge: false, showProOffer: false,
    });
    expect(getBusinessProDisplay({ ...free, empty: true }).showProOffer).toBe(false);
  });

  it("no usa el plan de otro negocio cuando cambia la selección", () => {
    const oldPlan = { businessId: "otro-negocio", isPro: false };
    expect(getBusinessProDisplay({ ...base, resolvedPlan: oldPlan }).showProOffer).toBe(false);
    expect(getBusinessProDisplay({ ...base, resolvedPlan: { ...oldPlan, isPro: true } }).showProBadge).toBe(false);
  });

  it("solo autoriza la insignia PRO de demostración en la ruta /preview", () => {
    expect(isBusinessProPreview("/preview", "?demoPro=1")).toBe(true);
    expect(isBusinessProPreview("/inicio", "?demoPro=1")).toBe(false);
    expect(isBusinessProPreview("/mis-negocios", "?demoPro=1")).toBe(false);
    expect(getBusinessProDisplay({ ...base, demoPro: true, resolvedPlan: null }))
      .toEqual({ showProBadge: true, showProOffer: false });
  });
});
