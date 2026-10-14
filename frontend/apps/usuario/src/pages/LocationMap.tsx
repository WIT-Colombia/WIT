import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { PageLayout } from "../components/PageLayout";
import { useLocationContext } from "../context/LocationContext";
import { loadGoogleMaps, type GoogleMapInstance, type GoogleMarkerInstance } from "../services/googleMapsLoader";
import type { Coordinates } from "../services/locationService";
import "./LocationMap.css";

const DEFAULT_CENTER: Coordinates = { lat: 3.5394, lng: -76.3036 };

export default function LocationMap() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { selection, setAutomaticLocation } = useLocationContext();
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GoogleMapInstance | null>(null);
  const markerRef = useRef<GoogleMarkerInstance | null>(null);
  const returnToParam = params.get("returnTo");
  const returnTo = returnToParam?.startsWith("/") ? returnToParam : "/home";
  const initialSelectionPoint = selection?.coordinates ?? null;
  const [point, setPoint] = useState<Coordinates | null>(initialSelectionPoint);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmationError, setConfirmationError] = useState(false);

  useEffect(() => {
    let active = true;
    setStatus("loading");
    setConfirmationError(false);
    const cityAddress = selection?.locality && !selection.coordinates
      ? `${selection.locality.name}, ${selection.locality.context}, Colombia`
      : null;
    setPoint(selection?.coordinates ?? null);
    void loadGoogleMaps().then(async (maps) => {
      const initial = await new Promise<Coordinates>((resolve, reject) => {
        if (!cityAddress) {
          resolve(selection?.coordinates ?? DEFAULT_CENTER);
          return;
        }
        if (!maps.Geocoder) {
          reject(new Error("GOOGLE_MAPS_GEOCODER_UNAVAILABLE"));
          return;
        }
        new maps.Geocoder().geocode({ address: cityAddress }, (results, geocodeStatus) => {
          const location = results?.[0]?.geometry?.location;
          if (geocodeStatus !== "OK" || !location) {
            reject(new Error(`GOOGLE_MAPS_GEOCODING_${geocodeStatus}`));
            return;
          }
          resolve({ lat: location.lat(), lng: location.lng() });
        });
      });
      return { maps, initial };
    }).then(({ maps, initial }) => {
      if (!active || !canvasRef.current) return;
      setPoint((current) => current ?? initial);
      const map = new maps.Map(canvasRef.current, { center: initial, zoom: 14, mapTypeControl: false, streetViewControl: false, fullscreenControl: false, gestureHandling: "greedy" });
      mapRef.current = map;
      markerRef.current = new maps.Marker({ map, position: initial, title: "Ubicación seleccionada" });
      map.addListener("click", (event) => {
        const lat = event.latLng?.lat();
        const lng = event.latLng?.lng();
        if (typeof lat !== "number" || typeof lng !== "number") return;
        const next = { lat, lng };
        markerRef.current?.setPosition(next);
        setPoint(next);
      });
      setStatus("ready");
    }).catch((error: unknown) => {
      if (import.meta.env.DEV) console.error("[XAMUKO Usuario] Error al cargar el selector de ubicación", error);
      if (active) setStatus("error");
    });
    return () => { active = false; markerRef.current?.setMap(null); mapRef.current = null; };
  }, [selection]);

  async function savePoint() {
    if (!point) return;
    setIsConfirming(true);
    setConfirmationError(false);
    try {
      await setAutomaticLocation(point);
      navigate(returnTo, { replace: true });
    } catch {
      setConfirmationError(true);
    } finally {
      setIsConfirming(false);
    }
  }

  return <PageLayout active="explore" className="location-picker-page">
    <div className="location-picker-heading"><div><span>UBICA TU ZONA</span><h1>Elige tu ubicación en el mapa</h1><p>Toca el punto donde quieres buscar negocios y productos cerca de ti.</p></div><Link to={returnTo}>← Volver</Link></div>
    <section className="location-picker-card" aria-label="Mapa para elegir ubicación">
      {status === "loading" && <div className="location-picker-state"><b>Cargando mapa…</b><span>Espera un momento para elegir tu punto.</span></div>}
      {status === "error" && <div className="location-picker-state"><b>No pudimos cargar el mapa</b><span>Revisa la conexión o elige una ciudad manualmente.</span><Link to="/location">Elegir ciudad</Link></div>}
      <div ref={canvasRef} className={`location-picker-canvas${status !== "ready" ? " is-hidden" : ""}`} aria-label="Mapa interactivo de Google Maps" />
    </section>
    <div className="location-picker-actions"><span>{confirmationError ? "No pudimos confirmar el punto. Inténtalo de nuevo." : point ? "Punto seleccionado en el mapa" : "Toca el mapa para elegir un punto"}</span><button type="button" disabled={!point || status !== "ready" || isConfirming} onClick={savePoint}>{isConfirming ? "Confirmando ubicación…" : "Confirmar ubicación"} <span aria-hidden="true">→</span></button></div>
  </PageLayout>;
}
