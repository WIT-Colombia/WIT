import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { alphabeticalCategories, businesses as demoBusinesses, type Business, type Product, type Service } from "../data/mockData";
import { searchUniversal, prioritizeFeaturedByDistance } from "../services/businessService";
import { useLocationContext } from "../context/LocationContext";
import { SiteHeader } from "../components/SiteHeader";
import { SearchBar, createSearchId } from "../components/SearchBar";
import { SiteFooter } from "../components/SiteFooter";
import { BottomNavigation } from "../components/BottomNavigation";
import { BusinessCard, ProductCard, ServiceCard } from "../components/EntityCards";
import { NoResultsState } from "../components/NoResultsState";
import { AdMobBanner } from "../components/AdMobBanner";
import { distanceBetweenCoordinates } from "../utils/coordinates";
import { isRealOfferId, useOfferLikes } from "../services/offerLikesService";
import { recordBusinessEvent } from "../services/analyticsService";
import { useFavorites } from "../services/favoritesService";
import "./Results.css";

function createDemoResults() {
  const sourceBusinesses = demoBusinesses.length ? demoBusinesses : [{ id: "demo-source", name: "Negocio de prueba", category: "Comercio", rating: 4.8, reviewCount: 12, distanceKm: 1.2, isOpen: true, address: "Palmira", image: "", tags: [] } satisfies Business];
  const generatedBusinesses = Array.from({ length: 50 }, (_, index) => { const source = sourceBusinesses[index % sourceBusinesses.length]; return { ...source, id: `demo-business-${index + 1}`, name: `${source.name} ${index + 1}`, distanceKm: Number((0.4 + index * 0.08).toFixed(1)) }; });
  const generatedProducts = Array.from({ length: 50 }, (_, index) => { const business = generatedBusinesses[index]; return { id: `demo-product-${index + 1}`, businessId: business.id, businessName: business.name, name: `Producto de prueba ${index + 1}`, description: `Descripción del producto de prueba ${index + 1}.`, image: business.image, price: 10000 + index * 500, priceLabel: `$${(10000 + index * 500).toLocaleString("es-CO")} COP` } satisfies Product; });
  const generatedServices = Array.from({ length: 50 }, (_, index) => { const business = generatedBusinesses[index]; return { id: `demo-service-${index + 1}`, businessId: business.id, businessName: business.name, name: `Servicio de prueba ${index + 1}`, description: `Descripción del servicio de prueba ${index + 1}.`, image: business.image, priceLabel: `$${(20000 + index * 750).toLocaleString("es-CO")} COP` } satisfies Service; });
  return { businesses: generatedBusinesses, products: generatedProducts, services: generatedServices };
}

export default function Results() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [items, setItems] = useState<Business[]>([]);
  const [matchingProducts, setMatchingProducts] = useState<Product[]>([]);
  const [matchingServices, setMatchingServices] = useState<Service[]>([]);
  const { favorites, toggleFavorite } = useFavorites();
  const offerLikeIds = useMemo(() => [...matchingProducts, ...matchingServices].map((item) => item.id), [matchingProducts, matchingServices]);
  const { get: getOfferLike, toggle: toggleOfferLike } = useOfferLikes(offerLikeIds);
  const [likeError, setLikeError] = useState<string | null>(null);
  const handleOfferLike = (offerId: string) => {
    setLikeError(null);
    void toggleOfferLike(offerId).catch(() => setLikeError("No pudimos actualizar el Me gusta. Intenta nuevamente."));
  };
  const [businessesVisibleCount, setBusinessesVisibleCount] = useState(8);
  const [productsVisibleCount, setProductsVisibleCount] = useState(8);
  const [servicesVisibleCount, setServicesVisibleCount] = useState(8);
  const [pages, setPages] = useState({ businesses: 1, products: 1, services: 1 });
  const [totalPages, setTotalPages] = useState({ businesses: 1, products: 1, services: 1 });
  const [resultTotals, setResultTotals] = useState({ businesses: 0, products: 0, services: 0 });
  const [loadedSearchKey, setLoadedSearchKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"businesses" | "products" | "services">("businesses");
  const manualTabSelection = useRef(false);
  const loadingSection = useRef<"businesses" | "products" | "services" | null>(null);
  const businessesSectionRef = useRef<HTMLElement>(null);
  const productsSectionRef = useRef<HTMLElement>(null);
  const servicesSectionRef = useRef<HTMLElement>(null);
  const query = params.get("q") ?? "";
  const category = params.get("category") ?? "";
  const demoMode = import.meta.env.VITE_E2E_REAL_ONLY !== "true" && import.meta.env.DEV && params.get("demo") === "150";
  const { selection } = useLocationContext();
  const location = selection?.locality ?? null;
  // Real searches must always reach the public API. The previous location/demo
  // gate skipped the request in E2E and made every search appear empty.
  const canShowCatalog = true;
  const searchKey = params.toString();

  useEffect(() => {
    let current = true;
    if (demoMode) {
      const demo = createDemoResults();
      setItems(demo.businesses); setMatchingProducts(demo.products); setMatchingServices(demo.services);
      setResultTotals({ businesses: 50, products: 50, services: 50 }); setTotalPages({ businesses: 1, products: 1, services: 1 }); setPages({ businesses: 1, products: 1, services: 1 });
      setLoadedSearchKey(searchKey);
      return;
    }
    if (!canShowCatalog) {
      setItems([]);
      setMatchingProducts([]);
      setMatchingServices([]);
      setResultTotals({ businesses: 0, products: 0, services: 0 });
      setTotalPages({ businesses: 1, products: 1, services: 1 });
      setLoadedSearchKey(searchKey);
      return;
    }
    manualTabSelection.current = false;
    searchUniversal({ query, category, latitude: selection?.coordinates?.lat, longitude: selection?.coordinates?.lng, businessPageSize: 50, productPageSize: 50, servicePageSize: 50 })
      .then(({ businesses: foundBusinesses, products: foundProducts, services: foundServices, pagination }) => {
        if (!current) return;
        const userCoordinates = selection?.coordinates;
        setItems(foundBusinesses.map((business) => ({ ...business, distanceKm: userCoordinates && business.coordinates ? distanceBetweenCoordinates(userCoordinates, business.coordinates) : Number.POSITIVE_INFINITY })));
        setMatchingProducts(foundProducts);
        setMatchingServices(foundServices);
        setPages({ businesses: 1, products: 1, services: 1 });
        setTotalPages({ businesses: pagination?.businesses?.totalPages ?? 1, products: pagination?.products?.totalPages ?? 1, services: pagination?.services?.totalPages ?? 1 });
        const totals = { businesses: pagination?.businesses?.total ?? foundBusinesses.length, products: pagination?.products?.total ?? foundProducts.length, services: pagination?.services?.total ?? foundServices.length };
        setResultTotals(totals);
        setLoadedSearchKey(searchKey);
        // Choose the first non-empty category only when this search response
        // completes. Manual tab changes remain untouched until the next search.
        if (!manualTabSelection.current) setActiveTab(totals.businesses > 0 ? "businesses" : totals.products > 0 ? "products" : "services");
      }).catch(() => { if (current) { setItems([]); setMatchingProducts([]); setMatchingServices([]); setResultTotals({ businesses: 0, products: 0, services: 0 }); setLoadedSearchKey(searchKey); } });
    return () => { current = false; };
  }, [query, category, canShowCatalog, selection, demoMode, searchKey]);

  const orderedItems = useMemo(() => prioritizeFeaturedByDistance(items, 3), [items]);
  const visibleBusinesses = orderedItems.slice(0, businessesVisibleCount);
  const visibleProducts = matchingProducts.slice(0, productsVisibleCount);
  const visibleServices = matchingServices.slice(0, servicesVisibleCount);
  const confirmedSearchId = params.get("searchId");
  const impressionScope = confirmedSearchId ?? "";
  const visibleBusinessIds = visibleBusinesses.map((business) => business.id).join(",");
  useEffect(() => {
    if (!confirmedSearchId || loadedSearchKey !== searchKey) return;
    visibleBusinesses.forEach((business, index) => recordBusinessEvent(business.id, "SEARCH_IMPRESSION", impressionScope, undefined, { source: 'search', searchTerm: query, searchPosition: index + 1, category: business.category, isFeatured: business.plan === 'premium' || business.isFeatured }));
  }, [visibleBusinessIds, impressionScope, confirmedSearchId, loadedSearchKey, searchKey, query]);
  useEffect(() => {
    setBusinessesVisibleCount(8);
    setProductsVisibleCount(8);
    setServicesVisibleCount(8);
    setActiveTab("businesses");
    setPages({ businesses: 1, products: 1, services: 1 });
  }, [searchKey]);
  async function toggleSection(section: "businesses" | "products" | "services") {
    const values = section === "businesses" ? [orderedItems.length, businessesVisibleCount, setBusinessesVisibleCount, businessesSectionRef] : section === "products" ? [matchingProducts.length, productsVisibleCount, setProductsVisibleCount, productsSectionRef] : [matchingServices.length, servicesVisibleCount, setServicesVisibleCount, servicesSectionRef];
    const [total, visible, setVisible, ref] = values as [number, number, (value: number) => void, React.RefObject<HTMLElement>];
    const sectionTotalPages = totalPages[section];
    const sectionPage = pages[section];
    if (visible >= total && sectionPage >= sectionTotalPages) { setVisible(8); ref.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }); return; }
    if (visible < total) { setVisible(Math.min(visible + 8, total)); return; }
    if (loadingSection.current) return;
    loadingSection.current = section;
    try {
      const result = await searchUniversal({ query, category, latitude: selection?.coordinates?.lat, longitude: selection?.coordinates?.lng, [`${section === "businesses" ? "business" : section.slice(0, -1)}Page`]: sectionPage + 1, businessPageSize: 50, productPageSize: 50, servicePageSize: 50 } as any);
      if (section === "businesses") setItems((current) => [...current, ...result.businesses.filter((item) => !current.some((existing) => existing.id === item.id))]);
      if (section === "products") setMatchingProducts((current) => [...current, ...result.products.filter((item) => !current.some((existing) => existing.id === item.id))]);
      if (section === "services") setMatchingServices((current) => [...current, ...result.services.filter((item) => !current.some((existing) => existing.id === item.id))]);
      const total = result.pagination?.[section]?.total;
      if (typeof total === "number") setResultTotals((current) => ({ ...current, [section]: total }));
      setPages((current) => ({ ...current, [section]: current[section] + 1 }));
      setVisible(visible + 8);
    } finally { loadingSection.current = null; }
  }
  function updateQuery(value: string) { setParams((current) => { const next = new URLSearchParams(current); next.delete("category"); next.delete("searchId"); value.trim() ? next.set("q", value.trim()) : next.delete("q"); return next; }); }
  function confirmSearch(value: string, searchId = createSearchId()) { setParams((current) => { const next = new URLSearchParams(current); next.delete("category"); value.trim() ? next.set("q", value.trim()) : next.delete("q"); next.set("searchId", searchId); return next; }); }
  useEffect(() => {
    const handleConfirmedSearch = (event: Event) => {
      const detail = (event as CustomEvent<{ value?: string; searchId?: string }>).detail;
      confirmSearch(detail?.value ?? "", detail?.searchId);
    };
    window.addEventListener("xamuko:search-confirmed", handleConfirmedSearch);
    return () => window.removeEventListener("xamuko:search-confirmed", handleConfirmedSearch);
  }, [setParams]);
  function updateCategory(value: string) { setParams((current) => { const next = new URLSearchParams(current); next.delete("searchId"); value ? next.set("category", value) : next.delete("category"); return next; }); }
  const locationName = location?.name ?? (selection?.mode === "automatic" ? "tu ubicación" : "esta zona");
  const resultsContext = category
    ? `Mostrando resultados de la categoría “${category}” para ${locationName}${query ? ` · búsqueda: “${query}”` : ""}.`
    : `Resultados para ${locationName}${query ? ` · búsqueda: “${query}”` : ""}.`;
  const mapPath = `/map${searchKey ? `?${searchKey}` : ""}`;

  const sectionButton = (section: "businesses" | "products" | "services", total: number, visible: number, label: string) => total > 8 ? <button className="results-more" type="button" onClick={() => toggleSection(section)} aria-label={visible >= total ? `Volver a mostrar 8 ${label}` : `Ver más ${label}`}>{visible >= total ? `Volver arriba ↑` : `Ver más ${label} ↓`}</button> : null;
  return <div className="results-page"><SiteHeader active="explore"/><main className="results-main"><SearchBar onSearch={updateQuery} initialValue={query} hideSubmit/><div className="results-category-chips" aria-label="Categorías"><button className={!category ? "selected" : ""} type="button" onClick={() => updateCategory("")}>Todo</button>{alphabeticalCategories.map((item) => <button className={category === item.name ? "selected" : ""} type="button" key={item.name} onClick={() => updateCategory(category === item.name ? "" : item.name)}>{item.icon} {item.name}</button>)}</div><div className="results-heading"><div className="results-heading__title"><button className="results-back-link" type="button" onClick={() => navigate(-1)}>← <span>Volver</span></button><div><h1>Explora en resultados</h1><p className={category ? "results-context results-context--active" : "results-context"}>{category && <span className="results-context__icon" aria-hidden="true">✓</span>}{resultsContext}</p></div></div><div className="results-heading-links"><Link className="results-map-link" to={mapPath}>⌖ <span>Ver mapa</span></Link></div></div><div className="results-tabs" role="tablist" aria-label="Tipo de resultados"><button type="button" role="tab" aria-selected={activeTab === "businesses"} className={activeTab === "businesses" ? "active" : ""} onClick={() => { manualTabSelection.current = true; setActiveTab("businesses"); }}>Negocios <span>{resultTotals.businesses}</span></button><button type="button" role="tab" aria-selected={activeTab === "products"} className={activeTab === "products" ? "active" : ""} onClick={() => { manualTabSelection.current = true; setActiveTab("products"); }}>Productos <span>{resultTotals.products}</span></button><button type="button" role="tab" aria-selected={activeTab === "services"} className={activeTab === "services" ? "active" : ""} onClick={() => { manualTabSelection.current = true; setActiveTab("services"); }}>Servicios <span>{resultTotals.services}</span></button></div>{likeError && <p className="results-like-error" role="alert">{likeError}</p>}<section className="results-list" aria-label="Resultados encontrados">{activeTab === "businesses" && visibleBusinesses.length > 0 && <section ref={businessesSectionRef} id="results-businesses" className="results-businesses" aria-labelledby="related-businesses-title"><div className="results-section-heading"><h2 id="related-businesses-title">Negocios</h2></div><div className="results-grid">{visibleBusinesses.map((business) => <BusinessCard key={business.id} business={business} favorite={favorites.includes(business.id)} onFavorite={() => { void toggleFavorite(business.id); }}/>)}</div>{sectionButton("businesses", orderedItems.length, businessesVisibleCount, "negocios")}</section>}{activeTab === "products" && visibleProducts.length > 0 && <section ref={productsSectionRef} id="results-products" className="results-offers results-offer-group" aria-labelledby="products-title"><h2 id="products-title">Productos</h2><div className="results-offer-grid">{visibleProducts.map((product) => <ProductCard key={product.id} product={product} liked={getOfferLike(product.id).liked} likeCount={isRealOfferId(product.id) ? getOfferLike(product.id).count : getOfferLike(product.id).count || product.likeCount} onLike={() => handleOfferLike(product.id)}/>)}</div>{sectionButton("products", matchingProducts.length, productsVisibleCount, "productos")}</section>}{activeTab === "services" && visibleServices.length > 0 && <section ref={servicesSectionRef} id="results-services" className="results-offers results-offer-group" aria-labelledby="services-title"><h2 id="services-title">Servicios</h2><div className="results-offer-grid">{visibleServices.map((service) => <ServiceCard key={service.id} service={service} liked={getOfferLike(service.id).liked} likeCount={isRealOfferId(service.id) ? getOfferLike(service.id).count : getOfferLike(service.id).count || service.likeCount} onLike={() => handleOfferLike(service.id)}/>)}</div>{sectionButton("services", matchingServices.length, servicesVisibleCount, "servicios")}</section>}{((activeTab === "businesses" && resultTotals.businesses === 0) || (activeTab === "products" && resultTotals.products === 0) || (activeTab === "services" && resultTotals.services === 0)) && <NoResultsState term={query || category} locationName={locationName}/>}</section><AdMobBanner slot="results-footer"/></main><SiteFooter/><BottomNavigation/></div>;
}
