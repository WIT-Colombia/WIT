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


  it("conserva Cali y sus coordenadas al leer de nuevo la selección manual", () => {
    const cali = getColombianAdministrativeDivisions().municipalities.find((item) => item.id === "76001");
    expect(cali).toBeDefined();
    const coordinates = { lat: 3.4516, lng: -76.5320 };
    saveSelectedLocation(cali!, coordinates);
    const selected = getLocationSelection();
    expect(selected?.mode).toBe("manual");
    expect(selected?.locality?.name).toBe("Cali");
    expect(selected?.coordinates).toEqual(coordinates);
    expect(getLocationSelection()?.coordinates).toEqual(coordinates);
  });

  it("conserva las coordenadas manuales restauradas del perfil", () => {
    const coordinates = { lat: 3.4516, lng: -76.5320 };
    expect(restorePreferredLocation({
      city: "Cali", region: "Valle del Cauca",
      latitude: coordinates.lat, longitude: coordinates.lng,
      mode: "MANUAL", resolution: "RESOLVED",
    })).toBe(true);
    expect(getLocationSelection()).toMatchObject({
      mode: "manual", locality: { name: "Cali", context: "Valle del Cauca" }, coordinates,
    });
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
