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

  useEffect(() => {
    if (offerViewIdRef.current) return;
    const offerViewId = createAnalyticsInteractionId();
    offerViewIdRef.current = offerViewId;
    navigate(`${location.pathname}${location.search}`, { replace: true, state: { ...(location.state as object | null ?? {}), offerViewId } });
  }, [location.pathname, location.search, location.state, navigate]);

  useEffect(() => {
    let cancelled = false;

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
      if (!cancelled && loadedBusiness) setBusiness(loadedBusiness);
    })();

    return () => {
      cancelled = true;
    };
  }, [id, kind, routeContext]);

  if (!offer || !business) {
    return <PageLayout><div className="business-not-found"><h1>No encontramos {isProduct ? "este producto" : "este servicio"}</h1><Link to="/home">Volver a explorar</Link></div></PageLayout>;
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
  const phone = business.phone;
  const whatsappMessage = `¡Hola! Vi el ${isProduct ? "producto" : "servicio"} ${item.name} en tu perfil de XAMUKO y quisiera recibir más información. ¡Gracias!`;
  const whatsappUrl = business.whatsapp ? whatsappLink(business.whatsapp, whatsappMessage) : null;
  const handleLike = () => {
    setLikeError(null);
    void toggleOfferLike(item.id).catch(() => setLikeError("No pudimos actualizar el Me gusta. Intenta nuevamente."));
  };

  return (
    <PageLayout className="offer-detail-page">
      <button className="offer-detail-back" type="button" onClick={() => {
        if (window.history.length > 1) navigate(-1);
        else navigate(`/business/${business.id}`);
      }}>
        ← Volver
      </button>
      <section className="offer-detail">
        <div className="offer-detail-image">
          <img src={item.image} alt={item.name} />
          <span className="offer-detail-kind">{isProduct ? "Producto" : "Servicio"}</span>
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
          <Link className="offer-business-card" to={`/business/${business.id}`}>
            <img src={business.logo || business.image} alt="" />
            <span><small>EN ESTE ESTABLECIMIENTO</small><b>{business.name}</b><em>{business.address}</em></span>
            <i>→</i>
          </Link>
          <div className="offer-detail-contact-actions">
            {whatsappUrl && <a className="offer-detail-contact whatsapp" href={whatsappUrl} target="_blank" rel="noreferrer" onClick={() => recordBusinessEvent(business.id, "WHATSAPP_CLICK", "click", undefined, analyticsContextRef.current)}>WhatsApp</a>}
            {phone && <a className="offer-detail-contact phone" href={`tel:${phone}`} onClick={() => recordBusinessEvent(business.id, "PHONE_CLICK", "click", undefined, analyticsContextRef.current)}><PhoneIcon />Llamar</a>}
          </div>
          <div className="offer-detail-actions">
            <button type="button" title={like.liked ? "Quitar me gusta" : "Me gusta"} aria-pressed={like.liked} className={`entity-action entity-like entity-product-like${like.liked ? " is-active" : ""}`} aria-label={like.liked ? `Quitar me gusta a ${item.name}` : `Me gusta ${item.name}`} onClick={() => requireAccount(handleLike)}><ThumbsUpIcon /></button>
            <span className={`offer-like-count${like.liked ? " is-active" : ""}`}>{like.liked ? "Ya no me gusta" : "Me gusta"}</span>
          </div>
          <small className="offer-like-count-note">A {isRealOfferId(item.id) ? like.count : like.count || getLikeCount(item.id, item.likeCount ?? 0)} personas les gusta este {isProduct ? "producto" : "servicio"}.</small>
          {likeError && <small className="offer-like-error" role="alert">{likeError}</small>}
          <Link className="offer-detail-report" to={`/report?type=${kind}&id=${item.id}`}>Reportar información de {isProduct ? "este producto" : "este servicio"}</Link>
        </div>
      </section>
    </PageLayout>
  );
}
