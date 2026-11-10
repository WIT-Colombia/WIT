import { beforeEach, describe, expect, it } from "vitest";
import { getColombianAdministrativeDivisions } from "./administrativeDivisionService";
import { getLocationSelection, restorePreferredLocation, saveAutomaticLocation, saveSelectedLocation } from "./locationService";

const storageKey = "wit-selected-location";
const palmira = getColombianAdministrativeDivisions().municipalities.find((item) => item.id === "76520");

describe("Ubicación inicial y última ubicación de XAMUKO Usuario", () => {
  beforeEach(() => window.localStorage.clear());

  it("no asigna Palmira ni ninguna otra ciudad sin autorización o selección", () => {
    expect(getLocationSelection()).toBeNull();
    expect(window.localStorage.getItem(storageKey)).toBeNull();
  });

  it("conserva la última ciudad elegida aunque se vuelva a cargar el estado", () => {
    expect(palmira).toBeDefined();
    saveSelectedLocation(palmira!);
    expect(getLocationSelection()?.mode).toBe("manual");
    expect(getLocationSelection()?.locality?.id).toBe("76520");
  });

  it("al autorizar una posición nueva no hereda la ciudad manual anterior", () => {
    saveSelectedLocation(palmira!);
    saveAutomaticLocation({ lat: 4.711, lng: -74.0721 });
    const selected = getLocationSelection();
    expect(selected?.mode).toBe("automatic");
    expect(selected?.locality).toBeUndefined();
    expect(selected?.coordinates).toEqual({ lat: 4.711, lng: -74.0721 });
  });

  it("restaura la ubicación GPS guardada en el perfil al volver a iniciar sesión", () => {
    expect(restorePreferredLocation({
      city: "Ubicación actual", region: null,
      latitude: 6.2442, longitude: -75.5812,
      mode: "GPS", resolution: "UNAVAILABLE",
    })).toBe(true);
    expect(getLocationSelection()).toMatchObject({
      mode: "automatic",
      coordinates: { lat: 6.2442, lng: -75.5812 },
    });
  });

  it("descarta datos locales inválidos sin inventar una zona", () => {
    window.localStorage.setItem(storageKey, "{malformed");
    expect(getLocationSelection()).toBeNull();
    expect(window.localStorage.getItem(storageKey)).toBeNull();
  });
});
