import type { Business } from "../data/mockData";

export type Coordinates = { lat: number; lng: number };

export function getCoordinateDestination(point: Coordinates | null | undefined): string | null {
  return point
    && Number.isFinite(point.lat) && point.lat >= -90 && point.lat <= 90
    && Number.isFinite(point.lng) && point.lng >= -180 && point.lng <= 180
    ? `${point.lat},${point.lng}`
    : null;
}

export function getBusinessCoordinates(business: Business): Coordinates | null {
  const point = business.coordinates;
  return business.coordinatesVerified && point && getCoordinateDestination(point) ? point : null;
}

export function getDirectionsDestination(business: Business): string | null {
  return getCoordinateDestination(getBusinessCoordinates(business));
}

function validAddressPart(value: string | undefined): value is string {
  const normalized = value?.trim();
  return Boolean(normalized && !/^(ubicación|direccion|dirección) no pública$/i.test(normalized) && !/^ciudad no registrada$/i.test(normalized));
}

function getPublicAddressDestination(business: Business): string | null {
  if (!validAddressPart(business.address) || !validAddressPart(business.city)) return null;
  return [business.address.trim(), business.city.trim(), ...(validAddressPart(business.regionName) ? [business.regionName.trim()] : []), "Colombia"].join(", ");
}

/** Builds a public Google Maps directions URL without using unverified coordinates. */
export function getBusinessDirectionsUrl(business: Business, origin?: string | null): string | null {
  const destination = getDirectionsDestination(business) ?? getPublicAddressDestination(business);
  if (!destination) return null;
  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1");
  if (origin) url.searchParams.set("origin", origin);
  url.searchParams.set("destination", destination);
  url.searchParams.set("travelmode", "driving");
  return url.toString();
}

/** Waze navigation requires a verified coordinate pair and never falls back to an address. */
export function getBusinessWazeUrl(business: Business): string | null {
  const destination = getDirectionsDestination(business);
  if (!destination) return null;
  const url = new URL("https://www.waze.com/ul");
  url.searchParams.set("ll", destination);
  url.searchParams.set("navigate", "yes");
  return url.toString();
}

export function distanceBetweenCoordinates(a: Coordinates, b: Coordinates): number {
  const earthRadiusKm = 6371;
  const toRadians = (degrees: number) => degrees * Math.PI / 180;
  const latitudeDelta = toRadians(b.lat - a.lat);
  const longitudeDelta = toRadians(b.lng - a.lng);
  const latitudeA = toRadians(a.lat);
  const latitudeB = toRadians(b.lat);
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}
