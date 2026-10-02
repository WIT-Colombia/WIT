import { Link, useParams } from "react-router-dom";
import { businesses, products, services, type Product, type Service } from "../data/mockData";
import { getLikeIds, toggleLike } from "../services/userDataService";
import { PageLayout } from "../components/PageLayout";
import { ThumbsUpIcon } from "../components/ActionIcons";
import { useState } from "react";
import "./OfferDetail.css";
import { useAccountGate } from "../hooks/useAccountGate";

export function ProductDetail() { return <OfferDetail kind="product"/>; }
export function ServiceDetail() { return <OfferDetail kind="service"/>; }

function OfferDetail({ kind }: { kind: "product" | "service" }) {
  const { id = "" } = useParams();
  const [likes, setLikes] = useState(getLikeIds);
  const requireAccount = useAccountGate();
  const offer = kind === "product" ? products.find((item) => item.id === id) : services.find((item) => item.id === id);
  const businessId = offer?.businessId;
  const business = businesses.find((item) => item.id === businessId);
  const isProduct = kind === "product";
  if (!offer || !business) return <PageLayout><div className="business-not-found"><h1>No encontramos {isProduct ? "este producto" : "este servicio"}</h1><Link to="/home">Volver a explorar</Link></div></PageLayout>;

  const item = offer as Product | Service;
  const price = isProduct ? (offer as Product).price ? new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format((offer as Product).price!) : "Consulta disponibilidad" : (offer as Service).priceLabel ?? "Consulta disponibilidad";
  return <PageLayout className="offer-detail-page"><Link className="offer-detail-back" to={`/business/${business.id}/${isProduct ? "products" : "services"}`}>← {isProduct ? "Productos" : "Servicios"} de {business.name}</Link><section className="offer-detail"><div className="offer-detail-image"><img src={item.image} alt={item.name}/><span>{isProduct ? "Producto" : "Servicio"}</span></div><div className="offer-detail-copy"><span className="offer-detail-label">{business.category}</span><h1>{item.name}</h1><p>{item.description}</p><strong className="offer-detail-price">{price}</strong><Link className="offer-business-card" to={`/business/${business.id}`}><img src={business.image} alt=""/><span><small>EN ESTE ESTABLECIMIENTO</small><b>{business.name}</b><em>{business.address}</em></span><i>→</i></Link><div className="offer-detail-actions"><Link to={`/business/${business.id}`} className="offer-detail-primary">Consultar en el negocio →</Link><button type="button" aria-pressed={likes.includes(item.id)} className={`entity-action entity-like entity-product-like${likes.includes(item.id) ? " is-active" : ""}`} aria-label={likes.includes(item.id) ? `Quitar me gusta a ${item.name}` : `Me gusta ${item.name}`} title={likes.includes(item.id) ? "Quitar me gusta" : "Me gusta"} onClick={() => requireAccount(() => setLikes(toggleLike(item.id)))}><ThumbsUpIcon/></button></div><small className="offer-detail-disclaimer">Información de muestra. Consulta precio y disponibilidad directamente con el establecimiento.</small><Link className="offer-detail-report" to={`/report?type=${kind}&id=${item.id}`}>Reportar información de {isProduct ? "este producto" : "este servicio"}</Link></div></section></PageLayout>;
}
