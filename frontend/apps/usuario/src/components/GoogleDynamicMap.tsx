import { useEffect, useRef, useState } from "react";
import type { Business } from "../data/mockData";
import { getBusinessCoordinates, type Coordinates } from "../utils/coordinates";
import { loadGoogleMaps, type GoogleMapInstance, type GoogleMarkerInstance } from "../services/googleMapsLoader";
import "./GoogleDynamicMap.css";

type GoogleDynamicMapProps = { businesses: Business[]; center: Coordinates | null; radiusKm: number | null; onBusinessSelect?: (business: Business) => void };

export function GoogleDynamicMap({ businesses, center, radiusKm, onBusinessSelect }: GoogleDynamicMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<GoogleMapInstance | null>(null);
  const markersRef = useRef<GoogleMarkerInstance[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "missing-key" | "error">("loading");

  useEffect(() => {
    if (!center) { setState("ready"); return; }
    if (mapRef.current) {
      mapRef.current.setCenter(center);
      mapRef.current.setZoom(radiusKm && radiusKm <= 3 ? 14 : 12);
      return;
    }
    let active = true;
    void loadGoogleMaps().then((maps) => {
      if (!active || !containerRef.current) return;
      mapRef.current = new maps.Map(containerRef.current, { center, zoom: radiusKm && radiusKm <= 3 ? 14 : 12, mapTypeControl: false, streetViewControl: false, fullscreenControl: true, gestureHandling: "greedy" });
      setState("ready");
    }).catch((error: unknown) => { if (active) setState(error instanceof Error && error.message === "GOOGLE_MAPS_JS_KEY_MISSING" ? "missing-key" : "error"); });
    return () => { active = false; };
  }, [center, radiusKm]);

  useEffect(() => {
    if (!mapRef.current || !window.google?.maps) return;
    for (const marker of markersRef.current) marker.setMap(null);
    markersRef.current = [];
    for (const business of businesses) {
      const position = getBusinessCoordinates(business);
      if (!position) continue;
      const marker = new window.google.maps.Marker({ map: mapRef.current, position, title: business.name });
      marker.addListener("click", () => onBusinessSelect?.(business));
      markersRef.current.push(marker);
    }
  }, [businesses, onBusinessSelect]);

  if (!center) return <div className="dynamic-map dynamic-map-fallback" role="status"><b>Ubicación no disponible</b><p>Necesitamos una ubicación confirmada para mostrar el mapa.</p></div>;
  if (state === "missing-key") return <div className="dynamic-map dynamic-map-fallback" role="status"><b>Mapa interactivo pendiente de configuración</b><p>Configura una clave de Maps JavaScript API restringida para este entorno.</p></div>;
  if (state === "error") return <div className="dynamic-map dynamic-map-fallback" role="status"><b>No pudimos cargar el mapa</b><p>Intenta nuevamente más tarde.</p></div>;
  return <div className="dynamic-map"><div ref={containerRef} className="dynamic-map__canvas" aria-label="Mapa interactivo de negocios" />{state === "loading" && <div className="dynamic-map__loading">Cargando mapa…</div>}</div>;
}
