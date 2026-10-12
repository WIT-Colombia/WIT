import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@wit/ui";
import { businesses as sampleBusinesses, categories, products as sampleProducts, type Business } from "../data/mockData";
import { hasSampleCatalogForLocation } from "../services/locationService";
import { useLocationContext } from "../context/LocationContext";
import { getBusinesses, prioritizeFeaturedByDistance } from "../services/businessService";
import { LocationAvailabilityNotice } from "../components/LocationAvailabilityNotice";
import { SearchBar } from "../components/SearchBar";
import { SiteHeader } from "../components/SiteHeader";
import { BottomNavigation } from "../components/BottomNavigation";
import { BusinessCard } from "../components/EntityCards";
import { NewProductsBanner } from "../components/NewProductsBanner";
import { NoResultsState } from "../components/NoResultsState";
import { AdMobBanner } from "../components/AdMobBanner";
import { ThumbsUpIcon } from "../components/ActionIcons";
import { useAccountGate } from "../hooks/useAccountGate";
import { getFavoriteIds, getLikeIds, toggleFavorite, toggleLike } from "../services/userDataService";
import xamukoLocalHero from "../assets/xamuko-local-hero.png";
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

const categoryIconPaths: Record<string, string> = {
  "Restaurantes": "M6 3v8m0-4h4M6 11a2 2 0 0 0 2 2v8m8-18v7m0 0a3 3 0 1 0 3 3v-3m-3 0h-3m3 0h3M4 21h16",
  "Droguerías": "M12 4v16M4 12h16",
  "Ferreterías": "m14.5 5.5 4 4M3 21l7.8-7.8m-2.3-4.7a5 5 0 0 0 6.5 6.5l2.2 2.2a2 2 0 1 0 2.8-2.8l-2.2-2.2A5 5 0 0 0 11.3 6L8 9.3",
  "Talleres": "m14 6 4-4 4 4-4 4m-4-4 4 4M4 20l8.5-8.5M3 21h4l9-9-4-4-9 9v4Z",
  "Barberías": "M8 4 4 8m0 0 4 4m-4-4 8 8m4-12 4 4m0 0-4 4m4-4-8 8M8 4l12 12",
  "Tecnología": "M6 3h12v18H6zM9 6h6M10 18h4",
  "Cafeterías": "M5 8h13v5a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5V8Zm13 2h1a3 3 0 0 1 0 6h-2M8 21h10M11 3v3m4-3v3",
  "Panaderías y reposterías": "M4 12a8 8 0 0 1 16 0v7H4v-7Zm4 0v7m4-7v7m4-7v7M4 16h16",
  "Supermercados y tiendas": "M4 5h17l-2 9H7L5 3H2m6 15a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm9 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z",
  "Frutas y verduras": "M12 20c-4-3-6-7-3-11 2-3 5-4 7-1 1 1 1 3 0 5-1 3-2 5-4 7Zm0 0c0-5 2-9 7-12",
  "Carnicerías y pescaderías": "M4 7h16M6 7v10h12V7m-8 4h4M8 3h8v4H8z",
  "Salud y bienestar": "M12 21s-7-4.4-7-10a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 5.6-7 10-7 10Zm-3-9h6m-3-3v6",
  "Clínicas y consultorios": "M5 3h14v18H5zM9 7h6M12 4v6M9 13h6m-3-3v6",
  "Ópticas": "M3 12c2-5 6-7 9 0 3-7 7-5 9 0-2 6-7 6-9 0-2 6-7-9 0Z",
  "Peluquerías y belleza": "M5 4v16m0-16c5 0 7 3 0 6 7 0 7 4 0 4m9-10v16m0-16c5 0 7 3 0 6 7 0 7 4 0 4",
  "Ropa y calzado": "m6 7 6-4 6 4 3 13H3L6 7Zm3-2 3 4 3-4",
  "Hogar y decoración": "m3 11 9-8 9 8v9H3zM9 20v-6h6v6",
  "Construcción y remodelación": "M4 20h16M6 17h12M8 14h8M10 11h4M12 3v8",
  "Repuestos y accesorios": "M12 3v4m0 10v4M3 12h4m10 0h4M5.6 5.6l2.8 2.8m5.2 5.2 2.8 2.8m0-10.8-2.8 2.8m-5.2 5.2-2.8 2.8M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z",
  "Lavanderías y tintorerías": "M4 5h16v16H4zM7 9h10M8 14a4 4 0 0 0 8 0",
  "Mascotas y veterinarias": "M8 11c-2-2-4-1-4 1m12-1c2-2 4-1 4 1M8 17c2-2 6-2 8 0m-4-3v-2",
  "Papelerías y librerías": "M5 4h14v16H5zM8 8h8M8 12h8M8 16h5",
  "Educación y cursos": "M3 6 12 3l9 3-9 3-9-3Zm3 3v6c3 3 9 3 12 0V9M21 6v7",
  "Deportes y recreación": "m12 3 3 4-3 4-3-4 3-4Zm-6 9 6 2 6-2m-6 2v7m-5-3 5-4 5 4",
  "Transporte y movilidad": "M5 17 7 7h10l2 10m-14 0h14M7 12h10M8 20h2m6 0h2",
  "Servicios para el hogar": "M5 20h14M7 17h10M9 14h6M11 4h2v10h-2z",
  "Servicios técnicos": "M14 5a5 5 0 0 0-5 7l-6 6 3 3 6-6a5 5 0 0 0 7-5l-3 3-3-3 3-3a5 5 0 0 0-2-1Z",
  "Servicios profesionales": "M4 7h16v13H4zM8 7V4h8v3M4 12h16M10 12v2h4v-2",
  "Floristerías y regalos": "M12 21v-8m0 0c-5 0-7-3-5-6 3 0 5 2 5 6Zm0 0c5 0 7-3 5-6-3 0-5 2-5 5 6Zm0-8c-3-3-2-6 0-8 2 2 3 5 0 8Z",
  "Hoteles y turismo": "M4 20V8l8-5 8 5v12M8 20v-6h8v6M9 9h.01M15 9h.01",
  "Eventos y entretenimiento": "M4 5h16v14H4zM8 9h8M8 13h5M7 2v3m10-3v3",
  "Belleza y cuidado personal": "M8 3h8m-6 0v5m4-5v5M5 8h14l-2 13H7L5 8Zm3 4h8",
};

function CategoryIcon({ name }: { name: string }) {
  const path = categoryIconPaths[name] ?? "M5 5h14v14H5zM9 9h6v6H9z";
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={path}/></svg>;
}

const NEW_BUSINESS_WINDOW_DAYS = 7;
const NEW_PRODUCT_WINDOW_DAYS = 7;

const specialOffers = [
  { product: sampleProducts[0], discount: "-20%", deadline: "Hasta 31 oct." },
  { product: sampleProducts[1], discount: "-15%", deadline: "Hasta 30 oct." },
  { product: sampleProducts[3], discount: "-30%", deadline: "Hasta 15 oct." },
  { product: sampleProducts[2], discount: "-10%", deadline: "Hasta 28 oct." },
  { product: sampleProducts[4], discount: "-25%", deadline: "Hasta 20 oct." },
  { product: sampleProducts[5], discount: "-12%", deadline: "Hasta 5 nov." },
  { product: sampleProducts[6], discount: "-18%", deadline: "Hasta 2 nov." },
];

function isRecentlyAdded(createdAt?: string): boolean {
  if (!createdAt) return false;
  const ageDays = (Date.now() - Date.parse(createdAt)) / (1000 * 60 * 60 * 24);
  return ageDays >= 0 && ageDays < NEW_BUSINESS_WINDOW_DAYS;
}

export default function Home() {
  const navigate = useNavigate();
  const requireAccount = useAccountGate();
  const location = useLocation();
  const navigationMessage = (location.state as { toast?: unknown } | null)?.toast;
  const [query, setQuery] = useState(() => new URLSearchParams(location.search).get("q") ?? "");
  const [category, setCategory] = useState("");
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [showAllFeatured, setShowAllFeatured] = useState(false);
  const [showAllNearby, setShowAllNearby] = useState(false);
  const [categoryScroll, setCategoryScroll] = useState({ left: 0, max: 0 });
  const [featuredScroll, setFeaturedScroll] = useState({ left: 0, max: 0 });
  const [nearbyScroll, setNearbyScroll] = useState({ left: 0, max: 0 });
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
  const featuredListRef = useRef<HTMLDivElement>(null);
  const featuredDragRef = useRef<{ pointerId: number; startX: number; startScrollLeft: number; moved: boolean } | null>(null);
  const ignoreFeaturedClickRef = useRef(false);
  const categoryListRef = useRef<HTMLDivElement>(null);
  const categoryDragRef = useRef<{ pointerId: number; startX: number; startScrollLeft: number; moved: boolean } | null>(null);
  const ignoreCategoryClickRef = useRef(false);
  const nearbyListRef = useRef<HTMLDivElement>(null);
  const nearbyDragRef = useRef<{ pointerId: number; startX: number; startScrollLeft: number; moved: boolean } | null>(null);
  const ignoreNearbyClickRef = useRef(false);
  const [showAllOffers, setShowAllOffers] = useState(false);
  const [offersScroll, setOffersScroll] = useState({ left: 0, max: 0 });
  const offersListRef = useRef<HTMLDivElement>(null);
  const offersDragRef = useRef<{ pointerId: number; startX: number; startScrollLeft: number; moved: boolean } | null>(null);
  const ignoreOffersClickRef = useRef(false);
  const { selection } = useLocationContext();
  const selectedLocation = selection?.mode === "manual" ? selection.locality : null;
  const hasSampleCatalog = hasSampleCatalogForLocation(selectedLocation);
  const [message, setMessage] = useState(() => typeof navigationMessage === "string" ? navigationMessage : "");

  useEffect(() => {
    if (typeof navigationMessage !== "string") return;
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [location.pathname, location.search, navigate, navigationMessage]);

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
    const distances = new Map(sampleBusinesses.map((business) => [business.id, business.distanceKm]));
    return [...sampleProducts]
      .filter((product) => {
        if (!product.createdAt) return false;
        const ageDays = (Date.now() - Date.parse(product.createdAt)) / (1000 * 60 * 60 * 24);
        return ageDays >= 0 && ageDays < NEW_PRODUCT_WINDOW_DAYS;
      })
      .sort((a, b) => (distances.get(a.businessId) ?? Number.POSITIVE_INFINITY) - (distances.get(b.businessId) ?? Number.POSITIVE_INFINITY)
        || Date.parse(b.createdAt ?? "") - Date.parse(a.createdAt ?? ""));
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
  const allFeaturedItems = useMemo(() => hasSampleCatalog
    ? [...sampleBusinesses].filter((business) => business.plan === "premium" || business.isFeatured).sort((a, b) => a.distanceKm - b.distanceKm)
    : [], [hasSampleCatalog]);
  const featuredItems = showAllFeatured ? allFeaturedItems : allFeaturedItems.slice(0, 4);
  useEffect(() => {
    const list = featuredListRef.current;
    if (!list || !showAllFeatured) {
      setFeaturedScroll({ left: 0, max: 0 });
      return;
    }
    const update = () => setFeaturedScroll({ left: list.scrollLeft, max: Math.max(0, list.scrollWidth - list.clientWidth) });
    const frame = window.requestAnimationFrame(update);
    const observer = new ResizeObserver(update);
    observer.observe(list);
    return () => { window.cancelAnimationFrame(frame); observer.disconnect(); };
  }, [showAllFeatured, featuredItems.length]);
  const locationLabel = selectedLocation ? `${selectedLocation.name}, ${selectedLocation.context}` : selection?.mode === "automatic" ? "tu ubicación actual" : "una zona seleccionada";
  const cityName = selectedLocation?.name ?? (selection?.mode === "automatic" ? "tu ubicación" : "esta zona");
  // Keep the More shortcut visible alongside the initial category set.
  const featuredCategories = categories.slice(0, 7);
  const selectedCategory = categories.find((item) => item.name === category);
  const visibleCategories = showAllCategories
    ? categories
    : selectedCategory && !featuredCategories.some((item) => item.name === selectedCategory.name)
      ? [...featuredCategories, selectedCategory]
    : featuredCategories;
  function selectCategory(categoryName: string, index: number) {
    setCategory(categoryName);
    setQuery("");
    if (index >= 6) setShowAllCategories(true);
    navigate(`/results?category=${encodeURIComponent(categoryName)}`);
  }
  useEffect(() => {
    const list = categoryListRef.current;
    if (!list || !showAllCategories) {
      setCategoryScroll({ left: 0, max: 0 });
      return;
    }
    const update = () => setCategoryScroll({ left: list.scrollLeft, max: Math.max(0, list.scrollWidth - list.clientWidth) });
    const frame = window.requestAnimationFrame(update);
    const observer = new ResizeObserver(update);
    observer.observe(list);
    return () => { window.cancelAnimationFrame(frame); observer.disconnect(); };
  }, [showAllCategories, visibleCategories.length]);

  useEffect(() => {
    const list = nearbyListRef.current;
    if (!list || !showAllNearby) {
      setNearbyScroll({ left: 0, max: 0 });
      return;
    }
    const update = () => setNearbyScroll({ left: list.scrollLeft, max: Math.max(0, list.scrollWidth - list.clientWidth) });
    const frame = window.requestAnimationFrame(update);
    const observer = new ResizeObserver(update);
    observer.observe(list);
    return () => { window.cancelAnimationFrame(frame); observer.disconnect(); };
  }, [showAllNearby, nearbyItems.length]);

  useEffect(() => {
    const list = offersListRef.current;
    if (!list || !showAllOffers) {
      setOffersScroll({ left: 0, max: 0 });
      return;
    }
    const update = () => setOffersScroll({ left: list.scrollLeft, max: Math.max(0, list.scrollWidth - list.clientWidth) });
    const frame = window.requestAnimationFrame(update);
    const observer = new ResizeObserver(update);
    observer.observe(list);
    return () => { window.cancelAnimationFrame(frame); observer.disconnect(); };
  }, [showAllOffers]);

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

  function startFeaturedDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const list = featuredListRef.current;
    if (!list) return;
    featuredDragRef.current = { pointerId: event.pointerId, startX: event.clientX, startScrollLeft: list.scrollLeft, moved: false };
  }

  function moveFeaturedDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = featuredDragRef.current;
    const list = featuredListRef.current;
    if (!drag || !list || drag.pointerId !== event.pointerId) return;
    const delta = event.clientX - drag.startX;
    if (Math.abs(delta) > 6) drag.moved = true;
    if (drag.moved) {
      event.preventDefault();
      if (!list.hasPointerCapture(event.pointerId)) list.setPointerCapture(event.pointerId);
      list.scrollLeft = drag.startScrollLeft - delta;
    }
  }

  function endFeaturedDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = featuredDragRef.current;
    const list = featuredListRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    ignoreFeaturedClickRef.current = drag.moved;
    featuredDragRef.current = null;
    if (list?.hasPointerCapture(event.pointerId)) list.releasePointerCapture(event.pointerId);
    if (ignoreFeaturedClickRef.current) window.setTimeout(() => { ignoreFeaturedClickRef.current = false; }, 0);
  }

  function startCategoryDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const list = categoryListRef.current;
    if (!list) return;
    categoryDragRef.current = { pointerId: event.pointerId, startX: event.clientX, startScrollLeft: list.scrollLeft, moved: false };
  }

  function moveCategoryDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = categoryDragRef.current;
    const list = categoryListRef.current;
    if (!drag || !list || drag.pointerId !== event.pointerId) return;
    const delta = event.clientX - drag.startX;
    if (Math.abs(delta) > 6) drag.moved = true;
    if (drag.moved) {
      event.preventDefault();
      if (!list.hasPointerCapture(event.pointerId)) list.setPointerCapture(event.pointerId);
      list.scrollLeft = drag.startScrollLeft - delta;
    }
  }

  function endCategoryDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = categoryDragRef.current;
    const list = categoryListRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    ignoreCategoryClickRef.current = drag.moved;
    categoryDragRef.current = null;
    if (list?.hasPointerCapture(event.pointerId)) list.releasePointerCapture(event.pointerId);
    if (ignoreCategoryClickRef.current) window.setTimeout(() => { ignoreCategoryClickRef.current = false; }, 0);
  }

  function startNearbyDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const list = nearbyListRef.current;
    if (!list) return;
    nearbyDragRef.current = { pointerId: event.pointerId, startX: event.clientX, startScrollLeft: list.scrollLeft, moved: false };
  }

  function moveNearbyDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = nearbyDragRef.current;
    const list = nearbyListRef.current;
    if (!drag || !list || drag.pointerId !== event.pointerId) return;
    const delta = event.clientX - drag.startX;
    if (Math.abs(delta) > 6) drag.moved = true;
    if (drag.moved) {
      event.preventDefault();
      if (!list.hasPointerCapture(event.pointerId)) list.setPointerCapture(event.pointerId);
      list.scrollLeft = drag.startScrollLeft - delta;
    }
  }

  function endNearbyDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = nearbyDragRef.current;
    const list = nearbyListRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    ignoreNearbyClickRef.current = drag.moved;
    nearbyDragRef.current = null;
    if (list?.hasPointerCapture(event.pointerId)) list.releasePointerCapture(event.pointerId);
    if (ignoreNearbyClickRef.current) window.setTimeout(() => { ignoreNearbyClickRef.current = false; }, 0);
  }

  function startOffersDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const list = offersListRef.current;
    if (!list) return;
    offersDragRef.current = { pointerId: event.pointerId, startX: event.clientX, startScrollLeft: list.scrollLeft, moved: false };
  }

  function moveOffersDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = offersDragRef.current;
    const list = offersListRef.current;
    if (!drag || !list || drag.pointerId !== event.pointerId) return;
    const delta = event.clientX - drag.startX;
    if (Math.abs(delta) > 6) drag.moved = true;
    if (drag.moved) {
      event.preventDefault();
      if (!list.hasPointerCapture(event.pointerId)) list.setPointerCapture(event.pointerId);
      list.scrollLeft = drag.startScrollLeft - delta;
    }
  }

  function endOffersDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = offersDragRef.current;
    const list = offersListRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    ignoreOffersClickRef.current = drag.moved;
    offersDragRef.current = null;
    if (list?.hasPointerCapture(event.pointerId)) list.releasePointerCapture(event.pointerId);
    if (ignoreOffersClickRef.current) window.setTimeout(() => { ignoreOffersClickRef.current = false; }, 0);
  }

  return <div className="home-page">
    <SiteHeader active="home" />

    <main id="inicio">
      <section className="hero-section">
        <div className="hero-copy"><span className="hero-kicker"><span className="pulse-dot" /> Descubre lo local</span><h1>Lo que necesitas,<br /><em>está más cerca.</em></h1><p>Encuentra negocios, productos y servicios en tu zona. Todo empieza con una búsqueda.</p>
          <SearchBar hideSubmit onSearch={setQuery} onSubmitSearch={(value) => navigate(`/results${value.trim() ? `?q=${encodeURIComponent(value.trim())}` : ""}`)} />
        </div>
      </section>

      {bannerBusinesses.length > 0 && <section className="home-business-banner home-business-banner--below-hero" aria-label="Descubre negocios"><div className="home-business-banner__heading"><h2>Descubre negocios</h2><div className="home-business-banner__controls"><button type="button" aria-label="Mover negocios hacia la izquierda" onClick={() => moveBanner(-1)}>←</button><button type="button" aria-label="Mover negocios hacia la derecha" onClick={() => moveBanner(1)}>→</button><button type="button" aria-pressed={bannerPaused} onClick={() => setBannerPaused((paused) => !paused)}>{bannerPaused ? "▶ Reanudar" : "Ⅱ Pausar"}</button></div></div><div className={`home-business-banner__viewport${bannerDragging ? " is-dragging" : ""}`} ref={bannerViewportRef} onPointerEnter={pauseBannerForInteraction} onPointerLeave={resumeBannerAfterInteraction} onPointerDown={startBannerDrag} onPointerMove={moveBannerDrag} onPointerUp={endBannerDrag} onPointerCancel={endBannerDrag} onClickCapture={(event) => { if (ignoreBannerClickRef.current) { event.preventDefault(); event.stopPropagation(); } }} onFocusCapture={pauseBannerForInteraction} onBlurCapture={resumeBannerAfterInteraction}><div className="home-business-banner__track">{[0, 1].map((group) => <div className="home-business-banner__group" key={group} ref={group === 0 ? bannerGroupRef : undefined} aria-hidden={group === 1 ? true : undefined}>{bannerBusinesses.map((business) => <Link className="home-business-banner__card" to={`/business/${business.id}`} key={business.id} tabIndex={group === 1 ? -1 : undefined} draggable={false}><img src={business.image} alt="" loading="lazy" draggable={false}/><span className="home-business-banner__shade"/><span className="home-business-banner__copy"><small>{business.plan === "premium" || business.isFeatured ? "Destacado" : isRecentlyAdded(business.createdAt) ? "Nuevo en tu ciudad" : "Cerca de ti"}</small><b>{business.name}</b><em>{business.category}</em></span></Link>)}</div>)}</div></div></section>}

      <section className="category-section" id="explorar" aria-labelledby="category-title">
        <div className="section-heading"><div><h2 id="category-title">Explora por categoría</h2></div><button className="text-link category-toggle" type="button" aria-expanded={showAllCategories} aria-controls="home-category-list" onClick={() => setShowAllCategories((current) => !current)}>{showAllCategories ? "Ver menos" : `Ver más (${categories.length})`} <Icon name="arrow" /></button></div>
        <div className={`category-list${showAllCategories ? " is-expanded" : ""}`} id="home-category-list" ref={categoryListRef} onScroll={() => { const list = categoryListRef.current; if (list) setCategoryScroll({ left: list.scrollLeft, max: Math.max(0, list.scrollWidth - list.clientWidth) }); }} onPointerDown={startCategoryDrag} onPointerMove={moveCategoryDrag} onPointerUp={endCategoryDrag} onPointerCancel={endCategoryDrag} onClickCapture={(event) => { if (ignoreCategoryClickRef.current) { event.preventDefault(); event.stopPropagation(); } }}>{visibleCategories.map((item, index) => <button key={item.name} type="button" className={`category-tile${category === item.name ? " selected" : ""}`} aria-pressed={category === item.name} onClick={() => selectCategory(item.name, index)}><span className="category-icon"><CategoryIcon name={item.name}/></span><span>{item.name}</span></button>)}</div>
        {showAllCategories && categoryScroll.max > 0 && <div className="category-scroll-control"><input type="range" min="0" max={categoryScroll.max} step="1" value={Math.min(categoryScroll.left, categoryScroll.max)} aria-label="Desplazar categorías" onChange={(event) => { const left = Number(event.target.value); if (categoryListRef.current) categoryListRef.current.scrollLeft = left; setCategoryScroll((current) => ({ ...current, left })); }} /></div>}
      </section>

      <section className="home-city-banner-section" aria-label={`Descubre negocios cerca de ${locationLabel}`}><div className="home-city-banner"><img src={xamukoLocalHero} alt="Comercios locales de la ciudad"/><div className="home-city-banner__shade"/><div className="home-city-banner__copy"><span>EXPLORA TU CIUDAD</span><h2>Lo local está<br/>más cerca de ti</h2><p>Encuentra negocios, productos y servicios que hacen especial a tu comunidad.</p><Link to="/map" className="home-city-banner__action"><Icon name="map"/>Explorar negocios</Link></div></div></section>

      <div className="admob-banner-slot admob-banner-slot--home-inline"><AdMobBanner /></div>

      {featuredItems.length > 0 && <section className="business-section home-featured-section" aria-labelledby="featured-title"><div className="section-heading businesses-heading"><div><h2 id="featured-title">Negocios destacados</h2></div>{allFeaturedItems.length > 4 && <button className="text-link" type="button" aria-expanded={showAllFeatured} aria-controls="featured-business-list" onClick={() => setShowAllFeatured((current) => !current)}>{showAllFeatured ? "Ver menos" : `Ver más (${allFeaturedItems.length})`} <Icon name="arrow" /></button>}</div><div className="business-grid" id="featured-business-list" ref={featuredListRef} onScroll={() => { const list = featuredListRef.current; if (list) setFeaturedScroll({ left: list.scrollLeft, max: Math.max(0, list.scrollWidth - list.clientWidth) }); }} onPointerDown={startFeaturedDrag} onPointerMove={moveFeaturedDrag} onPointerUp={endFeaturedDrag} onPointerCancel={endFeaturedDrag} onClickCapture={(event) => { if (ignoreFeaturedClickRef.current) { event.preventDefault(); event.stopPropagation(); } }}>{featuredItems.map((business) => <BusinessCard key={business.id} business={business} favorite={favorites.includes(business.id)} onFavorite={() => saveFavorite(business.id)} />)}</div>{showAllFeatured && featuredScroll.max > 0 && <div className="featured-scroll-control"><input type="range" min="0" max={featuredScroll.max} step="1" value={Math.min(featuredScroll.left, featuredScroll.max)} aria-label="Desplazar negocios destacados" onChange={(event) => { const left = Number(event.target.value); if (featuredListRef.current) featuredListRef.current.scrollLeft = left; setFeaturedScroll((current) => ({ ...current, left })); }} /></div>}</section>}

      {newProducts.length > 0 && <NewProductsBanner products={newProducts} likedIds={likes} onLike={saveLike}/>}

      <section className="business-section home-nearby-section" id="lugares" aria-labelledby="business-title">
        <div className="section-heading businesses-heading"><div><h2 id="business-title">{resultsLabel}</h2></div>{nearbyItems.length > 4 && <button className="text-link" type="button" aria-expanded={showAllNearby} aria-controls="nearby-business-list" onClick={() => setShowAllNearby((current) => !current)}>{showAllNearby ? "Ver menos" : `Ver más (${nearbyItems.length})`} <Icon name="arrow" /></button>}</div>
          {!hasSampleCatalog ? <LocationAvailabilityNotice location={selectedLocation} query={query}/> : visibleItems.length ? <><div className="business-grid" id="nearby-business-list" ref={nearbyListRef} onScroll={() => { const list = nearbyListRef.current; if (list) setNearbyScroll({ left: list.scrollLeft, max: Math.max(0, list.scrollWidth - list.clientWidth) }); }} onPointerDown={startNearbyDrag} onPointerMove={moveNearbyDrag} onPointerUp={endNearbyDrag} onPointerCancel={endNearbyDrag} onClickCapture={(event) => { if (ignoreNearbyClickRef.current) { event.preventDefault(); event.stopPropagation(); } }}>{(showAllNearby ? nearbyItems : nearbyItems.slice(0, 4)).map((business) => <BusinessCard key={business.id} business={business} favorite={favorites.includes(business.id)} onFavorite={() => saveFavorite(business.id)} />)}</div>{showAllNearby && nearbyScroll.max > 0 && <div className="nearby-scroll-control"><input type="range" min="0" max={nearbyScroll.max} step="1" value={Math.min(nearbyScroll.left, nearbyScroll.max)} aria-label="Desplazar lugares cerca de ti" onChange={(event) => { const left = Number(event.target.value); if (nearbyListRef.current) nearbyListRef.current.scrollLeft = left; setNearbyScroll((current) => ({ ...current, left })); }} /></div>}</> : <NoResultsState term={query || category} locationName={cityName}/>}
      </section>

      <section className="special-offers" aria-labelledby="special-offers-title">
        <div className="section-heading"><h2 id="special-offers-title">Ofertas especiales</h2>{specialOffers.length > 4 && <button className="text-link" type="button" aria-expanded={showAllOffers} aria-controls="special-offers-list" onClick={() => setShowAllOffers((current) => !current)}>{showAllOffers ? "Ver menos" : `Ver más (${specialOffers.length})`} <Icon name="arrow" /></button>}</div>
        <div className={`special-offers__list${showAllOffers ? " is-expanded" : ""}`} id="special-offers-list" ref={offersListRef} onScroll={() => { const list = offersListRef.current; if (list) setOffersScroll({ left: list.scrollLeft, max: Math.max(0, list.scrollWidth - list.clientWidth) }); }} onPointerDown={startOffersDrag} onPointerMove={moveOffersDrag} onPointerUp={endOffersDrag} onPointerCancel={endOffersDrag} onClickCapture={(event) => { if (ignoreOffersClickRef.current) { event.preventDefault(); event.stopPropagation(); } }}>{(showAllOffers ? specialOffers : specialOffers.slice(0, 4)).map(({ product, discount, deadline }) => { const business = sampleBusinesses.find((item) => item.id === product.businessId); return <article className="special-offer-card" key={product.id}><Link className="special-offer-card__link" to={`/product/${product.id}`} aria-label={`Ver ${product.name}`}><div className="special-offer-card__image"><img src={product.image} alt="" loading="lazy"/><span className="special-offer-card__discount">{discount}</span></div><div className="special-offer-card__content"><strong>{product.name}</strong><span>{business?.category ?? "Negocio local"}</span><small>✣ <b>{deadline}</b></small></div></Link><button className="special-offer-card__like" type="button" aria-label={likes.includes(product.id) ? `Quitar me gusta a ${product.name}` : `Me gusta ${product.name}`} aria-pressed={likes.includes(product.id)} onClick={(event) => { event.preventDefault(); event.stopPropagation(); requireAccount(() => saveLike(product.id)); }}><ThumbsUpIcon/></button></article>; })}</div>
        {showAllOffers && offersScroll.max > 0 && <div className="offers-scroll-control"><input type="range" min="0" max={offersScroll.max} step="1" value={Math.min(offersScroll.left, offersScroll.max)} aria-label="Desplazar ofertas especiales" onChange={(event) => { const left = Number(event.target.value); if (offersListRef.current) offersListRef.current.scrollLeft = left; setOffersScroll((current) => ({ ...current, left })); }} /></div>}
      </section>

      <div className="admob-banner-slot admob-banner-slot--home-footer"><AdMobBanner slot="home-footer" /></div>
      {hasSampleCatalog && <section className="need-banner"><div><span>¿No lo encontraste?</span><h2>Cuéntanos qué necesitas</h2><p>Ayúdanos a descubrir qué hace falta cerca de ti.</p></div><Button variant="outline" type="button" onClick={() => navigate("/register-need")}>Registrar una necesidad <Icon name="arrow" /></Button></section>}
    </main>

    <footer className="site-footer"><strong className="site-footer__brand">XAMUKO</strong><span>Lo que necesitas, está más cerca.</span><small>© 2026 XAMUKO · Palmira, Colombia</small></footer>
    {message && <div className="wit-toast" role="status">{message}</div>}
    <BottomNavigation />
  </div>;
}
