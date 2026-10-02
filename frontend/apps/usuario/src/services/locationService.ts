import type { Locality } from "../data/locations";

const STORAGE_KEY = "wit-selected-location";

export function getSelectedLocation(): Locality | null {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return null;

  try {
    return JSON.parse(saved) as Locality;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function saveSelectedLocation(location: Locality): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(location));
}

/** The current mock business catalog contains listings only for Palmira. */
export function hasSampleCatalogForLocation(location: Locality | null): boolean {
  return location === null || location.id === "76520";
}
