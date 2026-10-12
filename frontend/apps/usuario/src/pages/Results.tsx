import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { categories, type Business, type Product, type Service } from "../data/mockData";
import { getBusinesses, getMatchingProducts, getMatchingServices, prioritizeFeaturedByDistance } from "../services/businessService";
import { hasSampleCatalogForLocation } from "../services/locationService";
import { useLocationContext } from "../context/LocationContext";
import { SearchBar } from "../components/SearchBar";
import { LocationAvailabilityNotice } from "../components/LocationAvailabilityNotice";
import { SiteHeader } from "../components/SiteHeader";
import { BottomNavigation } from "../components/BottomNavigation";
import { BusinessCard, ProductCard, ServiceCard } from "../components/EntityCards";
import { NoResultsState } from "../components/NoResultsState";
import { AdMobBanner } from "../components/AdMobBanner";
import { getFavoriteIds, getLikeIds, toggleFavorite as persistFavorite, toggleLike as persistLike } from "../services/userDataService";
import "./Results.css";

export default function Results() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [items, setItems] = useState<Business[]>([]);
  const [matchingProducts, setMatchingProducts] = useState<Product[]>([]);
  const [matchingServices, setMatchingServices] = useState<Service[]>([]);
  const [favorites, setFavorites] = useState<string[]>(getFavoriteIds);
  const [likes, setLikes] = useState<string[]>(getLikeIds);
  const businessesListRef = useRef<HTMLDivElement>(null);
  const offersListRef = useRef<HTMLDivElement>(null);
  const [businessScroll, setBusinessScroll] = useState({ left: 0, max: 0 });
  const [offersScroll, setOffersScroll] = useState({ left: 0, max: 0 });
  const [businessesVisibleCount, setBusinessesVisibleCount] = useState(() => window.innerWidth > 700 ? 8 : 6);
  const [offersVisibleCount, setOffersVisibleCount] = useState(8);
  const query = params.get("q") ?? "";
  const category = params.get("category") ?? "";
  const { selection } = useLocationContext();
  const location = selection?.mode === "manual" ? selection.locality : null;
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

  const simulatedItems = useMemo(() => {
    if (query.trim().toLowerCase() !== "torta" || items.length === 0) return items;
    return Array.from({ length: 20 }, (_, index) => {
      const source = items[index % items.length];
      return { ...source, id: `${source.id}-demo-${index + 1}`, name: `${source.name} ${index + 1}`, distanceKm: Number((source.distanceKm + index * 0.2).toFixed(1)) };
    });
  }, [items, query]);
  const orderedItems = useMemo(() => prioritizeFeaturedByDistance(simulatedItems, 3), [simulatedItems]);
  const baseOffers = useMemo(() => [...matchingProducts.map((item) => ({ kind: "product" as const, item })), ...matchingServices.map((item) => ({ kind: "service" as const, item }))], [matchingProducts, matchingServices]);
  const allOffers = useMemo(() => {
    if (query.trim().toLowerCase() !== "torta" || baseOffers.length === 0) return baseOffers;
    return Array.from({ length: 20 }, (_, index) => {
      const source = baseOffers[index % baseOffers.length];
      return { ...source, item: { ...source.item, id: `${source.item.id}-demo-${index + 1}`, name: `${source.item.name} ${index + 1}` } };
    });
  }, [baseOffers, query]);
  const visibleItems = orderedItems.slice(0, businessesVisibleCount);
  const visibleOffers = allOffers.slice(0, offersVisibleCount);
  const searchKey = params.toString();

  useEffect(() => {
    setBusinessesVisibleCount(window.innerWidth > 700 ? 8 : 6);
    setOffersVisibleCount(8);
  }, [searchKey]);
  useEffect(() => {
    const list = businessesListRef.current;
    if (list) setBusinessScroll({ left: list.scrollLeft, max: Math.max(0, list.scrollWidth - list.clientWidth) });
  }, [visibleItems.length]);
  useEffect(() => {
    const list = offersListRef.current;
    if (list) setOffersScroll({ left: list.scrollLeft, max: Math.max(0, list.scrollWidth - list.clientWidth) });
  }, [visibleOffers.length]);

  function toggleFavorite(id: string) { setFavorites(persistFavorite(id)); }
  function updateQuery(value: string) { setParams((current) => { const next = new URLSearchParams(current); next.delete("category"); value.trim() ? next.set("q", value.trim()) : next.delete("q"); return next; }); }
  function updateCategory(value: string) { setParams((current) => { const next = new URLSearchParams(current); value ? next.set("category", value) : next.delete("category"); return next; }); }
  const heading = query ? `Resultados para “${query}”` : category || "Lugares cerca de ti";
  const resultCount = orderedItems.length + allOffers.length;
  const locationName = location?.name ?? (selection?.mode === "automatic" ? "tu ubicación" : "esta zona");
  const mapPath = `/map${searchKey ? `?${searchKey}` : ""}`;

  return <div className="results-page"><SiteHeader active="explore"/><main className="results-main"><div className="results-topline"><button className="results-back-link" type="button" onClick={() => navigate(-1)}>← <span>Volver</span></button></div><SearchBar onSearch={updateQuery} initialValue={query}/><div className="results-category-chips" aria-label="Categorías"><button className={!category ? "selected" : ""} type="button" onClick={() => updateCategory("")}>Todo</button>{categories.map((item) => <button className={category === item.name ? "selected" : ""} key={item.name} type="button" onClick={() => updateCategory(category === item.name ? "" : item.name)}>{item.icon} {item.name}</button>)}</div><div className="results-heading"><div><h1>{heading}</h1></div><div className="results-heading-links"><Link className="results-map-link" to={mapPath}>⌖ <span>Ver mapa</span></Link></div></div><section className="results-list" aria-label="Resultados encontrados">{visibleItems.length > 0 && <section id="results-businesses" className="results-businesses" aria-labelledby="related-businesses-title"><div className="results-section-heading"><div><h2 id="related-businesses-title">Negocios</h2></div></div><div className="results-grid" ref={businessesListRef} onScroll={() => { const list = businessesListRef.current; if (list) setBusinessScroll({ left: list.scrollLeft, max: Math.max(0, list.scrollWidth - list.clientWidth) }); }}>{visibleItems.map((business) => <BusinessCard key={business.id} business={business} favorite={favorites.includes(business.id)} onFavorite={() => toggleFavorite(business.id)}/>)}</div>{businessScroll.max > 0 && <div className="results-business-scroll-control"><input type="range" min="0" max={businessScroll.max} step="1" value={Math.min(businessScroll.left, businessScroll.max)} aria-label="Desplazar negocios" onChange={(event) => { const left = Number(event.target.value); if (businessesListRef.current) businessesListRef.current.scrollLeft = left; setBusinessScroll((current) => ({ ...current, left })); }}/></div>}{orderedItems.length > businessesVisibleCount && <button className="results-more" type="button" onClick={() => setBusinessesVisibleCount((count) => count + 8)}>Ver 8 negocios</button>}</section>}{visibleOffers.length > 0 && <section id="results-offers" className="results-offers" aria-labelledby="related-offers-title"><AdMobBanner slot="results-offers"/><h2 id="related-offers-title">Productos y servicios</h2><div className="results-offer-grid" ref={offersListRef} onScroll={() => { const list = offersListRef.current; if (list) setOffersScroll({ left: list.scrollLeft, max: Math.max(0, list.scrollWidth - list.clientWidth) }); }}>{visibleOffers.map(({ kind, item }) => kind === "product" ? <ProductCard key={item.id} product={item} liked={likes.includes(item.id)} onLike={() => setLikes(persistLike(item.id))}/> : <ServiceCard key={item.id} service={item} liked={likes.includes(item.id)} onLike={() => setLikes(persistLike(item.id))}/>)}</div>{offersScroll.max > 0 && <div className="results-offers-scroll-control"><input type="range" min="0" max={offersScroll.max} step="1" value={Math.min(offersScroll.left, offersScroll.max)} aria-label="Desplazar productos y servicios" onChange={(event) => { const left = Number(event.target.value); if (offersListRef.current) offersListRef.current.scrollLeft = left; setOffersScroll((current) => ({ ...current, left })); }}/></div>}{allOffers.length > offersVisibleCount && <button className="results-more" type="button" onClick={() => setOffersVisibleCount((count) => count + 8)}>Ver 8 productos y servicios más</button>}</section>}{!hasSampleCatalog ? <LocationAvailabilityNotice location={location} query={query}/> : resultCount === 0 && <NoResultsState term={query || category} locationName={locationName}/>}</section><AdMobBanner slot="results-footer"/></main><footer className="site-footer"><strong className="site-footer__brand">XAMUKO</strong><span>Lo que necesitas, está más cerca.</span><small>© 2026 XAMUKO · Palmira, Colombia</small></footer><BottomNavigation/></div>;
}
