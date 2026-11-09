/**
 * Search modes available to XAMUKO Usuario.
 * Radius searches always have a finite distance; City is a municipality filter,
 * not an alias for an unlimited-radius query.
 */
export const RESULT_RADII_KM = [1, 3, 10] as const;
export const MAP_RADII_KM = [1, 3, 5, 10] as const;

export type SearchArea =
  | { kind: "radius"; radiusKm: number }
  | { kind: "city"; city: string; region?: string }
  | { kind: "virtual" }
  | { kind: "location-required" };

export function resolveResultsArea(
  params: URLSearchParams,
  coordinatesAvailable: boolean,
  city?: string,
  region?: string,
): SearchArea {
  if (params.get("scope") === "virtual") return { kind: "virtual" };
  if (params.get("scope") === "city" && city) return { kind: "city", city, region };
  // A manually chosen municipality still works when GPS is denied.
  if (!coordinatesAvailable) return city ? { kind: "city", city, region } : { kind: "location-required" };

  const requested = Number(params.get("radiusKm"));
  const radiusKm = params.has("radiusKm") && RESULT_RADII_KM.some(km => km === requested) ? requested : 1;
  return { kind: "radius", radiusKm };
}

export function resolveMapRadiusIndex(params: URLSearchParams, cityAvailable: boolean): number {
  if (params.get("scope") === "city" && cityAvailable) return MAP_RADII_KM.length;
  const requested = Number(params.get("radiusKm"));
  const index = params.has("radiusKm") ? MAP_RADII_KM.findIndex(km => km === requested) : -1;
  return index >= 0 ? index : 0;
}
