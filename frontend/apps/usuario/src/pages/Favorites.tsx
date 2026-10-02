import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { businesses } from "../data/mockData";
import { getFavoriteIds, toggleFavorite } from "../services/userDataService";
import { BusinessCard } from "../components/EntityCards";
import { PageLayout } from "../components/PageLayout";
import { HeartIcon } from "../components/ActionIcons";

export default function Favorites() {
  const [favoriteIds, setFavoriteIds] = useState(getFavoriteIds);
  const savedStores = useMemo(() => businesses.filter((item) => favoriteIds.includes(item.id)), [favoriteIds]);
  function remove(id: string) { setFavoriteIds(toggleFavorite(id)); }

  return <PageLayout><div className="user-page-heading"><span>TUS TIENDAS GUARDADAS</span><h1>Tiendas guardadas</h1><p>Guarda una tienda para volver a encontrarla fácilmente.</p></div>
    {savedStores.length ? <div className="user-card-grid">{savedStores.map((business) => <BusinessCard key={business.id} business={business} favorite onFavorite={() => remove(business.id)}/>)}</div> : <div className="user-empty-state"><span className="empty-store-heart" aria-hidden="true"><HeartIcon/></span><h2>Aún no has guardado tiendas</h2><p>Usa el corazón “Guardar” en la ficha de una tienda para verla aquí.</p><Link to="/search">Buscar tiendas cerca de mí →</Link></div>}
  </PageLayout>;
}
