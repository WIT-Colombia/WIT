import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { categories } from "../data/mockData";
import { SiteHeader } from "../components/SiteHeader";
import { BottomNavigation } from "../components/BottomNavigation";
import "./Search.css";

const suggestions = ["desayunos", "droguería", "arreglo de motos", "barbería"];

export default function Search() {
  const [params] = useSearchParams();
  const [query, setQuery] = useState(() => params.get("q") ?? "");
  const navigate = useNavigate();

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigate(`/results${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ""}`);
  }

  return <div className="search-page">
    <SiteHeader active="explore" />
    <main className="search-main">
      <Link className="search-back" to="/home">← <span>Volver al inicio</span></Link>
      <div className="search-intro"><span className="search-eyebrow">CERCA DE TI</span><h1>¿Qué te gustaría encontrar?</h1><p>Busca un lugar, un servicio o algo que necesites hoy.</p></div>
      <form className="search-large" role="search" onSubmit={search}><span aria-hidden="true">⌕</span><label className="sr-only" htmlFor="search-page-input">Buscar negocios y servicios</label><input id="search-page-input" autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ej. desayunos, una droguería…"/><button type="submit">Buscar</button></form>
      <section className="search-suggestions"><h2>Ideas para empezar</h2><div>{suggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => { setQuery(suggestion); navigate(`/results?q=${encodeURIComponent(suggestion)}`); }}>⌕ <span>{suggestion}</span><b>→</b></button>)}</div></section>
      <section className="search-categories"><h2>O explora por categoría</h2><div>{categories.map((category) => <button key={category.name} type="button" onClick={() => navigate(`/results?category=${encodeURIComponent(category.name)}`)}><span>{category.icon}</span>{category.name}<b>→</b></button>)}</div></section>
      <p className="search-note">Por ahora mostramos negocios de ejemplo en Palmira. Estamos preparando más lugares para tu zona.</p>
    </main><BottomNavigation/>
  </div>;
}
