import { describe, expect, it } from "vitest";
import {
  MAP_RADII_KM,
  RESULT_RADII_KM,
  resolveMapRadiusIndex,
  resolveResultsArea,
} from "./searchArea";

describe("XAMUKO Usuario: zonas de Resultados y Mapa", () => {
  it("Resultados inicia a 1 km, nunca Sin límite", () => {
    expect(RESULT_RADII_KM).toEqual([1, 3, 10]);
    expect(resolveResultsArea(new URLSearchParams(), true, "Palmira", "Valle del Cauca"))
      .toEqual({ kind: "radius", radiusKm: 1 });
    expect(resolveResultsArea(new URLSearchParams("radiusKm=5"), true, "Palmira"))
      .toEqual({ kind: "radius", radiusKm: 1 });
    expect(resolveResultsArea(new URLSearchParams("radiusKm=50"), true, "Palmira"))
      .toEqual({ kind: "radius", radiusKm: 1 });
  });

  it("respeta los radios explícitos válidos 1, 3 y 10 km", () => {
    for (const km of RESULT_RADII_KM) {
      expect(resolveResultsArea(new URLSearchParams(`radiusKm=${km}`), true))
        .toEqual({ kind: "radius", radiusKm: km });
    }
  });

  it("Ciudad usa municipio y departamento sin GPS y Virtual no depende de ubicación", () => {
    expect(resolveResultsArea(new URLSearchParams(), false, "Palmira", "Valle del Cauca"))
      .toEqual({ kind: "city", city: "Palmira", region: "Valle del Cauca" });
    expect(resolveResultsArea(new URLSearchParams("scope=city"), true, "Palmira", "Valle del Cauca"))
      .toEqual({ kind: "city", city: "Palmira", region: "Valle del Cauca" });
    expect(resolveResultsArea(new URLSearchParams("scope=virtual"), false))
      .toEqual({ kind: "virtual" });
  });

  it("no realiza una búsqueda sin restricciones cuando falta toda ubicación", () => {
    expect(resolveResultsArea(new URLSearchParams(), false))
      .toEqual({ kind: "location-required" });
    expect(resolveResultsArea(new URLSearchParams("scope=city"), false))
      .toEqual({ kind: "location-required" });
  });

  it("Mapa solo usa 1, 3, 5, 10 km o Ciudad con municipio definido", () => {
    expect(MAP_RADII_KM).toEqual([1, 3, 5, 10]);
    expect(resolveMapRadiusIndex(new URLSearchParams(), true)).toBe(0);
    MAP_RADII_KM.forEach((radius, index) => {
      expect(resolveMapRadiusIndex(new URLSearchParams(`radiusKm=${radius}`), true)).toBe(index);
    });
    expect(resolveMapRadiusIndex(new URLSearchParams("scope=city"), true)).toBe(4);
    expect(resolveMapRadiusIndex(new URLSearchParams("scope=city"), false)).toBe(0);
    expect(resolveMapRadiusIndex(new URLSearchParams("radiusKm=25"), true)).toBe(0);
    expect(resolveMapRadiusIndex(new URLSearchParams("radiusKm=50"), true)).toBe(0);
  });
});
