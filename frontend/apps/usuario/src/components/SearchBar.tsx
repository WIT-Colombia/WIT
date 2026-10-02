import { useState, type FormEvent } from "react";

type SearchBarProps = { onSearch: (value: string) => void; onSubmitSearch?: (value: string) => void; initialValue?: string };

export function SearchBar({ onSearch, onSubmitSearch, initialValue = "" }: SearchBarProps) {
  const [value, setValue] = useState(initialValue);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSearch(value);
    onSubmitSearch?.(value);
  }

  return <form className="search-bar" role="search" onSubmit={submit}>
    <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/></svg>
    <label className="sr-only" htmlFor="wit-search">¿Qué estás buscando?</label>
    <input id="wit-search" value={value} onChange={(event) => { setValue(event.target.value); onSearch(event.target.value); }} placeholder="¿Qué estás buscando?" />
    {value && <button className="search-clear" type="button" aria-label="Borrar búsqueda" onClick={() => { setValue(""); onSearch(""); }}>×</button>}
    <button className="search-submit" type="submit">Buscar</button>
  </form>;
}
