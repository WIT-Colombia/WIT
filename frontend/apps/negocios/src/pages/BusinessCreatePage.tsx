import { useEffect, useState, type ChangeEvent, type FormEvent, type DragEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useParams } from "react-router-dom";
import { PageHeader } from "../components/common/PageHeader";
import { useBusinessStore } from "../services/businessStore";
import { businessCatalog, initialBusiness } from "../data/business.mock";
import type { BusinessDetails } from "../types/business";
import { getColombianAdministrativeDivisions } from "../../../usuario/src/services/administrativeDivisionService";
import { addBusinessInitialVisibilityPeriod } from "../services/visibilityPolicy";
import { businessApi, BusinessApiError, type ModalityType } from "../services/businessApiClient";
import { toBusinessDetails } from "../services/realBusinessAdapter";
import { phoneCountries } from "../components/common/PhoneNumberField";
import { BusinessLocationPicker } from "../components/BusinessLocationPicker";


const days = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const modalityOptions: Array<{ type: ModalityType; label: string; description: string }> = [
  { type: "PHYSICAL", label: "Físico", description: "Atiende clientes en un establecimiento." },
  { type: "VIRTUAL", label: "Virtual", description: "Ofrece productos o servicios por internet." },
  { type: "DELIVERY", label: "A domicilio", description: "Atiende clientes en su ubicación." },
];
type CategoryOption = { label: string; code: string };
type DayHours = { enabled: boolean; allDay: boolean; open: string; close: string };

const defaultHours = Object.fromEntries(days.map(day => [day, { enabled: day !== "Domingo", allDay: false, open: "08:00", close: "18:00" }])) as Record<string, DayHours>;
const locationCatalog = getColombianAdministrativeDivisions();
const fixedPrefixes: Record<string, string> = { "+57": "60", "+58": "2", "+593": "2", "+51": "1", "+34": "8" };
const dayAbbreviations: Record<string, string> = { Lun: "Lunes", Mar: "Martes", Mié: "Miércoles", Mie: "Miércoles", Jue: "Jueves", Vie: "Viernes", Sáb: "Sábado", Sab: "Sábado", Dom: "Domingo" };
const hoursFromText = (value: string) => {
  const parsed = Object.fromEntries(days.map(day => [day, { ...defaultHours[day] }])) as Record<string, DayHours>;
  if (!value.trim()) return Object.fromEntries(days.map(day => [day, { enabled: false, allDay: false, open: "08:00", close: "18:00" }])) as Record<string, DayHours>;
  value.split(" · ").filter(Boolean).forEach(part => {
    const match = part.match(/^(Lun|Mar|Mié|Mie|Jue|Vie|Sáb|Sab|Dom)\s+(24 horas|(\d{2}:\d{2})[–-](\d{2}:\d{2}))$/);
    if (!match) return;
    const day = dayAbbreviations[match[1]];
    if (day) parsed[day] = { enabled: true, allDay: match[2] === "24 horas", open: match[2] === "24 horas" ? "00:00" : match[3], close: match[2] === "24 horas" ? "23:59" : match[4] };
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
  const [maxStepReached, setMaxStepReached] = useState(1);
  const [selectedModalities, setSelectedModalities] = useState<ModalityType[]>(["PHYSICAL"]);
  const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>([]);
  const [categoryError, setCategoryError] = useState("");
  const [name, setName] = useState("Café Central");
  const [category, setCategory] = useState("Restaurantes");
  const [secondaryCategories, setSecondaryCategories] = useState<string[]>([]);
  const [description, setDescription] = useState("Arepas hechas al momento y sabores de casa para empezar bien el día.");
  const [departmentCode, setDepartmentCode] = useState("76");
  const [city, setCity] = useState("Palmira");
  const [address, setAddress] = useState("Calle 30 # 28-16, Palmira");
  const [additionalAddressInfo, setAdditionalAddressInfo] = useState("");
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [locationMode, setLocationMode] = useState<"address" | "map">("address");
  const initialPhone = splitPhone("+57");
  const [phoneCountry, setPhoneCountry] = useState(initialPhone.country);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneType, setPhoneType] = useState<"fixed" | "mobile">("mobile");
  const [phoneError, setPhoneError] = useState("");
  const [whatsappCountry, setWhatsappCountry] = useState(initialPhone.country);
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [instagram, setInstagram] = useState("");
  const [hours, setHours] = useState(defaultHours);
  const [photoNames, setPhotoNames] = useState<string[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [draggedPhoto, setDraggedPhoto] = useState<number | null>(null);
  const [coverImage, setCoverImage] = useState("");
  const [createdName, setCreatedName] = useState("");
  const [mapSelectionLabel, setMapSelectionLabel] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    businessApi.categories().then(response => {
      const options = response.categories.filter(item => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.code)).map(item => ({ label: item.translations[0]?.name ?? item.code, code: item.code }));
      setCategoryOptions(options);
      setCategory(current => options.some(item => item.label === current) ? current : options[0]?.label ?? "");
      setSecondaryCategories(current => current.filter(value => options.some(item => item.label === value)));
      setCategoryError(options.length ? "" : "No hay categorías activas disponibles. Solicita la carga del catálogo antes de crear el negocio.");
    }).catch(() => setCategoryError("No se pudieron cargar las categorías reales. Revisa la conexión e inténtalo nuevamente."));
  }, []);
  const municipalities = locationCatalog.municipalities.filter(item => item.departmentCode === departmentCode);
  const departmentName = locationCatalog.departments.find(item => item.code === departmentCode)?.name ?? "Colombia";
  const locationValue = locationMode === "map" ? (coordinates ? (mapSelectionLabel || `Ubicación seleccionada en mapa · ${city}, ${departmentName}`) : address.trim()) : address.trim();
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
    setName(editingBusiness.name); setCategory(editingBusiness.category); setSecondaryCategories((editingBusiness.secondaryCategories ?? []).filter(item => item !== editingBusiness.category)); setDescription(editingBusiness.description);
    const municipality = locationCatalog.municipalities.find(item => item.name === editingBusiness.city);
    const parsedPhone = splitPhone(editingBusiness.phone); const parsedWhatsapp = splitPhone(editingBusiness.whatsapp || editingBusiness.phone);
    setDepartmentCode(municipality?.departmentCode ?? "76"); setCity(editingBusiness.city); setAddress(editingBusiness.address); setCoordinates(editingBusiness.latitude != null && editingBusiness.longitude != null ? { lat: editingBusiness.latitude, lng: editingBusiness.longitude } : null); setAdditionalAddressInfo(editingBusiness.additionalAddressInfo ?? ""); setPhoneCountry(parsedPhone.country); setPhoneNumber(parsedPhone.number); setPhoneType(parsedPhone.number.startsWith("3") ? "mobile" : "fixed"); setWhatsappCountry(parsedWhatsapp.country); setWhatsappNumber(parsedWhatsapp.number);
    setLocationMode("address"); setMapSelectionLabel(""); setHours(hoursFromText(editingBusiness.hours)); setCoverImage(editingBusiness.coverImage ?? ""); setPhotoPreviews(editingBusiness.images?.length ? editingBusiness.images : (editingBusiness.coverImage ? [editingBusiness.coverImage] : [])); setPhotoNames(editingBusiness.images?.length ? editingBusiness.images.map((_, index) => `Imagen ${index + 1}`) : (editingBusiness.coverImage ? ["Imagen actual"] : []));
  }, [editingBusiness, setBusiness]);
  const updateDay = (day: string, field: keyof DayHours, value: boolean | string) => setHours(current => ({ ...current, [day]: { ...current[day], [field]: value } }));
  const selectPhotos = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).slice(0, 10);
    setPhotoNames(files.map(file => file.name));
    Promise.all(files.map(file => new Promise<string>(resolve => { const reader = new FileReader(); reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : ""); reader.readAsDataURL(file); }))).then(previews => { const valid = previews.filter(Boolean); setPhotoPreviews(valid); setCoverImage(valid[0] ?? ""); });
  };
  const removePhoto = (index: number) => { const next = photoPreviews.filter((_, photoIndex) => photoIndex !== index); setPhotoPreviews(next); setPhotoNames(names => names.filter((_, photoIndex) => photoIndex !== index)); setCoverImage(next[0] ?? ""); };
  const dropPhoto = (target: number, event: DragEvent<HTMLDivElement>) => { event.preventDefault(); if (draggedPhoto === null || draggedPhoto === target) return; const previews = [...photoPreviews]; const names = [...photoNames]; const [preview] = previews.splice(draggedPhoto, 1); const [name] = names.splice(draggedPhoto, 1); previews.splice(target, 0, preview); names.splice(target, 0, name); setPhotoPreviews(previews); setPhotoNames(names); setCoverImage(previews[0] ?? ""); setDraggedPhoto(null); };
  const hoursText = days.filter(day => hours[day].enabled).map(day => `${day.slice(0, 3)} ${hours[day].allDay ? "24 horas" : `${hours[day].open}–${hours[day].close}`}`).join(" · ") || "Cerrado todos los días";
  const validateContactRequirements = () => {
    const requiresContact = selectedModalities.includes("DELIVERY") || selectedModalities.includes("VIRTUAL");
    if (requiresContact && !phoneNumber && !whatsappNumber && !instagram.trim()) {
      setSubmitError("Las modalidades A domicilio y Virtual requieren al menos un dato de contacto.");
      return false;
    }
    setSubmitError("");
    return true;
  };
  const create = async (event: FormEvent) => {
    event.preventDefault();
    if (step === 4 || step === 6) {
      const fixedPrefix = phoneType === "fixed" ? fixedPrefixes[phoneCountry] : undefined;
      if (phoneNumber && phoneNumber.length !== phoneDigits) { setPhoneError(`Escribe los ${phoneDigits} dígitos del número.`); return; }
      if (phoneNumber && fixedPrefix && !phoneNumber.startsWith(fixedPrefix)) { setPhoneError(`Para ${selectedPhoneCountry.name}, un teléfono fijo debe comenzar por ${fixedPrefix}.`); return; }
      setPhoneError("");
      if (!validateContactRequirements()) return;
    }
    if (step === 2 && selectedModalities.length === 0) { setSubmitError("Selecciona al menos una modalidad para continuar."); return; }
    if (step < 6) { setStep(current => current + 1); setMaxStepReached(current => Math.max(current, step + 1)); return; }
    setSubmitError("");
    const primaryCategoryCode = categoryOptions.find(item => item.label === category)?.code;
    if (!primaryCategoryCode) { setSubmitError(categoryError || "Selecciona una categoría disponible."); return; }
    setSaving(true);
    const modalityHours = days.map((day, dayOfWeek) => ({ dayOfWeek: (dayOfWeek + 1) % 7, isClosed: !hours[day].enabled, opensAt: hours[day].enabled ? (hours[day].allDay ? "00:00" : hours[day].open) : null, closesAt: hours[day].enabled ? (hours[day].allDay ? "23:59" : hours[day].close) : null, timezone: "America/Bogota" }));
    const modalityContact = { phone: phoneNumber ? `${selectedPhoneCountry.dialCode ?? phoneCountry} ${phoneNumber}` : null, whatsapp: whatsappNumber ? `${selectedWhatsappCountry.dialCode ?? whatsappCountry} ${whatsappNumber}` : null };
    const needsCity = selectedModalities.includes("PHYSICAL") || selectedModalities.includes("DELIVERY") || selectedModalities.includes("VIRTUAL");
    const payload = { name: name.trim(), categoryCode: primaryCategoryCode, secondaryCategoryCodes: secondaryCategories.filter(item => item !== category).map(item => categoryOptions.find(option => option.label === item)?.code).filter((item): item is string => Boolean(item)), description: description.trim(), modalityTypes: selectedModalities, modalityConfigurations: selectedModalities.map(type => ({ type, contact: modalityContact, hours: modalityHours })), locationVisibility: selectedModalities.includes("PHYSICAL") && Boolean(locationValue.trim()) ? "PUBLIC" as const : "PRIVATE" as const, cityName: needsCity ? city.trim() || null : null, regionCode: needsCity && city.trim() ? departmentCode : null, regionName: needsCity && city.trim() ? departmentName : null, countryCode: "CO", instagram: instagram.trim() || null, address: selectedModalities.includes("PHYSICAL") ? locationValue.trim() || null : null, additionalAddressInfo: selectedModalities.includes("PHYSICAL") ? additionalAddressInfo.trim() || null : null, latitude: selectedModalities.includes("PHYSICAL") ? coordinates?.lat ?? null : null, longitude: selectedModalities.includes("PHYSICAL") ? coordinates?.lng ?? null : null, phone: phoneNumber ? `${selectedPhoneCountry.dialCode ?? phoneCountry} ${phoneNumber}` : null, whatsapp: whatsappNumber ? `${selectedWhatsappCountry.dialCode ?? whatsappCountry} ${whatsappNumber}` : null };
    const { modalityTypes: _modalityTypes, modalityConfigurations: _modalityConfigurations, locationVisibility: _locationVisibility, ...updatePayload } = payload;
    try {
      const response = editingBusiness?.id ? await businessApi.update(editingBusiness.id, updatePayload) : await businessApi.create(payload);
      const item = toBusinessDetails(response.business);
      setBusinesses(editingBusiness ? businesses.map(existing => existing === editingBusiness ? item : existing) : [...businesses, item]);
      setBusiness(item);
      if (!editingBusiness) setCreatedName(item.name);
      else navigate(`/mi-negocio/detalle/${businesses.indexOf(editingBusiness)}`);
    } catch (cause) {
      setSubmitError(cause instanceof BusinessApiError ? cause.message : "No se pudo guardar el negocio.");
    } finally { setSaving(false); }
    if (saving) return;
    if (editingBusiness?.id || !editingBusiness) return;
    const item: BusinessDetails = { ...(editingBusiness ?? initialBusiness), role: editingBusiness?.role ?? "Propietario", name: name.trim(), category, description: description.trim(), city: city.trim(), address: locationValue, additionalAddressInfo: additionalAddressInfo.trim(), phone: phoneNumber ? `${selectedPhoneCountry.dialCode ?? phoneCountry} ${phoneNumber}` : "", whatsapp: whatsappNumber ? `${selectedWhatsappCountry.dialCode ?? whatsappCountry} ${whatsappNumber}` : "", email: "", website: "", instagram: instagram.trim(), hours: hoursText, coverImage, images: photoPreviews, status: editingBusiness?.status ?? "Pendiente", isNew: editingBusiness?.isNew ?? true, catalog: editingBusiness?.catalog ?? (editingBusiness ? businessCatalog[editingBusiness.name] ?? [] : []) };
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
    <PageHeader eyebrow={isEditing ? "EDITAR NEGOCIO" : "NUEVO NEGOCIO"} title={isEditing ? "Edita tu tienda en XAMUKO" : "Crea tu tienda en XAMUKO"} description={isEditing ? "Actualiza la información de tu negocio." : "Completa la información para que las personas encuentren tu negocio."} />
    <section className="business-create-wizard surface-card">
      <div className="business-wizard-steps" aria-label="Progreso del registro">{["Datos básicos", "Modalidades", "Ubicación", "Contacto", "Horarios", "Revisar y publicar"].map((label, index) => { const visited = index + 1 <= maxStepReached; const completed = index + 1 < step || index + 1 < maxStepReached; return <button className={`${step === index + 1 ? "active" : completed ? "completed" : ""}${visited ? " clickable" : ""}`} key={label} type="button" disabled={!visited} onClick={() => { if (visited) setStep(index + 1); }} aria-label={visited ? `Ir a ${label}` : label}><span>{completed ? "✓" : index + 1}</span><small>{label}</small></button>; })}</div>
      <form onSubmit={create}>
        {step === 1 && <div className="business-wizard-panel"><h2>Comencemos con los datos básicos</h2><p>Esta información será visible para las personas que encuentren tu negocio en XAMUKO.</p><label className="form-field">Nombre comercial<input value={name} onFocus={event => event.currentTarget.select()} onChange={event => setName(event.target.value)} required placeholder="Ej. La Arepería de Majo" /></label><label className="form-field">Categoría principal<select value={category} onChange={event => { const next = event.target.value; setCategory(next); setSecondaryCategories(current => current.filter(item => item !== next)); }} required><option value="">Selecciona una categoría</option>{categoryOptions.map(item => <option key={item.code} value={item.label}>{item.label}</option>)}</select><small>Elige la categoría que mejor representa tu negocio.</small>{categoryError && <em className="form-error" role="alert">{categoryError}</em>}</label><fieldset className="form-field category-secondary-field"><legend>Categorías secundarias <small>(opcional)</small></legend><div className="category-secondary-grid">{categoryOptions.filter(item => item.label !== category).map(item => <label className={`category-secondary-option${secondaryCategories.includes(item.label) ? " selected" : ""}`} key={item.code}><input type="checkbox" checked={secondaryCategories.includes(item.label)} onChange={() => setSecondaryCategories(current => current.includes(item.label) ? current.filter(value => value !== item.label) : [...current, item.label])} /><span>{item.label}</span></label>)}</div><small className="category-secondary-count">{secondaryCategories.length ? `${secondaryCategories.length} seleccionada${secondaryCategories.length === 1 ? "" : "s"}` : "Ninguna seleccionada"}</small></fieldset><label className="form-field full-field">Descripción corta<textarea value={description} onFocus={event => event.currentTarget.select()} onChange={event => setDescription(event.target.value)} required maxLength={300} rows={4} placeholder="Cuéntales brevemente qué ofrece tu negocio." /><small>{description.length}/300</small></label></div>}
        {step === 2 && <div className="business-wizard-panel"><h2>¿Cómo atenderás a tus clientes?</h2><p>Selecciona una o varias modalidades. Ninguna es principal y todas quedarán en configuración para completarlas después.</p><div className="business-modality-selection" role="group" aria-label="Modalidades del negocio">{modalityOptions.map(option => { const checked = selectedModalities.includes(option.type); return <label className={`business-modality-choice${checked ? " selected" : ""}`} key={option.type}><input type="checkbox" checked={checked} onChange={() => setSelectedModalities(current => checked ? current.filter(item => item !== option.type) : [...current, option.type])} /><span><strong>{option.label}</strong><small>{option.description}</small></span></label>; })}</div></div>}
        {step === 3 && <div className="business-wizard-panel"><h2>¿Dónde está tu negocio?</h2><p>Los negocios virtuales y A domicilio requieren ciudad; los físicos requieren además una dirección escrita o seleccionada en el mapa.</p><label className="form-field">Departamento<select value={departmentCode} onChange={event => { setDepartmentCode(event.target.value); setCity("");  setMapSelectionLabel(""); }} required={selectedModalities.includes("PHYSICAL") || selectedModalities.includes("DELIVERY") || selectedModalities.includes("VIRTUAL")}><option value="">Selecciona un departamento</option>{locationCatalog.departments.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}</select></label><label className="form-field">Ciudad o municipio<select value={city} onChange={event => { setCity(event.target.value);  setMapSelectionLabel(""); }} required={selectedModalities.includes("PHYSICAL") || selectedModalities.includes("DELIVERY") || selectedModalities.includes("VIRTUAL")} disabled={!departmentCode}><option value="">Selecciona una ciudad o municipio</option>{municipalities.map(item => <option key={item.id} value={item.name}>{item.name}</option>)}</select></label><div className="location-mode-toggle" role="group" aria-label="Forma de indicar la ubicación"><button type="button" className={locationMode === "address" ? "active" : ""} onClick={() => setLocationMode("address")}>Escribir dirección</button><button type="button" className={locationMode === "map" ? "active" : ""} onClick={() => setLocationMode("map")}>Elegir en el mapa</button></div>{locationMode === "address" ? <label className="form-field">Dirección<input value={address} onChange={event => { setAddress(event.target.value);  }} required={selectedModalities.includes("PHYSICAL")} placeholder="Calle, carrera y número" /></label> : <><BusinessLocationPicker value={coordinates} query={[address, city, departmentName].filter(Boolean).join(", ")} onChange={value => { const label = `Ubicación seleccionada en ${city}, ${departmentName}`; setCoordinates(value); setAddress(current => current.trim() || label); setMapSelectionLabel(label); }} /><label className="form-field"><span>Dirección</span><input value={address} onChange={event => setAddress(event.target.value)} required={selectedModalities.includes("PHYSICAL")} placeholder="Calle, carrera y número" /></label><p className="wizard-map-selection" role="status">{mapSelectionLabel || `Selecciona un punto en ${city}, ${departmentName}`}</p></>}{selectedModalities.includes("PHYSICAL") && <label className="form-field"><span>Información adicional de la dirección (opcional)</span><input value={additionalAddressInfo} maxLength={200} onChange={event => setAdditionalAddressInfo(event.target.value)} placeholder="Ej. Centro Comercial La Nube, local 204" /></label>}</div>}
        {step === 4 && <div className="business-wizard-panel contact-wizard-panel"><div className="contact-wizard-heading"><div><h2>Información de contacto</h2><p>Agrega los canales que las personas usarán para comunicarse con tu negocio.</p></div></div><div className="contact-wizard-grid"><section className="contact-input-card"><div className="contact-card-heading"><span className="contact-card-icon phone">☎</span><div><h3>Teléfono</h3><small>¿Dónde pueden llamarte?</small></div></div><label className="form-field"><span>Tipo de línea</span><select value={phoneType} onChange={event => { setPhoneType(event.target.value as "fixed" | "mobile"); setPhoneNumber(""); setPhoneError(""); }} aria-label="Tipo de teléfono"><option value="fixed">Teléfono fijo</option><option value="mobile">Celular</option></select></label><label className="form-field"><span>País</span><select value={phoneCountry} onChange={event => { const country = phoneCountries.find(item => item.code === event.target.value) ?? phoneCountries[0]; setPhoneCountry(country.code); setPhoneNumber(""); setPhoneError(""); }} aria-label="País del teléfono">{phoneCountries.map(country => <option key={country.code} value={country.code}>{country.flag} {country.name} ({country.dialCode ?? country.code})</option>)}</select></label><label className="form-field"><span>Número nacional</span><div className="phone-number-input"><span>{selectedPhoneCountry.dialCode ?? phoneCountry}</span><input type="tel" inputMode="numeric" pattern={`[0-9]{${phoneDigits}}`} maxLength={phoneDigits} value={phoneNumber} onChange={event => { setPhoneNumber(event.target.value.replace(/\D/g, "").slice(0, phoneDigits)); setPhoneError(""); }} placeholder={phoneType === "fixed" ? "Ej. 602 123 4567" : "Ej. 300 123 4567"} aria-label="Número de teléfono sin indicativo" /></div><small>Escribe solo los {phoneDigits} dígitos nacionales.</small>{phoneError && <em className="form-error">{phoneError}</em>}</label></section><section className="contact-input-card"><div className="contact-card-heading"><span className="contact-card-icon whatsapp" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3.2a8.8 8.8 0 0 0-7.63 13.2L3 21l4.78-1.34A8.8 8.8 0 1 0 12 3.2Zm0 15.9a7.06 7.06 0 0 1-3.6-.99l-.26-.16-2.84.8.81-2.76-.17-.28A7.07 7.07 0 1 1 12 19.1Zm3.88-5.3c-.21-.11-1.23-.61-1.42-.68-.19-.07-.33-.11-.47.11-.14.21-.54.68-.66.82-.12.14-.24.16-.45.05-.21-.11-.89-.33-1.69-1.05-.63-.56-1.05-1.25-1.17-1.46-.12-.21-.01-.33.09-.44.1-.1.21-.24.31-.36.1-.12.14-.21.21-.35.07-.14.04-.26-.02-.37-.05-.11-.47-1.13-.65-1.55-.17-.4-.34-.35-.47-.36h-.4c-.14 0-.37.05-.56.26-.19.21-.74.72-.74 1.76s.76 2.04.87 2.18c.11.14 1.5 2.29 3.64 3.21.51.22.91.35 1.22.45.51.16.98.14 1.35.08.41-.06 1.23-.5 1.4-.98.17-.48.17-.9.12-.98-.05-.09-.19-.14-.4-.25Z" /></svg></span><div><h3>WhatsApp</h3><small>Recibe mensajes directamente</small></div></div><label className="form-field"><span>País</span><select value={whatsappCountry} onChange={event => { const country = phoneCountries.find(item => item.code === event.target.value) ?? phoneCountries[0]; setWhatsappCountry(country.code); setWhatsappNumber(""); }} aria-label="País de WhatsApp">{phoneCountries.map(country => <option key={country.code} value={country.code}>{country.flag} {country.name} ({country.dialCode ?? country.code})</option>)}</select></label><label className="form-field"><span>Número nacional</span><div className="phone-number-input"><span>{selectedWhatsappCountry.dialCode ?? whatsappCountry}</span><input type="tel" inputMode="numeric" pattern={`[0-9]{${whatsappDigits}}`} minLength={whatsappDigits} maxLength={whatsappDigits} value={whatsappNumber} onChange={event => { setWhatsappNumber(event.target.value.replace(/\D/g, "").slice(0, whatsappDigits)); }} placeholder="Ej. 300 123 4567" aria-label="Número de WhatsApp sin indicativo" /></div><small>Escribe los {whatsappDigits} dígitos permitidos para este país.</small></label></section><label className="form-field full-field">Instagram u otro canal digital <input type="url" value={instagram} onChange={event => setInstagram(event.target.value)} placeholder="https://instagram.com/tu-negocio" /></label></div></div>}
        {step === 5 && <div className="business-wizard-panel"><h2>Horarios de atención</h2><p>Configura cuándo está abierto tu negocio. Puedes marcar un día como 24 horas y dejar otros días cerrados, como el domingo.</p><div className="wizard-hours">{days.map(day => <div key={day}><label><input type="checkbox" checked={hours[day].enabled} onChange={event => updateDay(day, "enabled", event.target.checked)} /> <strong>{day}</strong></label><label><input type="checkbox" checked={hours[day].allDay} disabled={!hours[day].enabled} onChange={event => { const allDay = event.target.checked; setHours(current => ({ ...current, [day]: { ...current[day], allDay, open: allDay ? "00:00" : current[day].open, close: allDay ? "23:59" : current[day].close } })); }} /> 24 horas</label><input type="time" value={hours[day].open} disabled={!hours[day].enabled || hours[day].allDay} onChange={event => updateDay(day, "open", event.target.value)} /><span>–</span><input type="time" value={hours[day].close} disabled={!hours[day].enabled || hours[day].allDay} onChange={event => updateDay(day, "close", event.target.value)} /></div>)}</div><label className="form-field wizard-photos">Fotos del negocio <small>(solo imágenes, hasta 10)</small><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple onChange={selectPhotos} />{photoNames.length > 0 && <span>{photoNames.length} foto{photoNames.length === 1 ? " seleccionada" : "s seleccionadas"}</span>}</label>{photoPreviews.length > 0 && <><p className="photo-order-hint">Arrastra las imágenes para ordenar. La primera será la portada visible para las personas.</p><div className="photo-preview-grid">{photoPreviews.map((preview, index) => <div className={`photo-preview${index === 0 ? " is-cover" : ""}`} key={`${preview.slice(0, 20)}-${index}`} draggable onDragStart={() => setDraggedPhoto(index)} onDragOver={event => event.preventDefault()} onDrop={event => dropPhoto(index, event)}><img src={preview} alt={`Vista previa ${index + 1}`} /><span className="photo-preview-label">{index === 0 ? "Portada" : `Imagen ${index + 1}`}</span><div className="photo-preview-controls"><button type="button" aria-label={`Eliminar imagen ${index + 1}`} onClick={() => removePhoto(index)}>×</button></div></div>)}</div></>}</div>}
        {step === 6 && <div className="business-wizard-panel"><h2>Revisa la información</h2><p>Confirma que todo esté listo antes de crear tu tienda.</p><div className="wizard-review"><div><strong>{name || "Sin nombre"}</strong><span>{category || "Sin categoría"}{secondaryCategories.length ? ` · ${secondaryCategories.join(" · ")}` : ""} · {city || "Sin ciudad"}</span></div><dl><div><dt>Modalidades</dt><dd>{selectedModalities.map(type => modalityOptions.find(option => option.type === type)?.label).join(", ") || "Sin modalidades"} · quedarán en configuración</dd></div><div><dt>Descripción</dt><dd>{description || "Sin descripción"}</dd></div><div><dt>Ubicación</dt><dd>{locationValue || "Sin ubicación pública"}{additionalAddressInfo.trim() ? ` · ${additionalAddressInfo.trim()}` : ""}</dd></div><div><dt>Contacto</dt><dd>{phoneNumber ? `${selectedPhoneCountry.dialCode ?? phoneCountry} ${phoneNumber}` : "Sin teléfono"} · {whatsappNumber ? `${selectedWhatsappCountry.dialCode ?? whatsappCountry} ${whatsappNumber}` : "Sin WhatsApp"}</dd></div><div><dt>Horario</dt><dd>{hoursText}</dd></div><div><dt>Fotos</dt><dd>{photoNames.length ? `${photoNames.length} seleccionadas` : "Sin fotos todavía"}</dd></div></dl></div></div>}
        {submitError && <p className="form-error" role="alert">{submitError}</p>}<div className="business-wizard-actions"><button className="outline-button" type="button" onClick={back} disabled={saving}>{step === 1 ? "Cancelar" : "← Anterior"}</button><button className="action-button" type="submit" disabled={saving}>{saving ? "Guardando…" : step === 6 ? (isEditing ? "Guardar cambios" : "Crear mi tienda") : "Siguiente →"}</button></div>
        
      </form>
    </section>
  </>;
}
