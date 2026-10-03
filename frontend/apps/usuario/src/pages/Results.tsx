import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { type Business, type Product, type Service } from "../data/mockData";
import { getBusinesses, getMatchingProducts, getMatchingServices, prioritizeFeaturedByDistance } from "../services/businessService";
import { getSelectedLocation, hasSampleCatalogForLocation } from "../services/locationService";
import { SearchBar } from "../components/SearchBar";
import { LocationAvailabilityNotice } from "../components/LocationAvailabilityNotice";
import { SiteHeader } from "../components/SiteHeader";
import { BottomNavigation } from "../components/BottomNavigation";
import { BusinessCard, ProductCard, ServiceCard } from "../components/EntityCards";
import { NoResultsState } from "../components/NoResultsState";
import { getFavoriteIds, getLikeIds, toggleFavorite as persistFavorite, toggleLike as persistLike } from "../services/userDataService";
import "./Results.css";

export default function Results() {
  const [params, setParams] = useSearchParams();
  const [items, setItems] = useState<Business[]>([]);
  const [matchingProducts, setMatchingProducts] = useState<Product[]>([]);
  const [matchingServices, setMatchingServices] = useState<Service[]>([]);
  const [favorites, setFavorites] = useState<string[]>(getFavoriteIds);
  const [likes, setLikes] = useState<string[]>(getLikeIds);
  const [showAllBusinesses, setShowAllBusinesses] = useState(false);
  const [showAllOffers, setShowAllOffers] = useState(false);
  const query = params.get("q") ?? "";
  const category = params.get("category") ?? "";
  const location = getSelectedLocation();
  const hasSampleCatalog = hasSampleCatalogForLocation(location);

  useEffect(() => {
    if (!hasSampleCatalog) {
      setItems([]);
      setMatchingProducts([]);
      setMatchingServices([]);
      return;
    }
    let current = true;
    Promise.all([getBusinesses({ query, category }), getMatchingProducts({ query, category }), getMatchingServices({ query, category })])
      .then(([foundBusinesses, foundProducts, foundServices]) => {
        if (!current) return;
        setItems(foundBusinesses);
        setMatchingProducts(foundProducts);
        setMatchingServices(foundServices);
      });
    return () => { current = false; };
  }, [query, category, hasSampleCatalog]);

  const orderedItems = useMemo(() => prioritizeFeaturedByDistance(items), [items]);
  const allOffers = useMemo(() => [...matchingProducts.map((item) => ({ kind: "product" as const, item })), ...matchingServices.map((item) => ({ kind: "service" as const, item }))], [matchingProducts, matchingServices]);
  const visibleItems = showAllBusinesses ? orderedItems : orderedItems.slice(0, 20);
  const visibleOffers = showAllOffers ? allOffers : allOffers.slice(0, 20);

  function toggleFavorite(id: string) { setFavorites(persistFavorite(id)); }
  function updateQuery(value: string) { setParams((current) => { const next = new URLSearchParams(current); next.delete("category"); value.trim() ? next.set("q", value.trim()) : next.delete("q"); return next; }); }
  const heading = query ? `Resultados para “${query}”` : category || "Lugares cerca de ti";
  const resultCount = orderedItems.length + allOffers.length;
  const locationName = location?.name ?? "Palmira";

  return <div className="results-page"><SiteHeader active="explore"/><main className="results-main"><div className="results-topline"><Link to={`/search${query || category ? `?q=${encodeURIComponent(query || category)}` : ""}`}>← <span>Editar búsqueda</span></Link><span>Explorando en <strong>{location?.name ?? "Palmira"}, {location?.context ?? "Valle del Cauca"}</strong></span></div><SearchBar onSearch={updateQuery} initialValue={query}/><div className="results-heading"><div><span className="results-eyebrow">DESCUBRE LO LOCAL</span><h1>{heading}</h1><p>{hasSampleCatalog ? `${resultCount} ${resultCount === 1 ? "resultado" : "resultados"} de muestra para conocer en ${locationName}` : `Aún no tenemos negocios de muestra en ${locationName}.`}</p></div><div className="results-heading-links"><Link className="results-map-link" to="/map">⌖ <span>Ver mapa</span></Link></div></div>
      <section className="results-list" aria-label="Resultados encontrados">{visibleItems.length > 0 && <section className="results-businesses" aria-labelledby="related-businesses-title"><div className="results-section-heading"><div><span className="results-eyebrow">ESTABLECIMIENTOS</span><h2 id="related-businesses-title">Negocios relacionados</h2></div><span>{orderedItems.length} {orderedItems.length === 1 ? "negocio" : "negocios"}</span></div><div className="results-grid">{visibleItems.map((business) => <BusinessCard key={business.id} business={business} favorite={favorites.includes(business.id)} onFavorite={() => toggleFavorite(business.id)}/>)}</div>{orderedItems.length > 20 && !showAllBusinesses && <button className="results-more" type="button" onClick={() => setShowAllBusinesses(true)}>Ver más negocios</button>}</section>}{visibleOffers.length > 0 && <section className="results-offers" aria-labelledby="related-offers-title"><h2 id="related-offers-title">Productos y servicios que pueden servirte</h2><div className="results-offer-grid">{visibleOffers.map(({ kind, item }) => kind === "product" ? <ProductCard key={item.id} product={item} liked={likes.includes(item.id)} onLike={() => setLikes(persistLike(item.id))}/> : <ServiceCard key={item.id} service={item} liked={likes.includes(item.id)} onLike={() => setLikes(persistLike(item.id))}/>)}</div>{allOffers.length > 20 && !showAllOffers && <button className="results-more" type="button" onClick={() => setShowAllOffers(true)}>Ver más productos y servicios</button>}</section>}{!hasSampleCatalog ? <LocationAvailabilityNotice location={location} query={query}/> : resultCount === 0 && <NoResultsState term={query || category} locationName={locationName}/>}</section><p className="results-disclaimer">Estos son negocios de ejemplo para mostrar cómo funciona WIT. La información real llegará pronto.</p></main><BottomNavigation/></div>;
}
