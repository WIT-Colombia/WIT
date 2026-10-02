import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { categories } from "../data/mockData";
import { PageLayout } from "../components/PageLayout";
import "./Filters.css";

export default function Filters() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [category, setCategory] = useState(params.get("category") ?? "");
  const [openNow, setOpenNow] = useState(params.get("openNow") === "true");
  const [sort, setSort] = useState(params.get("sort") ?? "recommended");
  const [minRating, setMinRating] = useState(() => {
    const value = Number(params.get("minRating") ?? 0);
    return value >= 4.5 ? "4.5" : value >= 4 ? "4" : "";
  });
  const query = params.get("q") ?? "";

  function applyFilters() {
    const next = new URLSearchParams();
    if (query) next.set("q", query);
    if (category) next.set("category", category);
    if (openNow) next.set("openNow", "true");
    if (sort !== "recommended") next.set("sort", sort);
    if (minRating) next.set("minRating", minRating);
    navigate(`/results${next.size ? `?${next.toString()}` : ""}`);
  }

  return <PageLayout active="explore" className="filters-page"><Link className="filters-back" to={`/results${params.size ? `?${params.toString()}` : ""}`}>← Volver a resultados</Link><div className="user-page-heading"><span>AFINA TU BÚSQUEDA</span><h1>Filtros</h1><p>Elige qué es importante para ti y mira opciones que se ajusten mejor.</p></div>
    <div className="filters-panel"><fieldset><legend>Categoría</legend><button type="button" className={!category ? "filter-option active" : "filter-option"} onClick={() => setCategory("")}>Todas las categorías</button>{categories.map((item) => <button key={item.name} type="button" className={category === item.name ? "filter-option active" : "filter-option"} onClick={() => setCategory(category === item.name ? "" : item.name)}><span>{item.icon}</span>{item.name}<i>{category === item.name ? "✓" : ""}</i></button>)}</fieldset>
      <fieldset><legend>Disponibilidad</legend><label className="filter-switch"><input type="checkbox" checked={openNow} onChange={(event) => setOpenNow(event.target.checked)}/><span><b>Abiertos ahora</b><small>Ver solo lugares disponibles en este momento</small></span></label></fieldset>
      <fieldset><legend>Calificación</legend><div className="rating-filter-options">{["", "4", "4.5"].map((value) => <label key={value} className={minRating === value ? "rating-choice active" : "rating-choice"}><input type="radio" name="rating" value={value} checked={minRating === value} onChange={() => setMinRating(value)}/>{value ? `${value}+` : "Cualquiera"}{value && <span>★</span>}</label>)}</div></fieldset>
      <fieldset><legend>Ordenar por</legend><label className="sort-filter">Ordenar resultados<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="recommended">Recomendados</option><option value="rating">Mejor calificados</option><option value="distance">Más cercanos</option></select></label></fieldset>
      <div className="filters-actions"><button type="button" onClick={() => { setCategory(""); setOpenNow(false); setSort("recommended"); setMinRating(""); }}>Limpiar filtros</button><button type="button" onClick={applyFilters}>Ver resultados →</button></div>
    </div>
  </PageLayout>;
}
