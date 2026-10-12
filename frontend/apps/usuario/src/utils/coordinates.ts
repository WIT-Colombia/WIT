import type { Business } from "../data/mockData";

export type Coordinates = { lat: number; lng: number };

export function getBusinessCoordinates(business: Business): Coordinates | null {
  return business.coordinatesVerified && business.coordinates ? business.coordinates : null;
}

export function getDirectionsDestination(business: Business): string | null {
  const point = getBusinessCoordinates(business);
  return point ? `${point.lat},${point.lng}` : null;
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
