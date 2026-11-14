import { PublicOfferSeo } from "../components/PublicPageSeo";
import { CatalogPhoto } from "../components/CatalogPhoto";
import type { Business } from "../data/mockData";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { businesses, products, services, type Product, type Service } from "../data/mockData";
import { getBusinessById, getProductById, getServiceById } from "../services/businessService";
import { recordPublicPromotionView } from "../services/publicBusinessApi";
import { getLikeCount } from "../services/userDataService";
import { isRealOfferId, useOfferLikes } from "../services/offerLikesService";
import { PageLayout } from "../components/PageLayout";
import { PhoneIcon, ThumbsUpIcon } from "../components/ActionIcons";
import { useAccountGate } from "../hooks/useAccountGate";
import { activeBusinessContext, createAnalyticsInteractionId, recordBusinessEvent, type AnalyticsContext } from "../services/analyticsService";
import { whatsappLink } from "../utils/whatsapp";
import "./OfferDetail.css";
import "./OfferDetailEnhancements.css";

export function ProductDetail() {
  return <OfferDetail kind="product" />;
}

export function ServiceDetail() {
  return <OfferDetail kind="service" />;
}

function OfferDetail({ kind }: { kind: "product" | "service" }) {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { get: getOfferLike, toggle: toggleOfferLike } = useOfferLikes([id]);
  const [likeError, setLikeError] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState("");
  const requireAccount = useAccountGate();
  const [offer, setOffer] = useState<Product | Service | undefined>(() =>
    kind === "product" ? products.find((item) => item.id === id) : services.find((item) => item.id === id),
  );
  const [business, setBusiness] = useState<ReturnType<typeof businesses.find>>(() =>
    businesses.find((item) => item.id === offer?.businessId),
  );
  const trackedPromotionRef = useRef("");
  const trackedOfferViewRef = useRef("");
  const offerViewIdRef = useRef<string | null>(typeof (location.state as { offerViewId?: unknown } | null)?.offerViewId === "string" ? (location.state as { offerViewId: string }).offerViewId : null);
  const routeContext = (location.state as { analyticsContext?: AnalyticsContext } | null)?.analyticsContext;
  const analyticsContextRef = useRef<AnalyticsContext>(routeContext ?? { source: 'direct' });
  const isProduct = kind === "product";
  async function shareOffer() {
    const url = window.location.href;
    const title = offer?.name ?? (kind === "product" ? "Producto" : "Servicio");
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        setShareStatus("");
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareStatus("Enlace copiado");
    } catch {
      window.prompt("Copia el enlace de este elemento", url);
      setShareStatus("");
    }
  }
  const [verifiedSeo, setVerifiedSeo] = useState<{ offer: Product | Service; business: Business; kind: "product" | "service" } | null>(null);

  useEffect(() => {
    if (offerViewIdRef.current) return;
    const offerViewId = createAnalyticsInteractionId();
    offerViewIdRef.current = offerViewId;
    navigate(`${location.pathname}${location.search}`, { replace: true, state: { ...(location.state as object | null ?? {}), offerViewId } });
  }, [location.pathname, location.search, location.state, navigate]);

  useEffect(() => {
    let cancelled = false;
    setVerifiedSeo(null);

    void (async () => {
      const loaded = kind === "product"
        ? await getProductById(id).catch(() => undefined)
        : await getServiceById(id).catch(() => undefined);
      if (cancelled || !loaded) return;

      setOffer(loaded);
      const loadedBusiness = await getBusinessById(loaded.businessId).catch(() => undefined);
      if (cancelled) return;
      const inheritedContext = routeContext ?? activeBusinessContext(loaded.businessId);
      const analyticsContext: AnalyticsContext = {
        ...inheritedContext,
        category: inheritedContext.category ?? loadedBusiness?.category,
        isFeatured: inheritedContext.isFeatured ?? Boolean(loadedBusiness?.plan === 'premium' || loadedBusiness?.isFeatured),
      };
      analyticsContextRef.current = analyticsContext;
      if (isRealOfferId(loaded.id)) {
        const offerViewId = offerViewIdRef.current ?? createAnalyticsInteractionId();
        offerViewIdRef.current = offerViewId;
        const trackingKey = `${kind}:${loaded.businessId}:${loaded.id}:${offerViewId}`;
        if (trackedOfferViewRef.current !== trackingKey) {
          trackedOfferViewRef.current = trackingKey;
          recordBusinessEvent(loaded.businessId, "OFFER_VIEW", offerViewId, loaded.id, analyticsContext);
        }
      }
      if (loaded.promotionId) {
        const trackingKey = `${kind}:${id}:${loaded.promotionId}`;
        if (trackedPromotionRef.current !== trackingKey) {
          trackedPromotionRef.current = trackingKey;
          const dedupeKey = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
          void recordPublicPromotionView(loaded.promotionId, dedupeKey).catch(() => undefined);
        }
      }
      if (!cancelled && loadedBusiness) {
        setBusiness(loadedBusiness);
        if (isRealOfferId(loaded.id)) setVerifiedSeo({ offer: loaded, business: loadedBusiness, kind });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, kind, routeContext]);

  if (!offer || !business) {
    return <PageLayout><PublicOfferSeo verified={null} /><div className="business-not-found"><h1>No encontramos {isProduct ? "este producto" : "este servicio"}</h1><Link to="/home">Volver a explorar</Link></div></PageLayout>;
  }

  const item = offer as Product | Service;
  const product = item as Product;
  const like = getOfferLike(item.id);
  const hasActiveDiscount = isProduct && product.isOffer && Boolean(product.discount) && Boolean(product.originalPriceLabel);
  const price = isProduct
    ? `${product.priceLabel ?? "Consultar precio"}${product.originalPriceLabel ? ` · Antes ${product.originalPriceLabel}` : ""}${product.isOffer && product.discount ? ` · ${product.discount}` : ""}`
    : (item as Service).priceLabel ?? "Consulta disponibilidad";
  const priceView = hasActiveDiscount ? (
    <>
      <span className="offer-detail-price-current">{product.priceLabel}</span>
      <span className="offer-detail-price-original">Antes {product.originalPriceLabel}</span>
    </>
  ) : price;
  // La vigencia de la promoción se muestra en el detalle, no en las tarjetas del catálogo.
  const deadlineDate = item.isOffer && item.offerDeadline
    ? new Date(`${item.offerDeadline}T12:00:00Z`)
    : null;
  const deadlineLabel = deadlineDate && Number.isFinite(deadlineDate.getTime())
    ? new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(deadlineDate)
    : null;
  const phone = business.phone;
  const whatsappMessage = `¡Hola! Vi el ${isProduct ? "producto" : "servicio"} ${item.name} en tu perfil de XAMUKO y quisiera recibir más información. ¡Gracias!`;
  const whatsappUrl = business.whatsapp ? whatsappLink(business.whatsapp, whatsappMessage) : null;
  const handleLike = () => {
    setLikeError(null);
    void toggleOfferLike(item.id).catch(() => setLikeError("No pudimos actualizar el Me gusta. Intenta nuevamente."));
  };

  return (
    <PageLayout className="offer-detail-page">
      <PublicOfferSeo verified={verifiedSeo} />
      <div className="offer-detail-shell">
      <div className="offer-detail-topbar">
        <button className="offer-detail-back" type="button" onClick={() => {
          if (window.history.length > 1) navigate(-1);
          else navigate(`/business/${business.id}`);
        }}>← Volver</button>
        <div className="offer-detail-share-wrap">
          {shareStatus && <span className="offer-detail-share-status" role="status">{shareStatus}</span>}
          <button className="offer-detail-share" type="button" onClick={() => void shareOffer()} aria-label={`Compartir ${isProduct ? "producto" : "servicio"}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="2"/><circle cx="6" cy="12" r="2"/><circle cx="18" cy="19" r="2"/><path d="m8 11 8-5m-8 7 8 5"/></svg>
            Compartir
          </button>
        </div>
      </div>
      <section className="offer-detail">
        <div className="offer-detail-image">
          <CatalogPhoto src={item.image} alt={item.name} />
          <span className="offer-detail-kind">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m12 2 9 5v10l-9 5-9-5V7l9-5Z"/><path d="m3 7 9 5 9-5M12 12v10"/></svg>
            {isProduct ? "Producto" : "Servicio"}
          </span>
          {hasActiveDiscount && (
            <span className="offer-detail-image-discount" aria-label={`Descuento de ${product.discount}`}>
              {product.discount}
            </span>
          )}
        </div>
        <div className="offer-detail-copy">
          <span className="offer-detail-label">{business.category}</span>
          <h1>{item.name}</h1>
          {item.description?.trim() && <p>{item.description}</p>}
          <strong className="offer-detail-price">{priceView}</strong>
          {deadlineLabel && <small className="offer-detail-valid-until">Oferta válida hasta el {deadlineLabel}</small>}
          <Link className="offer-business-card" to={`/business/${business.id}`}>
            <img src={business.logo || business.image} alt="" />
            <span><small>EN ESTE ESTABLECIMIENTO</small><b>{business.name}</b><em>{business.address}</em></span>
            <i aria-hidden="true">→</i>
          </Link>
          <div className="offer-detail-contact-actions">
            {whatsappUrl && <a className="offer-detail-contact whatsapp" href={whatsappUrl} target="_blank" rel="noreferrer" onClick={() => recordBusinessEvent(business.id, "WHATSAPP_CLICK", "click", undefined, analyticsContextRef.current)}>WhatsApp</a>}
            {phone && <a className="offer-detail-contact phone" href={`tel:${phone}`} onClick={() => recordBusinessEvent(business.id, "PHONE_CLICK", "click", undefined, analyticsContextRef.current)}><PhoneIcon />Llamar</a>}
          </div>
          <div className="offer-detail-actions">
            <div className="offer-detail-like-control">
              <button type="button" title={like.liked ? "Quitar me gusta" : "Me gusta"} aria-pressed={like.liked} className={`offer-detail-thumb-button${like.liked ? " is-active" : ""}`} aria-label={like.liked ? `Quitar me gusta a ${item.name}` : `Me gusta ${item.name}`} onClick={() => requireAccount(handleLike)}>
                <ThumbsUpIcon />
              </button>
              <span className="offer-detail-like-number" aria-label="Cantidad de Me gusta">{isRealOfferId(item.id) ? like.count : like.count || getLikeCount(item.id, item.likeCount ?? 0)}</span>
            </div>
          </div>
          {likeError && <small className="offer-like-error" role="alert">{likeError}</small>}
          <Link className="offer-detail-report" to={`/report?type=${kind}&id=${encodeURIComponent(item.id)}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 21V4m0 1c5-3 9 3 14 0v11c-5 3-9-3-14 0"/></svg>
            Reportar información de {isProduct ? "este producto" : "este servicio"}
          </Link>
        </div>
      </section>
      </div>
    </PageLayout>
  );
}
