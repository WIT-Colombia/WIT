import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { categories, type Business } from "../data/mockData";
import { getBusinesses, prioritizeFeaturedByDistance } from "../services/businessService";
import { getSelectedLocation, hasSampleCatalogForLocation } from "../services/locationService";
import { getFavoriteIds, toggleFavorite } from "../services/userDataService";
import { BusinessCard } from "../components/EntityCards";
import { GoogleDynamicMap } from "../components/GoogleDynamicMap";
import { LocationAvailabilityNotice } from "../components/LocationAvailabilityNotice";
import { PageLayout } from "../components/PageLayout";
import "./Map.css";

const radiusSteps = [1, 3, Number.POSITIVE_INFINITY];
const radiusLabels = ["1 km", "3 km", "toda la ciudad"];

export default function Map() {
  const [params] = useSearchParams();
  const [category, setCategory] = useState(params.get("category") ?? "");
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [items, setItems] = useState<Business[]>([]);
  const [favorites, setFavorites] = useState(getFavoriteIds);
  const [radiusIndex, setRadiusIndex] = useState(0);
  const location = getSelectedLocation();
  const hasSampleCatalog = hasSampleCatalogForLocation(location);
  useEffect(() => { if (!hasSampleCatalog) { setItems([]); return; } let active = true; void getBusinesses({ query, category }).then((found) => { if (active) setItems(found); }); return () => { active = false; }; }, [query, category, hasSampleCatalog]);
  const ordered = useMemo(() => prioritizeFeaturedByDistance(items), [items]);
  const visible = ordered.filter((business) => business.distanceKm <= radiusSteps[radiusIndex]);
  const nextRadiusIndex = radiusIndex === 0 ? 1 : radiusIndex === 1 ? 2 : 0;
  const radiusActionLabel = radiusIndex === 0 ? "Ampliar a 3 km" : radiusIndex === 1 ? "Buscar en toda la ciudad" : "Regresar a 1 km";
  return <PageLayout active="explore" className="map-page"><div className="map-page-heading"><div><h1>Explora en el mapa</h1><p>Resultados para {location?.name ?? "Palmira"} dentro de {radiusLabels[radiusIndex]}.</p></div><Link to={`/results?q=${encodeURIComponent(query)}`}>Ver resultados en lista →</Link></div><div className="map-controls"><label className="map-search">⌕<span className="sr-only">Buscar en el mapa</span><input value={query} onChange={(event) => { setQuery(event.target.value); setRadiusIndex(0); }} placeholder="¿Qué estás buscando?"/></label></div><div className="map-category-chips"><button className={!category ? "selected" : ""} type="button" onClick={() => { setCategory(""); setRadiusIndex(0); }}>Todo</button>{categories.map((item) => <button className={category === item.name ? "selected" : ""} key={item.name} type="button" onClick={() => { setCategory(category === item.name ? "" : item.name); setRadiusIndex(0); }}>{item.icon} {item.name}</button>)}</div>{!hasSampleCatalog ? <LocationAvailabilityNotice location={location} query={query}/> : <div className="map-content"><section className="map-canvas"><GoogleDynamicMap businesses={visible} query={`${query}:${category}:${radiusIndex}`} center={location ? `${location.name}, ${location.context}` : "Palmira, Valle del Cauca"}/></section><aside className="map-results"><div className="map-results-heading"><div><b>{visible.length} lugares</b><span>Radio actual: {radiusLabels[radiusIndex]}</span></div><button className="map-expand-button" type="button" onClick={() => setRadiusIndex(nextRadiusIndex)}>{radiusActionLabel}</button></div>{visible.length ? visible.map((business) => <BusinessCard key={business.id} business={business} favorite={favorites.includes(business.id)} onFavorite={() => setFavorites(toggleFavorite(business.id))}/>) : <div className="map-empty" role="status"><span className="map-empty__icon" aria-hidden="true">⌕</span><b>No encontramos lugares aquí</b><p>No hay negocios que coincidan con tu búsqueda dentro de {radiusLabels[radiusIndex]}.</p><div className="map-empty__actions">{radiusIndex === 0 && <button type="button" onClick={() => setRadiusIndex(1)}>Ampliar a 3 km <span aria-hidden="true">→</span></button>}{radiusIndex === 1 && <button type="button" onClick={() => setRadiusIndex(2)}>Buscar en toda la ciudad <span aria-hidden="true">→</span></button>}<Link to="/search">Cambiar búsqueda</Link></div></div>}</aside></div>}</PageLayout>;
}
