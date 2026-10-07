import { useEffect, useState, type FormEvent, type ChangeEvent, type PointerEvent } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useBusinessStore } from "../services/businessStore";
import { getColombianAdministrativeDivisions } from "../../../usuario/src/services/administrativeDivisionService";

const categories = ["Restaurantes", "Droguerías", "Ferreterías", "Talleres", "Barberías", "Tecnología", "Cafeterías", "Panaderías y reposterías", "Supermercados y tiendas", "Frutas y verduras", "Carnicerías y pescaderías", "Salud y bienestar", "Clínicas y consultorios", "Ópticas", "Peluquerías y belleza", "Ropa y calzado", "Hogar y decoración", "Construcción y remodelación", "Repuestos y accesorios", "Lavanderías y tintorerías", "Mascotas y veterinarias", "Papelerías y librerías", "Educación y cursos", "Deportes y recreación", "Transporte y movilidad", "Servicios para el hogar", "Servicios técnicos", "Servicios profesionales", "Floristerías y regalos", "Hoteles y turismo", "Eventos y entretenimiento", "Belleza y cuidado personal", "Otros"];
const locationCatalog = getColombianAdministrativeDivisions();
const dayNames: Record<string, string> = { Lun: "Lunes", Mar: "Martes", Mié: "Miércoles", Jue: "Jueves", Vie: "Viernes", Sáb: "Sábado", Dom: "Domingo" };
const formatHour = (value: string) => { const [hour, minute] = value.split(":").map(Number); if (!Number.isFinite(hour)) return value; const suffix = hour >= 12 ? "p. m." : "a. m."; const displayHour = hour % 12 || 12; return `${displayHour}:${String(minute).padStart(2, "0")} ${suffix}`; };
const parseBusinessHours = (value: string) => value.split(" · ").filter(Boolean).map(part => { const match = part.match(/^(.{3})\s+(\d{2}:\d{2})[–-](\d{2}:\d{2})$/); return match ? [dayNames[match[1]] ?? match[1], `${formatHour(match[2])} – ${formatHour(match[3])}`] : null; }).filter((item): item is string[] => Boolean(item));

export function BusinessDetailPage() {
  const { index = "0" } = useParams();
  const navigate = useNavigate();
  const { businesses, setBusinesses, setBusiness } = useBusinessStore();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingRecovery, setConfirmingRecovery] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editDepartment, setEditDepartment] = useState("76");
  const [editLocationMode, setEditLocationMode] = useState<"address" | "map">("address");
  const [editPinPosition, setEditPinPosition] = useState({ x: 50, y: 50 });
  const [galleryIndex, setGalleryIndex] = useState(0);
  const businessIndex = Number(index);
  const hasValidBusiness = Number.isInteger(businessIndex) && businessIndex >= 0 && businessIndex < businesses.length;
  const business = businesses[businessIndex] ?? businesses[0];
  const [draft, setDraft] = useState(business);
  useEffect(() => {
    if (!business) return;
    setBusiness(business);
    setDraft(business);
    setGalleryIndex(0);
    setConfirmingDelete(false);
    setConfirmingRecovery(false);
  }, [business, setBusiness]);
  if (!hasValidBusiness || !business) return <Navigate to="/mis-negocios" replace />;
  const weeklyHours = parseBusinessHours(business.hours).length ? parseBusinessHours(business.hours) : [["Lunes", "Sin horario configurado"], ["Martes", "Sin horario configurado"], ["Miércoles", "Sin horario configurado"], ["Jueves", "Sin horario configurado"], ["Viernes", "Sin horario configurado"], ["Sábado", "Sin horario configurado"], ["Domingo", "Sin horario configurado"]];
  const setAsProfilePhoto = (image: string) => { const updated = { ...business, coverImage: image }; setBusinesses(businesses.map(item => item === business ? updated : item)); setBusiness(updated); };
  const info = (entries: string[][]) => <div className="business-detail-grid">{entries.map(([label, value]) => <div key={label}><small>{label}</small><strong>{value || "Sin información"}</strong></div>)}</div>;
  const remove = () => { const deleted = { ...business, status: "Eliminado" as const, deletedAt: new Date().toISOString() }; setBusinesses(businesses.map(item => item === business ? deleted : item)); setBusiness(deleted); setConfirmingDelete(false); setEditing(false); };
  const recover = () => { const recovered = { ...business, status: "Pendiente" as const, deletedAt: undefined }; setBusinesses(businesses.map(item => item === business ? recovered : item)); setBusiness(recovered); setConfirmingRecovery(false); };
  const updateDraft = (field: keyof typeof draft, value: string) => setDraft(current => ({ ...current, [field]: value }));
  const openEditor = () => {
    navigate(`/mis-negocios/editar/${index}`);
  };
  const municipalities = locationCatalog.municipalities.filter(item => item.departmentCode === editDepartment);
  const moveEditPin = (event: PointerEvent<HTMLButtonElement>) => {
    const map = event.currentTarget.parentElement;
    if (!map) return;
    const bounds = map.getBoundingClientRect();
    const x = Math.max(4, Math.min(96, ((event.clientX - bounds.left) / bounds.width) * 100));
    const y = Math.max(8, Math.min(90, ((event.clientY - bounds.top) / bounds.height) * 100));
    setEditPinPosition({ x, y });
    updateDraft("address", `Ubicación ajustada en ${draft.city || "la ciudad seleccionada"}`);
  };
  const save = (event: FormEvent) => { event.preventDefault(); const next = businesses.map(item => item === business ? draft : item); setBusinesses(next); setBusiness(draft); setEditing(false); };
  return <>
    <div className="business-detail-layout">
      <section className={`surface-card business-detail-main${business.status === "Eliminado" ? " is-deleted" : ""}`}>
        <div className="business-detail-hero">
          {business.coverImage ? <img className="business-detail-image" src={business.coverImage} alt={business.name} /> : <div className="business-logo">☕</div>}
          <div className="business-detail-hero-copy"><span className="business-detail-category">{business.category}{business.tags?.length ? ` · ${business.tags.join(" · ")}` : ""}</span><h2>{business.name}</h2><p>{business.city} · {business.address}</p>{business.rating && <div className="business-detail-rating">★ {business.rating.toFixed(1)} <span>({business.reviewCount ?? 0} opiniones)</span></div>}</div>
          
        </div>
        {business.status === "Eliminado" && <div className="business-deleted-notice"><strong>Tu negocio no se encuentra visible</strong><p>Cuentas con 10 días para recuperarlo. Toda su información se conserva durante ese plazo.</p><button className="action-button" type="button" onClick={() => setConfirmingRecovery(true)}>Recuperar negocio</button>{confirmingRecovery && <div className="business-recovery-confirm"><strong>¿Quieres recuperar este negocio?</strong><p>Volverá a estado Verificación pendiente y podrás seguir editándolo.</p><div><button className="action-button" type="button" onClick={recover}>Sí, recuperar</button><button className="outline-button" type="button" onClick={() => setConfirmingRecovery(false)}>Cancelar</button></div></div>}</div>}
        <section className="business-detail-section"><h3>Descripción</h3><p>{business.description}</p>{business.tags?.length ? <div className="business-tag-list">{business.tags.map(tag => <span key={tag}>{tag}</span>)}</div> : null}</section>
        {business.images && business.images.length > 0 && <section className="business-detail-section"><div className="business-gallery-heading"><h3>Fotos del negocio</h3><span>{galleryIndex + 1} de {business.images.length}</span></div><div className="business-detail-gallery"><div className="business-gallery-featured"><img src={business.images[galleryIndex]} alt={`${business.name} ${galleryIndex + 1}`} />{business.images.length > 1 && <><button type="button" className="business-gallery-arrow previous" aria-label="Foto anterior" onClick={() => setGalleryIndex(index => (index - 1 + business.images!.length) % business.images!.length)}>‹</button><button type="button" className="business-gallery-arrow next" aria-label="Foto siguiente" onClick={() => setGalleryIndex(index => (index + 1) % business.images!.length)}>›</button></>}</div><button type="button" className="business-profile-photo-button" onClick={() => setAsProfilePhoto(business.images![galleryIndex])}>{business.coverImage === business.images[galleryIndex] ? "✓ Foto de perfil actual" : "Usar esta foto como perfil"}</button>{business.images.length > 1 && <div className="business-gallery-thumbnails">{business.images.map((image, imageIndex) => <button type="button" className={imageIndex === galleryIndex ? "active" : ""} key={`${image.slice(0, 20)}-${imageIndex}`} onClick={() => setGalleryIndex(imageIndex)}><img src={image} alt={`Ver foto ${imageIndex + 1}`} /></button>)}</div>}</div></section>}
        <section className="business-detail-section"><h3>Información comercial</h3>{info([["Nombre comercial", business.name], ["Categoría", business.category]])}</section>
        <section className="business-detail-section"><h3>Ubicación</h3>{info([["Ciudad", business.city], ["Dirección", business.address]])}<div className="business-detail-map"><iframe title={`Mapa de ${business.name}`} src={`https://www.google.com/maps?q=${encodeURIComponent([business.address, business.city].filter(Boolean).join(", "))}&z=16&t=k&output=embed`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" /></div></section>
        <section className="business-detail-section"><h3>Contacto</h3>{info([["Teléfono", business.phone], ["WhatsApp", business.whatsapp]])}</section>
        <section className="business-detail-section"><h3>Horario</h3><div className="business-hours-list">{weeklyHours.map(([day, hours]) => <div key={day}><strong>{day}</strong><span>{hours}</span></div>)}</div></section>
        {business.status !== "Eliminado" && <><div className="business-detail-edit-row"><button className="danger-button business-detail-delete-button" type="button" onClick={() => setConfirmingDelete(true)}>Eliminar negocio</button><button className="action-button business-detail-edit-button" type="button" onClick={openEditor}>Editar negocio</button></div>{confirmingDelete && !editing && <div className="business-delete-confirm business-detail-delete-confirm"><strong>¿Eliminar este negocio?</strong><p>Tu negocio quedará no visible y podrás recuperarlo durante 10 días.</p><div><button className="danger-button" type="button" onClick={remove}>Sí, eliminar</button><button className="outline-button" type="button" onClick={() => setConfirmingDelete(false)}>Cancelar</button></div></div>}</>}
      </section>

    </div>

    {editing && <div className="modal-backdrop" role="presentation"><form className="modal-card business-edit-modal" onSubmit={save}><div className="modal-heading"><div><span className="page-eyebrow">EDITAR NEGOCIO</span><h2>Edita la información de tu tienda</h2><p>Actualiza los mismos datos que diligenciaste al crearla.</p></div><button className="close-button" type="button" aria-label="Cerrar" onClick={() => setEditing(false)}>×</button></div><div className="edit-form-section"><h3>Datos básicos</h3><div className="form-grid"><label className="form-field">Nombre comercial<input value={draft.name} onChange={event => updateDraft("name", event.target.value)} required /></label><label className="form-field">Categoría<select value={draft.category} onChange={event => updateDraft("category", event.target.value)} required>{categories.map(item => <option key={item}>{item}</option>)}</select></label><label className="form-field full-field">Descripción corta<textarea value={draft.description} onChange={event => updateDraft("description", event.target.value)} rows={3} maxLength={300} /></label></div></div><div className="edit-form-section"><h3>Ubicación</h3><div className="form-grid"><label className="form-field">Departamento<select value={editDepartment} onChange={event => { setEditDepartment(event.target.value); updateDraft("city", ""); }} required>{locationCatalog.departments.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}</select></label><label className="form-field">Ciudad o municipio<select value={draft.city} onChange={event => updateDraft("city", event.target.value)} required>{municipalities.map(item => <option key={item.id}>{item.name}</option>)}</select></label></div><div className="location-mode-toggle" role="group" aria-label="Forma de indicar la ubicación"><button type="button" className={editLocationMode === "address" ? "active" : ""} onClick={() => setEditLocationMode("address")}>Escribir dirección</button><button type="button" className={editLocationMode === "map" ? "active" : ""} onClick={() => setEditLocationMode("map")}>Elegir en el mapa</button></div>{editLocationMode === "address" ? <label className="form-field">Dirección<input value={draft.address} onChange={event => updateDraft("address", event.target.value)} required /></label> : <div className="edit-map-note"><iframe title="Mapa de ubicación del negocio" src={`https://www.google.com/maps?q=${encodeURIComponent([draft.address, draft.city].filter(Boolean).join(", "))}&z=16&t=k&output=embed`} loading="lazy" /><button className="edit-map-pin" type="button" aria-label="Mover el puntero de ubicación" style={{ left: `${editPinPosition.x}%`, top: `${editPinPosition.y}%` }} onPointerDown={event => event.currentTarget.setPointerCapture(event.pointerId)} onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) moveEditPin(event); }} onPointerUp={event => event.currentTarget.releasePointerCapture(event.pointerId)}><span>⌖</span></button><p>Arrastra el puntero para ajustar la ubicación. La dirección se actualizará al confirmar.</p></div>}</div><div className="edit-form-section"><h3>Contacto</h3><div className="form-grid"><label className="form-field">Teléfono<input value={draft.phone} onChange={event => updateDraft("phone", event.target.value)} required type="tel" /></label><label className="form-field">WhatsApp<input value={draft.whatsapp} onChange={event => updateDraft("whatsapp", event.target.value)} type="tel" /></label></div></div><div className="edit-form-section"><h3>Horarios y fotos</h3><label className="form-field">Horario general<input value={draft.hours} onChange={event => updateDraft("hours", event.target.value)} placeholder="Ej. Lun–Vie 8:00 a. m.–6:00 p. m." /></label><label className="form-field">Fotos del negocio <small>(opcional)</small><input type="file" accept="image/*" onChange={(event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => updateDraft("coverImage", typeof reader.result === "string" ? reader.result : (draft.coverImage ?? "")); reader.readAsDataURL(file); }} /></label></div><div className="modal-actions"><button className="outline-button" type="button" onClick={() => setEditing(false)}>Cancelar</button><button className="action-button" type="submit">Guardar cambios</button></div></form></div>}
  </>;
}
