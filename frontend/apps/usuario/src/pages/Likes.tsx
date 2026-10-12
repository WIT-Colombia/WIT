import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { products, services } from "../data/mockData";
import { toggleLike } from "../services/userDataService";
import { ProductCard, ServiceCard } from "../components/EntityCards";
import { PageLayout } from "../components/PageLayout";
import { ThumbsUpIcon } from "../components/ActionIcons";
import "./Likes.css";

export default function Likes() {
  // Simulación visual temporal para revisar la pantalla con muchos elementos guardados.
  const [ids, setIds] = useState(() => [...products.slice(0, 20), ...services.slice(0, 20)].map((item) => item.id));
  const [visibleCount, setVisibleCount] = useState(12);
  const likedProducts = useMemo(() => products.filter((product) => ids.includes(product.id)), [ids]);
  const likedServices = useMemo(() => services.filter((service) => ids.includes(service.id)), [ids]);
  const likedItems = useMemo(() => [...likedProducts.map((item) => ({ kind: "product" as const, item })), ...likedServices.map((item) => ({ kind: "service" as const, item }))], [likedProducts, likedServices]);
  const hasLikes = likedItems.length > 0;

  return <PageLayout className="likes-page"><Link className="offer-detail-back" to="/profile">← Volver al perfil</Link><div className="user-page-heading"><span>TUS ELECCIONES</span><h1>Productos y servicios que te gustan</h1></div>{hasLikes ? <><div className="user-card-grid">{likedItems.slice(0, visibleCount).map(({ kind, item }) => kind === "product" ? <ProductCard key={item.id} product={item} liked onLike={() => setIds(toggleLike(item.id))}/> : <ServiceCard key={item.id} service={item} liked onLike={() => setIds(toggleLike(item.id))}/>)}</div>{likedItems.length > visibleCount ? <button className="likes-more" type="button" onClick={() => setVisibleCount((count) => count + 12)}>Ver más</button> : likedItems.length > 36 ? <button className="likes-more likes-back-top" type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>Volver arriba ↑</button> : null}</> : <div className="user-empty-state"><span className="empty-product-thumb" aria-hidden="true"><ThumbsUpIcon/></span><h2>Aún no has marcado productos o servicios</h2><p>Usa “Me gusta” en productos o servicios para encontrarlos fácilmente aquí.</p><Link className="likes-search-link" to="/search">Buscar cerca de mí <span aria-hidden="true">→</span></Link></div>}</PageLayout>;
}
