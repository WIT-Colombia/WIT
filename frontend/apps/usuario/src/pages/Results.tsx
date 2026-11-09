import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { alphabeticalCategories, businesses as demoBusinesses, type Business, type Product, type Service } from "../data/mockData";
import { searchUniversal, prioritizeFeaturedByDistance } from "../services/businessService";
import { listPublicReviews } from "../services/reviewsService";
import { useLocationContext } from "../context/LocationContext";
import { SiteHeader } from "../components/SiteHeader";
import { SearchBar, createSearchId } from "../components/SearchBar";
import { SiteFooter } from "../components/SiteFooter";
import { BottomNavigation } from "../components/BottomNavigation";
import { BusinessCard, ProductCard, ServiceCard } from "../components/EntityCards";
import { NoResultsState } from "../components/NoResultsState";
import { AdMobBanner } from "../components/AdMobBanner";
import { distanceBetweenCoordinates } from "../utils/coordinates";
import { resolveResultsArea } from "../utils/searchArea";
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

async function enrichBusinesses(businesses: Business[], coordinates?: { lat: number; lng: number }): Promise<Business[]> {
  return Promise.all(businesses.map(async (business) => {
    let rating = business.rating;
    let reviewCount = business.reviewCount;
    try {
      const response = await listPublicReviews(business.id, 1, 1);
      rating = response.summary?.average ?? rating;
      reviewCount = response.summary?.total ?? reviewCount;
    } catch { /* A review outage must not hide a published business. */ }
    return {
      ...business, rating, reviewCount,
      distanceKm: coordinates && business.coordinates
        ? distanceBetweenCoordinates(coordinates, business.coordinates)
        : Number.POSITIVE_INFINITY,
    };
  }));
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
  const [searchStatus, setSearchStatus] = useState<"loading" | "ready" | "error" | "location-required">("loading");
  const [retryIndex, setRetryIndex] = useState(0);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
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
  const searchArea = resolveResultsArea(params, Boolean(selection?.coordinates), location?.name, location?.context);
  const searchScope = searchArea.kind === "virtual" || searchArea.kind === "city" ? searchArea.kind : undefined;
  const radiusKm = searchArea.kind === "radius" ? searchArea.radiusKm : undefined;
  const scopeValue = searchScope ?? String(radiusKm ?? 1);
  const locationRequired = searchArea.kind === "location-required";
  // None of these modes can accidentally fall back to an unrestricted API query.
  const searchLocationParams = searchArea.kind === "virtual"
    ? { scope: "virtual" as const }
    : searchArea.kind === "city"
      ? { scope: "city" as const, city: searchArea.city, region: searchArea.region }
      : { latitude: selection?.coordinates?.lat, longitude: selection?.coordinates?.lng, radiusKm };
  const searchKey = params.toString();
  const requestIdentity = `${searchKey}|loc:${selection?.coordinates?.lat ?? ""},${selection?.coordinates?.lng ?? ""}|${location?.name ?? ""}|${location?.context ?? ""}`;
  const currentRequest = useRef(requestIdentity);
  currentRequest.current = requestIdentity;

  useEffect(() => {
    let current = true;
    setSearchStatus("loading");
    setLoadedSearchKey(null);
    setLoadMoreError(null);
    setLoadingMore(false);
    loadingSection.current = null;
    if (locationRequired && !demoMode) {
      setItems([]); setMatchingProducts([]); setMatchingServices([]);
      setResultTotals({ businesses: 0, products: 0, services: 0 });
      setSearchStatus("location-required");
      return;
    }
    if (demoMode) {
      const demo = createDemoResults();
      setItems(demo.businesses); setMatchingProducts(demo.products); setMatchingServices(demo.services);
      setResultTotals({ businesses: 50, products: 50, services: 50 }); setTotalPages({ businesses: 1, products: 1, services: 1 }); setPages({ businesses: 1, products: 1, services: 1 });
      setLoadedSearchKey(searchKey);
      setSearchStatus("ready");
      return;
    }
    manualTabSelection.current = false;
    searchUniversal({ query, category, ...searchLocationParams, businessPageSize: 50, productPageSize: 50, servicePageSize: 50 })
      .then(async ({ businesses: foundBusinesses, products: foundProducts, services: foundServices, pagination }) => {
        if (!current) return;
        const hydratedBusinesses = await enrichBusinesses(foundBusinesses, searchScope === "virtual" ? undefined : selection?.coordinates);
        if (!current) return;
        setItems(hydratedBusinesses);
        setMatchingProducts(foundProducts);
        setMatchingServices(foundServices);
        setPages({ businesses: 1, products: 1, services: 1 });
        setTotalPages({ businesses: pagination?.businesses?.totalPages ?? 1, products: pagination?.products?.totalPages ?? 1, services: pagination?.services?.totalPages ?? 1 });
        const totals = { businesses: pagination?.businesses?.total ?? foundBusinesses.length, products: pagination?.products?.total ?? foundProducts.length, services: pagination?.services?.total ?? foundServices.length };
        setResultTotals(totals);
        setLoadedSearchKey(searchKey);
        setSearchStatus("ready");
        // Choose the first non-empty category only when this search response
        // completes. Manual tab changes remain untouched until the next search.
        if (!manualTabSelection.current) setActiveTab(totals.businesses > 0 ? "businesses" : totals.products > 0 ? "products" : "services");
      }).catch(() => { if (current) {
        setItems([]); setMatchingProducts([]); setMatchingServices([]);
        setResultTotals({ businesses: 0, products: 0, services: 0 });
        setLoadedSearchKey(null);
        setSearchStatus("error");
      } });
    return () => { current = false; };
  }, [query, category, selection, radiusKm, searchScope, locationRequired, location?.name, location?.context, demoMode, searchKey, retryIndex]);

  // The virtual API already orders ALL featured businesses before the rest.
  // Never reapply physical-distance/pioneer ranking or limit featured spots to three.
  const orderedItems = useMemo(
    () => searchScope === "virtual" ? items : prioritizeFeaturedByDistance(items, 3),
    [items, searchScope],
  );
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
    if (searchStatus !== "ready") return;
    const values = section === "businesses"
      ? [orderedItems.length, businessesVisibleCount, setBusinessesVisibleCount, businessesSectionRef]
      : section === "products"
        ? [matchingProducts.length, productsVisibleCount, setProductsVisibleCount, productsSectionRef]
        : [matchingServices.length, servicesVisibleCount, setServicesVisibleCount, servicesSectionRef];
    const [loaded, visible, setVisible, ref] = values as [
      number, number, React.Dispatch<React.SetStateAction<number>>, React.RefObject<HTMLElement | null>,
    ];
    if (visible < loaded) {
      setVisible(Math.min(visible + 8, loaded));
      return;
    }
    if (pages[section] >= totalPages[section]) {
      setVisible(8);
      ref.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start",
      });
      return;
    }
    if (loadingSection.current) return;
    loadingSection.current = section;
    setLoadingMore(true);
    setLoadMoreError(null);
    const requestedIdentity = requestIdentity;
    try {
      const nextPage = pages[section] + 1;
      const pageFilter = section === "businesses" ? { businessPage: nextPage }
        : section === "products" ? { productPage: nextPage }
        : { servicePage: nextPage };
      const result = await searchUniversal({
        query, category,
        ...searchLocationParams,
        ...pageFilter,
        businessPageSize: 50, productPageSize: 50, servicePageSize: 50,
      });
      if (currentRequest.current !== requestedIdentity) return;
      if (section === "businesses") {
        const rated = await enrichBusinesses(result.businesses, searchScope === "virtual" ? undefined : selection?.coordinates);
        if (currentRequest.current !== requestedIdentity) return;
        setItems(current => [...current, ...rated.filter(item => !current.some(existing => existing.id === item.id))]);
      }
      if (section === "products") {
        setMatchingProducts(current => [...current, ...result.products.filter(item => !current.some(existing => existing.id === item.id))]);
      }
      if (section === "services") {
        setMatchingServices(current => [...current, ...result.services.filter(item => !current.some(existing => existing.id === item.id))]);
      }
      const pagination = result.pagination?.[section];
      if (typeof pagination?.total === "number") {
        setResultTotals(current => ({ ...current, [section]: pagination.total }));
      }
      if (typeof pagination?.totalPages === "number") {
        setTotalPages(current => ({ ...current, [section]: pagination.totalPages }));
      }
      setPages(current => ({ ...current, [section]: nextPage }));
      setVisible(current => current + 8);
    } catch {
      if (currentRequest.current === requestedIdentity) {
        setLoadMoreError("No pudimos cargar más resultados. Verifica la conexión e inténtalo de nuevo.");
      }
    } finally {
      if (currentRequest.current === requestedIdentity) {
        loadingSection.current = null;
        setLoadingMore(false);
      }
    }
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
  function updateScope(value: string) {
    setParams(current => {
      const next = new URLSearchParams(current);
      next.delete("searchId");
      next.delete("scope");
      next.delete("radiusKm");
      if (value === "city" && location?.name) next.set("scope", "city");
      else if (value === "virtual") next.set("scope", "virtual");
      else if (selection?.coordinates && ["1", "3", "10"].includes(value)) next.set("radiusKm", value);
      return next;
    });
  }

  const locationName = location?.name ?? (selection?.mode === "automatic" ? "tu ubicación" : "esta zona");
  const contextLocation = searchScope === "virtual" ? "negocios virtuales" : searchScope === "city" ? `la ciudad de ${locationName}` : locationName;
  const resultsContext = category
    ? `Mostrando resultados de la categoría “${category}” para ${contextLocation}${query ? ` · búsqueda: “${query}”` : ""}.`
    : `Resultados para ${contextLocation}${query ? ` · búsqueda: “${query}”` : ""}.`;
  const mapPath = `/map${searchKey ? `?${searchKey}` : ""}`;

  const sectionButton = (section: "businesses" | "products" | "services", loaded: number, visible: number, label: string) => {
    if (resultTotals[section] <= 8) return null;
    const atEnd = visible >= loaded && pages[section] >= totalPages[section];
    return <button className="results-more" type="button" disabled={loadingMore} onClick={() => { void toggleSection(section); }} aria-label={atEnd ? `Volver a mostrar 8 ${label}` : `Ver más ${label}`}>{loadingMore ? "Cargando…" : atEnd ? "Volver arriba ↑" : `Ver más ${label} ↓`}</button>;
  };
  return <div className="results-page"><SiteHeader active="explore"/><main className="results-main"><SearchBar onSearch={updateQuery} initialValue={query} hideSubmit/><div className="results-category-chips" aria-label="Categorías"><button className={!category ? "selected" : ""} type="button" onClick={() => updateCategory("")}>Todo</button>{alphabeticalCategories.map((item) => <button className={category === item.name ? "selected" : ""} type="button" key={item.name} onClick={() => updateCategory(category === item.name ? "" : item.name)}>{item.icon} {item.name}</button>)}</div><div className="results-distance-filter">
  <label htmlFor="results-distance-select">
    Buscar en
    <select id="results-distance-select" value={scopeValue} onChange={event => updateScope(event.target.value)}>
      <option value="1" disabled={!selection?.coordinates}>1 km</option>
      <option value="3" disabled={!selection?.coordinates}>3 km</option>
      <option value="10" disabled={!selection?.coordinates}>10 km</option>
      <option value="city" disabled={!location?.name}>Ciudad</option>
      <option value="virtual">Virtual</option>
    </select>
  </label>
  <span>{searchScope === "virtual"
    ? "Solo negocios con modalidad virtual activa y sus productos y servicios, sin límite de distancia."
    : searchScope === "city"
      ? `Negocios, productos y servicios registrados en ${locationName}.`
      : locationRequired
      ? "Selecciona una ubicación para buscar por distancia o ciudad; Virtual sigue disponible."
      : `Mostrando opciones dentro de ${radiusKm ?? 1} km.`}</span>
</div><div className="results-heading"><div className="results-heading__title"><button className="results-back-link" type="button" onClick={() => navigate(-1)}>← <span>Volver</span></button><div><h1>Explora en resultados</h1><p className={category ? "results-context results-context--active" : "results-context"}>{category && <span className="results-context__icon" aria-hidden="true">✓</span>}{resultsContext}</p></div></div><div className="results-heading-links">{searchScope !== "virtual" && <Link className="results-map-link" to={mapPath}>⌖ <span>Ver mapa</span></Link>}</div></div><div className="results-tabs" role="tablist" aria-label="Tipo de resultados"><button type="button" role="tab" aria-selected={activeTab === "businesses"} className={activeTab === "businesses" ? "active" : ""} onClick={() => { manualTabSelection.current = true; setActiveTab("businesses"); }}>Negocios <span>{resultTotals.businesses}</span></button><button type="button" role="tab" aria-selected={activeTab === "products"} className={activeTab === "products" ? "active" : ""} onClick={() => { manualTabSelection.current = true; setActiveTab("products"); }}>Productos <span>{resultTotals.products}</span></button><button type="button" role="tab" aria-selected={activeTab === "services"} className={activeTab === "services" ? "active" : ""} onClick={() => { manualTabSelection.current = true; setActiveTab("services"); }}>Servicios <span>{resultTotals.services}</span></button></div>{searchStatus === "loading" && <p className="results-request-state" role="status">Buscando negocios, productos y servicios…</p>}{searchStatus === "location-required" && <p className="results-request-state" role="status">Para buscar negocios cerca de ti, <Link to="/location">selecciona una ubicación</Link> o elige Virtual.</p>}{searchStatus === "error" && <div className="results-request-state results-request-state--error" role="alert"><p>No pudimos consultar los resultados. Comprueba tu conexión e inténtalo de nuevo.</p><button type="button" onClick={() => setRetryIndex(current => current + 1)}>Reintentar búsqueda</button></div>}{loadMoreError && searchStatus === "ready" && <p className="results-request-state results-request-state--error" role="alert">{loadMoreError}</p>}{likeError && <p className="results-like-error" role="alert">{likeError}</p>}<section className="results-list" aria-label="Resultados encontrados">{searchStatus === "ready" && activeTab === "businesses" && visibleBusinesses.length > 0 && <section ref={businessesSectionRef} id="results-businesses" className="results-businesses" aria-labelledby="related-businesses-title"><div className="results-section-heading"><h2 id="related-businesses-title">Negocios</h2></div><div className="results-grid">{visibleBusinesses.map((business) => <BusinessCard key={business.id} classicLayout business={business} favorite={favorites.includes(business.id)} onFavorite={() => { void toggleFavorite(business.id); }}/>)}</div>{sectionButton("businesses", orderedItems.length, businessesVisibleCount, "negocios")}</section>}{searchStatus === "ready" && activeTab === "products" && visibleProducts.length > 0 && <section ref={productsSectionRef} id="results-products" className="results-offers results-offer-group" aria-labelledby="products-title"><h2 id="products-title">Productos</h2><div className="results-offer-grid">{visibleProducts.map((product) => <ProductCard key={product.id} product={product} liked={getOfferLike(product.id).liked} likeCount={isRealOfferId(product.id) ? getOfferLike(product.id).count : getOfferLike(product.id).count || product.likeCount} onLike={() => handleOfferLike(product.id)}/>)}</div>{sectionButton("products", matchingProducts.length, productsVisibleCount, "productos")}</section>}{searchStatus === "ready" && activeTab === "services" && visibleServices.length > 0 && <section ref={servicesSectionRef} id="results-services" className="results-offers results-offer-group" aria-labelledby="services-title"><h2 id="services-title">Servicios</h2><div className="results-offer-grid">{visibleServices.map((service) => <ServiceCard key={service.id} service={service} liked={getOfferLike(service.id).liked} likeCount={isRealOfferId(service.id) ? getOfferLike(service.id).count : getOfferLike(service.id).count || service.likeCount} onLike={() => handleOfferLike(service.id)}/>)}</div>{sectionButton("services", matchingServices.length, servicesVisibleCount, "servicios")}</section>}{searchStatus === "ready" && ((activeTab === "businesses" && resultTotals.businesses === 0) || (activeTab === "products" && resultTotals.products === 0) || (activeTab === "services" && resultTotals.services === 0)) && <NoResultsState term={query || category} locationName={locationName} radiusKm={radiusKm} virtualOnly={searchScope === "virtual"}/>}</section><AdMobBanner slot="results-footer"/></main><SiteFooter/><BottomNavigation/></div>;
}
