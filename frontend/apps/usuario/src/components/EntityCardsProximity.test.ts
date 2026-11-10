import { describe, expect, it } from "vitest";
import { businessProximityLabel } from "./EntityCards";
import type { Business } from "../data/mockData";

function sample(modalityTypes: string[] = [], distanceKm = Number.POSITIVE_INFINITY, verified = false): Business {
  return {
    id: "test-business",
    name: "Negocio de prueba",
    category: "Comercio",
    rating: 5,
    reviewCount: 0,
    distanceKm,
    isOpen: true,
    address: "Palmira",
    image: "",
    tags: [],
    modalityTypes,
    coordinates: verified ? { lat: 3.5, lng: -76.3 } : undefined,
    coordinatesVerified: verified,
  };
}

describe("Etiqueta de proximidad de negocios", () => {
  it("muestra Virtual para modalidad virtual sin local físico", () => {
    expect(businessProximityLabel(sample(["VIRTUAL"]))).toBe("Virtual");
    expect(businessProximityLabel(sample(["VIRTUAL", "DELIVERY"]))).toBe("Virtual");
  });

  it("muestra A domicilio cuando únicamente ofrece atención a domicilio", () => {
    expect(businessProximityLabel(sample(["DELIVERY"]))).toBe("A domicilio");
  });

  it("conserva la distancia comprobada de un negocio físico", () => {
    expect(businessProximityLabel(sample(["PHYSICAL"], 2.5, true))).toBe("A 2.5 km");
    expect(businessProximityLabel(sample(["PHYSICAL", "VIRTUAL"], 2.5, true))).toBe("A 2.5 km");
  });

  it("muestra Virtual si también ofrece esa modalidad pero no hay distancia física válida", () => {
    expect(businessProximityLabel(sample(["PHYSICAL", "VIRTUAL"]))).toBe("Virtual");
  });

  it("no inventa modalidades ni distancias cuando faltan los datos", () => {
    expect(businessProximityLabel(sample())).toBe("Sin distancia");
    expect(businessProximityLabel(sample(["PHYSICAL", "DELIVERY"]))).toBe("Sin distancia");
    expect(businessProximityLabel(sample(["PHYSICAL"], 2.5))).toBe("Sin distancia");
  });
});
