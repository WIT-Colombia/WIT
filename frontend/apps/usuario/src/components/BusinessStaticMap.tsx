import type { Business } from "../data/mockData";
import { getBusinessCoordinates } from "../utils/coordinates";
import "./BusinessStaticMap.css";

export function BusinessStaticMap({ business }: { business: Business }) {
  const verifiedPoint = getBusinessCoordinates(business);
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_STATIC_API_KEY?.trim();
  if (!verifiedPoint || !apiKey) return null;
  const point = verifiedPoint;
  const params = new URLSearchParams({ center: `${point.lat},${point.lng}`, zoom: "15", size: "800x360", scale: "2", maptype: "roadmap", markers: `color:purple|${point.lat},${point.lng}`, key: apiKey });
  return <div className="business-static-map-frame"><img className="business-static-map" src={`https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`} alt={`Mapa de ${business.name}`} loading="lazy" /></div>;
}
