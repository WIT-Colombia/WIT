import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { categories, type Business } from "../data/mockData";
import { getBusinesses, prioritizeFeaturedByDistance } from "../services/businessService";
import { getSelectedLocation } from "../services/locationService";
import { getFavoriteIds, toggleFavorite } from "../services/userDataService";
import { BusinessCard } from "../components/EntityCards";
import { GoogleMapEmbed } from "../components/GoogleMapEmbed";
import { LocationAvailabilityNotice } from "../components/LocationAvailabilityNotice";
import { PageLayout } from "../components/PageLayout";
import { hasSampleCatalogForLocation } from "../services/locationService";
import "./Map.css";

export default function Map() {
  const [params] = useSearchParams();
  const [category, setCategory] = useState("");
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [openNow, setOpenNow] = useState(false);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [favorites, setFavorites] = useState(getFavoriteIds);
  const location = getSelectedLocation();
  const hasSampleCatalog = hasSampleCatalogForLocation(location);
  const mapLocation = [location?.name ?? "Palmira", location?.context ?? "Valle del Cauca", "Colombia"].join(", ");
  useEffect(() => {
    if (!hasSampleCatalog) {
      setBusinesses([]);
      return;
    }
    let current = true;
    void getBusinesses({ query, category }).then((found) => { if (current) setBusinesses(found); });
    return () => { current = false; };
  }, [query, category, hasSampleCatalog]);
  const filtered = prioritizeFeaturedByDistance(businesses.filter((business) => !openNow || business.isOpen));

  function saveFavorite(id: string) { setFavorites(toggleFavorite(id)); }

  return <PageLayout active="explore" className="map-page"><div className="map-page-heading"><div><span>ENCUENTRA CERCA DE TI</span><h1>Explora en el mapa</h1><p>{hasSampleCatalog ? `Mapa de ${location?.name ?? "Palmira"}, ${location?.context ?? "Valle del Cauca"}. Los establecimientos de la lista son ejemplos.` : `Mapa de ${location?.name ?? "tu zona"}, ${location?.context ?? "Colombia"}.`}</p></div><Link to={`/results${query ? `?q=${encodeURIComponent(query)}` : ""}`}>Ver resultados en lista →</Link></div>
    <div className="map-controls"><label className="map-search">⌕<span className="sr-only">Buscar en el mapa</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="¿Qué estás buscando?"/></label><label className="map-open-filter"><input type="checkbox" checked={openNow} onChange={(event) => setOpenNow(event.target.checked)}/> Abiertos ahora</label><Link to={`/filters${query ? `?q=${encodeURIComponent(query)}` : ""}`}>☷ Filtros</Link></div>
    <div className="map-category-chips"><button className={!category ? "selected" : ""} type="button" onClick={() => setCategory("")}>Todo</button>{categories.map((item) => <button className={category === item.name ? "selected" : ""} key={item.name} type="button" onClick={() => setCategory(category === item.name ? "" : item.name)}>{item.icon} {item.name}</button>)}</div>
    <div className="map-content"><section className="map-canvas" aria-label={`Mapa de ${mapLocation}`}><GoogleMapEmbed query={mapLocation} title={`Mapa de ${mapLocation}`} className="map-google-embed"/></section>
      <aside className="map-results">{hasSampleCatalog ? <><div className="map-results-heading"><div><b>{filtered.length} lugares</b><span>Ejemplos en {location?.name ?? "Palmira"}</span></div><Link to="/search">Cambiar búsqueda</Link></div>{filtered.length ? filtered.map((business) => <BusinessCard key={business.id} business={business} favorite={favorites.includes(business.id)} onFavorite={() => saveFavorite(business.id)}/>) : <div className="map-empty"><b>No encontramos lugares con esos filtros</b><p>Prueba otra búsqueda o categoría.</p><Link to={`/register-need${query ? `?q=${encodeURIComponent(query)}` : ""}`}>Cuéntanos qué necesitas</Link></div>}<p className="map-disclaimer">Estos negocios son ejemplos y todavía no tienen ubicaciones verificadas en el mapa.</p></> : <LocationAvailabilityNotice location={location} query={query}/>}</aside></div>
  </PageLayout>;
}
