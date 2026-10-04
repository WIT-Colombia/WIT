import { Link } from "react-router-dom";
import { businesses, type Business, type Product, type Service } from "../data/mockData";
import { HeartIcon, ThumbsUpIcon } from "./ActionIcons";
import { useAccountGate } from "../hooks/useAccountGate";
import { getLikeCount } from "../services/userDataService";
import "./EntityCards.css";
import "./EntityCardsEnhancements.css";

type BusinessCardProps = { business: Business; favorite?: boolean; onFavorite?: () => void; onContact?: () => void };
type ProductCardProps = { product: Product; liked?: boolean; onLike?: () => void };
type ServiceCardProps = { service: Service; liked?: boolean; onLike?: () => void };

function formatPrice(price: number): string {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(price);
}

export function BusinessCard({ business, favorite = false, onFavorite, onContact }: BusinessCardProps) {
  const requireAccount = useAccountGate();
  return <article className="entity-card entity-business-card">
    <Link className="entity-card__image" to={`/business/${business.id}`}><img src={business.image} alt={business.name} loading="lazy"/>{(business.plan === "premium" || business.isFeatured) && <span className="entity-featured">Destacado</span>}<span className={`entity-open${business.isOpen ? " is-open" : ""}`}><i/>{business.isOpen ? "Abierto" : "Cerrado"}</span></Link>
    <div className="entity-card__content"><div className="entity-card__heading"><div><p>{business.category}</p>{business.isVerified && <span className="entity-verified">✓ Verificado</span>}<h3><Link to={`/business/${business.id}`}>{business.name}</Link></h3></div><span className="entity-rating">★ {business.rating.toFixed(1)} <small>({business.reviewCount})</small></span></div>
      <p className="entity-address">⌖ {business.address}</p><div className="entity-card__actions"><span>A {business.distanceKm.toFixed(1)} km</span><div>
        {onFavorite && <button className={`entity-action entity-favorite${favorite ? " is-active" : ""}`} type="button" aria-label={favorite ? `Quitar ${business.name} de tiendas guardadas` : `Guardar ${business.name}`} title={favorite ? "Quitar de tiendas guardadas" : "Guardar tienda"} aria-pressed={favorite} onClick={() => requireAccount(onFavorite)}><HeartIcon/></button>}
        {onContact ? <button className="entity-view" type="button" onClick={onContact}>Contactar <span>→</span></button> : <Link className="entity-view" to={`/business/${business.id}`}>Ver negocio <span>→</span></Link>}
      </div></div>
    </div>
  </article>;
}

export function ProductCard({ product, liked = false, onLike }: ProductCardProps) {
  const requireAccount = useAccountGate();
  const businessName = businesses.find((business) => business.id === product.businessId)?.name ?? "este establecimiento";
 return <article className="entity-card entity-offer-card"><Link className="entity-card__image" to={`/product/${product.id}`}><img src={product.image} alt={product.name} loading="lazy"/></Link><div className="entity-card__content"><span className="entity-offer-type">Producto</span><h3><Link to={`/product/${product.id}`}>{product.name}</Link></h3><p className="entity-offer-description">{product.description}</p><Link className="entity-establishment" to={`/business/${product.businessId}`}>En {businessName} →</Link><div className="entity-offer-footer"><strong>{product.price ? formatPrice(product.price) : "Consulta disponibilidad"}</strong>{onLike && <span className="entity-like-count"><button className={`entity-action entity-like entity-product-like${liked ? " is-active" : ""}`} type="button" aria-label={liked ? `Quitar me gusta a ${product.name}` : `Me gusta ${product.name}`} title={liked ? "Quitar me gusta" : "Me gusta el producto"} aria-pressed={liked} onClick={() => requireAccount(onLike)}><ThumbsUpIcon/></button>{getLikeCount(product.id, product.likeCount ?? 0)}</span>}</div></div></article>;
}

export function ServiceCard({ service, liked = false, onLike }: ServiceCardProps) {
  const requireAccount = useAccountGate();
  const businessName = businesses.find((business) => business.id === service.businessId)?.name ?? "este establecimiento";
 return <article className="entity-card entity-offer-card entity-service-card"><Link className="entity-card__image" to={`/service/${service.id}`}><img src={service.image} alt={service.name} loading="lazy"/></Link><div className="entity-card__content"><span className="entity-offer-type">Servicio</span><h3><Link to={`/service/${service.id}`}>{service.name}</Link></h3><p className="entity-offer-description">{service.description}</p><Link className="entity-establishment" to={`/business/${service.businessId}`}>En {businessName} →</Link><div className="entity-offer-footer"><strong>{service.priceLabel ?? "Consulta disponibilidad"}</strong>{onLike && <span className="entity-like-count"><button className={`entity-action entity-like entity-product-like${liked ? " is-active" : ""}`} type="button" aria-label={liked ? `Quitar me gusta a ${service.name}` : `Me gusta ${service.name}`} title={liked ? "Quitar me gusta" : "Me gusta el servicio"} aria-pressed={liked} onClick={() => requireAccount(onLike)}><ThumbsUpIcon/></button>{getLikeCount(service.id, service.likeCount ?? 0)}</span>}</div></div></article>;
}
