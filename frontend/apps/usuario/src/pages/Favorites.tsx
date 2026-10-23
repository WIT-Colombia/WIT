import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { businesses } from "../data/mockData";
import { listPublicBusinesses } from "../services/publicBusinessApi";
import { useFavorites } from "../services/favoritesService";
import { BusinessCard } from "../components/EntityCards";
import { PageLayout } from "../components/PageLayout";
import { HeartIcon } from "../components/ActionIcons";
import { useLocationContext } from "../context/LocationContext";
import { distanceBetweenCoordinates, getBusinessCoordinates } from "../utils/coordinates";
import "./Favorites.css";

export default function Favorites() {
  const { favorites: favoriteIds, toggleFavorite } = useFavorites();
  const { selection } = useLocationContext();
  const [publicBusinesses, setPublicBusinesses] = useState<typeof businesses>([]);
  useEffect(() => { void listPublicBusinesses().then(setPublicBusinesses).catch(() => setPublicBusinesses([])); }, []);
  const [visibleCount, setVisibleCount] = useState(12);
  const savedStores = useMemo(() => [...businesses, ...publicBusinesses]
    .filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index && favoriteIds.includes(item.id))
    .map((business) => {
      const origin = selection?.coordinates;
      const destination = getBusinessCoordinates(business);
      return origin && destination ? { ...business, distanceKm: distanceBetweenCoordinates(origin, destination) } : business;
    }), [favoriteIds, publicBusinesses, selection]);
  function remove(id: string) { void toggleFavorite(id); }
  function returnToTop() { setVisibleCount(12); window.scrollTo({ top: 0, behavior: "smooth" }); }

  return <PageLayout className="favorites-page"><Link className="offer-detail-back" to="/profile">← Volver al perfil</Link><div className="user-page-heading"><span>TUS LUGARES</span><h1>Tus favoritos</h1></div>
    {savedStores.length ? <><div className="user-card-grid">{savedStores.slice(0, visibleCount).map((business) => <BusinessCard key={business.id} business={business} favorite onFavorite={() => remove(business.id)}/>)}</div>{savedStores.length > visibleCount ? <button className="favorites-more" type="button" onClick={() => setVisibleCount((count) => count + 12)}>Ver más</button> : savedStores.length > 36 ? <button className="favorites-more favorites-back-top" type="button" onClick={returnToTop}>Volver arriba ↑</button> : null}</> : <div className="user-empty-state"><span className="empty-store-heart" aria-hidden="true"><HeartIcon/></span><h2>Aún no tienes favoritos</h2><p>Guarda un negocio con el corazón para encontrarlo fácilmente aquí.</p><Link className="favorites-search-link" to="/search">Explorar negocios <span aria-hidden="true">→</span></Link></div>}
  </PageLayout>;
}
