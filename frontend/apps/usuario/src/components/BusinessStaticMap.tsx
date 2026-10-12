import type { Business } from "../data/mockData";
import { getBusinessCoordinates } from "../utils/coordinates";
import "./BusinessStaticMap.css";

export function BusinessStaticMap({ business }: { business: Business }) {
  const verifiedPoint = getBusinessCoordinates(business);
  const previewPoint = import.meta.env.DEV && business.id === "ferreteria-martillo" ? business.staticMapPreviewCoordinates : undefined;
  const point = verifiedPoint ?? previewPoint;
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_STATIC_API_KEY?.trim();
  if (!point || !apiKey) return null;
  const params = new URLSearchParams({ center: `${point.lat},${point.lng}`, zoom: "15", size: "800x360", scale: "2", maptype: "roadmap", markers: `color:purple|${point.lat},${point.lng}`, key: apiKey });
  const preview = !verifiedPoint && Boolean(previewPoint);
  return <div className={`business-static-map-frame${preview ? " business-static-map-frame--preview" : ""}`}><img className="business-static-map" src={`https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`} alt={`Mapa de ${business.name}`} loading="lazy" />{preview && <span className="business-static-map-label">Ubicación de demostración</span>}</div>;
}
