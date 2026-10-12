import type { Locality } from "../data/locations";
import { getColombianAdministrativeDivisions } from "./administrativeDivisionService";

const STORAGE_KEY = "wit-selected-location";
const LOCATION_EVENT = "wit-location-changed";

export type Coordinates = { lat: number; lng: number };
export type LocationSelection =
  | { mode: "manual"; locality: Locality; country: "Colombia"; coordinates?: Coordinates }
  | { mode: "automatic"; coordinates: Coordinates };

const DEFAULT_LOCALITY_ID = "76520";
const DEFAULT_COORDINATES: Coordinates = { lat: 3.5394, lng: -76.3036 };

function defaultSelection(): LocationSelection | null {
  const locality = getColombianAdministrativeDivisions().municipalities.find((item) => item.id === DEFAULT_LOCALITY_ID);
  return locality ? { mode: "manual", locality, country: "Colombia", coordinates: DEFAULT_COORDINATES } : null;
}

function coordinatesForLocality(locality: Locality): Coordinates | undefined {
  return locality.id === DEFAULT_LOCALITY_ID ? DEFAULT_COORDINATES : undefined;
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
    if (parsed.mode === "automatic" && parsed.coordinates && typeof parsed.coordinates.lat === "number" && typeof parsed.coordinates.lng === "number") {
      return { mode: "automatic", coordinates: parsed.coordinates };
    }
    if (parsed.mode === "manual" && parsed.locality) return { mode: "manual", locality: parsed.locality, country: "Colombia", coordinates: parsed.coordinates ?? coordinatesForLocality(parsed.locality) };
    if (typeof parsed.id === "string" && typeof parsed.name === "string") return { mode: "manual", locality: parsed as Locality, country: "Colombia", coordinates: coordinatesForLocality(parsed as Locality) };
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
  return selection?.mode === "manual" ? selection.locality : null;
}

export function saveSelectedLocation(location: Locality): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode: "manual", locality: location, country: "Colombia", coordinates: coordinatesForLocality(location) } satisfies LocationSelection));
  notify();
}

export function saveAutomaticLocation(coordinates: Coordinates): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode: "automatic", coordinates } satisfies LocationSelection));
  notify();
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

/** The current mock business catalog contains listings only for Palmira selected manually. */
export function hasSampleCatalogForLocation(location: Locality | null): boolean {
  return location?.id === "76520";
}
