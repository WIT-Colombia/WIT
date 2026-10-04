import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { categories } from "../data/mockData";
import { getSelectedLocation } from "../services/locationService";
import { saveUserNeed } from "../services/userDataService";
import { PageLayout } from "../components/PageLayout";
import "./RegisterNeed.css";

export default function RegisterNeed() {
  const [params] = useSearchParams();
  const [title, setTitle] = useState(params.get("q") ?? "");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const location = getSelectedLocation();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim() || !category) return;
    saveUserNeed({ id: `need-${Date.now()}`, title: title.trim(), category, description: description.trim(), location: { id: location?.id ?? "76520", name: location?.name ?? "Palmira", context: location?.context ?? "Valle del Cauca" }, createdAt: new Date().toISOString() });
    setSubmitted(true);
  }

  if (submitted) return <PageLayout className="register-need-page"><div className="need-confirmation"><span>✓</span><h1>Gracias por contarnos</h1><p>Tu respuesta nos ayuda a entender qué hace falta cerca de ti.</p><Link to="/home">Volver al inicio</Link></div></PageLayout>;
  return <PageLayout className="register-need-page"><Link className="need-back" to="/home">← Volver a explorar</Link><div className="user-page-heading"><span>AYÚDANOS A DESCUBRIR</span><h1>¿Qué necesitas encontrar?</h1><p>Cuéntanos un poco y ayúdanos a encontrar lo que necesitas.</p></div><form className="need-form" onSubmit={submit}><label>¿Qué estás buscando?<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ej. un lugar para desayunar" maxLength={90} required/></label><label>¿En qué categoría?<select value={category} onChange={(event) => setCategory(event.target.value)} required><option value="">Elige una categoría</option>{categories.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</select></label><label>Cuéntanos un poco más <span>(opcional)</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Algún detalle que nos ayude a entender mejor…" maxLength={320} rows={4}/></label><div className="need-location-note">⌖ Zona seleccionada: <b>{location ? `${location.name}, ${location.context}` : "Palmira, Valle del Cauca"}</b></div><button type="submit">Guardar mi necesidad →</button></form></PageLayout>;
}
