import { Link, useLocation, useNavigate } from "react-router-dom";
import type { KeyboardEvent, MouseEvent } from "react";
import { businesses, type Business, type Product, type Service } from "../data/mockData";
import { HeartIcon, ThumbsUpIcon } from "./ActionIcons";
import { PioneerBadge } from "./PioneerBadge";
import { useAccountGate } from "../hooks/useAccountGate";
import { getLikeCount } from "../services/userDataService";
import { getBusinessPublicationState } from "../services/negociosPublicationService";
import { getBusinessCoordinates } from "../utils/coordinates";
import { createAnalyticsInteractionId, rememberBusinessVisitContext, type AnalyticsContext } from "../services/analyticsService";
import "./EntityCards.css";
import "./EntityCardsEnhancements.css";

type BusinessCardProps = { business: Business; favorite?: boolean; onFavorite?: () => void; onContact?: () => void; analyticsContext?: AnalyticsContext };
type ProductCardProps = { product: Product; liked?: boolean; likeCount?: number; onLike?: () => void; readOnly?: boolean; analyticsContext?: AnalyticsContext };
type ServiceCardProps = { service: Service; liked?: boolean; likeCount?: number; onLike?: () => void; readOnly?: boolean; analyticsContext?: AnalyticsContext };

function formatPrice(price: number): string {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(price);
}

function formatDistance(distanceKm: number): string {
  if (!Number.isFinite(distanceKm)) return "Sin distancia";
  if (distanceKm < 1) return `${Math.round(distanceKm * 1000)} m`;
  return `${distanceKm.toFixed(1)} km`;
}

function businessProximityLabel(business: Business): string {
  return getBusinessCoordinates(business) && Number.isFinite(business.distanceKm) ? `A ${formatDistance(business.distanceKm)}` : "Sin distancia";
}

function OfferPrice({ current, original }: { current: string; original?: string }) {
  void original;
  return <strong>{current}</strong>;
}

export function BusinessCard({ business, favorite = false, onFavorite, onContact, analyticsContext }: BusinessCardProps) {
  const requireAccount = useAccountGate();
  const navigate = useNavigate();
  const location = useLocation();
  const isFeatured = business.plan === "premium" || business.isFeatured;
  const publicationState = getBusinessPublicationState(business.name);
  const inferredContext: AnalyticsContext = location.pathname === '/results' ? { source: 'search', searchTerm: new URLSearchParams(location.search).get('q') ?? undefined, category: business.category, isFeatured } : { source: isFeatured ? 'featured' : 'direct', category: business.category, isFeatured };
  const open = () => { rememberBusinessVisitContext(business.id, analyticsContext ?? inferredContext); navigate(`/business/${business.id}`); };
  const openBusiness = (event: MouseEvent<HTMLElement>) => { if ((event.target as HTMLElement).closest("button, a")) return; open(); };
  const openBusinessWithKeyboard = (event: KeyboardEvent<HTMLElement>) => { if ((event.key === "Enter" || event.key === " ") && !(event.target as HTMLElement).closest("button, a")) { event.preventDefault(); open(); } };
  return <article className={`entity-card entity-business-card${isFeatured ? " entity-business-card--featured" : ""}`} role="link" tabIndex={0} onClick={openBusiness} onKeyDown={openBusinessWithKeyboard}>
    <div className="entity-card__image"><img src={business.image} alt={business.name} loading="lazy"/>{!business.pioneerNumber && (business.plan === "premium" || business.isFeatured) && <span className="entity-featured">Destacado</span>}<PioneerBadge pioneerNumber={business.pioneerNumber} /><span className={`entity-open${business.isOpen ? " is-open" : ""}`}><i/>{business.isOpen ? "Abierto" : "Cerrado"}</span>{onFavorite && <button className={`entity-action entity-favorite${favorite ? " is-active" : ""}`} type="button" aria-label={favorite ? `Quitar ${business.name} de favoritos` : `Guardar ${business.name} en favoritos`} title={favorite ? "Quitar de favoritos" : "Guardar en favoritos"} aria-pressed={favorite} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.preventDefault(); event.stopPropagation(); requireAccount(onFavorite); }}><HeartIcon/></button>}</div>
    <div className="entity-card__content"><div className="entity-card__heading"><div><p>{business.category}</p>{publicationState === "pending" ? <span className="entity-verified entity-pending">• Verificación pendiente</span> : business.isVerified && <span className="entity-verified">✓ Verificado</span>}<h3>{business.name}</h3></div><span className="entity-rating">★ {business.rating.toFixed(1)} <small>({business.reviewCount})</small></span></div>
      <p className="entity-address">⌖ {business.address}</p><p className="entity-business-description" title={business.description}>{business.description}</p><div className="entity-card__actions"><span>{businessProximityLabel(business)}</span><div>{onContact ? <button className="entity-view" type="button" onClick={onContact}>Contactar <span>→</span></button> : <Link className="entity-view" to={`/business/${business.id}`} onClick={(event) => { event.stopPropagation(); rememberBusinessVisitContext(business.id, analyticsContext ?? inferredContext); }}>Ver negocio <span>→</span></Link>}</div></div>
    </div>
  </article>;
}

export function ProductCard({ product, liked = false, likeCount, onLike, readOnly = false, analyticsContext }: ProductCardProps) {
  const requireAccount = useAccountGate();
  const navigate = useNavigate();
  const location = useLocation();
  const businessName = product.businessName ?? businesses.find((business) => business.id === product.businessId)?.name ?? "este establecimiento";
  const currentPrice = product.priceLabel ?? (product.price ? formatPrice(product.price) : "Consultar precio");
  const resultContext: AnalyticsContext | undefined = location.pathname === '/results' ? { source: 'search', searchTerm: new URLSearchParams(location.search).get('q') ?? undefined } : undefined;
  const openProduct = () => navigate(`/product/${product.id}`, { state: { offerViewId: createAnalyticsInteractionId(), analyticsContext: analyticsContext ?? resultContext } });
  return <article className="entity-card entity-offer-card" role={readOnly ? undefined : "link"} tabIndex={readOnly ? -1 : 0} onClick={(event) => { if (readOnly || (event.target as HTMLElement).closest("button, a")) return; openProduct(); }} onKeyDown={(event) => { if (!readOnly && (event.key === "Enter" || event.key === " ") && !(event.target as HTMLElement).closest("button, a")) { event.preventDefault(); openProduct(); } }}><div className="entity-card__image"><img src={product.image} alt={product.name} loading="lazy"/>{product.isOffer && <span className="entity-offer-badge">{product.discount ?? product.offerLabel ?? "Oferta"}</span>}</div><div className="entity-card__content"><span className="entity-offer-type">Producto</span>{product.isOffer && product.offerDeadline && <small className="entity-offer-deadline">✣ Hasta {product.offerDeadline}</small>}<h3>{product.name}</h3><p className="entity-offer-description" title={product.description}>{product.description}</p>{readOnly ? <span className="entity-establishment">En {businessName}</span> : <Link className="entity-establishment" to={`/business/${product.businessId}`} onClick={(event) => event.stopPropagation()}>En {businessName} →</Link>}<div className="entity-offer-footer"><OfferPrice current={currentPrice} original={product.isOffer ? product.originalPriceLabel : undefined}/>{onLike && <span className="entity-like-count"><button className={`entity-action entity-like entity-product-like${liked ? " is-active" : ""}`} type="button" aria-label={liked ? `Quitar me gusta a ${product.name}` : `Me gusta ${product.name}`} title={liked ? "Quitar me gusta" : "Me gusta el producto"} aria-pressed={liked} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.preventDefault(); event.stopPropagation(); requireAccount(onLike); }}><ThumbsUpIcon/></button>{likeCount ?? getLikeCount(product.id, product.likeCount ?? 0)}</span>}</div></div></article>;
}

export function ServiceCard({ service, liked = false, likeCount, onLike, readOnly = false, analyticsContext }: ServiceCardProps) {
  const requireAccount = useAccountGate();
  const navigate = useNavigate();
  const location = useLocation();
  const businessName = service.businessName ?? businesses.find((business) => business.id === service.businessId)?.name ?? "este establecimiento";
  const resultContext: AnalyticsContext | undefined = location.pathname === '/results' ? { source: 'search', searchTerm: new URLSearchParams(location.search).get('q') ?? undefined } : undefined;
  const openService = () => navigate(`/service/${service.id}`, { state: { offerViewId: createAnalyticsInteractionId(), analyticsContext: analyticsContext ?? resultContext } });
  return <article className="entity-card entity-offer-card entity-service-card" role={readOnly ? undefined : "link"} tabIndex={readOnly ? -1 : 0} onClick={(event) => { if (readOnly || (event.target as HTMLElement).closest("button, a")) return; openService(); }} onKeyDown={(event) => { if (!readOnly && (event.key === "Enter" || event.key === " ") && !(event.target as HTMLElement).closest("button, a")) { event.preventDefault(); openService(); } }}><div className="entity-card__image"><img src={service.image} alt={service.name} loading="lazy"/>{service.isOffer && <span className="entity-offer-badge">{service.discount ?? service.offerLabel ?? "Oferta"}</span>}</div><div className="entity-card__content"><span className="entity-offer-type">Servicio</span>{service.isOffer && service.offerDeadline && <small className="entity-offer-deadline">✣ Hasta {service.offerDeadline}</small>}<h3>{service.name}</h3><p className="entity-offer-description" title={service.description}>{service.description}</p>{readOnly ? <span className="entity-establishment">En {businessName}</span> : <Link className="entity-establishment" to={`/business/${service.businessId}`} onClick={(event) => event.stopPropagation()}>En {businessName} →</Link>}<div className="entity-offer-footer"><OfferPrice current={service.priceLabel ?? "Consulta disponibilidad"} original={service.isOffer ? service.originalPriceLabel : undefined}/>{onLike && <span className="entity-like-count"><button className={`entity-action entity-like entity-product-like${liked ? " is-active" : ""}`} type="button" aria-label={liked ? `Quitar me gusta a ${service.name}` : `Me gusta ${service.name}`} title={liked ? "Quitar me gusta" : "Me gusta el servicio"} aria-pressed={liked} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.preventDefault(); event.stopPropagation(); requireAccount(onLike); }}><ThumbsUpIcon/></button>{likeCount ?? getLikeCount(service.id, service.likeCount ?? 0)}</span>}</div></div></article>;
}
