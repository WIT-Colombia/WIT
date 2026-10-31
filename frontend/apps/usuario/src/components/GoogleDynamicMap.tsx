import { useEffect, useMemo, useRef, useState } from "react";
import type { Business } from "../data/mockData";
import { getBusinessCoordinates, type Coordinates } from "../utils/coordinates";
import { loadGoogleMaps, type GoogleCircleInstance, type GoogleMapInstance, type GoogleMarkerInstance } from "../services/googleMapsLoader";
import "./GoogleDynamicMap.css";

type GoogleDynamicMapProps = {
  businesses: Business[];
  center: Coordinates | null;
  userLocation: Coordinates | null;
  radiusKm: number | null;
  radiusLabels: string[];
  radiusIndex: number;
  onRadiusChange: (index: number) => void;
  onBusinessOpen?: (business: Business) => void;
};

function formatDistance(distanceKm: number): string {
  return distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm.toFixed(1)} km`;
}

export function GoogleDynamicMap({ businesses, center, userLocation, radiusKm, radiusLabels, radiusIndex, onRadiusChange, onBusinessOpen }: GoogleDynamicMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<GoogleMapInstance | null>(null);
  const mapsRef = useRef<Awaited<ReturnType<typeof loadGoogleMaps>> | null>(null);
  const markersRef = useRef<GoogleMarkerInstance[]>([]);
  const userMarkerRef = useRef<GoogleMarkerInstance | null>(null);
  const userRadiusRef = useRef<GoogleCircleInstance | null>(null);
  const searchRadiusRef = useRef<GoogleCircleInstance | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing-key" | "error">("loading");
  const [mapType, setMapType] = useState<"roadmap" | "satellite">("roadmap");
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const centerKey = center ? `${center.lat},${center.lng}` : "";
  const userLocationKey = userLocation ? `${userLocation.lat},${userLocation.lng}` : "";
  const selectedBusiness = useMemo(() => businesses.find((business) => business.id === selectedBusinessId) ?? null, [businesses, selectedBusinessId]);
  const zoomForRadius = (radius: number | null) => radius === null ? 11 : radius <= 1 ? 15 : radius <= 3 ? 14 : 13;

  useEffect(() => {
    if (!center) { setState("ready"); return; }
    if (mapRef.current) { mapRef.current.setCenter(center); return; }
    let active = true;
    let resizeObserver: ResizeObserver | undefined;
    void loadGoogleMaps().then((maps) => {
      if (!active || !containerRef.current) return;
      mapsRef.current = maps;
      const map = new maps.Map(containerRef.current, { center, zoom: zoomForRadius(radiusKm), mapTypeId: "roadmap", mapTypeControl: false, zoomControl: false, streetViewControl: false, fullscreenControl: false, gestureHandling: "greedy" });
      mapRef.current = map;
      const notifyResize = () => {
        if (!active || !mapRef.current) return;
        maps.event?.trigger(mapRef.current, "resize");
        mapRef.current.setCenter(center);
      };
      requestAnimationFrame(notifyResize);
      if (typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(() => requestAnimationFrame(notifyResize));
        resizeObserver.observe(containerRef.current);
      }
      setState("ready");
    }).catch((error: unknown) => {
      if (import.meta.env.DEV) console.error("[XAMUKO Usuario] Error al inicializar el mapa", error);
      if (active) setState(error instanceof Error && error.message === "GOOGLE_MAPS_JS_KEY_MISSING" ? "missing-key" : "error");
    });
    return () => {
      active = false;
      resizeObserver?.disconnect();
    };
  }, [centerKey]);

  useEffect(() => {
    if (!mapRef.current || state !== "ready") return;
    mapRef.current.setZoom(zoomForRadius(radiusKm));
  }, [radiusKm, state]);

  useEffect(() => {
    if (!mapRef.current || !mapsRef.current) return;
    for (const marker of markersRef.current) marker.setMap(null);
    markersRef.current = [];
    for (const business of businesses) {
      const position = getBusinessCoordinates(business);
      if (!position) continue;
      try {
        const marker = new mapsRef.current.Marker({ map: mapRef.current, position, title: business.name, icon: { path: "M12 1.5C6.75 1.5 2.5 5.75 2.5 11c0 6.8 9.5 11.5 9.5 11.5S21.5 17.8 21.5 11C21.5 5.75 17.25 1.5 12 1.5Z", scale: 1.4, fillColor: "#7B3FFB", fillOpacity: 1, strokeColor: "#FFFFFF", strokeWeight: 2.5 } });
        marker.addListener("click", () => { setSelectedBusinessId(business.id); setNotice(null); });
        markersRef.current.push(marker);
      } catch (error) {
        if (import.meta.env.DEV) console.error("[XAMUKO Usuario] Error al crear marcador", error);
      }
    }
  }, [businesses, state]);

  useEffect(() => {
    if (selectedBusinessId && !selectedBusiness) setSelectedBusinessId(null);
  }, [selectedBusiness, selectedBusinessId]);

  useEffect(() => {
    if (!mapRef.current || !mapsRef.current) return;
    userMarkerRef.current?.setMap(null);
    userMarkerRef.current = null;
    userRadiusRef.current?.setMap(null);
    userRadiusRef.current = null;
    if (!userLocation) return;
    try {
      userMarkerRef.current = new mapsRef.current.Marker({ map: mapRef.current, position: userLocation, title: "Tu ubicación", ...(mapsRef.current.SymbolPath ? { icon: { path: mapsRef.current.SymbolPath.CIRCLE, scale: 8, fillColor: "#2563EB", fillOpacity: 1, strokeColor: "#FFFFFF", strokeWeight: 3 } } : {}) });
      if (mapsRef.current.Circle) userRadiusRef.current = new mapsRef.current.Circle({ map: mapRef.current, center: userLocation, radius: 120, fillColor: "#2563EB", fillOpacity: 0.16, strokeColor: "#2563EB", strokeOpacity: 0.32, strokeWeight: 1, clickable: false });
    } catch (error) {
      if (import.meta.env.DEV) console.error("[XAMUKO Usuario] Error al crear la ubicación activa", error);
    }
  }, [state, userLocationKey]);

  useEffect(() => {
    if (!mapRef.current || !mapsRef.current) return;
    searchRadiusRef.current?.setMap(null);
    searchRadiusRef.current = null;
    if (!center || !radiusKm || !mapsRef.current.Circle) return;
    searchRadiusRef.current = new mapsRef.current.Circle({ map: mapRef.current, center, radius: radiusKm * 1000, fillColor: "#7B3FFB", fillOpacity: 0.05, strokeColor: "#7B3FFB", strokeOpacity: 0.28, strokeWeight: 1, clickable: false });
  }, [centerKey, radiusKm, state]);

  function changeMapType(nextType: "roadmap" | "satellite") {
    mapRef.current?.setMapTypeId?.(nextType);
    setMapType(nextType);
  }

  function centerOnSelection() {
    if (!center || !mapRef.current) { setNotice("Ubicación no disponible."); return; }
    mapRef.current.setCenter(center);
    setNotice(null);
  }

  function changeZoom(amount: number) {
    const currentZoom = mapRef.current?.getZoom?.() ?? zoomForRadius(radiusKm);
    mapRef.current?.setZoom(Math.max(3, Math.min(20, currentZoom + amount)));
  }

  async function toggleFullscreen() {
    if (!containerRef.current) return;
    if (document.fullscreenElement) await document.exitFullscreen?.();
    else await containerRef.current.parentElement?.requestFullscreen?.();
  }

  if (!center) return <div className="dynamic-map dynamic-map-fallback" role="status"><b>Ubicación no disponible</b><p>Necesitamos una ubicación confirmada para mostrar el mapa.</p></div>;
  if (state === "missing-key") return <div className="dynamic-map dynamic-map-fallback" role="status"><b>Mapa interactivo pendiente de configuración</b><p>Configura una clave de Maps JavaScript API restringida para este entorno.</p></div>;
  if (state === "error") return <div className="dynamic-map dynamic-map-fallback" role="status"><b>No pudimos cargar el mapa</b><p>Intenta nuevamente más tarde.</p></div>;
  return <div className="dynamic-map"><div ref={containerRef} className="dynamic-map__canvas" aria-label="Mapa interactivo de negocios" /><div className="dynamic-map__type-control" role="group" aria-label="Tipo de mapa"><button type="button" className={mapType === "roadmap" ? "is-active" : ""} onClick={() => changeMapType("roadmap")}>Mapa</button><button type="button" className={mapType === "satellite" ? "is-active" : ""} onClick={() => changeMapType("satellite")}>Satélite</button></div><div className="dynamic-map__right-controls"><button type="button" onClick={centerOnSelection} aria-label="Centrar en mi ubicación" title="Centrar en mi ubicación">⌖</button><div className="dynamic-map__zoom-controls"><button type="button" onClick={() => changeZoom(1)} aria-label="Acercar">+</button><button type="button" onClick={() => changeZoom(-1)} aria-label="Alejar">−</button></div><button type="button" onClick={() => { void toggleFullscreen(); }} aria-label="Pantalla completa" title="Pantalla completa">⛶</button></div><div className="dynamic-map__radius-control" role="group" aria-label="Radio de búsqueda">{radiusLabels.map((label, index) => <button className={radiusIndex === index ? "is-active" : ""} type="button" key={label} onClick={() => onRadiusChange(index)}>{label === "toda la ciudad" ? "Ciudad" : label}</button>)}</div>{selectedBusiness && <article className="dynamic-map__business-card"><button className="dynamic-map__card-close" type="button" onClick={() => setSelectedBusinessId(null)} aria-label="Cerrar información">×</button>{selectedBusiness.image && <img src={selectedBusiness.image} alt="" />}{selectedBusiness.image ? <div className="dynamic-map__business-copy">{selectedBusiness.category && <span>{selectedBusiness.category}</span>}<b>{selectedBusiness.name}</b>{Number.isFinite(selectedBusiness.distanceKm) && <small>A {formatDistance(selectedBusiness.distanceKm)}</small>}{selectedBusiness.reviewCount > 0 && <small>★ {selectedBusiness.rating.toFixed(1)} ({selectedBusiness.reviewCount})</small>}<button type="button" onClick={() => onBusinessOpen?.(selectedBusiness)}>Ver negocio</button></div> : <div className="dynamic-map__business-copy dynamic-map__business-copy--no-image">{selectedBusiness.category && <span>{selectedBusiness.category}</span>}<b>{selectedBusiness.name}</b><button type="button" onClick={() => onBusinessOpen?.(selectedBusiness)}>Ver negocio</button></div>}</article>}{notice && <p className="dynamic-map__notice" role="status">{notice}</p>}{state === "loading" && <div className="dynamic-map__loading">Cargando mapa…</div>}</div>;
}
