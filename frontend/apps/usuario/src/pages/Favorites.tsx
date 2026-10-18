import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { businesses } from "../data/mockData";
import { listPublicBusinesses } from "../services/publicBusinessApi";
import { getFavoriteIds, toggleFavorite } from "../services/userDataService";
import { BusinessCard } from "../components/EntityCards";
import { PageLayout } from "../components/PageLayout";
import { HeartIcon } from "../components/ActionIcons";
import "./Favorites.css";

export default function Favorites() {
  const [favoriteIds, setFavoriteIds] = useState(getFavoriteIds);
  const [publicBusinesses, setPublicBusinesses] = useState<typeof businesses>([]);
  useEffect(() => { void listPublicBusinesses().then(setPublicBusinesses).catch(() => setPublicBusinesses([])); }, []);
  const [visibleCount, setVisibleCount] = useState(12);
  const savedStores = useMemo(() => [...businesses, ...publicBusinesses].filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index && favoriteIds.includes(item.id)), [favoriteIds, publicBusinesses]);
  function remove(id: string) { setFavoriteIds(toggleFavorite(id)); }

  return <PageLayout className="favorites-page"><Link className="offer-detail-back" to="/profile">← Volver al perfil</Link><div className="user-page-heading"><span>TUS LUGARES</span><h1>Tus favoritos</h1></div>
    {savedStores.length ? <><div className="user-card-grid">{savedStores.slice(0, visibleCount).map((business) => <BusinessCard key={business.id} business={business} favorite onFavorite={() => remove(business.id)}/>)}</div>{savedStores.length > visibleCount ? <button className="favorites-more" type="button" onClick={() => setVisibleCount((count) => count + 12)}>Ver más</button> : savedStores.length > 36 ? <button className="favorites-more favorites-back-top" type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>Volver arriba ↑</button> : null}</> : <div className="user-empty-state"><span className="empty-store-heart" aria-hidden="true"><HeartIcon/></span><h2>Aún no tienes favoritos</h2><p>Guarda un negocio con el corazón para encontrarlo fácilmente aquí.</p><Link className="favorites-search-link" to="/search">Explorar negocios <span aria-hidden="true">→</span></Link></div>}
  </PageLayout>;
}
