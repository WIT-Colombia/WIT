import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { alphabeticalCategories, type Business } from "../data/mockData";
import { searchUniversal, prioritizeFeaturedByDistance } from "../services/businessService";
import { hydrateBusinessRatings } from "../services/publicBusinessApi";
import { useLocationContext } from "../context/LocationContext";
import { useFavorites } from "../services/favoritesService";
import { BusinessCard } from "../components/EntityCards";
import { GoogleDynamicMap } from "../components/GoogleDynamicMap";
import { distanceBetweenCoordinates, getBusinessCoordinates, getCoordinateDestination, type Coordinates } from "../utils/coordinates";
import { LocationAvailabilityNotice } from "../components/LocationAvailabilityNotice";
import { PageLayout } from "../components/PageLayout";
import { loadGoogleMaps } from "../services/googleMapsLoader";
import { MAP_RADII_KM, resolveMapRadiusIndex } from "../utils/searchArea";
import { rememberBusinessVisitContext } from "../services/analyticsService";
import "./Map.css";

const radiusLabels = ["1 km", "3 km", "5 km", "10 km", "Ciudad"];

export default function Map() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const category = params.get("category") ?? "";
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [items, setItems] = useState<Business[]>([]);
  const [mapPosition, setMapPosition] = useState<{ original: string; coordinates: Coordinates } | null>(null);
  const [resultsVisibleCount, setResultsVisibleCount] = useState(8);
  const { favorites, toggleFavorite } = useFavorites();
  const { selection } = useLocationContext();
  const location = selection?.locality ?? null;
  const radiusIndex = resolveMapRadiusIndex(params, Boolean(location?.name));
  const radiusKm = MAP_RADII_KM[radiusIndex] ?? null;
  const cityScope = radiusIndex === MAP_RADII_KM.length;
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
  const originalCenterKey = center ? `${center.lat},${center.lng}` : "";
  const searchCenter = mapPosition?.original === originalCenterKey ? mapPosition.coordinates : center;
  const mapMoved = Boolean(center && searchCenter && distanceBetweenCoordinates(center, searchCenter) > 0.05);
  const maxRadiusIndex = location?.name && !mapMoved ? MAP_RADII_KM.length : MAP_RADII_KM.length - 1;
  useEffect(() => {
    let active = true;
    // Manual city selections may obtain their coordinates asynchronously.
    // Never call the API with no scope and no location.
    setItems([]);
    if (!searchCenter) return () => { active = false; };
    const searchArea = cityScope && !mapMoved && location?.name
      ? { scope: "city" as const, city: location.name, region: location.context }
      : { latitude: searchCenter.lat, longitude: searchCenter.lng, radiusKm: radiusKm ?? 1 };
    void searchUniversal({ query, category, ...searchArea, businessPageSize: 50 })
      .then(async ({ businesses: foundBusinesses, products, services }) => {
        const ratedBusinesses = await hydrateBusinessRatings(foundBusinesses);
        if (!active) return;
        const byId = new globalThis.Map(ratedBusinesses.map((business) => [business.id, business]));
        [...products, ...services].forEach((offer) => {
          if (!byId.has(offer.businessId)) {
            byId.set(offer.businessId, {
              id: offer.businessId, name: offer.businessName ?? "Negocio",
              category: "Resultados relacionados", rating: 0, reviewCount: 0,
              distanceKm: Number.POSITIVE_INFINITY, isOpen: true,
              address: "Ubicación no pública", image: "", tags: [],
              coordinates: offer.businessCoordinates,
            });
          }
        });
        setItems([...byId.values()].map((business) => ({
          ...business,
          distanceKm: business.coordinates
            ? distanceBetweenCoordinates(searchCenter, business.coordinates)
            : Number.POSITIVE_INFINITY,
        })));
      }).catch(() => { if (active) setItems([]); });
    return () => { active = false; };
  }, [query, category, searchCenter?.lat, searchCenter?.lng, radiusIndex, cityScope, radiusKm, location?.name, location?.context, mapMoved]);
  const ordered = useMemo(() => prioritizeFeaturedByDistance(items), [items]);
  const visible = ordered.filter((business) => {
    const point = getBusinessCoordinates(business);
    return Boolean(point && searchCenter && ((cityScope && !mapMoved) || (radiusKm !== null && distanceBetweenCoordinates(searchCenter, point) <= radiusKm)));
  });
  useEffect(() => { setResultsVisibleCount(8); }, [query, category, radiusIndex, selection, searchCenter?.lat, searchCenter?.lng]);
  const visibleResults = visible.slice(0, resultsVisibleCount);
  const hasMoreResults = resultsVisibleCount < visible.length;
  const resultsAtEnd = visible.length > 8 && !hasMoreResults;
  const nextRadiusIndex = Math.min(radiusIndex + 1, maxRadiusIndex);
  const radiusActionLabel = radiusIndex >= maxRadiusIndex ? "Cobertura máxima" : `Ampliar a ${radiusLabels[nextRadiusIndex]}`;
  const handleRadiusChange = useCallback((nextIndex: number) => {
    const safeIndex = Math.max(0, Math.min(nextIndex, maxRadiusIndex));
    setParams(current => {
      const next = new URLSearchParams(current);
      next.delete("scope");
      next.delete("radiusKm");
      if (safeIndex === MAP_RADII_KM.length && location?.name) {
        next.set("scope", "city");
      } else {
        next.set("radiusKm", String(MAP_RADII_KM[safeIndex] ?? 1));
      }
      return next;
    });
  }, [setParams, location?.name, maxRadiusIndex]);
  const handleMapMoved = useCallback((nextCenter: Coordinates) => {
    setMapPosition({ original: originalCenterKey, coordinates: nextCenter });
    if (cityScope) handleRadiusChange(0);
  }, [originalCenterKey, cityScope, handleRadiusChange]);
  const visibleLocation = location?.name ?? (selection?.mode === "automatic" ? "tu ubicación actual" : "una zona seleccionada");
  const userLocation = selection?.mode === "automatic" && getCoordinateDestination(selection.coordinates) ? selection.coordinates : null;
  const mapContext = (business: Business) => ({ source: 'map' as const, category: business.category, isFeatured: business.plan === 'premium' || business.isFeatured });
  const openBusiness = useCallback((business: Business) => {
    rememberBusinessVisitContext(business.id, mapContext(business));
    navigate(`/business/${business.id}`);
  }, [navigate]);
  function updateCategory(value: string) {
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (value) next.set("category", value); else next.delete("category");
      next.delete("scope");
      next.set("radiusKm", "1");
      return next;
    });
  }
  const mapUnavailable = !selection || (selection.mode === "manual" && manualCenterState === "error");
  const mapResolving = selection?.mode === "manual" && manualCenterState === "loading";
  const mapFilters = category
    ? `Mostrando negocios de la categoría “${category}”${query ? ` · búsqueda: “${query}”` : ""}`
    : query ? `búsqueda: “${query}”` : "";
  const mapHeading = mapMoved ? `Explorando otra zona del mapa${mapFilters ? ` · ${mapFilters}` : ""}` : category ? `${mapFilters} cerca de ${visibleLocation}` : `Resultados para ${visibleLocation}${mapFilters ? ` · ${mapFilters}` : ""}`;
  return <PageLayout active="explore" className="map-page"><div className="map-page-heading"><div><h1>Explora en el mapa</h1><p className={category ? "map-context map-context--active" : "map-context"}>{category && <span className="map-context__icon" aria-hidden="true">✓</span>}{mapHeading} {cityScope ? "en la ciudad seleccionada" : `a ${radiusKm ?? 1} km`}.</p></div><Link to={`/results${params.toString() ? `?${params.toString()}` : ""}`}>Ver resultados en lista →</Link></div><div className="map-controls"><label className="map-search">⌕<span className="sr-only">Buscar en el mapa</span><input value={query} onChange={(event) => { setQuery(event.target.value); handleRadiusChange(0); }} placeholder="¿Qué estás buscando?"/></label></div><div className="map-category-chips"><button className={!category ? "selected" : ""} type="button" onClick={() => { updateCategory(""); }}>Todo</button>{alphabeticalCategories.map((item) => <button className={category === item.name ? "selected" : ""} type="button" key={item.name} onClick={() => { updateCategory(category === item.name ? "" : item.name); }}>{item.icon} {item.name}</button>)}</div>{!selection ? <LocationAvailabilityNotice location={location} query={query}/> : mapResolving ? <div className="map-content"><section className="map-canvas"><div className="dynamic-map dynamic-map-fallback" role="status"><b>Ubicando la ciudad…</b><p>Estamos obteniendo su centro geográfico para preparar el mapa.</p></div></section></div> : mapUnavailable ? <div className="map-content"><section className="map-canvas"><div className="dynamic-map dynamic-map-fallback" role="status"><b>No pudimos ubicar esta ciudad</b><p>{manualCenterError === "GEOCODING_REJECTED" ? "Google Maps rechazó la geocodificación. Revisa que Maps JavaScript API, Geocoding y la facturación estén habilitados para esta clave." : "Selecciona otra ubicación o permite la ubicación del navegador para explorar el mapa."}</p><Link to="/location">Cambiar ubicación</Link></div></section></div> : <div className="map-content"><section className="map-canvas"><GoogleDynamicMap businesses={visible} center={center} searchCenter={searchCenter} userLocation={userLocation} radiusKm={radiusKm} radiusLabels={radiusLabels} radiusIndex={radiusIndex} cityAvailable={Boolean(location?.name) && !mapMoved} onRadiusChange={handleRadiusChange} onMapMoved={handleMapMoved} onBusinessOpen={openBusiness}/></section><aside className="map-results"><div className="map-results-heading"><div><b>{visible.length} lugares</b><span>Cobertura actual: {radiusLabels[radiusIndex]}</span></div><button className="map-expand-button" type="button" onClick={() => handleRadiusChange(nextRadiusIndex)} disabled={radiusIndex >= maxRadiusIndex}>{radiusActionLabel}</button></div>{visible.length ? <><div className="map-results-grid">{visibleResults.map((business) => <BusinessCard key={business.id} business={business} analyticsContext={mapContext(business)} favorite={favorites.includes(business.id)} onFavorite={() => { void toggleFavorite(business.id); }}/>)}</div>{visible.length > 8 && <button className="map-results-more" type="button" onClick={() => { if (resultsAtEnd) { setResultsVisibleCount(8); document.querySelector('.map-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } else setResultsVisibleCount((count) => Math.min(count + 8, visible.length)); }}>{resultsAtEnd ? 'Volver arriba ↑' : 'Ver más ↓'}</button>}</> : <div className="map-empty" role="status"><span className="map-empty__icon" aria-hidden="true">⌕</span><b>Ubicación no disponible</b><p>{cityScope ? "Solo aparecen negocios del municipio seleccionado que tengan una ubicación pública verificable." : "Solo mostramos negocios que tienen coordenadas verificadas dentro del radio seleccionado."}</p><div className="map-empty__actions"><button type="button" onClick={() => handleRadiusChange(nextRadiusIndex)} disabled={radiusIndex >= maxRadiusIndex}>{radiusActionLabel} <span aria-hidden="true">→</span></button><Link to="/search">Cambiar búsqueda</Link></div></div>}</aside></div>}</PageLayout>;
}
