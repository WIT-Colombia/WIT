import type { Business } from "../data/mockData";

export type Coordinates = { lat: number; lng: number };

// The mock catalog has no verified coordinates. This stable approximation keeps
// previews useful without presenting the locations as confirmed.
export function getBusinessCoordinates(business: Business): Coordinates {
  if (business.coordinates) return business.coordinates;
  let seed = 0;
  for (const character of business.id) seed = (seed * 31 + character.charCodeAt(0)) >>> 0;
  const latOffset = ((seed % 1801) - 900) / 100000;
  const lngOffset = ((((seed / 1801) | 0) % 1801) - 900) / 100000;
  return { lat: 3.5394 + latOffset, lng: -76.3036 + lngOffset };
}

export function getDirectionsDestination(business: Business): string {
  const point = getBusinessCoordinates(business);
  return `${point.lat},${point.lng}`;
}
