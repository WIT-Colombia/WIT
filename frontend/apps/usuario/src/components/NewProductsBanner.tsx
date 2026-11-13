import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { PublicNewArrival } from "../services/publicBusinessApi";
import { CityEmptyState } from "./NoResultsState";
import { ProductCard, ServiceCard } from "./EntityCards";
import { isHorizontalDominantGesture, isMouseDragPointer } from "../utils/gestureDirection";
import "./NewProductsBanner.css";
import "./NewProductsBannerEnhancements.css";

type NewProductsBannerProps = {
  items: PublicNewArrival[];
  hasMore: boolean;
  isLoadingMore: boolean;
  loadMoreError: boolean;
  onLoadMore: () => void;
  cityEmpty?: boolean;
  locationName: string;
  likedIds: string[];
  onLike: (id: string) => void | Promise<void>;
  getLikeCount?: (id: string, fallback?: number) => number;
};

export function NewProductsBanner({ items, cityEmpty = false, locationName, likedIds, onLike, getLikeCount, hasMore, isLoadingMore, loadMoreError, onLoadMore }: NewProductsBannerProps) {
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
  }, [showAll, items.length]);

  function startDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (!isMouseDragPointer(event.pointerType, event.button)) return;
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

  function updateScroll() {
    const list = listRef.current;
    if (!list) return;
    const left = list.scrollLeft;
    const max = Math.max(0, list.scrollWidth - list.clientWidth);
    setScrollState({ left, max });
    // Load the next 20 when the expanded carousel approaches its end.
    if (showAll && hasMore && !isLoadingMore && max > 0 && max - left < 280) onLoadMore();
  }

  function toggleAll() {
    if (showAll && listRef.current) listRef.current.scrollLeft = 0;
    setShowAll((value) => !value);
  }

  return <section className="new-products" aria-labelledby="new-products-title">
      <div className="new-products__heading">
      <div><h2 id="new-products-title">Nuevos en tu ciudad</h2></div>{(items.length > 4 || hasMore) && <button className="text-link new-products__all" type="button" aria-expanded={showAll} aria-controls="new-products-list" onClick={toggleAll}>{showAll ? "Ver menos" : `Ver más (${items.length}${hasMore ? "+" : ""})`} →</button>}
    </div>
    {cityEmpty ? <CityEmptyState locationName={locationName} /> : items.length ? <div className={`new-products__list${showAll ? " is-expanded" : ""}`} id="new-products-list" aria-label="Productos y servicios nuevos" ref={listRef} onScroll={updateScroll} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onClickCapture={(event) => { if (ignoreClickRef.current) { event.preventDefault(); event.stopPropagation(); } }}>
      {(showAll ? items : items.slice(0, 4)).map(({ kind, item }) => <div className="new-products__item" key={`${kind}-${item.id}`}>
        {kind === "SERVICE"
          ? <ServiceCard service={item} liked={likedIds.includes(item.id)} likeCount={getLikeCount?.(item.id, item.likeCount) ?? item.likeCount} onLike={() => onLike(item.id)} />
          : <ProductCard product={item} liked={likedIds.includes(item.id)} likeCount={getLikeCount?.(item.id, item.likeCount) ?? item.likeCount} onLike={() => onLike(item.id)} />}
      </div>)}
    </div> : null}
    {showAll && hasMore && <div className="new-products__load-more"><button type="button" disabled={isLoadingMore} onClick={onLoadMore}>{isLoadingMore ? "Cargando novedades…" : "Cargar 20 más"}</button>{loadMoreError && <p role="alert">No pudimos cargar más novedades. Intenta nuevamente.</p>}</div>}
    {showAll && scrollState.max > 0 && <div className="new-products__scroll-control"><input type="range" min="0" max={scrollState.max} step="1" value={Math.min(scrollState.left, scrollState.max)} aria-label="Desplazar productos nuevos" onChange={(event) => { const left = Number(event.target.value); if (listRef.current) listRef.current.scrollLeft = left; setScrollState((current) => ({ ...current, left })); }} /></div>}
  </section>;
}
