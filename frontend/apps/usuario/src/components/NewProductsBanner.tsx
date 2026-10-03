import { useState } from "react";
import type { Product } from "../data/mockData";
import { ProductCard } from "./EntityCards";
import "./NewProductsBanner.css";
import "./NewProductsBannerEnhancements.css";

type NewProductsBannerProps = {
  products: Product[];
  likedIds: string[];
  onLike: (id: string) => void;
};

export function NewProductsBanner({ products, likedIds, onLike }: NewProductsBannerProps) {
  const [showAll, setShowAll] = useState(false);
  if (!products.length) return null;

  return <section className="new-products" aria-labelledby="new-products-title">
    <div className="new-products__heading">
      <div><span className="section-kicker">RECIÉN AGREGADOS</span><h2 id="new-products-title">Nuevos en tu ciudad</h2><p>Productos que los negocios de tu ciudad acaban de agregar.</p></div>{products.length > 0 && <button className="new-products__all" type="button" onClick={() => setShowAll((value) => !value)}>{showAll ? "Ver menos" : "Ver todas"} →</button>}
    </div>
    <div className="new-products__list" aria-label="Productos nuevos">
      {(showAll ? products : products.slice(0, 4)).map((product) => <div className="new-products__item" key={product.id}><ProductCard product={product} liked={likedIds.includes(product.id)} onLike={() => onLike(product.id)}/></div>)}
    </div>
  </section>;
}
