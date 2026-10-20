import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { products, services, type Product, type Service } from "../data/mockData";
import { useAuth } from "../context/AuthContext";
import { listUserOfferLikes, useOfferLikes } from "../services/offerLikesService";
import { toggleLike } from "../services/userDataService";
import { getPublicBusiness } from "../services/publicBusinessApi";
import { ProductCard, ServiceCard } from "../components/EntityCards";
import { PageLayout } from "../components/PageLayout";
import { ThumbsUpIcon } from "../components/ActionIcons";
import "./Likes.css";

function formatPrice(amount: number | string | null | undefined, text: string | null | undefined, currency: string | null | undefined, negotiable: boolean) {
  if (negotiable) return "Precio a convenir";
  const code = currency || "COP";
  if (amount !== null && amount !== undefined && Number.isFinite(Number(amount))) return `${new Intl.NumberFormat("es-CO", { style: "currency", currency: code, maximumFractionDigits: 0 }).format(Number(amount)).replace(/\u00a0/g, " ")} ${code}`;
  if (text && Number.isFinite(Number(text))) return `${new Intl.NumberFormat("es-CO", { style: "currency", currency: code, maximumFractionDigits: 0 }).format(Number(text)).replace(/\u00a0/g, " ")} ${code}`;
  return text || "Consultar precio";
}

export default function Likes() {
  const { status } = useAuth();
  const [realItems, setRealItems] = useState<Array<{ kind: "product" | "service"; item: Product | Service; count: number }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [ids, setIds] = useState(() => [...products.slice(0, 20), ...services.slice(0, 20)].map((item) => item.id));
  const [visibleCount, setVisibleCount] = useState(12);
  const realIds = realItems.map(({ item }) => item.id);
  const { toggle: toggleOfferLike } = useOfferLikes(realIds);
  useEffect(() => {
    if (status !== "authenticated") { setRealItems([]); return; }
    let active = true; setLoading(true); setError(false);
    void listUserOfferLikes(page, 20).then(async (result) => {
      if (!active) return;
      const businessIds = [...new Set(result.items.map((entry) => entry.business.publicId))];
      const businessCatalogs = await Promise.all(businessIds.map(async (businessId) => [businessId, await getPublicBusiness(businessId).catch(() => null)] as const));
      const catalogByBusiness = new Map(businessCatalogs);
      const mapped = result.items.map((entry) => {
        const catalog = catalogByBusiness.get(entry.business.publicId);
        const catalogOffers = entry.kind === "PRODUCT" ? catalog?.products ?? [] : catalog?.services ?? [];
        const catalogOffer = catalogOffers.find((offer) => offer.id === entry.offerId);
        const image = entry.photo?.url?.trim() || catalogOffer?.image || "";
        const base = { id: entry.offerId, businessId: entry.business.publicId, businessName: entry.business.name, name: entry.name, description: entry.description ?? "", image, likeCount: entry.likeCount, priceLabel: formatPrice(entry.priceAmount, entry.priceText, entry.currency, entry.negotiable) };
        return { kind: entry.kind === "PRODUCT" ? "product" as const : "service" as const, item: base as Product | Service, count: entry.likeCount };
      });
      setRealItems((current) => page === 1 ? mapped : [...current, ...mapped]);
      setHasMore(result.pagination.page < result.pagination.totalPages);
    }).catch(() => { if (active) setError(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page, status]);
  const demoItems = useMemo(() => [...products.filter((item) => ids.includes(item.id)).map((item) => ({ kind: "product" as const, item, count: item.likeCount ?? 0 })), ...services.filter((item) => ids.includes(item.id)).map((item) => ({ kind: "service" as const, item, count: item.likeCount ?? 0 }))], [ids]);
  const likedItems = status === "authenticated" ? realItems : demoItems;
  const hasLikes = likedItems.length > 0;
  const removeReal = async (id: string) => { await toggleOfferLike(id); setRealItems((items) => items.filter(({ item }) => item.id !== id)); };
  return <PageLayout className="likes-page"><Link className="offer-detail-back" to="/profile">← Volver al perfil</Link><div className="user-page-heading"><span>TUS ELECCIONES</span><h1>Productos y servicios que te gustan</h1></div>{loading && <p className="auth-status">Cargando tus Me gusta…</p>}{error && <p className="form-error" role="alert">No pudimos cargar tus Me gusta. Intenta nuevamente.</p>}{hasLikes ? <><div className="user-card-grid">{likedItems.slice(0, visibleCount).map(({ kind, item, count }) => kind === "product" ? <ProductCard key={item.id} product={item} liked likeCount={status === "authenticated" ? count : undefined} onLike={() => status === "authenticated" ? void removeReal(item.id) : setIds(toggleLike(item.id))}/> : <ServiceCard key={item.id} service={item} liked likeCount={status === "authenticated" ? count : undefined} onLike={() => status === "authenticated" ? void removeReal(item.id) : setIds(toggleLike(item.id))}/>)}</div>{status === "authenticated" && hasMore ? <button className="likes-more" type="button" onClick={() => setPage((value) => value + 1)}>Ver más</button> : likedItems.length > visibleCount ? <button className="likes-more" type="button" onClick={() => setVisibleCount((count) => count + 12)}>Ver más</button> : null}</> : !loading && <div className="user-empty-state"><span className="empty-product-thumb" aria-hidden="true"><ThumbsUpIcon/></span><h2>Aún no has marcado productos o servicios</h2><p>Usa “Me gusta” en productos o servicios para encontrarlos fácilmente aquí.</p><Link className="likes-search-link" to="/search">Buscar cerca de mí <span aria-hidden="true">→</span></Link></div>}</PageLayout>;
}
