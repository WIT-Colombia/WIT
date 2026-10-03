import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { products, services } from "../data/mockData";
import { getLikeIds, toggleLike } from "../services/userDataService";
import { ProductCard, ServiceCard } from "../components/EntityCards";
import { PageLayout } from "../components/PageLayout";
import { ThumbsUpIcon } from "../components/ActionIcons";

export default function Likes() {
  const [ids, setIds] = useState(getLikeIds);
  const likedProducts = useMemo(() => products.filter((product) => ids.includes(product.id)), [ids]);
  const likedServices = useMemo(() => services.filter((service) => ids.includes(service.id)), [ids]);
  const hasLikes = likedProducts.length + likedServices.length > 0;

  return <PageLayout><Link className="offer-detail-back" to="/profile">← Volver al perfil</Link><div className="user-page-heading"><h1>Productos y servicios que te gustan</h1></div>{hasLikes ? <div className="user-card-grid">{likedProducts.map((product) => <ProductCard key={product.id} product={product} liked onLike={() => setIds(toggleLike(product.id))}/>)}{likedServices.map((service) => <ServiceCard key={service.id} service={service} liked onLike={() => setIds(toggleLike(service.id))}/>)}</div> : <div className="user-empty-state"><span className="empty-product-thumb" aria-hidden="true"><ThumbsUpIcon/></span><h2>Aún no has marcado productos o servicios</h2><p>Usa “Me gusta” en productos o servicios para encontrarlos fácilmente aquí.</p><Link to="/search">Buscar cerca de mí →</Link></div>}</PageLayout>;
}
