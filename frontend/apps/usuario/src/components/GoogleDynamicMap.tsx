import type { Business } from "../data/mockData";
import "./GoogleDynamicMap.css";

export function GoogleDynamicMap({ businesses: _businesses, query, center }: { businesses: Business[]; query?: string; center?: string }) {
  const radiusIndex = Number(query?.split(":").at(-1) ?? 0);
  const radius = radiusIndex === 2 ? "toda la ciudad" : radiusIndex === 1 ? "3 km" : "1 km";
  const search = center || "Palmira, Valle del Cauca";
  const zoom = radiusIndex === 2 ? 12 : radiusIndex === 1 ? 14 : 16;
  const src = `https://www.google.com/maps?q=${encodeURIComponent(search)}&z=${zoom}&t=k&output=embed`;
  return <div className="dynamic-map"><iframe key={radius} className="dynamic-map__canvas" title={`Mapa satelital centrado en ${search}`} src={src} loading="lazy" referrerPolicy="no-referrer-when-downgrade" /></div>;
}
