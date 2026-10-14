import type { Locality } from "../data/locations";
import { getColombianAdministrativeDivisions } from "./administrativeDivisionService";
import { loadGoogleMaps } from "./googleMapsLoader";

const STORAGE_KEY = "wit-selected-location";
const LOCATION_EVENT = "wit-location-changed";

export type Coordinates = { lat: number; lng: number };
export type LocationSelection =
  | { mode: "manual"; locality: Locality; country: "Colombia"; coordinates?: Coordinates }
  | { mode: "automatic"; coordinates: Coordinates; locality?: Locality; country?: "Colombia"; cityResolution?: "pending" | "resolved" | "unavailable" };

const DEFAULT_LOCALITY_ID = "76520";
const DEFAULT_COORDINATES: Coordinates = { lat: 3.5394, lng: -76.3036 };

function defaultSelection(): LocationSelection | null {
  const locality = getColombianAdministrativeDivisions().municipalities.find((item) => item.id === DEFAULT_LOCALITY_ID);
  return locality ? { mode: "manual", locality, country: "Colombia", coordinates: DEFAULT_COORDINATES } : null;
}

function defaultLocality(): Locality | null {
  const fallback = defaultSelection();
  return fallback?.mode === "manual" ? fallback.locality : null;
}

function coordinatesForLocality(locality: Locality): Coordinates | undefined {
  return locality.id === DEFAULT_LOCALITY_ID ? DEFAULT_COORDINATES : undefined;
}

function isCoordinates(value: unknown): value is Coordinates {
  if (!value || typeof value !== "object") return false;
  const coordinates = value as Partial<Coordinates>;
  return typeof coordinates.lat === "number" && Number.isFinite(coordinates.lat)
    && typeof coordinates.lng === "number" && Number.isFinite(coordinates.lng);
}

function findCanonicalLocality(value: unknown): Locality | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<Locality>;
  if (typeof candidate.id !== "string") return null;
  const municipalities = getColombianAdministrativeDivisions().municipalities;
  return municipalities.find((item) => item.id === candidate.id
    && (typeof candidate.departmentCode !== "string" || item.departmentCode === candidate.departmentCode)) ?? null;
}

function notify(): void {
  window.dispatchEvent(new Event(LOCATION_EVENT));
}

export function getLocationSelection(): LocationSelection | null {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    const fallback = defaultSelection();
    if (fallback) localStorage.setItem(STORAGE_KEY, JSON.stringify(fallback));
    return fallback;
  }
  try {
    const parsed = JSON.parse(saved) as Partial<LocationSelection> & Locality;
    if (parsed.mode === "automatic" && isCoordinates(parsed.coordinates)) {
      const locality = findCanonicalLocality(parsed.locality) ?? defaultLocality();
      const cityResolution = parsed.cityResolution === "pending" || parsed.cityResolution === "unavailable" || parsed.cityResolution === "resolved"
        ? parsed.cityResolution
        : parsed.locality ? "resolved" : "pending";
      const normalized: LocationSelection = { mode: "automatic", coordinates: parsed.coordinates, cityResolution, ...(locality ? { locality, country: "Colombia" as const } : {}) };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
      return normalized;
    }
    const locality = findCanonicalLocality(parsed.mode === "manual" ? parsed.locality : parsed);
    if (locality) {
      const normalized: LocationSelection = { mode: "manual", locality, country: "Colombia", coordinates: coordinatesForLocality(locality) };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
      return normalized;
    }
  } catch {
    // Remove malformed local state below.
  }
  localStorage.removeItem(STORAGE_KEY);
  const fallback = defaultSelection();
  if (fallback) localStorage.setItem(STORAGE_KEY, JSON.stringify(fallback));
  return fallback;
}

export function getSelectedLocation(): Locality | null {
  const selection = getLocationSelection();
  return selection?.locality ?? null;
}

export function saveSelectedLocation(location: Locality): void {
  const fallback = defaultSelection();
  const selected = findCanonicalLocality(location) ?? (fallback?.mode === "manual" ? fallback.locality : null);
  if (!selected) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode: "manual", locality: selected, country: "Colombia", coordinates: coordinatesForLocality(selected) } satisfies LocationSelection));
  notify();
}

export function saveAutomaticLocation(coordinates: Coordinates, locality?: Locality, cityResolution: "pending" | "resolved" | "unavailable" = "pending"): void {
  const current = getLocationSelection();
  const activeLocality = locality ?? current?.locality ?? defaultLocality();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode: "automatic", coordinates, cityResolution, ...(activeLocality ? { locality: activeLocality, country: "Colombia" } : {}) } satisfies LocationSelection));
  notify();
}

function normalizeName(value: string): string {
  return value.toLocaleLowerCase("es-CO").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

/** Resolves GPS coordinates to a known Colombian municipality once, so city-only listings can use reliable administrative data. */
export async function resolveLocalityFromCoordinates(coordinates: Coordinates): Promise<Locality | null> {
  try {
    const maps = await loadGoogleMaps();
    return await new Promise<Locality | null>((resolve) => {
      new maps.Geocoder().geocode({ location: coordinates }, (results, status) => {
        if (status !== "OK" || !results?.length) { resolve(null); return; }
        const components = results[0].address_components ?? [];
        const municipalityName = components.find((item) => item.types.includes("locality") || item.types.includes("administrative_area_level_2"))?.long_name;
        const departmentName = components.find((item) => item.types.includes("administrative_area_level_1"))?.long_name;
        const countryName = components.find((item) => item.types.includes("country"))?.long_name;
        if (!municipalityName || (countryName && normalizeName(countryName) !== "colombia")) { resolve(null); return; }
        const locality = getColombianAdministrativeDivisions().municipalities.find((item) => normalizeName(item.name) === normalizeName(municipalityName)
          && (!departmentName || normalizeName(item.context) === normalizeName(departmentName)));
        resolve(locality ?? null);
      });
    });
  } catch {
    return null;
  }
}

export function clearSelectedLocation(): void {
  localStorage.removeItem(STORAGE_KEY);
  notify();
}

export function subscribeToLocation(listener: () => void): () => void {
  window.addEventListener(LOCATION_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(LOCATION_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

/** The current mock business catalog contains listings for Palmira when its municipality is reliably known. */
export function hasSampleCatalogForLocation(location: Locality | null): boolean {
  return location?.id === "76520";
}
