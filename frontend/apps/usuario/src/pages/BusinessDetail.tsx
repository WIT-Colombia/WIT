import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { businesses, products as allProducts, reviews as sampleReviews, services as allServices, type Business, type Product, type Review, type Service } from "../data/mockData";
import { getFavoriteIds, getLikeIds, toggleFavorite, toggleLike, getUserReviews } from "../services/userDataService";
import { ProductCard, ServiceCard } from "../components/EntityCards";
import { HeartIcon } from "../components/ActionIcons";
import { PageLayout } from "../components/PageLayout";
import { GoogleMapEmbed } from "../components/GoogleMapEmbed";
import { shareLink } from "../utils/share";
import { useAccountGate } from "../hooks/useAccountGate";
import "./BusinessDetail.css";

function PhoneIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16.5v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 10.2 18a19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 1.1 3.3 2 2 0 0 1 3.1 1h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L7 9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.7 2.1Z"/></svg>;
}

function WhatsAppIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.5 11.7a8.5 8.5 0 0 1-12.6 7.4L3 20l.9-4.6a8.5 8.5 0 1 1 16.6-3.7Z"/><path d="M8.6 8.3c.2-.5.5-.5.8-.5h.5c.2 0 .4.1.5.4l.7 1.7c.1.2.1.4-.1.6l-.5.7c-.2.2-.2.3 0 .5.3.5.8 1 1.4 1.4.6.4 1.1.6 1.4.7.2.1.4.1.5-.1l.8-.9c.2-.2.4-.2.6-.1l1.6.8c.2.1.3.3.3.5-.1.5-.3 1-.7 1.3-.4.4-1 .6-1.6.5-1-.1-2.1-.6-3.3-1.4-1.5-1-2.6-2.3-3.2-3.5-.5-1-.7-1.8-.5-2.4.1-.4.4-.7.8-.9Z"/></svg>;
}

function registeredPhoneLink(phone: string): string {
  return `tel:${phone.trim().replace(/[^\d+]/g, "")}`;
}

function registeredWhatsAppLink(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const international = digits.startsWith("57") ? digits : `57${digits}`;
  return `https://wa.me/${international}`;
}

export default function BusinessDetail() {
  const { id = "" } = useParams();
  const [business, setBusiness] = useState<Business>();
  const [businessProducts, setBusinessProducts] = useState<Product[]>([]);
  const [businessServices, setBusinessServices] = useState<Service[]>([]);
  const [businessReviews, setBusinessReviews] = useState<Review[]>([]);
  const [favorites, setFavorites] = useState(getFavoriteIds);
  const [likes, setLikes] = useState(getLikeIds);
  const [message, setMessage] = useState("");
  const [mapExpanded, setMapExpanded] = useState(false);
  const requireAccount = useAccountGate();

  useEffect(() => {
    const found = businesses.find((item) => item.id === id);
    setBusiness(found);
    setBusinessProducts(allProducts.filter((item) => item.businessId === id));
    setBusinessServices(allServices.filter((item) => item.businessId === id));
    setBusinessReviews([...sampleReviews.filter((item) => item.businessId === id), ...getUserReviews().filter((item) => item.businessId === id)]);
  }, [id]);

  useEffect(() => {
    if (!mapExpanded) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMapExpanded(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mapExpanded]);

  async function shareBusiness() {
    const result = await shareLink(business?.name ?? "WIT", `Mira este lugar en WIT: ${business?.name ?? ""}`, window.location.href);
    setMessage(result === "copied" ? "Enlace copiado." : result === "unavailable" ? "No pudimos compartir el enlace desde este navegador." : "");
  }

  if (!business) return <PageLayout><div className="business-not-found"><h1>No encontramos este negocio</h1><p>Puede que el enlace ya no esté disponible.</p><Link to="/home">Volver a explorar</Link></div></PageLayout>;

  const mapLocation = [business.name, business.address, "Palmira, Valle del Cauca, Colombia"].join(", ");

  return <PageLayout className="business-detail-page"><div className="business-detail-back"><Link to="/results">← Volver a resultados</Link><button type="button" onClick={shareBusiness}>Compartir ↗</button></div>
    <section className="business-detail-hero"><div className="business-detail-photo"><img src={business.image} alt={business.name}/><span className={`entity-open${business.isOpen ? " is-open" : ""}`}><i/>{business.isOpen ? "Abierto" : "Cerrado"}</span></div><div className="business-detail-intro"><span className="business-detail-category">{business.category} · {business.tags.join(" · ")}</span><h1>{business.name}</h1><div className="business-detail-rating"><b>★ {business.rating.toFixed(1)}</b><span>({business.reviewCount} opiniones de muestra)</span><span>· A {business.distanceKm.toFixed(1)} km</span></div><p>{business.description}</p><div className="business-detail-location"><span>⌖</span><div><b>{business.address}</b><small>Palmira, Valle del Cauca</small></div></div><div className="business-detail-actions"><Link className="business-primary-action" to={`/directions?businessId=${business.id}`}>Cómo llegar →</Link><div className="business-social-actions"><button type="button" className={`business-social-action business-favorite-action${favorites.includes(business.id) ? " is-active" : ""}`} aria-label={favorites.includes(business.id) ? "Quitar de tiendas guardadas" : "Guardar esta tienda"} aria-pressed={favorites.includes(business.id)} onClick={() => requireAccount(() => setFavorites(toggleFavorite(business.id)))}><HeartIcon/><span>{favorites.includes(business.id) ? "Tienda guardada" : "Guardar tienda"}</span></button></div></div><div className="business-contact-actions" aria-label={`Contacto con ${business.name}`}>{business.phone ? <a className="business-contact-button" href={registeredPhoneLink(business.phone)} title={`Llamar a ${business.phone}`}><PhoneIcon/><span>Llamar</span></a> : <button className="business-contact-button is-unavailable" type="button" disabled title="La tienda aún no registra un número telefónico"><PhoneIcon/><span>Sin teléfono registrado</span></button>}{business.whatsapp ? <a className="business-contact-button business-whatsapp-button" href={registeredWhatsAppLink(business.whatsapp)} target="_blank" rel="noreferrer"><WhatsAppIcon/><span>WhatsApp</span></a> : <button className="business-contact-button business-whatsapp-button is-unavailable" type="button" disabled title="La tienda aún no registra un número de WhatsApp"><WhatsAppIcon/><span>Sin WhatsApp registrado</span></button>}</div>{business.phone || business.whatsapp ? <p className="business-contact-note">Números de prueba para previsualizar las opciones; no corresponden a un negocio real.</p> : <p className="business-contact-note">Las opciones se activan cuando la tienda registra sus números.</p>}</div></section>
    <nav className="business-tabs" aria-label="Secciones del negocio"><Link className="active" to={`/business/${id}`}>Información</Link><Link to={`/business/${id}/products`}>Productos <span>{businessProducts.length}</span></Link><Link to={`/business/${id}/services`}>Servicios <span>{businessServices.length}</span></Link><Link to={`/reviews?businessId=${id}`}>Opiniones <span>{businessReviews.length}</span></Link></nav>
    <section className="business-detail-columns"><div className="business-about"><span className="business-section-label">SOBRE ESTE LUGAR</span><h2>Un lugar para tener en cuenta</h2><p>{business.description} Los datos de esta ficha son una muestra para conocer la experiencia WIT.</p><div className="business-hours"><div><b>Horario de hoy</b><span className={business.isOpen ? "open" : "closed"}>{business.isOpen ? "Abierto" : "Cerrado"} · horario de muestra</span></div><span>⌄</span></div><div className="business-data-note">Este es un negocio de ejemplo. Dirección, horarios y opiniones no están verificados.</div></div>
      <aside className="business-detail-aside"><section className="business-map-preview" aria-label={`Mapa de ${business.name}`}><div className="business-map-heading"><div><span>UBICACIÓN</span><b>{business.address}</b></div><button type="button" onClick={() => setMapExpanded(true)} aria-haspopup="dialog" aria-label={`Ampliar mapa de ${business.name}`}>⛶ <span>Ampliar</span></button></div><GoogleMapEmbed query={mapLocation} title={`Mapa de ${business.name}`} className="business-map-embed"/><small className="business-map-address">Palmira, Valle del Cauca</small></section><Link className="business-report" to={`/report?type=business&id=${id}`}>Reportar información de este lugar</Link></aside></section>
    {businessProducts.length > 0 && <section className="business-offer-section"><div className="business-section-heading"><div><span className="business-section-label">PRODUCTOS</span><h2>Lo que puedes encontrar</h2></div><Link to={`/business/${id}/products`}>Ver todos →</Link></div><div className="business-offer-grid">{businessProducts.slice(0,3).map((product) => <ProductCard key={product.id} product={product} liked={likes.includes(product.id)} onLike={() => setLikes(toggleLike(product.id))}/>)}</div></section>}
    {businessServices.length > 0 && <section className="business-offer-section"><div className="business-section-heading"><div><span className="business-section-label">SERVICIOS</span><h2>También te pueden ayudar</h2></div><Link to={`/business/${id}/services`}>Ver todos →</Link></div><div className="business-offer-grid">{businessServices.slice(0,3).map((service) => <ServiceCard key={service.id} service={service} liked={likes.includes(service.id)} onLike={() => setLikes(toggleLike(service.id))}/>)}</div></section>}
    {businessReviews.length > 0 && <section className="business-review-section"><div className="business-section-heading"><div><span className="business-section-label">OPINIONES</span><h2>Lo que cuentan las personas</h2></div><Link to={`/reviews?businessId=${id}`}>Ver opiniones →</Link></div>{businessReviews.slice(0,2).map((review) => <article className="business-review" key={review.id}><span className="business-review-avatar">{review.author.charAt(0)}</span><div><b>{review.author}</b><span className="business-review-stars">{"★".repeat(review.rating)}{"☆".repeat(5-review.rating)} <small>{review.date}</small></span><p>{review.comment}</p></div></article>)}<Link className="business-add-review" to={`/reviews?businessId=${id}`}>Escribir una opinión</Link></section>}
    {mapExpanded && <div className="business-map-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setMapExpanded(false); }}><section className="business-map-dialog" role="dialog" aria-modal="true" aria-label={`Mapa ampliado de ${business.name}`}><div className="business-map-dialog-heading"><b>Mapa de {business.name}</b><button type="button" onClick={() => setMapExpanded(false)}>✕ <span>Cerrar</span></button></div><GoogleMapEmbed query={mapLocation} title={`Mapa ampliado de ${business.name}`} className="business-map-expanded"/></section></div>}
    {message && <div className="wit-toast" role="status">{message}</div>}
  </PageLayout>;
}
