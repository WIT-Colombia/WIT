import { describe, expect, it } from "vitest";
import type { Business } from "../data/mockData";
import { bogotaDayIndex, selectDiscoverBusinesses } from "./discoverBusinesses";

function business(id: string, type: "pioneer" | "premium" | "free"): Business {
  return {
    id, name: id, category: "Comercio", rating: 0, reviewCount: 0,
    distanceKm: 0, isOpen: true, address: "Cali", image: "", tags: [],
    ...(type === "pioneer" ? { pioneerNumber: 1 } : {}),
    plan: type === "premium" ? "premium" : "free",
  };
}

describe("Descubre negocios", () => {
  it("mantiene seis negocios distintos y permite aparecer a los gratuitos", () => {
    const candidates = [
      ...Array.from({ length: 15 }, (_, i) => business(`pionero-${i}`, "pioneer")),
      ...Array.from({ length: 15 }, (_, i) => business(`premium-${i}`, "premium")),
      ...Array.from({ length: 30 }, (_, i) => business(`gratis-${i}`, "free")),
    ];
    const selected = selectDiscoverBusinesses(candidates, 20000);
    expect(selected).toHaveLength(6);
    expect(new Set(selected.map((item) => item.id)).size).toBe(6);
    expect(selected.filter((item) => item.pioneerNumber !== undefined)).toHaveLength(2);
    expect(selected.filter((item) => item.plan === "premium")).toHaveLength(2);
    expect(selected.filter((item) => item.plan === "free" && item.pioneerNumber === undefined)).toHaveLength(2);
    expect(selectDiscoverBusinesses([...candidates].reverse(), 20000).map((item) => item.id))
      .toEqual(selected.map((item) => item.id));
  });

  it("rota cada día y permite recorrer todo el catálogo gratuito", () => {
    const candidates = Array.from({ length: 60 }, (_, i) => business(`gratis-${i}`, "free"));
    const daily = Array.from({ length: 10 }, (_, day) => selectDiscoverBusinesses(candidates, day));
    expect(daily.every((items) => items.length === 6)).toBe(true);
    expect(new Set(daily.flat().map((item) => item.id)).size).toBe(60);
  });

  it("redistribuye cupos faltantes sin duplicar ni inventar negocios", () => {
    const candidates = [business("p-1", "pioneer"), business("premium-1", "premium"),
      ...Array.from({ length: 10 }, (_, i) => business(`free-${i}`, "free"))];
    const selected = selectDiscoverBusinesses([...candidates, candidates[0]], 1234);
    expect(selected).toHaveLength(6);
    expect(selected.filter((item) => item.id === "p-1")).toHaveLength(1);
    expect(selected.filter((item) => item.id === "premium-1")).toHaveLength(1);
    expect(selectDiscoverBusinesses(candidates.slice(0, 2), 1234)).toHaveLength(2);
    expect(selectDiscoverBusinesses([], 1234)).toEqual([]);
  });

  it("cambia de día a medianoche colombiana y no a medianoche UTC", () => {
    const before = Date.parse("2026-11-13T04:59:59Z");
    const after = Date.parse("2026-11-13T05:00:00Z");
    expect(bogotaDayIndex(before)).toBe(bogotaDayIndex(after) - 1);
  });
});
