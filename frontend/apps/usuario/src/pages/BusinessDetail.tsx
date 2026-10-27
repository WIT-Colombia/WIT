import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { Business, Product, Review, Service } from "../data/mockData";
import { getLikeCount } from "../services/userDataService";
import { isRealOfferId, useOfferLikes } from "../services/offerLikesService";
import { useFavorites } from "../services/favoritesService";
import { getBusinessById, getProductsByBusinessId, getServicesByBusinessId } from "../services/businessService";
import { ProductCard, ServiceCard } from "../components/EntityCards";
import { PioneerBadge } from "../components/PioneerBadge";
import { AdMobBanner } from "../components/AdMobBanner";
import { HeartIcon } from "../components/ActionIcons";
import { PageLayout } from "../components/PageLayout";
import { getPublicBusinessUrl, shareLink } from "../utils/share";
import { useAccountGate } from "../hooks/useAccountGate";
import { useAuth } from "../context/AuthContext";
import { useLocationContext } from "../context/LocationContext";
import { distanceBetweenCoordinates, getBusinessCoordinates } from "../utils/coordinates";
import { whatsappLink } from "../utils/whatsapp";
import { PublicBusinessDigitalCard } from "../components/PublicBusinessDigitalCard";
import { recordBusinessEvent } from "../services/analyticsService";
import { listPublicReviews, type PublicReview } from "../services/reviewsService";
import registrationInvitePerson from "../assets/registration-invite-person.png";
import "./BusinessDetail.css";
import "./BusinessDetailEnhancements.css";
import "./BusinessReviewEnhancements.css";
import "./BusinessRatingEnhancements.css";
import "./BusinessRatingLayout.css";
import "./BusinessDetailHeader.css";

type Tab = "info" | "products" | "services" | "reviews";
const validTabs: Tab[] = ["info", "products", "services", "reviews"];
type PreviewStorage = { returnTo?: string; expiresAt?: number };
const businessAppBaseUrl = (import.meta.env.VITE_BUSINESS_PUBLIC_URL?.trim() || (import.meta.env.DEV ? "http://localhost:5174" : "")).replace(/\/+$/, "");
const previewStorageKey = (businessId: string) => `xamuko-business-preview:${businessId}`;
function trustedBusinessReferrer(value: string): boolean {
  if (!businessAppBaseUrl || !value) return false;
  try {
    const referrer = new URL(value);
    return referrer.origin === new URL(businessAppBaseUrl).origin && referrer.pathname.startsWith("/mi-negocio/detalle/");
  } catch {
    return false;
  }
}
function safeBusinessReturnUrl(value: string | null): string | null {
  if (!value || !businessAppBaseUrl) return null;
  try {
    const target = new URL(value, businessAppBaseUrl);
    if (target.origin !== new URL(businessAppBaseUrl).origin || !target.pathname.startsWith("/mi-negocio/detalle/")) return null;
    return target.toString();
  } catch {
    return null;
  }
}
function phoneLink(phone: string) { return `tel:${phone.replace(/[^\d+]/g, "")}`; }
function BusinessRatingSummary({ average, count }: { average: number | null; count: number }) {
  const hasRatings = count > 0 && average !== null && Number.isFinite(average);
  const normalizedAverage = hasRatings ? Math.min(5, Math.max(0, average!)) : 0;
  return <span className="business-rating-summary" aria-label={hasRatings ? `${normalizedAverage.toFixed(1)} de 5, ${count} ${count === 1 ? "opinión" : "opiniones"}` : "Aún no hay calificaciones"}>
    <span className="business-rating-stars" aria-hidden="true"><span>★★★★★</span>{hasRatings && <b style={{ width: `${normalizedAverage / 5 * 100}%` }}>★★★★★</b>}</span>
    {hasRatings && <><strong>{normalizedAverage.toFixed(1)}</strong><small>({count} {count === 1 ? "opinión" : "opiniones"})</small></>}
  </span>;
}
function PhoneIcon() { return <svg className="business-contact-icon" aria-hidden="true" viewBox="0 0 24 24" fill="currentColor"><path d="M7.1 3.2 4.9 4.5a2.5 2.5 0 0 0-1.1 2.8c1.8 6.2 5.7 10.1 11.9 11.9a2.5 2.5 0 0 0 2.8-1.1l1.3-2.2a1.9 1.9 0 0 0-.6-2.6l-2.7-1.7a1.9 1.9 0 0 0-2.5.4l-.8 1a11.9 11.9 0 0 1-3.7-3.7l1-.8a1.9 1.9 0 0 0 .4-2.5L9.7 3.8a1.9 1.9 0 0 0-2.6-.6Z"/></svg>; }
function WhatsAppIcon() { return <svg className="business-contact-icon" aria-hidden="true" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3.2a8.8 8.8 0 0 0-7.63 13.2L3 21l4.78-1.34A8.8 8.8 0 1 0 12 3.2Zm0 15.9a7.06 7.06 0 0 1-3.6-.99l-.26-.16-2.84.8.81-2.76-.17-.28A7.07 7.07 0 1 1 12 19.1Zm3.88-5.3c-.21-.11-1.23-.61-1.42-.68-.19-.07-.33-.11-.47.11-.14.21-.54.68-.66.82-.12.14-.24.16-.45.05-.21-.11-.89-.33-1.69-1.05-.63-.56-1.05-1.25-1.17-1.46-.12-.21-.01-.33.09-.44.1-.1.21-.24.31-.36.1-.12.14-.21.21-.35.07-.14.04-.26-.02-.37-.05-.11-.47-1.13-.65-1.55-.17-.4-.34-.35-.47-.36h-.4c-.14 0-.37.05-.56.26-.19.21-.74.72-.74 1.76s.76 2.04.87 2.18c.11.14 1.5 2.29 3.64 3.21.51.22.91.35 1.22.45.51.16.98.14 1.35.08.41-.06 1.23-.5 1.4-.98.17-.48.17-.9.12-.98-.05-.09-.19-.14-.4-.25Z"/></svg>; }
type SocialNetworkPlatform = "facebook" | "instagram" | "x" | "tiktok";
function SocialNetworkIcon({ platform }: { platform: SocialNetworkPlatform }) {
  if (platform === "facebook") return <svg className="business-social-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#1877F2" /><path fill="white" d="M13.46 19v-6.13h2.06l.31-2.39h-2.37V8.95c0-.69.19-1.17 1.19-1.17h1.27V5.64c-.22-.03-.98-.1-1.87-.1-1.85 0-3.12 1.13-3.12 3.21v1.73H9v2.39h2.1V19h2.36Z" /></svg>;
  if (platform === "instagram") return <svg className="business-social-icon" viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="business-instagram-gradient" x1="3" y1="21" x2="21" y2="3" gradientUnits="userSpaceOnUse"><stop stopColor="#FEDA75" /><stop offset=".28" stopColor="#FA7E1E" /><stop offset=".62" stopColor="#D62976" /><stop offset="1" stopColor="#7B2CBF" /></linearGradient></defs><rect x="1.4" y="1.4" width="21.2" height="21.2" rx="5.9" fill="url(#business-instagram-gradient)" /><rect x="6.25" y="6.25" width="11.5" height="11.5" rx="3.5" fill="none" stroke="white" strokeWidth="1.8" /><circle cx="12" cy="12" r="2.75" fill="none" stroke="white" strokeWidth="1.8" /><circle cx="17.25" cy="6.9" r="1.05" fill="white" /></svg>;
  if (platform === "x") return <svg className="business-social-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="1.4" y="1.4" width="21.2" height="21.2" rx="3.2" fill="#050505" /><path fill="white" d="M17.87 4.6h2.05l-4.48 5.12L20.72 19h-4.14l-3.24-4.13L9.73 19H7.67l4.81-5.5L7.42 4.6h4.22l2.93 3.79 3.3-3.79Zm-.72 12.91h1.14L11.02 6h-1.22l7.35 11.51Z" /></svg>;
  return <svg className="business-social-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="1.4" y="1.4" width="21.2" height="21.2" rx="3.2" fill="#050505" /><path fill="#25F4EE" d="M14.34 3.05c.55 3.48 2.49 5.55 5.66 5.98v3.55c-1.85-.06-3.57-.57-5.12-1.52v6.36a6.38 6.38 0 1 1-5.5-6.32v3.59a2.91 2.91 0 1 0 2.05 2.79V3.05h2.91Z" /><path fill="#FE2C55" d="M12.85 2.05c.56 3.49 2.5 5.56 5.67 5.99v2.66a9.12 9.12 0 0 1-4.17-1.17v7.39a6.38 6.38 0 1 1-5.5-6.32v2.66a3.72 3.72 0 1 0 2.06 3.34V2.05h1.94Z" /><path fill="white" d="M13.56 2.6c.5 3.12 2.26 4.98 5.14 5.36v1.67a8.44 8.44 0 0 1-4.3-1.55v8.59a5.68 5.68 0 1 1-5.5-5.67v1.88a3.8 3.8 0 1 0 2.73 3.64V2.6h1.93Z" /></svg>;
}

export default function BusinessDetail() {
  const { id = "" } = useParams(); const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab"); const tab: Tab = validTabs.includes(tabParam as Tab) ? tabParam as Tab : "info";
  const previewRequested = searchParams.get("preview") === "business";
  const returnToParam = searchParams.get("returnTo");
  const navigate = useNavigate();
  const { status: authStatus } = useAuth();
  const { selection } = useLocationContext();
  const [galleryOpen, setGalleryOpen] = useState(false); const [galleryIndex, setGalleryIndex] = useState(0); const [shareOpen, setShareOpen] = useState(false);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false); const [hoursExpanded, setHoursExpanded] = useState(false);
  const [productsVisibleCount, setProductsVisibleCount] = useState(8); const [servicesVisibleCount, setServicesVisibleCount] = useState(8);
  const shareWrapRef = useRef<HTMLDivElement>(null);
  const galleryTouchStartX = useRef<number | null>(null);
  const headerTouchStartX = useRef<number | null>(null);
  const headerSwipeDetected = useRef(false);
  const popularListRef = useRef<HTMLDivElement>(null);
  const popularDragRef = useRef<{ pointerId: number; startX: number; startScrollLeft: number; moved: boolean } | null>(null);
  const { favorites, toggleFavorite } = useFavorites(); const [message, setMessage] = useState(""); const requireAccount = useAccountGate();
  const [business, setBusiness] = useState<Business | null>(null);
  const [businessProducts, setBusinessProducts] = useState<Product[]>([]);
  const [businessServices, setBusinessServices] = useState<Service[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "not-found" | "error">("loading");
  const [previewContext, setPreviewContext] = useState<{ active: boolean; returnTo: string | null }>({ active: false, returnTo: null });
  const [publicReviews, setPublicReviews] = useState<PublicReview[]>([]);
  const [reviewSummary, setReviewSummary] = useState<{ average: number | null; count: number }>({ average: null, count: 0 });
  const isBusinessPreview = previewContext.active;
  const demoCatalog = import.meta.env.VITE_E2E_REAL_ONLY !== "true" && searchParams.get("demoCatalog") === "50";
  const demoProducts = useMemo(() => demoCatalog && businessProducts.length > 0 ? Array.from({ length: 50 }, (_, index) => ({ ...businessProducts[index % businessProducts.length], id: `demo-product-${index + 1}`, name: `Producto demo ${index + 1}` })) : businessProducts, [demoCatalog, businessProducts]);
  const demoServices = useMemo(() => demoCatalog && businessServices.length > 0 ? Array.from({ length: 50 }, (_, index) => ({ ...businessServices[index % businessServices.length], id: `demo-service-${index + 1}`, name: `Servicio demo ${index + 1}` })) : businessServices, [demoCatalog, businessServices]);
  const catalogProducts = demoCatalog && businessProducts.length > 0 ? demoProducts : businessProducts;
  const catalogServices = demoCatalog && businessServices.length > 0 ? demoServices : businessServices;
  const offerLikeIds = useMemo(() => [...catalogProducts, ...catalogServices].map((item) => item.id), [catalogProducts, catalogServices]);
  const { get: getOfferLike, toggle: toggleOfferLike } = useOfferLikes(offerLikeIds);
  useEffect(() => {
    if (!previewRequested || !id) { setPreviewContext({ active: false, returnTo: null }); return; }
    const referrerIsBusiness = trustedBusinessReferrer(document.referrer);
    const validatedReturnTo = safeBusinessReturnUrl(returnToParam);
    const key = previewStorageKey(id);
    let stored: PreviewStorage | null = null;
    try { stored = JSON.parse(sessionStorage.getItem(key) ?? "null") as PreviewStorage | null; } catch { stored = null; }
    const storedIsValid = Boolean(stored?.expiresAt && stored.expiresAt > Date.now() && safeBusinessReturnUrl(stored.returnTo ?? ""));
    // The preview flag only selects a read-only presentation. Public data is still
    // authorized and filtered by the public API; the return target is origin/path validated.
    if (validatedReturnTo && (referrerIsBusiness || previewRequested)) {
      const next = { returnTo: validatedReturnTo, expiresAt: Date.now() + 30 * 60 * 1000 };
      try { sessionStorage.setItem(key, JSON.stringify(next)); } catch { /* Storage is optional; referrer validation remains active. */ }
      setPreviewContext({ active: true, returnTo: validatedReturnTo });
      return;
    }
    setPreviewContext({ active: storedIsValid, returnTo: storedIsValid ? safeBusinessReturnUrl(stored?.returnTo ?? "") : null });
  }, [id, previewRequested, returnToParam]);
  useEffect(() => {
    if (tabParam !== "photos") return;
    const next = new URLSearchParams(searchParams);
    next.delete("tab");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, tabParam]);
  useEffect(() => {
    let cancelled = false;
    setLoadState("loading");
    setDescriptionExpanded(false);
    setHoursExpanded(false);
    setGalleryIndex(0);
    getBusinessById(id)
      .then(async (loadedBusiness) => {
        if (cancelled) return;
        if (!loadedBusiness) { setBusiness(null); setBusinessProducts([]); setBusinessServices([]); setLoadState("not-found"); return; }
        const [products, services] = await Promise.all([getProductsByBusinessId(id).catch(() => []), getServicesByBusinessId(id).catch(() => [])]);
        if (cancelled) return;
        setBusiness(loadedBusiness);
        setBusinessProducts(products);
        setBusinessServices(services);
        setLoadState("ready");
      })
      .catch(() => { if (!cancelled) { setBusiness(null); setBusinessProducts([]); setBusinessServices([]); setLoadState("error"); } });
    return () => { cancelled = true; };
  }, [id]);
  useEffect(() => { if (loadState === "ready" && business?.id && !isBusinessPreview) recordBusinessEvent(currentBusiness.id, "BUSINESS_VIEW", new Date().toISOString().slice(0, 10)); }, [business?.id, isBusinessPreview, loadState]);
  useEffect(() => {
    let cancelled = false;
    if (loadState !== "ready" || !id) { setReviewSummary({ average: null, count: 0 }); return () => { cancelled = true; }; }
    void listPublicReviews(id).then(result => {
      if (cancelled) return;
      setPublicReviews(result.reviews);
      const summary = result.summary;
      setReviewSummary(summary
        ? { average: summary.average, count: summary.total }
        : result.reviews.length
          ? { average: result.reviews.reduce((total, review) => total + review.rating, 0) / result.reviews.length, count: result.reviews.length }
          : { average: null, count: 0 });
    }).catch(() => { if (!cancelled) { setPublicReviews([]); setReviewSummary({ average: null, count: 0 }); } });
    return () => { cancelled = true; };
  }, [id, loadState]);
  useEffect(() => {
    if (!galleryOpen && !shareOpen) return;
    const closeOverlays = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setGalleryOpen(false);
      setShareOpen(false);
    };
    const closeShareOnOutsideTap = (event: PointerEvent) => {
      if (shareOpen && shareWrapRef.current && !shareWrapRef.current.contains(event.target as Node)) setShareOpen(false);
    };
    window.addEventListener("keydown", closeOverlays);
    document.addEventListener("pointerdown", closeShareOnOutsideTap);
    return () => { window.removeEventListener("keydown", closeOverlays); document.removeEventListener("pointerdown", closeShareOnOutsideTap); };
  }, [galleryOpen, shareOpen]);
  const offerCount = (item: Product | Service) => isRealOfferId(item.id) ? getOfferLike(item.id).count : getLikeCount(item.id, item.likeCount ?? 0);
  const sortedProducts = useMemo(() => [...catalogProducts].sort((a, b) => Number(Boolean(b.isOffer)) - Number(Boolean(a.isOffer)) || offerCount(b) - offerCount(a)), [catalogProducts, getOfferLike]);
  const sortedServices = useMemo(() => [...catalogServices].sort((a, b) => Number(Boolean(b.isOffer)) - Number(Boolean(a.isOffer)) || offerCount(b) - offerCount(a)), [catalogServices, getOfferLike]);
  const popular = useMemo(() => {
    const items = [
      ...catalogProducts.map((item) => ({ kind: "product" as const, item })),
      ...catalogServices.map((item) => ({ kind: "service" as const, item })),
    ];
    return items.sort((a, b) => getOfferLike(b.item.id).count - getOfferLike(a.item.id).count || b.item.id.localeCompare(a.item.id)).slice(0, 4);
  }, [catalogProducts, catalogServices, getOfferLike]);
  const businessReviews = useMemo<Review[]>(() => publicReviews.map(item => ({ id: item.id, businessId: id, author: item.author, rating: item.rating, date: item.createdAt, comment: item.comment, response: item.response })), [id, publicReviews]);
  if (loadState === "loading") return <PageLayout><div className="business-not-found"><h1>Cargando negocio…</h1><p>Estamos consultando la información pública.</p></div></PageLayout>;
  if (loadState === "error") return <PageLayout><div className="business-not-found"><h1>No se pudo cargar este negocio</h1><p>Revisa tu conexión e inténtalo nuevamente.</p><Link to="/home">Volver a explorar</Link></div></PageLayout>;
  if (loadState === "not-found" || !business) return <PageLayout><div className="business-not-found"><h1>No encontramos este negocio</h1><p>Puede que el enlace ya no esté disponible o no esté publicado.</p><Link to="/home">Volver a explorar</Link></div></PageLayout>;
  const currentBusiness = business;
  const goBack = () => { if (isBusinessPreview && previewContext.returnTo) { window.location.assign(previewContext.returnTo); return; } if (window.history.length > 1) navigate(-1); else navigate("/home"); };
  const whatsappUrl = business.whatsapp ? whatsappLink(business.whatsapp) : null;
  const weeklyHours = business.weeklyHours ?? [];
  const locationLine = [business.city, business.regionName].filter(Boolean).join(", ") || "Ciudad no registrada";
  const businessCoordinates = getBusinessCoordinates(business);
  const selectedCoordinates = selection?.coordinates;
  const businessDistanceKm = businessCoordinates && selectedCoordinates
    ? distanceBetweenCoordinates(selectedCoordinates, businessCoordinates)
    : Number.POSITIVE_INFINITY;
  const businessDistanceLabel = Number.isFinite(businessDistanceKm)
    ? `A ${businessDistanceKm < 1 ? `${Math.round(businessDistanceKm * 1000)} m` : `${businessDistanceKm.toFixed(1)} km`}`
    : "Sin distancia";
  const modalityLabels: Record<string, string> = { PHYSICAL: "En el establecimiento", DELIVERY: "A domicilio", VIRTUAL: "Virtual" };
  const attentionModalities = (business.modalityTypes ?? []).map((type) => modalityLabels[type] ?? type).filter(Boolean);
  const socialNetworks = [
    { platform: "instagram" as const, label: "Instagram", url: business.socialNetworks?.instagram },
    { platform: "facebook" as const, label: "Facebook", url: business.socialNetworks?.facebook },
    { platform: "tiktok" as const, label: "TikTok", url: business.socialNetworks?.tiktok },
    { platform: "x" as const, label: "X", url: business.socialNetworks?.x },
  ].filter((network): network is { platform: SocialNetworkPlatform; label: string; url: string } => Boolean(network.url));
  const now = new Date();
  const todayHours = weeklyHours.find((item) => item.day === ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"][now.getDay()]);
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const openNow = Boolean(todayHours && !todayHours.isClosed && todayHours.hours.includes("–") && currentTime >= todayHours.hours.slice(0, 5) && currentTime < todayHours.hours.slice(-5));
  const galleryImages = Array.from(new Set([business.image, ...(business.gallery ?? [])].filter(Boolean))).slice(0, 10);
  const showRegistrationInvite = authStatus === "anonymous" && !isBusinessPreview;
  const cleanPublicUrl = getPublicBusinessUrl(id);
  async function share() { if (!cleanPublicUrl) { setMessage("No se pudo compartir el enlace."); setShareOpen(false); return; } const result = await shareLink(currentBusiness.name, `Descubre ${currentBusiness.name} en XAMUKO.`, cleanPublicUrl); setMessage(result === "copied" ? "Enlace copiado." : result === "unavailable" ? "No se pudo compartir el enlace." : ""); setShareOpen(false); }
  const whatsappShareUrl = cleanPublicUrl
    ? `https://wa.me/?text=${encodeURIComponent(`Descubre ${currentBusiness.name} en XAMUKO. ${cleanPublicUrl}`)}`
    : "";
  function startPopularDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const list = popularListRef.current;
    if (!list) return;
    popularDragRef.current = { pointerId: event.pointerId, startX: event.clientX, startScrollLeft: list.scrollLeft, moved: false };
  }
  function movePopularDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = popularDragRef.current;
    const list = popularListRef.current;
    if (!drag || !list || drag.pointerId !== event.pointerId) return;
    const delta = event.clientX - drag.startX;
    if (Math.abs(delta) > 6) drag.moved = true;
    if (drag.moved) {
      event.preventDefault();
      if (!list.hasPointerCapture(event.pointerId)) list.setPointerCapture(event.pointerId);
      list.scrollLeft = drag.startScrollLeft - delta;
    }
  }
  function endPopularDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = popularDragRef.current;
    const list = popularListRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (list?.hasPointerCapture(event.pointerId)) list.releasePointerCapture(event.pointerId);
    popularDragRef.current = null;
  }
  const tabButton = (key: Tab, label: string) => <button type="button" className={tab === key ? "active" : ""} onClick={() => { const next = new URLSearchParams(searchParams); if (key === "info") next.delete("tab"); else next.set("tab", key); setSearchParams(next); }}>{label}</button>;
  return <PageLayout className={`business-detail-page${isBusinessPreview ? " business-preview-mode" : ""}`}><div className="business-detail-back"><button className="business-back-link" type="button" onClick={goBack}>← {isBusinessPreview ? "Volver a mi negocio" : "Volver"}</button><div className="business-share-wrap" ref={shareWrapRef}><button type="button" disabled={isBusinessPreview || !cleanPublicUrl} onClick={() => setShareOpen((open) => !open)} aria-expanded={shareOpen} aria-haspopup="menu">Compartir ↗</button>{shareOpen && !isBusinessPreview && cleanPublicUrl && <div className="business-share-menu"><a href={whatsappShareUrl} target="_blank" rel="noopener noreferrer" className="business-share-whatsapp">WhatsApp <span>↗</span></a><button type="button" onClick={share}>Compartir enlace <span>↗</span></button></div>}</div></div>{isBusinessPreview && <div className="business-preview-notice" role="status">Vista previa de tu negocio · Las acciones de cliente están deshabilitadas.</div>}<section className="business-detail-hero">
      <div className="business-detail-gallery">
        <div className="business-detail-photo" onTouchStart={(event) => { headerTouchStartX.current = event.touches[0]?.clientX ?? null; headerSwipeDetected.current = false; }} onTouchMove={(event) => { const startX = headerTouchStartX.current; const currentX = event.touches[0]?.clientX; if (startX !== null && currentX !== undefined && Math.abs(currentX - startX) > 10) headerSwipeDetected.current = true; }} onTouchEnd={(event) => { const startX = headerTouchStartX.current; const endX = event.changedTouches[0]?.clientX; headerTouchStartX.current = null; if (startX === null || endX === undefined || Math.abs(endX - startX) < 45 || galleryImages.length < 2) return; setGalleryIndex((current) => endX < startX ? (current + 1) % galleryImages.length : (current - 1 + galleryImages.length) % galleryImages.length); }}>
          {galleryImages.length ? <>
            <button className="business-detail-photo-trigger" type="button" onClick={(event) => { if (headerSwipeDetected.current) { event.preventDefault(); headerSwipeDetected.current = false; return; } setGalleryOpen(true); }} aria-label={`Ver fotos de ${currentBusiness.name}`}><img src={galleryImages[galleryIndex] ?? galleryImages[0]} alt={currentBusiness.name}/></button>
            {galleryImages.length > 1 && <><button type="button" className="business-header-arrow previous" aria-label="Foto anterior" onClick={() => setGalleryIndex((galleryIndex - 1 + galleryImages.length) % galleryImages.length)}>‹</button><button type="button" className="business-header-arrow next" aria-label="Foto siguiente" onClick={() => setGalleryIndex((galleryIndex + 1) % galleryImages.length)}>›</button></>}
            <span className="business-header-counter">{galleryIndex + 1} / {galleryImages.length}</span>
          </> : <span className="business-header-no-photo">Sin fotografías publicadas</span>}
          {todayHours && <span className={`entity-open${openNow ? " is-open" : ""}`}><i/>{openNow ? "Abierto ahora" : "Cerrado"}</span>}
        </div>
        {galleryImages.length > 0 && <div className="business-detail-gallery-strip" aria-label="Fotos del establecimiento">{galleryImages.slice(0,4).map((image, index) => <button type="button" className={index === galleryIndex ? "active" : ""} key={image} onClick={() => setGalleryIndex(index)} aria-label={`Ver foto ${index + 1}`}><img src={image} alt="" /></button>)}<button type="button" className="business-header-more" onClick={() => setGalleryOpen(true)}>▧<span>Ver fotos<br/>({galleryImages.length})</span></button></div>}
      </div>
      <div className="business-detail-intro">
        <div className="business-header-identity">{business.logo && <img className="business-header-logo" src={business.logo} alt={`Logotipo de ${currentBusiness.name}`} onError={event => { event.currentTarget.hidden = true; }}/>}<div><span className="business-detail-category">{business.category}</span><h1>{currentBusiness.name}</h1><PioneerBadge pioneerNumber={business.pioneerNumber} /><div className="business-header-badges">{business.isFeatured === true && <span className="business-featured-badge" aria-label="Negocio destacado">⭐ Destacado</span>}{business.tags.length > 0 && <small className="business-header-meta">{business.tags.join(" · ")}</small>}</div></div></div>
        <div className="business-detail-rating"><BusinessRatingSummary average={reviewSummary.average} count={reviewSummary.count} /><span>· ⌖ {businessDistanceLabel}</span>{business.isVerified && <span className="business-verified">✓ Verificado</span>}</div>
        {business.description && <div className={`business-header-description${descriptionExpanded ? " is-expanded" : ""}`}><p>{business.description}</p><button type="button" onClick={() => setDescriptionExpanded((expanded) => !expanded)} aria-expanded={descriptionExpanded}>{descriptionExpanded ? "Ver menos" : "Leer más"}</button></div>}
        {attentionModalities.length > 0 && <div className="business-attention-modalities"><strong>Modalidades de atención</strong><div>{attentionModalities.map((label) => <span key={label}>{label}</span>)}</div></div>}
        <div className="business-detail-actions">
          {business.phone && (isBusinessPreview ? <button type="button" className="business-header-call" disabled><PhoneIcon/>Llamar</button> : <a className="business-header-call" href={phoneLink(business.phone)} onClick={() => recordBusinessEvent(currentBusiness.id, "PHONE_CLICK", "click")}><PhoneIcon/>Llamar</a>)}
          {whatsappUrl && (isBusinessPreview ? <button type="button" className="business-header-whatsapp" disabled><WhatsAppIcon/>WhatsApp</button> : <a className="business-header-whatsapp" href={whatsappUrl} target="_blank" rel="noreferrer" onClick={() => recordBusinessEvent(currentBusiness.id, "WHATSAPP_CLICK", "click")}><WhatsAppIcon/>WhatsApp</a>)}
          {businessCoordinates && (isBusinessPreview ? <button type="button" className="business-primary-action" disabled>➤ Cómo llegar</button> : <Link className="business-primary-action" to={`/directions?businessId=${encodeURIComponent(currentBusiness.id)}`} onClick={() => recordBusinessEvent(currentBusiness.id, "DIRECTIONS_CLICK", "click")}>➤ Cómo llegar</Link>)}
          <button type="button" className={`business-social-action business-favorite-action${favorites.includes(currentBusiness.id) ? " is-active" : ""}`} disabled={isBusinessPreview} aria-pressed={favorites.includes(currentBusiness.id)} onClick={() => requireAccount(() => { void toggleFavorite(currentBusiness.id); })}><HeartIcon/><span className="business-favorite-full-label">{favorites.includes(currentBusiness.id) ? "En favoritos" : "Favoritos"}</span><span className="business-favorite-mobile-label">Favoritos</span></button>
        </div>
        {showRegistrationInvite && <aside className="business-registration-invite" aria-label={`Invitación de ${currentBusiness.name} a XAMUKO`}>
          <img className="business-registration-invite-art" src={registrationInvitePerson} alt="" />
          <div className="business-registration-invite-content">
            <strong>¡{currentBusiness.name} te invita a unirte a <span>XAMUKO</span>!</strong>
            <p>Descubre negocios cerca de ti, guarda tus favoritos y comparte tus experiencias</p>
            <Link to={`/register?next=${encodeURIComponent(`/business/${encodeURIComponent(currentBusiness.id)}`)}`}>Crear mi cuenta gratis <span aria-hidden="true">→</span></Link>
          </div>
        </aside>}
        {(business.email || business.website) && <div className="business-header-links">{business.email && (isBusinessPreview ? <button type="button" disabled>Correo electrónico ↗</button> : <a href={`mailto:${business.email}`}>Correo electrónico ↗</a>)}{business.website && (isBusinessPreview ? <button type="button" className="business-website-button" disabled><span>Visitar sitio web</span></button> : <a className="business-website-button" href={business.website} target="_blank" rel="noopener noreferrer"><svg className="business-website-globe" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.2 2.4 3.3 5.4 3.3 9S14.2 18.6 12 21c-2.2-2.4-3.3-5.4-3.3-9S9.8 5.4 12 3Z"/></svg><span>Visitar sitio web</span></a>)}</div>}
        <div className={`business-header-hours${hoursExpanded ? " is-expanded" : ""}`}><span aria-hidden="true">◷</span><div className="business-header-hours-summary">{todayHours ? <><b className={openNow ? "open" : "closed"}>{openNow ? "Abierto ahora" : "Cerrado ahora"}</b><span>· {todayHours.isClosed ? "Cerrado hoy" : openNow ? `Cierra a las ${todayHours.hours.slice(-5)}` : `Horario de hoy: ${todayHours.hours}`}</span></> : <span>Horario no disponible</span>}</div>{weeklyHours.length > 0 && <button type="button" className="business-header-hours-toggle" onClick={() => setHoursExpanded((expanded) => !expanded)} aria-expanded={hoursExpanded} aria-label={hoursExpanded ? "Ocultar horario semanal" : "Ver horario semanal"}>⌄</button>}{hoursExpanded && <div className="business-header-hours-list">{weeklyHours.map((item) => <div key={item.day}><b>{item.day}</b><span>{item.hours}</span></div>)}</div>}</div>
      </div>
    </section>
    <nav className="business-tabs" aria-label="Secciones del negocio">{tabButton("info", "Información")}{tabButton("products", "Productos")}{tabButton("services", "Servicios")}{tabButton("reviews", "Opiniones")}</nav>
    {tab !== "reviews" && <section className={`business-detail-columns${tab === "products" || tab === "services" ? " business-catalog-view" : ""}${tab === "info" ? " business-info-columns" : ""}`}><div className="business-about">{tab === "info" && <PublicBusinessDigitalCard business={currentBusiness} />}<div className="business-info-placeholder" aria-hidden="true" />{tab === "products" && <><span className="business-section-label">Productos</span><h2>Productos de {currentBusiness.name}</h2>{sortedProducts.length ? <><div className="business-offer-grid business-products-grid">{sortedProducts.slice(0, productsVisibleCount).map((product) => <ProductCard key={product.id} product={product} liked={getOfferLike(product.id).liked} likeCount={getOfferLike(product.id).count} onLike={isBusinessPreview || demoCatalog ? undefined : () => { void toggleOfferLike(product.id); }} readOnly={isBusinessPreview || demoCatalog}/>)}</div>{sortedProducts.length > productsVisibleCount && <button className="business-products-more" type="button" onClick={() => setProductsVisibleCount((count) => count + 8)}>Ver más productos <span>↓</span></button>}{productsVisibleCount >= sortedProducts.length && sortedProducts.length > 8 && <button className="business-products-more business-products-top" type="button" onClick={() => { setProductsVisibleCount(8); setServicesVisibleCount(8); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Volver arriba ↑</button>} </> : <p>Aún no hay productos publicados.</p>}</>}{tab === "services" && <><span className="business-section-label">Servicios</span><h2>Servicios de {currentBusiness.name}</h2>{sortedServices.length ? <><div className="business-offer-grid business-products-grid">{sortedServices.slice(0, servicesVisibleCount).map((service) => <ServiceCard key={service.id} service={service} liked={getOfferLike(service.id).liked} likeCount={getOfferLike(service.id).count} onLike={isBusinessPreview || demoCatalog ? undefined : () => { void toggleOfferLike(service.id); }} readOnly={isBusinessPreview || demoCatalog}/>)}</div>{sortedServices.length > servicesVisibleCount && <button className="business-products-more" type="button" onClick={() => setServicesVisibleCount((count) => count + 8)}>Ver más servicios <span>↓</span></button>}{servicesVisibleCount >= sortedServices.length && sortedServices.length > 8 && <button className="business-products-more business-products-top" type="button" onClick={() => { setProductsVisibleCount(8); setServicesVisibleCount(8); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Volver arriba ↑</button>} </> : <p>Aún no hay servicios publicados.</p>}</>}</div><aside className="business-detail-aside"><section className="business-aside-block"><h3>Horario de atención</h3><div className="business-hours"><div><b>Horario de hoy</b><span className={openNow ? "open" : "closed"}>{weeklyHours.length ? (openNow ? "Abierto ahora" : "Cerrado ahora") : "Horario no disponible"}</span></div></div><div className="business-weekly-hours">{weeklyHours.length ? weeklyHours.map((item) => <div key={item.day}><b>{item.day}</b><span>{item.hours}</span></div>) : <p>Horario no disponible.</p>}</div></section>{businessCoordinates && <section className="business-aside-block"><h3>Ubicación</h3><p className="business-aside-address">⌖ {currentBusiness.address || "Dirección no pública"}<small>{locationLine}</small>{currentBusiness.additionalAddressInfo && <small>{currentBusiness.additionalAddressInfo}</small>}{Number.isFinite(currentBusiness.distanceKm) && <small>A {currentBusiness.distanceKm < 1 ? `${Math.round(currentBusiness.distanceKm * 1000)} m` : `${currentBusiness.distanceKm.toFixed(1)} km`} de tu ubicación</small>}</p>{isBusinessPreview ? <button type="button" className="business-primary-action" disabled>Cómo llegar ↗</button> : <Link className="business-primary-action" to={`/directions?businessId=${encodeURIComponent(currentBusiness.id)}`} onClick={() => recordBusinessEvent(currentBusiness.id, "DIRECTIONS_CLICK", "click")}>Cómo llegar ↗</Link>}</section>}{socialNetworks.length > 0 && <section className="business-aside-block business-socials-public"><h3>Redes sociales</h3><div className="business-social-links">{socialNetworks.map((network) => isBusinessPreview ? <span className="business-social-link business-preview-disabled" key={network.platform}><SocialNetworkIcon platform={network.platform} /><span>{network.label}</span></span> : <a key={network.platform} href={network.url} target="_blank" rel="noopener noreferrer"><SocialNetworkIcon platform={network.platform} /><span>{network.label}</span></a>)}</div></section>}</aside></section>}
    {tab === "reviews" && !isBusinessPreview && <section className="business-review-section"><div className="business-section-heading"><div><span className="business-section-label">Opiniones</span><h2>Lo que cuentan las personas</h2></div>{isBusinessPreview ? <span className="business-preview-disabled">Calificar y opinar →</span> : <Link to={`/reviews?businessId=${id}`}>Calificar y opinar →</Link>}</div>{businessReviews.length ? businessReviews.slice(0,5).map((review) => <article className="business-review" key={review.id}><span className="business-review-avatar">{review.author.charAt(0)}</span><div><b>{review.author}</b><span className="business-review-stars">{"★".repeat(review.rating)}{"☆".repeat(5-review.rating)} <small>{review.date}</small></span>{review.comment && <p>{review.comment}</p>}{review.response&&<div className="business-review-response"><strong>Respuesta del negocio</strong><p>{review.response.body}</p></div>}</div></article>) : <p>Aún no hay opiniones para este negocio.</p>}</section>}{popular.length > 0 && <section className="business-offer-section business-popular-section"><div className="business-section-heading"><div><span className="business-section-label">Productos y servicios</span><h2>Los más destacados</h2></div></div><div className="business-offer-grid business-popular-grid" ref={popularListRef} onPointerDown={startPopularDrag} onPointerMove={movePopularDrag} onPointerUp={endPopularDrag} onPointerCancel={endPopularDrag}>{popular.map(({ kind, item }) => kind === "product" ? <ProductCard key={item.id} product={item} liked={getOfferLike(item.id).liked} likeCount={getOfferLike(item.id).count} onLike={isBusinessPreview ? undefined : () => { void toggleOfferLike(item.id); }} readOnly={isBusinessPreview}/> : <ServiceCard key={item.id} service={item} liked={getOfferLike(item.id).liked} likeCount={getOfferLike(item.id).count} onLike={isBusinessPreview ? undefined : () => { void toggleOfferLike(item.id); }} readOnly={isBusinessPreview}/>)}</div></section>}
    {false && <section className="business-offer-section"><div className="business-section-heading"><div><span className="business-section-label">Productos</span><h2>Productos de {currentBusiness.name}</h2></div></div>{sortedProducts.length ? <><div className="business-offer-grid business-products-grid">{sortedProducts.slice(0, productsVisibleCount).map((product) => <ProductCard key={product.id} product={product} liked={getOfferLike(product.id).liked} likeCount={isRealOfferId(product.id) ? getOfferLike(product.id).count : getOfferLike(product.id).count || product.likeCount} onLike={isBusinessPreview || demoCatalog ? undefined : () => { void toggleOfferLike(product.id); }} readOnly={isBusinessPreview || demoCatalog}/>)}</div>{sortedProducts.length > productsVisibleCount ? <button className="business-products-more" type="button" onClick={() => setProductsVisibleCount((count) => count + 12)}>Ver más productos <span>↓</span></button> : sortedProducts.length > 12 ? <button className="business-products-more business-products-top" type="button" onClick={() => { setProductsVisibleCount(8); setServicesVisibleCount(8); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Volver arriba ↑</button> : null}</> : <p>Aún no hay productos publicados.</p>}</section>}
    {false && <section className="business-offer-section"><div className="business-section-heading"><div><span className="business-section-label">Servicios</span><h2>Servicios de {currentBusiness.name}</h2></div></div>{sortedServices.length ? <><div className="business-offer-grid business-products-grid">{sortedServices.slice(0, servicesVisibleCount).map((service) => <ServiceCard key={service.id} service={service} liked={getOfferLike(service.id).liked} likeCount={isRealOfferId(service.id) ? getOfferLike(service.id).count : getOfferLike(service.id).count || service.likeCount} onLike={isBusinessPreview || demoCatalog ? undefined : () => { void toggleOfferLike(service.id); }} readOnly={isBusinessPreview || demoCatalog}/>)}</div>{sortedServices.length > servicesVisibleCount ? <button className="business-products-more" type="button" onClick={() => setServicesVisibleCount((count) => count + 12)}>Ver más servicios <span>↓</span></button> : sortedServices.length > 12 ? <button className="business-products-more business-products-top" type="button" onClick={() => { setProductsVisibleCount(8); setServicesVisibleCount(8); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Volver arriba ↑</button> : null}</> : <p>Aún no hay servicios publicados.</p>}</section>}
    <div className="admob-banner-slot admob-banner-slot--business">{!isBusinessPreview && <AdMobBanner slot="business-footer" />}</div>{galleryOpen && <div className="business-gallery-overlay" role="dialog" aria-modal="true" aria-label={`Galería de fotos de ${currentBusiness.name}`} onClick={() => setGalleryOpen(false)}><div className="business-gallery-dialog" onClick={(event) => event.stopPropagation()}><div className="business-gallery-heading"><div><span>GALERÍA</span><b>Descubre {currentBusiness.name}</b></div><button type="button" onClick={() => setGalleryOpen(false)} aria-label="Cerrar galería">×</button></div><div className="business-gallery-main" onTouchStart={(event) => { galleryTouchStartX.current = event.touches[0]?.clientX ?? null; }} onTouchEnd={(event) => { const startX = galleryTouchStartX.current; const endX = event.changedTouches[0]?.clientX; galleryTouchStartX.current = null; if (startX === null || endX === undefined) return; const delta = endX - startX; if (Math.abs(delta) < 45) return; setGalleryIndex((current) => delta < 0 ? (current + 1) % galleryImages.length : (current - 1 + galleryImages.length) % galleryImages.length); }}><button type="button" className="business-gallery-arrow" onClick={() => setGalleryIndex((galleryIndex - 1 + galleryImages.length) % galleryImages.length)} aria-label="Foto anterior">‹</button><img src={galleryImages[galleryIndex]} alt={`${currentBusiness.name}, foto ${galleryIndex + 1}`} /><button type="button" className="business-gallery-arrow" onClick={() => setGalleryIndex((galleryIndex + 1) % galleryImages.length)} aria-label="Foto siguiente">›</button></div><div className="business-gallery-thumbs">{galleryImages.map((image, index) => <button type="button" className={index === galleryIndex ? "active" : ""} key={image} onClick={() => setGalleryIndex(index)} aria-label={`Ver foto ${index + 1}`}><img src={image} alt="" /></button>)}</div></div></div>}{message && <div className="wit-toast" role="status">{message}</div>}</PageLayout>;
}
