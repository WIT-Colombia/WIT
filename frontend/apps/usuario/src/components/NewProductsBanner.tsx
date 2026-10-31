import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { Product } from "../data/mockData";
import { ProductCard } from "./EntityCards";
import { isHorizontalDominantGesture } from "../utils/gestureDirection";
import "./NewProductsBanner.css";
import "./NewProductsBannerEnhancements.css";

type NewProductsBannerProps = {
  products: Product[];
  likedIds: string[];
  onLike: (id: string) => void | Promise<void>;
  getLikeCount?: (id: string, fallback?: number) => number;
};

export function NewProductsBanner({ products, likedIds, onLike, getLikeCount }: NewProductsBannerProps) {
  const [showAll, setShowAll] = useState(false);
  const [scrollState, setScrollState] = useState({ left: 0, max: 0 });
  const listRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; startX: number; startScrollLeft: number; startY: number; moved: boolean } | null>(null);
  const ignoreClickRef = useRef(false);
  useEffect(() => {
    const list = listRef.current;
    if (!list || !showAll) {
      setScrollState({ left: 0, max: 0 });
      return;
    }
    const update = () => setScrollState({ left: list.scrollLeft, max: Math.max(0, list.scrollWidth - list.clientWidth) });
    const frame = window.requestAnimationFrame(update);
    const observer = new ResizeObserver(update);
    observer.observe(list);
    return () => { window.cancelAnimationFrame(frame); observer.disconnect(); };
  }, [showAll, products.length]);

  function startDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const list = listRef.current;
    if (!list) return;
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, startScrollLeft: list.scrollLeft, moved: false };
  }

  function moveDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    const list = listRef.current;
    if (!drag || !list || drag.pointerId !== event.pointerId) return;
    const delta = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (isHorizontalDominantGesture(delta, deltaY)) drag.moved = true;
    if (drag.moved) {
      event.preventDefault();
      if (!list.hasPointerCapture(event.pointerId)) list.setPointerCapture(event.pointerId);
      list.scrollLeft = drag.startScrollLeft - delta;
    }
  }

  function endDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    const list = listRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    ignoreClickRef.current = drag.moved;
    dragRef.current = null;
    if (list?.hasPointerCapture(event.pointerId)) list.releasePointerCapture(event.pointerId);
    if (ignoreClickRef.current) window.setTimeout(() => { ignoreClickRef.current = false; }, 0);
  }

  return <section className="new-products" aria-labelledby="new-products-title">
      <div className="new-products__heading">
      <div><h2 id="new-products-title">Nuevos en tu ciudad</h2></div>{products.length > 4 && <button className="text-link new-products__all" type="button" aria-expanded={showAll} aria-controls="new-products-list" onClick={() => setShowAll((value) => !value)}>{showAll ? "Ver menos" : `Ver más (${products.length})`} →</button>}
    </div>
    {products.length ? <div className={`new-products__list${showAll ? " is-expanded" : ""}`} id="new-products-list" aria-label="Productos nuevos" ref={listRef} onScroll={() => { const list = listRef.current; if (list) setScrollState({ left: list.scrollLeft, max: Math.max(0, list.scrollWidth - list.clientWidth) }); }} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onClickCapture={(event) => { if (ignoreClickRef.current) { event.preventDefault(); event.stopPropagation(); } }}>
      {(showAll ? products : products.slice(0, 4)).map((product) => <div className="new-products__item" key={product.id}><ProductCard product={product} liked={likedIds.includes(product.id)} likeCount={getLikeCount?.(product.id, product.likeCount) ?? product.likeCount} onLike={() => onLike(product.id)}/></div>)}
    </div> : <p className="home-empty-offers">Aún no hay productos nuevos publicados cerca de ti.</p>}
    {showAll && scrollState.max > 0 && <div className="new-products__scroll-control"><input type="range" min="0" max={scrollState.max} step="1" value={Math.min(scrollState.left, scrollState.max)} aria-label="Desplazar productos nuevos" onChange={(event) => { const left = Number(event.target.value); if (listRef.current) listRef.current.scrollLeft = left; setScrollState((current) => ({ ...current, left })); }} /></div>}
  </section>;
}
