import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button, Logo } from "@wit/ui";
import { businesses as sampleBusinesses, categories, products as sampleProducts, type Business } from "../data/mockData";
import { getSelectedLocation, hasSampleCatalogForLocation } from "../services/locationService";
import { getBusinesses, prioritizeFeaturedByDistance } from "../services/businessService";
import { LocationAvailabilityNotice } from "../components/LocationAvailabilityNotice";
import { SearchBar } from "../components/SearchBar";
import { SiteHeader } from "../components/SiteHeader";
import { BottomNavigation } from "../components/BottomNavigation";
import { BusinessCard } from "../components/EntityCards";
import { NewProductsBanner } from "../components/NewProductsBanner";
import { NoResultsState } from "../components/NoResultsState";
import { getFavoriteIds, getLikeIds, toggleFavorite, toggleLike } from "../services/userDataService";
import "./Home.css";
import "./HomeChanges.css";
import "./HomeAdjustments.css";

function Icon({ name }: { name: "pin" | "star" | "arrow" | "phone" | "map" }) {
  const paths = {
    pin: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
    star: <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/>,
    arrow: <><path d="M7 17 17 7M7 7h10v10"/></>,
    phone: <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.2-1.3a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.8 2.1Z"/>,
    map: <><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z"/><path d="M9 3v15m6-12v15"/></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

const NEW_BUSINESS_WINDOW_DAYS = 30;
const NEW_PRODUCT_WINDOW_DAYS = 30;

function isRecentlyAdded(createdAt?: string): boolean {
  if (!createdAt) return false;
  const ageDays = (Date.now() - Date.parse(createdAt)) / (1000 * 60 * 60 * 24);
  return ageDays >= 0 && ageDays < NEW_BUSINESS_WINDOW_DAYS;
}

export default function Home() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [showAllNearby, setShowAllNearby] = useState(false);
  const [items, setItems] = useState<Business[]>([]);
  const [favorites, setFavorites] = useState<string[]>(getFavoriteIds);
  const [likes, setLikes] = useState<string[]>(getLikeIds);
  const [bannerPaused, setBannerPaused] = useState(false);
  const [bannerInteracting, setBannerInteracting] = useState(false);
  const [bannerDragging, setBannerDragging] = useState(false);
  const bannerViewportRef = useRef<HTMLDivElement>(null);
  const bannerGroupRef = useRef<HTMLDivElement>(null);
  const bannerDragRef = useRef<{ pointerId: number; startX: number; startScrollLeft: number; moved: boolean } | null>(null);
  const ignoreBannerClickRef = useRef(false);
  const bannerResumeTimerRef = useRef<number | null>(null);
  const [selectedLocation] = useState(() => getSelectedLocation());
  const hasSampleCatalog = hasSampleCatalogForLocation(selectedLocation);
  const [mapView, setMapView] = useState(() => new URLSearchParams(window.location.search).get("view") === "map");
  const [message, setMessage] = useState("");

  useEffect(() => { void getBusinesses({ query, category }).then(setItems); }, [query, category]);
  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(() => setMessage(""), 3200);
    return () => window.clearTimeout(timeout);
  }, [message]);

  const resultsLabel = useMemo(() => {
    if (query) return `Resultados para “${query}”`;
    if (category) return category;
    return "Lugares cerca de ti";
  }, [query, category]);

  const visibleItems = hasSampleCatalog ? items : [];
  const bannerBusinesses = useMemo(() => {
    if (!hasSampleCatalog) return [];
    const nearby = [...sampleBusinesses].sort((a, b) => a.distanceKm - b.distanceKm);
    const withinFiveKm = nearby.filter((business) => business.distanceKm <= 5);
    const withinTenKm = nearby.filter((business) => business.distanceKm <= 10);
    const isFeatured = (business: Business) => business.plan === "premium" || business.isFeatured;
    const allFeaturedIds = new Set(nearby.filter(isFeatured).map((business) => business.id));

    const featured = withinFiveKm.filter(isFeatured).slice(0, 3);
    const featuredIds = new Set(featured.map((business) => business.id));
    featured.push(...withinTenKm.filter((business) => isFeatured(business) && !featuredIds.has(business.id)).slice(0, 3 - featured.length));

    const newBusinesses = withinFiveKm.filter((business) => isRecentlyAdded(business.createdAt) && !allFeaturedIds.has(business.id)).slice(0, 2);
    const newIds = new Set(newBusinesses.map((business) => business.id));
    newBusinesses.push(...withinTenKm.filter((business) => isRecentlyAdded(business.createdAt) && !allFeaturedIds.has(business.id) && !newIds.has(business.id)).slice(0, 2 - newBusinesses.length));

    if (featured.length && newBusinesses.length) return [...featured, ...newBusinesses];
    if (featured.length) return featured;
    if (newBusinesses.length) return newBusinesses.slice(0, 5);
    return (withinFiveKm.length ? withinFiveKm : withinTenKm).slice(0, 5);
  }, [hasSampleCatalog]);
  const newProducts = useMemo(() => {
    if (!hasSampleCatalog) return [];
    return [...sampleProducts]
      .filter((product) => {
        if (!product.createdAt) return false;
        const ageDays = (Date.now() - Date.parse(product.createdAt)) / (1000 * 60 * 60 * 24);
        return ageDays >= 0 && ageDays < NEW_PRODUCT_WINDOW_DAYS;
      })
      .sort((a, b) => Date.parse(b.createdAt ?? "") - Date.parse(a.createdAt ?? ""));
  }, [hasSampleCatalog]);
  useEffect(() => {
    const viewport = bannerViewportRef.current;
    if (!viewport || !bannerBusinesses.length || bannerPaused || bannerInteracting || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const loopWidth = bannerGroupRef.current?.getBoundingClientRect().width ?? 0;
    if (viewport.scrollLeft === 0 && loopWidth) viewport.scrollLeft = loopWidth;
    let frame = 0;
    let lastFrameTime = 0;
    function move(timestamp: number) {
      const currentViewport = bannerViewportRef.current;
      const currentLoopWidth = bannerGroupRef.current?.getBoundingClientRect().width ?? 0;
      if (currentViewport && currentLoopWidth) {
        if (lastFrameTime) {
          const nextScroll = currentViewport.scrollLeft - (timestamp - lastFrameTime) * 0.018;
          currentViewport.scrollLeft = nextScroll <= 1 ? currentLoopWidth : nextScroll;
        }
        lastFrameTime = timestamp;
        frame = window.requestAnimationFrame(move);
      }
    }
    frame = window.requestAnimationFrame(move);
    return () => window.cancelAnimationFrame(frame);
  }, [bannerBusinesses.length, bannerPaused, bannerInteracting]);

  useEffect(() => () => {
    if (bannerResumeTimerRef.current !== null) window.clearTimeout(bannerResumeTimerRef.current);
  }, []);
  const nearbyItems = useMemo(() => prioritizeFeaturedByDistance(visibleItems), [visibleItems]);
  const locationLabel = selectedLocation ? `${selectedLocation.name}, ${selectedLocation.context}` : "Palmira, Valle del Cauca";
  const cityName = selectedLocation?.name ?? "Palmira";
  const featuredCategories = categories.slice(0, 6);
  const selectedCategory = categories.find((item) => item.name === category);
  const visibleCategories = showAllCategories
    ? categories
    : selectedCategory && !featuredCategories.some((item) => item.name === selectedCategory.name)
      ? [...featuredCategories, selectedCategory]
      : featuredCategories;

  function saveFavorite(id: string) { setFavorites(toggleFavorite(id)); }
  function saveLike(id: string) { setLikes(toggleLike(id)); }

  function pauseBannerForInteraction() {
    if (bannerResumeTimerRef.current !== null) window.clearTimeout(bannerResumeTimerRef.current);
    bannerResumeTimerRef.current = null;
    setBannerInteracting(true);
  }

  function resumeBannerAfterInteraction() {
    setBannerInteracting(true);
    if (bannerResumeTimerRef.current !== null) window.clearTimeout(bannerResumeTimerRef.current);
    bannerResumeTimerRef.current = window.setTimeout(() => {
      setBannerInteracting(false);
      bannerResumeTimerRef.current = null;
    }, 2400);
  }

  function moveBanner(direction: -1 | 1) {
    const viewport = bannerViewportRef.current;
    if (!viewport) return;
    resumeBannerAfterInteraction();
    viewport.scrollBy({ left: direction * Math.round(viewport.clientWidth * 0.72), behavior: "smooth" });
  }

  function startBannerDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    bannerDragRef.current = { pointerId: event.pointerId, startX: event.clientX, startScrollLeft: event.currentTarget.scrollLeft, moved: false };
    pauseBannerForInteraction();
    setBannerDragging(false);
  }

  function moveBannerDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = bannerDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const distance = event.clientX - drag.startX;
    if (Math.abs(distance) > 4) {
      drag.moved = true;
      setBannerDragging(true);
      if (!event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();
      event.currentTarget.scrollLeft = drag.startScrollLeft - distance;
    }
  }

  function endBannerDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = bannerDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.moved) {
      ignoreBannerClickRef.current = true;
      window.setTimeout(() => { ignoreBannerClickRef.current = false; }, 0);
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    bannerDragRef.current = null;
    setBannerDragging(false);
    resumeBannerAfterInteraction();
  }

  return <div className="home-page">
    <SiteHeader active="home" />

    <main id="inicio">
      <section className="hero-section">
        <div className="hero-copy"><span className="hero-kicker"><span className="pulse-dot" /> DESCUBRE LO LOCAL</span><h1>Lo que necesitas,<br /><em>está más cerca.</em></h1><p>Encuentra negocios, productos y servicios en tu zona. Todo empieza con una búsqueda.</p>
          <SearchBar onSearch={setQuery} onSubmitSearch={(value) => navigate(`/results${value.trim() ? `?q=${encodeURIComponent(value.trim())}` : ""}`)} />
          <div className="search-hint"><Icon name="pin" /> Explorando en <strong>{locationLabel}</strong></div>
        </div>
        <div className="hero-art home-hero-map" aria-label={`Mapa de negocios cerca de ${locationLabel}`}><iframe title={`Mapa de Google Maps centrado en ${locationLabel}`} src={`https://www.google.com/maps?q=${encodeURIComponent(`negocios cerca de ${locationLabel}`)}&z=14&output=embed`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" /></div>
      </section>

      {bannerBusinesses.length > 0 && <section className="home-business-banner home-business-banner--below-hero" aria-label="Descubre negocios"><div className="home-business-banner__heading"><span>DESCUBRE NEGOCIOS</span><div className="home-business-banner__controls"><button type="button" aria-label="Mover negocios hacia la izquierda" onClick={() => moveBanner(-1)}>←</button><button type="button" aria-label="Mover negocios hacia la derecha" onClick={() => moveBanner(1)}>→</button><button type="button" aria-pressed={bannerPaused} onClick={() => setBannerPaused((paused) => !paused)}>{bannerPaused ? "▶ Reanudar" : "Ⅱ Pausar"}</button></div></div><div className={`home-business-banner__viewport${bannerDragging ? " is-dragging" : ""}`} ref={bannerViewportRef} onPointerEnter={pauseBannerForInteraction} onPointerLeave={resumeBannerAfterInteraction} onPointerDown={startBannerDrag} onPointerMove={moveBannerDrag} onPointerUp={endBannerDrag} onPointerCancel={endBannerDrag} onClickCapture={(event) => { if (ignoreBannerClickRef.current) { event.preventDefault(); event.stopPropagation(); } }} onFocusCapture={pauseBannerForInteraction} onBlurCapture={resumeBannerAfterInteraction}><div className="home-business-banner__track">{[0, 1].map((group) => <div className="home-business-banner__group" key={group} ref={group === 0 ? bannerGroupRef : undefined} aria-hidden={group === 1 ? true : undefined}>{bannerBusinesses.map((business) => <Link className="home-business-banner__card" to={`/business/${business.id}`} key={business.id} tabIndex={group === 1 ? -1 : undefined} draggable={false}><img src={business.image} alt="" loading="lazy" draggable={false}/><span className="home-business-banner__shade"/><span className="home-business-banner__copy"><small>{business.plan === "premium" || business.isFeatured ? "DESTACADO" : isRecentlyAdded(business.createdAt) ? "NUEVO EN WIT" : "CERCA DE TI"}</small><b>{business.name}</b><em>{business.category}</em></span></Link>)}</div>)}</div></div></section>}

      <section className="category-section" id="explorar" aria-labelledby="category-title">
        <div className="section-heading"><div><span className="section-kicker">¿QUÉ NECESITAS?</span><h2 id="category-title">Explora por categoría</h2></div><button className="text-link" type="button" aria-expanded={showAllCategories} aria-controls="home-category-list" onClick={() => setShowAllCategories((current) => !current)}>{showAllCategories ? "Ver menos" : `Ver todas (${categories.length})`} <Icon name="arrow" /></button></div>
        <div className="category-list" id="home-category-list">{visibleCategories.map((item, index) => <button key={item.name} type="button" className={`category-tile${category === item.name ? " selected" : ""}`} aria-pressed={category === item.name} onClick={() => { setCategory((current) => current === item.name ? "" : item.name); if (index >= 6) setShowAllCategories(true); }}><span className="category-icon" aria-hidden="true">{item.icon}</span><span>{item.name}</span></button>)}</div>
      </section>

      {newProducts.length > 0 && <NewProductsBanner products={newProducts} likedIds={likes} onLike={saveLike}/>}

      <section className="business-section" id="lugares" aria-labelledby="business-title">
        <div className="section-heading businesses-heading"><div><span className="section-kicker">CERCA DE TU ZONA</span><h2 id="business-title">{resultsLabel}</h2><p>{hasSampleCatalog ? `${visibleItems.length} negocios de muestra en ${cityName}` : `Estamos preparando la información para ${cityName}.`}</p></div><Button variant={mapView ? "primary" : "outline"} type="button" onClick={() => setMapView((current) => !current)}><Icon name="map" />{mapView ? "Ver lista" : "Ver en mapa"}</Button></div>
        {mapView && <div className="map-preview home-google-map"><iframe title={`Negocios cerca de ${locationLabel}`} src={`https://www.google.com/maps?q=${encodeURIComponent(`negocios cerca de ${locationLabel}`)}&z=14&output=embed`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" /><div className="map-caption"><Icon name="pin" />Negocios cerca de {cityName} · radio aproximado de 3 km</div></div>}
          {!hasSampleCatalog ? <LocationAvailabilityNotice location={selectedLocation} query={query}/> : visibleItems.length ? <><div className="business-grid">{(showAllNearby ? nearbyItems : nearbyItems.slice(0, 12)).map((business) => <BusinessCard key={business.id} business={business} favorite={favorites.includes(business.id)} onFavorite={() => saveFavorite(business.id)} />)}</div>{nearbyItems.length > 12 && !showAllNearby && <button className="home-see-all" type="button" onClick={() => setShowAllNearby(true)}>Ver todos ({nearbyItems.length})</button>}</> : <NoResultsState term={query || category} locationName={cityName}/>}
      </section>

      {hasSampleCatalog && <section className="need-banner"><div><span>¿No lo encontraste?</span><h2>Cuéntanos qué necesitas</h2><p>Ayúdanos a descubrir qué hace falta cerca de ti.</p></div><Button variant="outline" type="button" onClick={() => navigate("/register-need")}>Registrar una necesidad <Icon name="arrow" /></Button><span className="banner-sparkle">✳</span></section>}
    </main>

    <footer className="site-footer"><Logo /><span>Descubrimiento local, hecho para estar cerca.</span><small>© 2026 WIT · Palmira, Colombia</small></footer>
    {message && <div className="wit-toast" role="status">{message}</div>}
    <BottomNavigation />
  </div>;
}
