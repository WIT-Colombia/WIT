import { Link, useParams } from "react-router-dom";
import { businesses, products, services } from "../data/mockData";
import { getLikeIds, toggleLike } from "../services/userDataService";
import { ProductCard, ServiceCard } from "../components/EntityCards";
import { PageLayout } from "../components/PageLayout";
import { useState } from "react";
import "./BusinessDetail.css";

export function BusinessProducts() { return <BusinessOfferList kind="products"/>; }
export function BusinessServices() { return <BusinessOfferList kind="services"/>; }

function BusinessOfferList({ kind }: { kind: "products" | "services" }) {
  const { id = "" } = useParams();
  const business = businesses.find((item) => item.id === id);
  const [likes, setLikes] = useState(getLikeIds);
  if (!business) return <PageLayout><div className="business-not-found"><h1>No encontramos este negocio</h1><Link to="/home">Volver a explorar</Link></div></PageLayout>;
  const offers = kind === "products" ? products.filter((item) => item.businessId === id) : services.filter((item) => item.businessId === id);
  const title = kind === "products" ? "Productos" : "Servicios";
  return <PageLayout className="business-offers-page"><Link className="business-offers-back" to={`/business/${id}`}>← {business.name}</Link><div className="user-page-heading"><span>{business.category.toLocaleUpperCase("es-CO")}</span><h1>{title} de {business.name}</h1><p>Conoce las opciones que este lugar ofrece. Los precios pueden cambiar; consulta directamente con el establecimiento.</p></div>
    {offers.length ? <div className="user-card-grid">{kind === "products" ? products.filter((item) => item.businessId === id).map((product) => <ProductCard key={product.id} product={product} liked={likes.includes(product.id)} onLike={() => setLikes(toggleLike(product.id))}/>) : services.filter((item) => item.businessId === id).map((service) => <ServiceCard key={service.id} service={service} liked={likes.includes(service.id)} onLike={() => setLikes(toggleLike(service.id))}/>)}</div> : <div className="user-empty-state"><span>⌕</span><h2>Aún no hay {title.toLocaleLowerCase("es-CO")} publicados</h2><p>Este lugar todavía no ha agregado {title.toLocaleLowerCase("es-CO")} a su perfil.</p><Link to={`/business/${id}`}>Volver a la ficha</Link></div>}
  </PageLayout>;
}
