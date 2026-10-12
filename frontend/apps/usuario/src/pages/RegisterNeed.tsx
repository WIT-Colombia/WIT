import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { categories } from "../data/mockData";
import { useLocationContext } from "../context/LocationContext";
import { saveUserNeed } from "../services/userDataService";
import { PageLayout } from "../components/PageLayout";
import "./RegisterNeed.css";

export default function RegisterNeed() {
  const [params] = useSearchParams();
  const [title, setTitle] = useState(params.get("q") ?? "");
  const [category, setCategory] = useState("");
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const { selection } = useLocationContext();
  const location = selection?.mode === "manual" ? selection.locality : null;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim() || !category) return;
    saveUserNeed({ id: `need-${Date.now()}`, title: title.trim(), category, description: description.trim(), location: { id: location?.id ?? "unknown", name: location?.name ?? "Zona no seleccionada", context: location?.context ?? "Sin ubicación confirmada" }, createdAt: new Date().toISOString() });
    setSubmitted(true);
  }

  if (submitted) return <PageLayout className="register-need-page"><div className="need-confirmation"><span>✓</span><h1>Gracias por contarnos</h1><p>Tu respuesta nos ayuda a entender qué hace falta cerca de ti.</p><Link to="/home">Volver al inicio</Link></div></PageLayout>;
  return <PageLayout className="register-need-page"><Link className="need-back" to="/home">← Volver a explorar</Link><div className="user-page-heading"><span>AYÚDANOS A DESCUBRIR</span><h1>¿Qué necesitas encontrar?</h1><p>Cuéntanos un poco y ayúdanos a encontrar lo que necesitas.</p></div><form className="need-form" onSubmit={submit}><label>¿Qué estás buscando?<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ej. un lugar para desayunar" maxLength={90} required/></label><label>¿En qué categoría?<div className={`need-category-select${categoryOpen ? " is-open" : ""}`}><button className="need-category-trigger" type="button" aria-haspopup="listbox" aria-expanded={categoryOpen} onClick={() => setCategoryOpen((open) => !open)}><span className={category ? "has-value" : ""}>{category || "Elige una categoría"}</span><span className="need-category-chevron" aria-hidden="true">⌄</span></button>{categoryOpen && <div className="need-category-menu" role="listbox" aria-label="Categorías">{categories.map((item) => <button key={item.name} type="button" role="option" aria-selected={category === item.name} className={category === item.name ? "is-selected" : ""} onClick={() => { setCategory(item.name); setCategoryOpen(false); }}>{item.name}<span aria-hidden="true">{category === item.name ? "✓" : ""}</span></button>)}</div>}</div></label><label>Cuéntanos un poco más <span>(opcional)</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Algún detalle que nos ayude a entender mejor…" maxLength={320} rows={4}/></label><div className="need-location-note">⌖ Zona seleccionada: <b>{location ? `${location.name}, ${location.context}` : selection?.mode === "automatic" ? "Ubicación actual" : "Zona no seleccionada"}</b></div><button type="submit">Guardar mi necesidad →</button></form></PageLayout>;
}
