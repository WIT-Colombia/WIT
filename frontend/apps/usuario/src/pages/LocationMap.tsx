import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PageLayout } from "../components/PageLayout";
import { useLocationContext } from "../context/LocationContext";
import { loadGoogleMaps, type GoogleMapInstance, type GoogleMarkerInstance } from "../services/googleMapsLoader";
import type { Coordinates } from "../services/locationService";
import "./LocationMap.css";

const DEFAULT_CENTER: Coordinates = { lat: 3.5394, lng: -76.3036 };

export default function LocationMap() {
  const navigate = useNavigate();
  const { selection, setAutomaticLocation } = useLocationContext();
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GoogleMapInstance | null>(null);
  const markerRef = useRef<GoogleMarkerInstance | null>(null);
  const [point, setPoint] = useState<Coordinates | null>(selection?.mode === "automatic" ? selection.coordinates : selection?.coordinates ?? DEFAULT_CENTER);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let active = true;
    void loadGoogleMaps().then((maps) => {
      if (!active || !canvasRef.current) return;
      const initial = selection?.mode === "automatic" ? selection.coordinates : selection?.coordinates ?? DEFAULT_CENTER;
      const map = new maps.Map(canvasRef.current, { center: initial, zoom: 14, mapTypeControl: false, streetViewControl: false, fullscreenControl: false, gestureHandling: "greedy" });
      mapRef.current = map;
      markerRef.current = new maps.Marker({ map, position: initial, title: "Tu ubicación" });
      map.addListener("click", (event) => {
        const lat = event.latLng?.lat();
        const lng = event.latLng?.lng();
        if (typeof lat !== "number" || typeof lng !== "number") return;
        const next = { lat, lng };
        markerRef.current?.setPosition(next);
        setPoint(next);
      });
      setStatus("ready");
    }).catch(() => { if (active) setStatus("error"); });
    return () => { active = false; markerRef.current?.setMap(null); mapRef.current = null; };
  }, [selection]);

  function savePoint() {
    if (!point) return;
    setAutomaticLocation(point);
    navigate("/home");
  }

  return <PageLayout active="explore" className="location-picker-page">
    <div className="location-picker-heading"><div><span>UBICA TU ZONA</span><h1>Elige tu ubicación en el mapa</h1><p>Toca el punto donde quieres buscar negocios y productos cerca de ti.</p></div><Link to="/location">← Volver</Link></div>
    <section className="location-picker-card" aria-label="Mapa para elegir ubicación">
      {status === "loading" && <div className="location-picker-state"><b>Cargando mapa…</b><span>Espera un momento para elegir tu punto.</span></div>}
      {status === "error" && <div className="location-picker-state"><b>No pudimos cargar el mapa</b><span>Revisa la conexión o elige una ciudad manualmente.</span><Link to="/location">Elegir ciudad</Link></div>}
      <div ref={canvasRef} className={`location-picker-canvas${status !== "ready" ? " is-hidden" : ""}`} aria-label="Mapa interactivo de Google Maps" />
    </section>
    <div className="location-picker-actions"><span>{point ? "Punto seleccionado en el mapa" : "Toca el mapa para elegir un punto"}</span><button type="button" disabled={!point || status !== "ready"} onClick={savePoint}>Usar esta ubicación <span aria-hidden="true">→</span></button></div>
  </PageLayout>;
}
