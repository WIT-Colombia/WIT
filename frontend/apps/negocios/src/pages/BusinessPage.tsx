import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../components/common/PageHeader";
import { FormField } from "../components/common/FormField";
import { useBusinessStore } from "../services/businessStore";
import { initialBusiness } from "../data/business.mock";
import type { BusinessDetails } from "../types/business";

function blankBusiness(name: string, category: string, city: string): BusinessDetails { return { ...initialBusiness, name, category, city, description: "Añade una descripción para que las personas conozcan tu negocio.", address: "", phone: "", whatsapp: "", email: "", website: "", instagram: "", hours: "", status: "Información incompleta" }; }

export function BusinessPage() {
  const navigate = useNavigate();
  const { business, businesses, setBusiness, setBusinesses } = useBusinessStore();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newCity, setNewCity] = useState("");
  const selectBusiness = (item: BusinessDetails, index: number) => { setBusiness(item); navigate(`/mi-negocio/detalle/${index}`); };
  const create = (event: FormEvent) => { event.preventDefault(); const item = blankBusiness(newName.trim(), newCategory.trim() || "Por definir", newCity.trim() || "Por definir"); const next = [...businesses, item]; setBusinesses(next); setBusiness(item); setNewName(""); setNewCategory(""); setNewCity(""); setCreating(false); navigate(`/mi-negocio/detalle/${next.length - 1}`); };
  return <><PageHeader eyebrow="" title="Mis negocios" description="Administra todos los negocios asociados a tu cuenta." /><section className="business-list-surface surface-card"><div className="card-heading"><div><h2>Tus negocios</h2><p>Selecciona uno para consultar toda su información o crea uno nuevo.</p></div><button className="action-button" type="button" onClick={() => navigate("/mis-negocios/nuevo")}>＋ Crear negocio</button></div><div className="business-list">{businesses.map((item, index) => <article className={`business-list-item${item === business ? " active" : ""}`} key={`${item.name}-${index}`}><button type="button" className="business-list-select" onClick={() => selectBusiness(item, index)}><span className="business-list-icon">{item.name.charAt(0).toUpperCase()}</span><span><strong>{item.name}</strong><small>{item.category} · {item.city}</small></span></button><div className="business-list-actions"><span className={`status-pill ${item.status === "Verificado" ? "" : "pending"}`}>{item.status === "Pendiente" ? "Verificación pendiente" : item.status}</span></div></article>)}</div>{creating && <form className="business-create-form" onSubmit={create}><h3>Crear negocio</h3><p>Podrás completar el resto de la información después.</p><div className="form-grid"><FormField label="Nombre comercial" name="new-name" value={newName} onChange={event => setNewName(event.target.value)} required /><FormField label="Categoría" name="new-category" value={newCategory} onChange={event => setNewCategory(event.target.value)} /><FormField label="Ciudad" name="new-city" value={newCity} onChange={event => setNewCity(event.target.value)} /></div><div className="form-actions"><button className="action-button" type="submit">Crear negocio</button><button className="outline-button" type="button" onClick={() => setCreating(false)}>Cancelar</button></div></form>}</section></>;
}
