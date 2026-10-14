import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { categories, type Business } from "../data/mockData";
import { getBusinesses, prioritizeFeaturedByDistance } from "../services/businessService";
import { hasSampleCatalogForLocation } from "../services/locationService";
import { useLocationContext } from "../context/LocationContext";
import { getFavoriteIds, toggleFavorite } from "../services/userDataService";
import { BusinessCard } from "../components/EntityCards";
import { GoogleDynamicMap } from "../components/GoogleDynamicMap";
import { distanceBetweenCoordinates, getBusinessCoordinates, type Coordinates } from "../utils/coordinates";
import { LocationAvailabilityNotice } from "../components/LocationAvailabilityNotice";
import { PageLayout } from "../components/PageLayout";
import { loadGoogleMaps } from "../services/googleMapsLoader";
import "./Map.css";

const radiusSteps = [3, 5, 10, Number.POSITIVE_INFINITY];
const radiusLabels = ["3 km", "5 km", "10 km", "toda la ciudad"];

export default function Map() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [category, setCategory] = useState(params.get("category") ?? "");
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [items, setItems] = useState<Business[]>([]);
  const [favorites, setFavorites] = useState(getFavoriteIds);
  const [radiusIndex, setRadiusIndex] = useState(0);
  const { selection } = useLocationContext();
  const location = selection?.locality ?? null;
  const [manualCenter, setManualCenter] = useState<Coordinates | null>(null);
  const [manualCenterState, setManualCenterState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [manualCenterError, setManualCenterError] = useState("UNKNOWN");
  const manualAddress = location && !selection?.coordinates ? `${location.name}, ${location.context}, Colombia` : null;
  useEffect(() => {
    if (!manualAddress) {
      setManualCenter(null);
      setManualCenterState("idle");
      return;
    }
    let active = true;
    setManualCenter(null);
    setManualCenterState("loading");
    setManualCenterError("UNKNOWN");
    void loadGoogleMaps().then((maps) => new Promise<Coordinates>((resolve, reject) => {
      const geocoder = new maps.Geocoder();
      geocoder.geocode({ address: manualAddress }, (results, status) => {
        const point = results?.[0]?.geometry?.location;
        if (status !== "OK" || !point) {
          setManualCenterError("GEOCODING_REJECTED");
          reject(new Error(`GOOGLE_MAPS_GEOCODING_${status}`));
          return;
        }
        resolve({ lat: point.lat(), lng: point.lng() });
      });
    })).then((point) => {
      if (!active) return;
      setManualCenter(point);
      setManualCenterState("ready");
    }).catch(() => {
      if (active) {
        setManualCenterError("GEOCODING_REJECTED");
        setManualCenterState("error");
      }
    });
    return () => { active = false; };
  }, [manualAddress]);
  const center: Coordinates | null = selection?.mode === "automatic" ? selection.coordinates : selection?.coordinates ?? manualCenter;
  // The map can be centered on any selected city; the local demo catalog is
  // only loaded for locations that explicitly have sample listings.
  const hasSampleCatalog = hasSampleCatalogForLocation(location);
  useEffect(() => { if (!hasSampleCatalog) { setItems([]); return; } let active = true; void getBusinesses({ query, category }).then((found) => { if (active) setItems(found); }); return () => { active = false; }; }, [query, category, hasSampleCatalog]);
  const ordered = useMemo(() => prioritizeFeaturedByDistance(items), [items]);
  const visible = ordered.filter((business) => {
    const point = getBusinessCoordinates(business);
    return Boolean(point && center && (radiusSteps[radiusIndex] === Number.POSITIVE_INFINITY || distanceBetweenCoordinates(center, point) <= radiusSteps[radiusIndex]));
  });
  const nextRadiusIndex = (radiusIndex + 1) % radiusSteps.length;
  const radiusActionLabel = radiusIndex === radiusSteps.length - 1 ? "Regresar a 3 km" : `Ampliar a ${radiusLabels[nextRadiusIndex]}`;
  const visibleLocation = location?.name ?? (selection?.mode === "automatic" ? "tu ubicación actual" : "una zona seleccionada");
  const mapUnavailable = !selection || (selection.mode === "manual" && manualCenterState === "error");
  const mapResolving = selection?.mode === "manual" && manualCenterState === "loading";
  return <PageLayout active="explore" className="map-page"><div className="map-page-heading"><div><h1>Explora en el mapa</h1><p>Resultados para {visibleLocation} dentro de {radiusLabels[radiusIndex]}.</p></div><Link to={`/results${params.toString() ? `?${params.toString()}` : ""}`}>Ver resultados en lista →</Link></div><div className="map-controls"><label className="map-search">⌕<span className="sr-only">Buscar en el mapa</span><input value={query} onChange={(event) => { setQuery(event.target.value); setRadiusIndex(0); }} placeholder="¿Qué estás buscando?"/></label></div><div className="map-category-chips"><button className={!category ? "selected" : ""} type="button" onClick={() => { setCategory(""); setRadiusIndex(0); }}>Todo</button>{categories.map((item) => <button className={category === item.name ? "selected" : ""} type="button" key={item.name} onClick={() => { setCategory(category === item.name ? "" : item.name); setRadiusIndex(0); }}>{item.icon} {item.name}</button>)}</div>{!selection ? <LocationAvailabilityNotice location={location} query={query}/> : mapResolving ? <div className="map-content"><section className="map-canvas"><div className="dynamic-map dynamic-map-fallback" role="status"><b>Ubicando la ciudad…</b><p>Estamos obteniendo su centro geográfico para preparar el mapa.</p></div></section></div> : mapUnavailable ? <div className="map-content"><section className="map-canvas"><div className="dynamic-map dynamic-map-fallback" role="status"><b>No pudimos ubicar esta ciudad</b><p>{manualCenterError === "GEOCODING_REJECTED" ? "Google Maps rechazó la geocodificación. Revisa que Maps JavaScript API, Geocoding y la facturación estén habilitados para esta clave." : "Selecciona otra ubicación o permite la ubicación del navegador para explorar el mapa."}</p><Link to="/location">Cambiar ubicación</Link></div></section></div> : <div className="map-content"><section className="map-canvas"><GoogleDynamicMap businesses={visible} center={center} radiusKm={radiusSteps[radiusIndex] === Number.POSITIVE_INFINITY ? null : radiusSteps[radiusIndex]} onBusinessSelect={(business) => navigate(`/business/${business.id}`)}/></section><aside className="map-results"><div className="map-results-heading"><div><b>{visible.length} lugares</b><span>Radio actual: {radiusLabels[radiusIndex]}</span></div><button className="map-expand-button" type="button" onClick={() => setRadiusIndex(nextRadiusIndex)}>{radiusActionLabel}</button></div>{visible.length ? visible.map((business) => <BusinessCard key={business.id} business={business} favorite={favorites.includes(business.id)} onFavorite={() => setFavorites(toggleFavorite(business.id))}/>) : <div className="map-empty" role="status"><span className="map-empty__icon" aria-hidden="true">⌕</span><b>Ubicación no disponible</b><p>Solo mostramos negocios que tienen coordenadas verificadas dentro del radio seleccionado.</p><div className="map-empty__actions"><button type="button" onClick={() => setRadiusIndex(nextRadiusIndex)}>{radiusActionLabel} <span aria-hidden="true">→</span></button><Link to="/search">Cambiar búsqueda</Link></div></div>}</aside></div>}</PageLayout>;
}
