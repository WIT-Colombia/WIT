import { useEffect, useState, type ChangeEvent, type FormEvent, type PointerEvent, type DragEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useParams } from "react-router-dom";
import { PageHeader } from "../components/common/PageHeader";
import { useBusinessStore } from "../services/businessStore";
import { businessCatalog, initialBusiness } from "../data/business.mock";
import type { BusinessDetails } from "../types/business";
import { getColombianAdministrativeDivisions } from "../../../usuario/src/services/administrativeDivisionService";
import { addBusinessInitialVisibilityPeriod } from "../services/visibilityPolicy";

const categories = [
  "Restaurantes", "Droguerías", "Ferreterías", "Talleres", "Barberías", "Tecnología", "Cafeterías",
  "Panaderías y reposterías", "Supermercados y tiendas", "Frutas y verduras", "Carnicerías y pescaderías",
  "Salud y bienestar", "Clínicas y consultorios", "Ópticas", "Peluquerías y belleza", "Ropa y calzado",
  "Hogar y decoración", "Construcción y remodelación", "Repuestos y accesorios", "Lavanderías y tintorerías",
  "Mascotas y veterinarias", "Papelerías y librerías", "Educación y cursos", "Deportes y recreación",
  "Transporte y movilidad", "Servicios para el hogar", "Servicios técnicos", "Servicios profesionales",
  "Floristerías y regalos", "Hoteles y turismo", "Eventos y entretenimiento", "Belleza y cuidado personal", "Otros",
];
const days = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
type DayHours = { enabled: boolean; open: string; close: string };

const defaultHours = Object.fromEntries(days.map(day => [day, { enabled: day !== "Domingo", open: "08:00", close: "18:00" }])) as Record<string, DayHours>;
const locationCatalog = getColombianAdministrativeDivisions();
const phoneCountries = [{ code: "+57", name: "Colombia", flag: "🇨🇴", length: 10 }, { code: "+1-US", dialCode: "+1", name: "Estados Unidos", flag: "🇺🇸", length: 10 }, { code: "+1-CA", dialCode: "+1", name: "Canadá", flag: "🇨🇦", length: 10 }, { code: "+52", name: "México", flag: "🇲🇽", length: 10 }, { code: "+34", name: "España", flag: "🇪🇸", length: 9 }, { code: "+54", name: "Argentina", flag: "🇦🇷", length: 10 }, { code: "+55", name: "Brasil", flag: "🇧🇷", length: 11 }, { code: "+56", name: "Chile", flag: "🇨🇱", length: 9 }, { code: "+51", name: "Perú", flag: "🇵🇪", length: 9 }, { code: "+593", name: "Ecuador", flag: "🇪🇨", length: 9 }, { code: "+58", name: "Venezuela", flag: "🇻🇪", length: 10 }, { code: "+507", name: "Panamá", flag: "🇵🇦", length: 8 }, { code: "+506", name: "Costa Rica", flag: "🇨🇷", length: 8 }, { code: "+44", name: "Reino Unido", flag: "🇬🇧", length: 10 }, { code: "+33", name: "Francia", flag: "🇫🇷", length: 9 }, { code: "+49", name: "Alemania", flag: "🇩🇪", length: 11 }, { code: "+39", name: "Italia", flag: "🇮🇹", length: 10 }, { code: "+61", name: "Australia", flag: "🇦🇺", length: 9 }, { code: "+81", name: "Japón", flag: "🇯🇵", length: 10 }, { code: "+86", name: "China", flag: "🇨🇳", length: 11 }, { code: "+91", name: "India", flag: "🇮🇳", length: 10 }];
const fixedPrefixes: Record<string, string> = { "+57": "60", "+58": "2", "+593": "2", "+51": "1", "+34": "8" };
const dayAbbreviations: Record<string, string> = { Lun: "Lunes", Mar: "Martes", Mié: "Miércoles", Mie: "Miércoles", Jue: "Jueves", Vie: "Viernes", Sáb: "Sábado", Sab: "Sábado", Dom: "Domingo" };
const hoursFromText = (value: string) => {
  const parsed = Object.fromEntries(days.map(day => [day, { ...defaultHours[day] }])) as Record<string, DayHours>;
  if (!value.trim()) return Object.fromEntries(days.map(day => [day, { enabled: false, open: "08:00", close: "18:00" }])) as Record<string, DayHours>;
  value.split(" · ").filter(Boolean).forEach(part => {
    const match = part.match(/^(Lun|Mar|Mié|Mie|Jue|Vie|Sáb|Sab|Dom)\s+(\d{2}:\d{2})[–-](\d{2}:\d{2})$/);
    if (!match) return;
    const day = dayAbbreviations[match[1]];
    if (day) parsed[day] = { enabled: true, open: match[2], close: match[3] };
  });
  return parsed;
};
const splitPhone = (value: string) => {
  const match = value.match(/^(\+\d+)\s*(.*)$/);
  const country = phoneCountries.find(item => item.code === match?.[1]) ?? phoneCountries[0];
  return { country: country.code, number: (match?.[2] ?? value).replace(/\D/g, "").slice(0, country.length) };
};

export function BusinessCreatePage() {
  const navigate = useNavigate();
  const { index: editIndex } = useParams();
  const { businesses, setBusinesses, setBusiness, preferences, setPreferences } = useBusinessStore();
  const editingBusiness = editIndex !== undefined ? businesses[Number(editIndex)] : undefined;
  const isEditing = Boolean(editingBusiness);
  const [step, setStep] = useState(1);
  const [name, setName] = useState("Café Central");
  const [category, setCategory] = useState("Restaurantes");
  const [description, setDescription] = useState("Arepas hechas al momento y sabores de casa para empezar bien el día.");
  const [departmentCode, setDepartmentCode] = useState("76");
  const [city, setCity] = useState("Palmira");
  const [address, setAddress] = useState("Calle 30 # 28-16, Palmira");
  const [locationMode, setLocationMode] = useState<"address" | "map">("address");
  const initialPhone = splitPhone("+57");
  const [phoneCountry, setPhoneCountry] = useState(initialPhone.country);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneType, setPhoneType] = useState<"fixed" | "mobile">("mobile");
  const [phoneError, setPhoneError] = useState("");
  const [whatsappCountry, setWhatsappCountry] = useState(initialPhone.country);
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [hours, setHours] = useState(defaultHours);
  const [photoNames, setPhotoNames] = useState<string[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [draggedPhoto, setDraggedPhoto] = useState<number | null>(null);
  const [coverImage, setCoverImage] = useState("");
  const [createdName, setCreatedName] = useState("");
  const [pinPosition, setPinPosition] = useState({ x: 50, y: 50 });
  const [manualLocation, setManualLocation] = useState(false);
  const [mapSelectionLabel, setMapSelectionLabel] = useState("");
  const municipalities = locationCatalog.municipalities.filter(item => item.departmentCode === departmentCode);
  const departmentName = locationCatalog.departments.find(item => item.code === departmentCode)?.name ?? "Colombia";
  const mapQuery = encodeURIComponent([locationMode === "address" ? address : "", city, departmentName].filter(Boolean).join(", "));
  const locationValue = locationMode === "map" ? (mapSelectionLabel || `Ubicación seleccionada en mapa · ${city}, ${departmentName}`) : address.trim();
  const selectedPhoneCountry = phoneCountries.find(item => item.code === phoneCountry) ?? phoneCountries[0];
  const phoneDigits = selectedPhoneCountry.length;
  const selectedWhatsappCountry = phoneCountries.find(item => item.code === whatsappCountry) ?? phoneCountries[0];
  const whatsappDigits = selectedWhatsappCountry.length;
  useEffect(() => {
    if (!createdName) return;
    const timer = window.setTimeout(() => navigate("/mi-negocio"), 1200);
    return () => window.clearTimeout(timer);
  }, [createdName, navigate]);
  useEffect(() => {
    if (!editingBusiness) return;
    setBusiness(editingBusiness);
    setName(editingBusiness.name); setCategory(editingBusiness.category); setDescription(editingBusiness.description);
    const municipality = locationCatalog.municipalities.find(item => item.name === editingBusiness.city);
    const parsedPhone = splitPhone(editingBusiness.phone); const parsedWhatsapp = splitPhone(editingBusiness.whatsapp || editingBusiness.phone);
    setDepartmentCode(municipality?.departmentCode ?? "76"); setCity(editingBusiness.city); setAddress(editingBusiness.address); setPhoneCountry(parsedPhone.country); setPhoneNumber(parsedPhone.number); setPhoneType(parsedPhone.number.startsWith("3") ? "mobile" : "fixed"); setWhatsappCountry(parsedWhatsapp.country); setWhatsappNumber(parsedWhatsapp.number);
    setLocationMode("address"); setManualLocation(false); setMapSelectionLabel(""); setHours(hoursFromText(editingBusiness.hours)); setCoverImage(editingBusiness.coverImage ?? ""); setPhotoPreviews(editingBusiness.images?.length ? editingBusiness.images : (editingBusiness.coverImage ? [editingBusiness.coverImage] : [])); setPhotoNames(editingBusiness.images?.length ? editingBusiness.images.map((_, index) => `Imagen ${index + 1}`) : (editingBusiness.coverImage ? ["Imagen actual"] : []));
  }, [editingBusiness, setBusiness]);
  const movePin = (event: PointerEvent<HTMLElement>) => {
    const map = event.currentTarget.parentElement;
    if (!map) return;
    const bounds = map.getBoundingClientRect();
    const x = Math.max(4, Math.min(96, ((event.clientX - bounds.left) / bounds.width) * 100));
    const y = Math.max(8, Math.min(90, ((event.clientY - bounds.top) / bounds.height) * 100));
    const selectedLabel = `Ubicación ajustada en ${city}, ${departmentName}`;
    setPinPosition({ x, y });
    setManualLocation(true);
    setAddress(selectedLabel);
    setMapSelectionLabel(selectedLabel);
  };

  const updateDay = (day: string, field: keyof DayHours, value: string | boolean) => setHours(current => ({ ...current, [day]: { ...current[day], [field]: value } }));
  const selectPhotos = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).slice(0, 10);
    setPhotoNames(files.map(file => file.name));
    Promise.all(files.map(file => new Promise<string>(resolve => { const reader = new FileReader(); reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : ""); reader.readAsDataURL(file); }))).then(previews => { const valid = previews.filter(Boolean); setPhotoPreviews(valid); setCoverImage(valid[0] ?? ""); });
  };
  const removePhoto = (index: number) => { const next = photoPreviews.filter((_, photoIndex) => photoIndex !== index); setPhotoPreviews(next); setPhotoNames(names => names.filter((_, photoIndex) => photoIndex !== index)); setCoverImage(next[0] ?? ""); };
  const dropPhoto = (target: number, event: DragEvent<HTMLDivElement>) => { event.preventDefault(); if (draggedPhoto === null || draggedPhoto === target) return; const previews = [...photoPreviews]; const names = [...photoNames]; const [preview] = previews.splice(draggedPhoto, 1); const [name] = names.splice(draggedPhoto, 1); previews.splice(target, 0, preview); names.splice(target, 0, name); setPhotoPreviews(previews); setPhotoNames(names); setCoverImage(previews[0] ?? ""); setDraggedPhoto(null); };
  const hoursText = days.filter(day => hours[day].enabled).map(day => `${day.slice(0, 3)} ${hours[day].open}–${hours[day].close}`).join(" · ") || "Cerrado todos los días";
  const create = (event: FormEvent) => {
    event.preventDefault();
    if (step === 3) {
      const fixedPrefix = phoneType === "fixed" ? fixedPrefixes[phoneCountry] : undefined;
      if (phoneNumber.length !== phoneDigits) { setPhoneError(`Escribe los ${phoneDigits} dígitos del número.`); return; }
      if (fixedPrefix && !phoneNumber.startsWith(fixedPrefix)) { setPhoneError(`Para ${selectedPhoneCountry.name}, un teléfono fijo debe comenzar por ${fixedPrefix}.`); return; }
      setPhoneError("");
    }
    if (step < 5) { setStep(current => current + 1); return; }
    const item: BusinessDetails = { ...(editingBusiness ?? initialBusiness), role: editingBusiness?.role ?? "Propietario", name: name.trim(), category, description: description.trim(), city: city.trim(), address: locationValue, phone: `${selectedPhoneCountry.dialCode ?? phoneCountry} ${phoneNumber}`, whatsapp: `${selectedWhatsappCountry.dialCode ?? whatsappCountry} ${whatsappNumber || phoneNumber}`, email: "", website: "", instagram: "", hours: hoursText, coverImage, images: photoPreviews, status: editingBusiness?.status ?? "Pendiente", isNew: editingBusiness?.isNew ?? true, catalog: editingBusiness?.catalog ?? (editingBusiness ? businessCatalog[editingBusiness.name] ?? [] : []) };
    const next = editingBusiness ? businesses.map(existing => existing === editingBusiness ? item : existing) : [...businesses, item];
    setBusinesses(next);
    setBusiness(item);
    if (!editingBusiness) {
      const visibilityUntil = addBusinessInitialVisibilityPeriod().toISOString();
      setPreferences({ ...preferences, profileVisible: true, visibilityUntil, visibilityByBusiness: { ...(preferences.visibilityByBusiness ?? {}), [item.name]: { profileVisible: true, visibilityUntil } } });
    }
    if (editingBusiness) navigate(`/mi-negocio/detalle/${businesses.indexOf(editingBusiness)}`); else setCreatedName(item.name);
  };
  const back = () => step === 1 ? navigate("/mis-negocios") : setStep(current => current - 1);

  if (editIndex !== undefined && !editingBusiness) return <Navigate to="/mis-negocios" replace />;
  if (createdName) return <section className="business-create-success surface-card"><span className="business-create-success-icon">✓</span><h1>¡Tienda creada correctamente!</h1><p><strong>{createdName}</strong> ya está asociada a tu cuenta.</p><small>Te llevaremos a Mi negocio…</small><button className="action-button" type="button" onClick={() => navigate("/mi-negocio")}>Ir a Mi negocio</button></section>;

  return <>
    <PageHeader eyebrow={isEditing ? "EDITAR NEGOCIO" : "NUEVO NEGOCIO"} title={isEditing ? "Edita tu tienda en WIT" : "Crea tu tienda en WIT"} description={isEditing ? "Actualiza la información de tu negocio." : "Completa la información para que las personas encuentren tu negocio."} />
    <section className="business-create-wizard surface-card">
      <div className="business-wizard-steps" aria-label="Progreso del registro">{["Datos básicos", "Ubicación", "Contacto", "Horarios", "Revisar y publicar"].map((label, index) => <div className={`${step === index + 1 ? "active" : step > index + 1 ? "completed" : ""}${isEditing ? " clickable" : ""}`} key={label} onClick={() => { if (isEditing) setStep(index + 1); }} onKeyDown={event => { if (isEditing && (event.key === "Enter" || event.key === " ")) setStep(index + 1); }} role={isEditing ? "button" : undefined} tabIndex={isEditing ? 0 : undefined}><span>{step > index + 1 ? "✓" : index + 1}</span><small>{label}</small></div>)}</div>
      <form onSubmit={create}>
        {step === 1 && <div className="business-wizard-panel"><h2>Comencemos con los datos básicos</h2><p>Esta información será visible para las personas que encuentren tu negocio en WIT.</p><label className="form-field">Nombre comercial<input value={name} onFocus={event => event.currentTarget.select()} onChange={event => setName(event.target.value)} required placeholder="Ej. La Arepería de Majo" /></label><label className="form-field">Categoría<select value={category} onChange={event => setCategory(event.target.value)} required><option value="">Selecciona una categoría</option>{categories.map(item => <option key={item}>{item}</option>)}</select></label><label className="form-field full-field">Descripción corta<textarea value={description} onFocus={event => event.currentTarget.select()} onChange={event => setDescription(event.target.value)} required maxLength={300} rows={4} placeholder="Cuéntales brevemente qué ofrece tu negocio." /><small>{description.length}/300</small></label></div>}
        {step === 2 && <div className="business-wizard-panel"><h2>¿Dónde está tu negocio?</h2><p>Elige una sola forma de indicar la ubicación.</p><label className="form-field">Departamento<select value={departmentCode} onChange={event => { setDepartmentCode(event.target.value); setCity(""); setManualLocation(false); setMapSelectionLabel(""); }} required><option value="">Selecciona un departamento</option>{locationCatalog.departments.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}</select></label><label className="form-field">Ciudad o municipio<select value={city} onChange={event => { setCity(event.target.value); setManualLocation(false); setMapSelectionLabel(""); }} required disabled={!departmentCode}><option value="">Selecciona una ciudad o municipio</option>{municipalities.map(item => <option key={item.id} value={item.name}>{item.name}</option>)}</select></label><div className="location-mode-toggle" role="group" aria-label="Forma de indicar la ubicación"><button type="button" className={locationMode === "address" ? "active" : ""} onClick={() => setLocationMode("address")}>Escribir dirección</button><button type="button" className={locationMode === "map" ? "active" : ""} onClick={() => setLocationMode("map")}>Elegir en el mapa</button></div>{locationMode === "address" ? <label className="form-field">Dirección<input value={address} onChange={event => { setAddress(event.target.value); setManualLocation(false); }} required placeholder="Calle, carrera y número" /></label> : <><div className="wizard-map-placeholder"><iframe title="Mapa satelital de ubicación del negocio" src={`https://www.google.com/maps?q=${mapQuery}&z=16&t=k&output=embed`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" /><button className="wizard-map-pin" type="button" aria-label="Mover el puntero de ubicación" style={{ left: `${pinPosition.x}%`, top: `${pinPosition.y}%` }} onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) movePin(event); }} onPointerUp={event => { event.currentTarget.releasePointerCapture(event.pointerId); }}><span>⌖</span></button><span className="wizard-map-hint">Arrastra el puntero para ajustar la ubicación{manualLocation ? " · Ubicación ajustada" : ""}</span></div><p className="wizard-map-selection" role="status">{mapSelectionLabel || `Selecciona un punto en ${city}, ${departmentName}`}</p></>}</div>}
        {step === 3 && <div className="business-wizard-panel contact-wizard-panel"><div className="contact-wizard-heading"><span className="contact-wizard-icon">☎</span><div><h2>Información de contacto</h2><p>Agrega los canales que las personas usarán para comunicarse con tu negocio.</p></div></div><div className="contact-wizard-note"><span>✓</span><p>El indicativo internacional se selecciona automáticamente. Solo debes escribir el número nacional.</p></div><div className="contact-wizard-grid"><section className="contact-input-card"><div className="contact-card-heading"><span className="contact-card-icon phone">☎</span><div><h3>Teléfono</h3><small>¿Dónde pueden llamarte?</small></div></div><label className="form-field"><span>Tipo de línea</span><select value={phoneType} onChange={event => { setPhoneType(event.target.value as "fixed" | "mobile"); setPhoneNumber(""); setPhoneError(""); }} aria-label="Tipo de teléfono"><option value="fixed">Teléfono fijo</option><option value="mobile">Celular</option></select></label><label className="form-field"><span>País</span><select value={phoneCountry} onChange={event => { const country = phoneCountries.find(item => item.code === event.target.value) ?? phoneCountries[0]; setPhoneCountry(country.code); setPhoneNumber(""); setPhoneError(""); }} aria-label="País del teléfono">{phoneCountries.map(country => <option key={country.code} value={country.code}>{country.flag} {country.name} ({country.dialCode ?? country.code})</option>)}</select></label><label className="form-field"><span>Número nacional</span><div className="phone-number-input"><span>{selectedPhoneCountry.dialCode ?? phoneCountry}</span><input type="tel" inputMode="numeric" pattern={`[0-9]{${phoneDigits}}`} maxLength={phoneDigits} value={phoneNumber} onChange={event => { setPhoneNumber(event.target.value.replace(/\D/g, "").slice(0, phoneDigits)); setPhoneError(""); }} placeholder={phoneType === "fixed" ? "Ej. 602 123 4567" : "Ej. 300 123 4567"} aria-label="Número de teléfono sin indicativo" required /></div><small>Escribe solo los {phoneDigits} dígitos nacionales.</small>{phoneError && <em className="form-error">{phoneError}</em>}</label></section><section className="contact-input-card"><div className="contact-card-heading"><span className="contact-card-icon whatsapp" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3.2a8.8 8.8 0 0 0-7.63 13.2L3 21l4.78-1.34A8.8 8.8 0 1 0 12 3.2Zm0 15.9a7.06 7.06 0 0 1-3.6-.99l-.26-.16-2.84.8.81-2.76-.17-.28A7.07 7.07 0 1 1 12 19.1Zm3.88-5.3c-.21-.11-1.23-.61-1.42-.68-.19-.07-.33-.11-.47.11-.14.21-.54.68-.66.82-.12.14-.24.16-.45.05-.21-.11-.89-.33-1.69-1.05-.63-.56-1.05-1.25-1.17-1.46-.12-.21-.01-.33.09-.44.1-.1.21-.24.31-.36.1-.12.14-.21.21-.35.07-.14.04-.26-.02-.37-.05-.11-.47-1.13-.65-1.55-.17-.4-.34-.35-.47-.36h-.4c-.14 0-.37.05-.56.26-.19.21-.74.72-.74 1.76s.76 2.04.87 2.18c.11.14 1.5 2.29 3.64 3.21.51.22.91.35 1.22.45.51.16.98.14 1.35.08.41-.06 1.23-.5 1.4-.98.17-.48.17-.9.12-.98-.05-.09-.19-.14-.4-.25Z" /></svg></span><div><h3>WhatsApp</h3><small>Recibe mensajes directamente</small></div></div><label className="form-field"><span>País</span><select value={whatsappCountry} onChange={event => { const country = phoneCountries.find(item => item.code === event.target.value) ?? phoneCountries[0]; setWhatsappCountry(country.code); setWhatsappNumber(""); }} aria-label="País de WhatsApp">{phoneCountries.map(country => <option key={country.code} value={country.code}>{country.flag} {country.name} ({country.dialCode ?? country.code})</option>)}</select></label><label className="form-field"><span>Número nacional</span><div className="phone-number-input"><span>{selectedWhatsappCountry.dialCode ?? whatsappCountry}</span><input type="tel" inputMode="numeric" pattern={`[0-9]{${whatsappDigits}}`} minLength={whatsappDigits} maxLength={whatsappDigits} value={whatsappNumber} onChange={event => { setWhatsappNumber(event.target.value.replace(/\D/g, "").slice(0, whatsappDigits)); }} placeholder="Ej. 300 123 4567" aria-label="Número de WhatsApp sin indicativo" required /></div><small>Escribe los {whatsappDigits} dígitos permitidos para este país.</small></label></section></div></div>}
        {step === 4 && <div className="business-wizard-panel"><h2>Horarios de atención</h2><p>Configura cuándo está abierto tu negocio. Podrás cambiarlo después.</p><div className="wizard-hours">{days.map(day => <div key={day}><label><input type="checkbox" checked={hours[day].enabled} onChange={event => updateDay(day, "enabled", event.target.checked)} /> <strong>{day}</strong></label><input type="time" value={hours[day].open} disabled={!hours[day].enabled} onChange={event => updateDay(day, "open", event.target.value)} /><span>–</span><input type="time" value={hours[day].close} disabled={!hours[day].enabled} onChange={event => updateDay(day, "close", event.target.value)} /></div>)}</div><label className="form-field wizard-photos">Fotos del negocio <small>(solo imágenes, hasta 10)</small><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple onChange={selectPhotos} />{photoNames.length > 0 && <span>{photoNames.length} foto{photoNames.length === 1 ? " seleccionada" : "s seleccionadas"}</span>}</label>{photoPreviews.length > 0 && <><p className="photo-order-hint">Arrastra las imágenes para ordenar. La primera será la portada visible para las personas.</p><div className="photo-preview-grid">{photoPreviews.map((preview, index) => <div className={`photo-preview${index === 0 ? " is-cover" : ""}`} key={`${preview.slice(0, 20)}-${index}`} draggable onDragStart={() => setDraggedPhoto(index)} onDragOver={event => event.preventDefault()} onDrop={event => dropPhoto(index, event)}><img src={preview} alt={`Vista previa ${index + 1}`} /><span className="photo-preview-label">{index === 0 ? "Portada" : `Imagen ${index + 1}`}</span><div className="photo-preview-controls"><button type="button" aria-label={`Eliminar imagen ${index + 1}`} onClick={() => removePhoto(index)}>×</button></div></div>)}</div></>}</div>}
        {step === 5 && <div className="business-wizard-panel"><h2>Revisa la información</h2><p>Confirma que todo esté listo antes de crear tu tienda.</p><div className="wizard-review"><div><strong>{name || "Sin nombre"}</strong><span>{category || "Sin categoría"} · {city || "Sin ciudad"}</span></div><dl><div><dt>Descripción</dt><dd>{description || "Sin descripción"}</dd></div><div><dt>Ubicación</dt><dd>{locationValue || "Sin ubicación"}</dd></div><div><dt>Contacto</dt><dd>{phoneNumber ? `${selectedPhoneCountry.dialCode ?? phoneCountry} ${phoneNumber}` : "Sin teléfono"} · {whatsappNumber ? `${selectedWhatsappCountry.dialCode ?? whatsappCountry} ${whatsappNumber}` : "Sin WhatsApp"}</dd></div><div><dt>Horario</dt><dd>{hoursText}</dd></div><div><dt>Fotos</dt><dd>{photoNames.length ? `${photoNames.length} seleccionadas` : "Sin fotos todavía"}</dd></div></dl></div></div>}
        <div className="business-wizard-actions"><button className="outline-button" type="button" onClick={back}>{step === 1 ? "Cancelar" : "← Anterior"}</button><button className="action-button" type="submit">{step === 5 ? (isEditing ? "Guardar cambios" : "Crear mi tienda") : "Siguiente →"}</button></div>
        
      </form>
    </section>
  </>;
}
