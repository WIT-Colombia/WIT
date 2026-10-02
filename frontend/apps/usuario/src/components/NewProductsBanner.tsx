import type { Product } from "../data/mockData";
import { ProductCard } from "./EntityCards";
import "./NewProductsBanner.css";

type NewProductsBannerProps = {
  products: Product[];
  likedIds: string[];
  onLike: (id: string) => void;
};

export function NewProductsBanner({ products, likedIds, onLike }: NewProductsBannerProps) {
  if (!products.length) return null;

  return <section className="new-products" aria-labelledby="new-products-title">
    <div className="new-products__heading">
      <div><span className="section-kicker">RECIÉN AGREGADOS</span><h2 id="new-products-title">Nuevos en WIT</h2><p>Productos que los negocios de tu zona acaban de agregar.</p></div>
    </div>
    <div className="new-products__list" aria-label="Productos nuevos">
      {products.map((product) => <div className="new-products__item" key={product.id}><ProductCard product={product} liked={likedIds.includes(product.id)} onLike={() => onLike(product.id)}/></div>)}
    </div>
  </section>;
}
