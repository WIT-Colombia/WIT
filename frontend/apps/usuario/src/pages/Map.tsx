import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { alphabeticalCategories, type Business } from "../data/mockData";
import { getBusinesses, prioritizeFeaturedByDistance } from "../services/businessService";
import { hasSampleCatalogForLocation } from "../services/locationService";
import { useLocationContext } from "../context/LocationContext";
import { getFavoriteIds, toggleFavorite } from "../services/userDataService";
import { BusinessCard } from "../components/EntityCards";
import { GoogleDynamicMap } from "../components/GoogleDynamicMap";
import { distanceBetweenCoordinates, getBusinessCoordinates, getCoordinateDestination, type Coordinates } from "../utils/coordinates";
import { LocationAvailabilityNotice } from "../components/LocationAvailabilityNotice";
import { PageLayout } from "../components/PageLayout";
import { loadGoogleMaps } from "../services/googleMapsLoader";
import "./Map.css";

const radiusSteps = [1, 3, 5, Number.POSITIVE_INFINITY];
const radiusLabels = ["1 km", "3 km", "5 km", "toda la ciudad"];

export default function Map() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const category = params.get("category") ?? "";
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
      if (!maps.Geocoder) {
        reject(new Error("GOOGLE_MAPS_GEOCODER_UNAVAILABLE"));
        return;
      }
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
  useEffect(() => { if (!hasSampleCatalog) { setItems([]); return; } let active = true; const userCoordinates = selection?.coordinates; void getBusinesses({ query, category }).then((found) => { if (!active) return; setItems(found.map((business) => ({ ...business, distanceKm: userCoordinates && business.coordinates ? distanceBetweenCoordinates(userCoordinates, business.coordinates) : Number.POSITIVE_INFINITY }))); }); return () => { active = false; }; }, [query, category, hasSampleCatalog, selection]);
  const ordered = useMemo(() => prioritizeFeaturedByDistance(items), [items]);
  const visible = ordered.filter((business) => {
    const point = getBusinessCoordinates(business);
    return Boolean(point && center && (radiusSteps[radiusIndex] === Number.POSITIVE_INFINITY || distanceBetweenCoordinates(center, point) <= radiusSteps[radiusIndex]));
  });
  const nextRadiusIndex = Math.min(radiusIndex + 1, radiusSteps.length - 1);
  const radiusActionLabel = radiusIndex === radiusSteps.length - 1 ? "Radio máximo" : `Ampliar a ${radiusLabels[nextRadiusIndex]}`;
  const handleRadiusChange = useCallback((nextIndex: number) => {
    setRadiusIndex((current) => current === nextIndex ? current : Math.max(0, Math.min(nextIndex, radiusSteps.length - 1)));
  }, []);
  const visibleLocation = location?.name ?? (selection?.mode === "automatic" ? "tu ubicación actual" : "una zona seleccionada");
  const userLocation = selection?.mode === "automatic" && getCoordinateDestination(selection.coordinates) ? selection.coordinates : null;
  const openBusiness = useCallback((business: Business) => navigate(`/business/${business.id}`), [navigate]);
  function updateCategory(value: string) {
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (value) next.set("category", value); else next.delete("category");
      return next;
    });
  }
  const mapUnavailable = !selection || (selection.mode === "manual" && manualCenterState === "error");
  const mapResolving = selection?.mode === "manual" && manualCenterState === "loading";
  const mapFilters = category
    ? `Mostrando negocios de la categoría “${category}”${query ? ` · búsqueda: “${query}”` : ""}`
    : query ? `búsqueda: “${query}”` : "";
  const mapHeading = category ? `${mapFilters} cerca de ${visibleLocation}` : `Resultados para ${visibleLocation}${mapFilters ? ` · ${mapFilters}` : ""}`;
  return <PageLayout active="explore" className="map-page"><div className="map-page-heading"><div><h1>Explora en el mapa</h1><p className={category ? "map-context map-context--active" : "map-context"}>{category && <span className="map-context__icon" aria-hidden="true">✓</span>}{mapHeading} dentro de {radiusLabels[radiusIndex]}.</p></div><Link to={`/results${params.toString() ? `?${params.toString()}` : ""}`}>Ver resultados en lista →</Link></div><div className="map-controls"><label className="map-search">⌕<span className="sr-only">Buscar en el mapa</span><input value={query} onChange={(event) => { setQuery(event.target.value); setRadiusIndex(0); }} placeholder="¿Qué estás buscando?"/></label></div><div className="map-category-chips"><button className={!category ? "selected" : ""} type="button" onClick={() => { updateCategory(""); setRadiusIndex(0); }}>Todo</button>{alphabeticalCategories.map((item) => <button className={category === item.name ? "selected" : ""} type="button" key={item.name} onClick={() => { updateCategory(category === item.name ? "" : item.name); setRadiusIndex(0); }}>{item.icon} {item.name}</button>)}</div>{!selection ? <LocationAvailabilityNotice location={location} query={query}/> : mapResolving ? <div className="map-content"><section className="map-canvas"><div className="dynamic-map dynamic-map-fallback" role="status"><b>Ubicando la ciudad…</b><p>Estamos obteniendo su centro geográfico para preparar el mapa.</p></div></section></div> : mapUnavailable ? <div className="map-content"><section className="map-canvas"><div className="dynamic-map dynamic-map-fallback" role="status"><b>No pudimos ubicar esta ciudad</b><p>{manualCenterError === "GEOCODING_REJECTED" ? "Google Maps rechazó la geocodificación. Revisa que Maps JavaScript API, Geocoding y la facturación estén habilitados para esta clave." : "Selecciona otra ubicación o permite la ubicación del navegador para explorar el mapa."}</p><Link to="/location">Cambiar ubicación</Link></div></section></div> : <div className="map-content"><section className="map-canvas"><GoogleDynamicMap businesses={visible} center={center} userLocation={userLocation} radiusKm={radiusSteps[radiusIndex] === Number.POSITIVE_INFINITY ? null : radiusSteps[radiusIndex]} radiusLabels={radiusLabels} radiusIndex={radiusIndex} onRadiusChange={handleRadiusChange} onBusinessOpen={openBusiness}/></section><aside className="map-results"><div className="map-results-heading"><div><b>{visible.length} lugares</b><span>Radio actual: {radiusLabels[radiusIndex]}</span></div><button className="map-expand-button" type="button" onClick={() => handleRadiusChange(nextRadiusIndex)} disabled={radiusIndex === radiusSteps.length - 1}>{radiusActionLabel}</button></div>{visible.length ? visible.map((business) => <BusinessCard key={business.id} business={business} favorite={favorites.includes(business.id)} onFavorite={() => setFavorites(toggleFavorite(business.id))}/>) : <div className="map-empty" role="status"><span className="map-empty__icon" aria-hidden="true">⌕</span><b>Ubicación no disponible</b><p>Solo mostramos negocios que tienen coordenadas verificadas dentro del radio seleccionado.</p><div className="map-empty__actions"><button type="button" onClick={() => handleRadiusChange(nextRadiusIndex)} disabled={radiusIndex === radiusSteps.length - 1}>{radiusActionLabel} <span aria-hidden="true">→</span></button><Link to="/search">Cambiar búsqueda</Link></div></div>}</aside></div>}</PageLayout>;
}
