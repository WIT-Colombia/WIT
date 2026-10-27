import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

type SearchBarProps = { onSearch: (value: string) => void; onSubmitSearch?: (value: string, searchId: string) => void; initialValue?: string; showFilters?: boolean; hideSubmit?: boolean; inputId?: string };

export function createSearchId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function SearchBar({ onSearch, onSubmitSearch, initialValue = "", showFilters = false, hideSubmit = false, inputId = "wit-search" }: SearchBarProps) {
  const [value, setValue] = useState(initialValue);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const searchId = createSearchId();
    onSearch(value);
    onSubmitSearch?.(value, searchId);
    window.dispatchEvent(new CustomEvent("xamuko:search-confirmed", { detail: { value, searchId } }));
  }

  return <form className="search-bar" role="search" onSubmit={submit}>
    <button className="search-icon-submit" type="submit" aria-label="Buscar" style={{ display: "grid", flex: "0 0 24px", width: 24, height: 24, padding: 0, placeItems: "center", border: 0, background: "transparent", color: "inherit", cursor: "pointer" }}><svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/></svg></button>
    <label className="sr-only" htmlFor={inputId}>¿Qué estás buscando?</label>
    <input id={inputId} value={value} onChange={(event) => { setValue(event.target.value); onSearch(event.target.value); }} placeholder="¿Qué estás buscando?" />
    {value && <button className="search-clear" type="button" aria-label="Borrar búsqueda" onClick={() => { setValue(""); onSearch(""); }}>×</button>}
    {showFilters && <Link className="search-filter-button" to={`/filters${value.trim() ? `?q=${encodeURIComponent(value.trim())}` : ""}`} aria-label="Abrir filtros"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2" fill="var(--xamuko-violet)"/><circle cx="15" cy="12" r="2" fill="var(--xamuko-violet)"/><circle cx="11" cy="18" r="2" fill="var(--xamuko-violet)"/></svg></Link>}
    {!showFilters && !hideSubmit && <button className="search-submit" type="submit">Buscar</button>}
  </form>;
}
