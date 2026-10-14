import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps, type GoogleMapInstance, type GoogleMarkerInstance } from "../../../usuario/src/services/googleMapsLoader";
import "../styles/location-picker.css";

type Coordinates = { lat: number; lng: number };
type Props = { value: Coordinates | null; query?: string; onChange: (value: Coordinates) => void; onCancel?: () => void };

export function BusinessLocationPicker({ value, query = "", onChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<GoogleMapInstance | null>(null);
  const markerRef = useRef<GoogleMarkerInstance | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const hasApiKey = Boolean(import.meta.env.VITE_GOOGLE_MAPS_JS_API_KEY?.trim());
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setMessage("");
    if (!hasApiKey) { setLoading(false); setMessage("El mapa interactivo no está disponible sin una API key. Escribe la dirección para continuar."); return undefined; }
    void loadGoogleMaps().then(maps => {
      if (cancelled || !containerRef.current) return;
      const initial = value ?? { lat: 4.71099, lng: -74.07209 };
      const mapOptions = { center: initial, zoom: value ? 16 : 12, mapTypeId: "satellite", mapTypeControl: true, streetViewControl: false, fullscreenControl: true, gestureHandling: "greedy" } as ConstructorParameters<typeof maps.Map>[1];
      const map = new maps.Map(containerRef.current, mapOptions);
      mapRef.current = map;
      const place = (position: Coordinates) => { markerRef.current?.setMap(null); markerRef.current = new maps.Marker({ map, position, title: "Ubicación del negocio" }); map.setCenter(position); map.setZoom(16); onChange(position); };
      map.addListener("click", event => { if (event.latLng) place({ lat: event.latLng.lat(), lng: event.latLng.lng() }); });
      if (value) place(value);
      else if (query.trim() && maps.Geocoder) new maps.Geocoder().geocode({ address: query }, (results) => { const location = results?.[0]?.geometry?.location; if (location && !cancelled) place({ lat: location.lat(), lng: location.lng() }); });
      setLoading(false);
    }).catch(error => {
      if (import.meta.env.DEV) console.error("[XAMUKO Business] Error al cargar Google Maps", error);
      if (!cancelled) {
        setLoading(false);
        const code = error instanceof Error ? error.message : "GOOGLE_MAPS_UNKNOWN_ERROR";
        setMessage(code === "GOOGLE_MAPS_JS_KEY_MISSING"
          ? "Agrega una API key de Google Maps para seleccionar en el mapa. Puedes continuar con la dirección escrita."
          : `No se pudo cargar Google Maps.${import.meta.env.DEV ? ` Código: ${code}.` : " Puedes continuar con la dirección escrita."}`);
      }
    });
    return () => { cancelled = true; mapRef.current = null; markerRef.current = null; };
  }, [hasApiKey]);
  return <div className="business-location-picker">{hasApiKey && <div ref={containerRef} className="business-location-picker__map" aria-label="Selector de ubicación en Google Maps" />}{hasApiKey && loading && <p className="business-location-picker__status">Cargando mapa…</p>}{message && <div className="business-location-picker__fallback" role="status"><strong>Selector de mapa no disponible</strong><p>{message}</p></div>}{value && <p className="business-location-picker__coordinates">Ubicación seleccionada: {value.lat.toFixed(6)}, {value.lng.toFixed(6)}</p>}</div>;
}
