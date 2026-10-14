import { useEffect, useRef, useState, type FormEvent, type ChangeEvent } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useBusinessStore } from "../services/businessStore";
import { getColombianAdministrativeDivisions } from "../../../usuario/src/services/administrativeDivisionService";
import { addBusinessRecoveryPeriod, BUSINESS_RECOVERY_DAYS } from "../services/visibilityPolicy";
import type { BusinessNotification, BusinessDetails } from "../types/business";
import { businessApi, BusinessApiError, type ModalityType, type RealModality } from "../services/businessApiClient";
import { categoryCodeFromLabel, toBusinessDetails } from "../services/realBusinessAdapter";
import { PhoneNumberField, phoneCountryFor, splitInternationalPhone, type PhoneCountryCode } from "../components/common/PhoneNumberField";
import { BusinessLocationPicker } from "../components/BusinessLocationPicker";

const categories = ["Restaurantes", "Droguerías", "Ferreterías", "Talleres", "Barberías", "Tecnología", "Cafeterías", "Panaderías y reposterías", "Supermercados y tiendas", "Frutas y verduras", "Carnicerías y pescaderías", "Salud y bienestar", "Clínicas y consultorios", "Ópticas", "Peluquerías y belleza", "Ropa y calzado", "Hogar y decoración", "Construcción y remodelación", "Repuestos y accesorios", "Lavanderías y tintorerías", "Mascotas y veterinarias", "Papelerías y librerías", "Educación y cursos", "Deportes y recreación", "Transporte y movilidad", "Servicios para el hogar", "Servicios técnicos", "Servicios profesionales", "Floristerías y regalos", "Hoteles y turismo", "Eventos y entretenimiento", "Belleza y cuidado personal", "Otros"];
const locationCatalog = getColombianAdministrativeDivisions();
const dayNames: Record<string, string> = { Lun: "Lunes", Mar: "Martes", Mié: "Miércoles", Jue: "Jueves", Vie: "Viernes", Sáb: "Sábado", Dom: "Domingo" };
const scheduleDays = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"] as const;
type ScheduleDay = { enabled: boolean; allDay: boolean; open: string; close: string };
const defaultSchedule: Record<string, ScheduleDay> = Object.fromEntries(scheduleDays.map(day => [day, { enabled: false, allDay: false, open: "08:00", close: "18:00" }])) as Record<string, ScheduleDay>;
const scheduleFromText = (value: string) => {
  const result = Object.fromEntries(scheduleDays.map(day => [day, { ...defaultSchedule[day] }])) as Record<string, ScheduleDay>;
  value.split(" · ").filter(Boolean).forEach(part => { const match = part.match(/^(.{3})\s+(24 horas|([0-9]{2}:[0-9]{2})[–-]([0-9]{2}:[0-9]{2}))$/); if (!match) return; const day = dayNames[match[1]]; if (!day) return; result[day] = { enabled: true, allDay: match[2] === "24 horas", open: match[3] ?? "00:00", close: match[4] ?? "23:59" }; });
  return result;
};
const scheduleToText = (value: Record<string, ScheduleDay>) => scheduleDays.filter(day => value[day].enabled).map(day => `${day.slice(0, 3)} ${value[day].allDay ? "24 horas" : `${value[day].open}–${value[day].close}`}`).join(" · ") || "Cerrado todos los días";
const normalizeWebsite = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    if (!/^https?:$/.test(parsed.protocol) || !parsed.hostname || /\s/.test(trimmed) || (!parsed.hostname.includes(".") && parsed.hostname !== "localhost")) return null;
    return candidate;
  } catch {
    return null;
  }
};
const normalizeInstagram = (value: string) => {
  const trimmed = value.trim().replace(/^@/, "");
  if (!trimmed) return "";
  const withoutProtocol = trimmed.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  const match = withoutProtocol.match(/^instagram\.com\/([A-Za-z0-9._]+)\/?(?:[?#].*)?$/i) ?? withoutProtocol.match(/^([A-Za-z0-9._]+)$/);
  const username = match?.[1] ?? "";
  if (!username || username.length > 30 || !/^[A-Za-z0-9._]+$/.test(username) || username.startsWith(".") || username.endsWith(".")) return null;
  return `https://instagram.com/${username}`;
};
const formatHour = (value: string) => { const [hour, minute] = value.split(":").map(Number); if (!Number.isFinite(hour)) return value; const suffix = hour >= 12 ? "p. m." : "a. m."; const displayHour = hour % 12 || 12; return `${displayHour}:${String(minute).padStart(2, "0")} ${suffix}`; };
const parseBusinessHours = (value: string) => value.split(" · ").filter(Boolean).map(part => { const match = part.match(/^(.{3})\s+(\d{2}:\d{2})[–-](\d{2}:\d{2})$/); return match ? [dayNames[match[1]] ?? match[1], `${formatHour(match[2])} – ${formatHour(match[3])}`] : null; }).filter((item): item is string[] => Boolean(item));
const nicknamePattern = /^@?[a-zA-Z0-9._-]{3,30}$/;
const modalityTypes: ModalityType[] = ["PHYSICAL", "VIRTUAL", "DELIVERY"];
const modalityLabels: Record<ModalityType, string> = { PHYSICAL: "Física", VIRTUAL: "Virtual", DELIVERY: "A domicilio" };
const sectionLabels: Record<Exclude<EditableSection, null>, string> = { general: "la información comercial", description: "la descripción", location: "la ubicación", contact: "el contacto", hours: "el horario" };
const categoryLabel = (value: string) => categories.find(item => categoryCodeFromLabel(item) === categoryCodeFromLabel(value)) ?? value;
const StaticLocationPreview = ({ business }: { business: BusinessDetails }) => {
  if (business.latitude == null || business.longitude == null || business.locationVisibility !== "PUBLIC") return null;
  const query = `${business.latitude},${business.longitude}`;
  const key = import.meta.env.VITE_GOOGLE_MAPS_STATIC_API_KEY?.trim();
  const [staticMapFailed, setStaticMapFailed] = useState(false);
  return <div className="business-detail-static-map"><div className="business-detail-static-map__frame">{key && !staticMapFailed ? <img src={`https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(query)}&zoom=16&size=640x240&scale=2&maptype=satellite&markers=color:red%7C${encodeURIComponent(query)}&key=${encodeURIComponent(key)}`} alt={`Mapa de ${business.name}`} loading="lazy" onError={() => setStaticMapFailed(true)} /> : <span>Vista previa no disponible.</span>}</div></div>;
};
type EditableSection = "general" | "description" | "location" | "contact" | "hours" | null;

export function BusinessDetailPage() {
  const { index = "0" } = useParams();
  const navigate = useNavigate();
  const { businesses, setBusinesses, setBusiness, account, notifications, setNotifications } = useBusinessStore();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingRecovery, setConfirmingRecovery] = useState(false);
  const [showCollaboratorForm, setShowCollaboratorForm] = useState(false);
  const [confirmingCollaboratorRemoval, setConfirmingCollaboratorRemoval] = useState<string | null>(null);
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const [activeInviteField, setActiveInviteField] = useState<"nickname" | "email" | null>(null);
  const [nicknameError, setNicknameError] = useState("");
  const [collaboratorNickname, setCollaboratorNickname] = useState("");
  const [collaboratorEmail, setCollaboratorEmail] = useState("");
  const [editing, setEditing] = useState(false);
  const [editDepartment, setEditDepartment] = useState("76");
  const [editLocationMode, setEditLocationMode] = useState<"address" | "map">("address");
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingSection, setEditingSection] = useState<EditableSection>(null);
  const [sectionSaving, setSectionSaving] = useState<EditableSection>(null);
  const [sectionError, setSectionError] = useState("");
  const [sectionNotice, setSectionNotice] = useState("");
  const [sectionConfirmation, setSectionConfirmation] = useState<{ section: Exclude<EditableSection, null>; details: Partial<Record<ModalityType, string[]>> } | null>(null);
  const confirmationCancelRef = useRef<HTMLButtonElement>(null);
  const confirmationReturnFocusRef = useRef<HTMLElement | null>(null);
  const [phoneCountry, setPhoneCountry] = useState<PhoneCountryCode>("+57");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneLineType, setPhoneLineType] = useState<"fixed" | "mobile">("mobile");
  const [whatsappCountry, setWhatsappCountry] = useState<PhoneCountryCode>("+57");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [editHours, setEditHours] = useState<Record<string, ScheduleDay>>(defaultSchedule);
  const [modalities, setModalities] = useState<RealModality[]>([]);
  const [modalitiesLoading, setModalitiesLoading] = useState(false);
  const [modalitiesError, setModalitiesError] = useState("");
  const [modalityBusy, setModalityBusy] = useState<string | null>(null);
  const [modalityConfirmation, setModalityConfirmation] = useState<ModalityType | null>(null);
  const [modalityConfirmationError, setModalityConfirmationError] = useState("");
  const modalityConfirmationCancelRef = useRef<HTMLButtonElement>(null);
  const businessIndex = Number(index);
  const hasValidBusiness = Number.isInteger(businessIndex) && businessIndex >= 0 && businessIndex < businesses.length;
  const business = businesses[businessIndex] ?? businesses[0];
  const [draft, setDraft] = useState(business);
  const [draftSecondaryCategories, setDraftSecondaryCategories] = useState<string[]>(business?.secondaryCategories ?? []);
  useEffect(() => {
    if (!business) return;
    setBusiness(business);
    setDraft(business);
    setDraftSecondaryCategories(business.secondaryCategories ?? []);
    const parsedPhone = splitInternationalPhone(business.phone);
    const parsedWhatsapp = splitInternationalPhone(business.whatsapp);
    setPhoneCountry(parsedPhone.country);
    setPhoneNumber(parsedPhone.number);
    setPhoneLineType(parsedPhone.number.startsWith("3") ? "mobile" : "fixed");
    setWhatsappCountry(parsedWhatsapp.country);
    setWhatsappNumber(parsedWhatsapp.number);
    setEditHours(scheduleFromText(business.hours));
    setGalleryIndex(0);
    setConfirmingDelete(false);
    setConfirmingRecovery(false);
    setShowCollaboratorForm(false);
    setConfirmingCollaboratorRemoval(null);
    setConfirmingLeave(false);
  }, [business, setBusiness]);
  useEffect(() => {
    if (!business?.id) return;
    let cancelled = false;
    setModalitiesLoading(true);
    setModalitiesError("");
    businessApi.listModalities(business.id).then(response => {
      if (!cancelled) setModalities(response.modalities);
    }).catch(cause => {
      if (!cancelled) setModalitiesError(cause instanceof BusinessApiError ? cause.message : "No se pudieron cargar las modalidades.");
    }).finally(() => { if (!cancelled) setModalitiesLoading(false); });
    return () => { cancelled = true; };
  }, [business?.id]);
  useEffect(() => {
    if (!sectionConfirmation) return;
    confirmationReturnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusFrame = window.requestAnimationFrame(() => confirmationCancelRef.current?.focus({ preventScroll: true }));
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setSectionConfirmation(null);
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleEscape);
      confirmationReturnFocusRef.current?.focus({ preventScroll: true });
      confirmationReturnFocusRef.current = null;
    };
  }, [sectionConfirmation]);
  useEffect(() => {
    if (!modalityConfirmation) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusFrame = window.requestAnimationFrame(() => modalityConfirmationCancelRef.current?.focus({ preventScroll: true }));
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setModalityConfirmation(null);
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleEscape);
      previous?.focus({ preventScroll: true });
    };
  }, [modalityConfirmation]);
  useEffect(() => {
    if (!editingSection) return;
    const frame = window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(`[data-business-section="${editingSection}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [editingSection]);
  if (!hasValidBusiness || !business) return <Navigate to="/mis-negocios" replace />;
  const weeklyHours = parseBusinessHours(business.hours).length ? parseBusinessHours(business.hours) : [["Lunes", "Sin horario configurado"], ["Martes", "Sin horario configurado"], ["Miércoles", "Sin horario configurado"], ["Jueves", "Sin horario configurado"], ["Viernes", "Sin horario configurado"], ["Sábado", "Sin horario configurado"], ["Domingo", "Sin horario configurado"]];
  const activeModalities = modalityTypes.filter(type => modalities.some(item => item.type === type && item.status === "ACTIVE")).map(type => modalityLabels[type]);
  const incompleteActiveModalities = modalities.filter(item => item.status === "ACTIVE" && (item.blockers?.length ?? 0) > 0);
  const setAsProfilePhoto = (image: string) => { const updated = { ...business, coverImage: image }; setBusinesses(businesses.map(item => item === business ? updated : item)); setBusiness(updated); };
  const info = (entries: string[][]) => <div className="business-detail-grid">{entries.map(([label, value]) => <div key={label}><small>{label}</small><strong>{value || "Sin información"}</strong></div>)}</div>;
  const recoveryAvailable = Boolean(business.recoveryUntil && new Date(business.recoveryUntil).getTime() > Date.now());
  const recoveryDaysLeft = business.recoveryUntil ? Math.max(0, Math.ceil((new Date(business.recoveryUntil).getTime() - Date.now()) / 86400000)) : 0;
  const remove = () => { if (business.role !== "Propietario") return; const deletedAt = new Date(); const deleted = { ...business, status: "Eliminado" as const, deletedAt: deletedAt.toISOString(), recoveryUntil: addBusinessRecoveryPeriod(deletedAt).toISOString() }; setBusinesses(businesses.map(item => item === business ? deleted : item)); setBusiness(deleted); setConfirmingDelete(false); setEditing(false); };
  const recover = () => { if (!recoveryAvailable) return; const recovered = { ...business, status: "Pendiente" as const, deletedAt: undefined, recoveryUntil: undefined }; setBusinesses(businesses.map(item => item === business ? recovered : item)); setBusiness(recovered); setConfirmingRecovery(false); };
  const updateDraft = (field: keyof typeof draft, value: string | number | undefined) => setDraft(current => ({ ...current, [field]: value }));
  const formatPhone = (country: PhoneCountryCode, number: string) => number ? `${phoneCountryFor(country).dialCode ?? country} ${number}` : null;
  const hasContactChannel = Boolean(business.phone || business.whatsapp || business.email || business.website || business.instagram);
  const hasVirtualChannel = Boolean(business.whatsapp || normalizeWebsite(business.website) || normalizeInstagram(business.instagram));
  const modalityErrorMessage = (cause: unknown, fallback: string) => cause instanceof BusinessApiError ? cause.fields.modality || cause.message : fallback;
  const canEditModalities = business.role === "Propietario" || business.permissions?.includes("EDIT_BUSINESS") === true;
  const municipalities = locationCatalog.municipalities.filter(item => item.departmentCode === editDepartment);
  const save = async (event: FormEvent) => { event.preventDefault(); setSaveError(""); if (business.id) { setSaving(true); try { const response = await businessApi.update(business.id, { name: draft.name, categoryCode: categoryCodeFromLabel(draft.category), secondaryCategoryCodes: draftSecondaryCategories.filter(item => item !== draft.category).map(categoryCodeFromLabel), description: draft.description, cityName: draft.city, address: draft.address, latitude: draft.latitude ?? null, longitude: draft.longitude ?? null, additionalAddressInfo: draft.additionalAddressInfo?.trim() || null, phone: draft.phone || null, whatsapp: draft.whatsapp || null, email: draft.email || null, website: draft.website || null, instagram: draft.instagram || null }); const nextBusiness = toBusinessDetails(response.business); setBusinesses(businesses.map(item => item === business ? nextBusiness : item)); setBusiness(nextBusiness); setDraft(nextBusiness); setEditing(false); } catch (cause) { setSaveError(cause instanceof BusinessApiError ? cause.message : "No se pudieron guardar los cambios."); } finally { setSaving(false); } return; } const next = businesses.map(item => item === business ? draft : item); setBusinesses(next); setBusiness(draft); setEditing(false); };
  const beginSectionEdit = (section: Exclude<EditableSection, null>) => {
    setDraft(business);
    setDraftSecondaryCategories(business.secondaryCategories ?? []);
    setSectionError("");
    setSectionNotice("");
    setSectionConfirmation(null);
    if (section === "location") {
      const municipality = locationCatalog.municipalities.find(item => item.name === business.city);
      if (municipality) setEditDepartment(municipality.departmentCode);
    }
    if (section === "hours") setEditHours(scheduleFromText(business.hours));
    setEditingSection(section);
  };
  const cancelSectionEdit = () => { setEditingSection(null); setSectionError(""); setSectionNotice(""); setSectionConfirmation(null); setDraft(business); setDraftSecondaryCategories(business.secondaryCategories ?? []); setEditHours(scheduleFromText(business.hours)); };
  const saveSection = async (section: Exclude<EditableSection, null>, deactivateModalities: ModalityType[] = []) => {
    if (!business.id) {
      setEditingSection(null);
      return;
    }
    setSectionSaving(section);
    setSectionError("");
    setSectionNotice("");
    if (!deactivateModalities.length) setSectionConfirmation(null);
    try {
      const normalizedWebsite = section === "contact" ? normalizeWebsite(draft.website) : undefined;
      const normalizedInstagram = section === "contact" ? normalizeInstagram(draft.instagram) : undefined;
      if (section === "contact" && normalizedWebsite === null) {
        setSectionError("Ingresa un dominio válido, por ejemplo www.ejemplo.com.");
        setSectionSaving(null);
        return;
      }
      if (section === "contact" && normalizedInstagram === null) {
        setSectionError("Ingresa un usuario o perfil válido de Instagram, por ejemplo @mitienda.");
        setSectionSaving(null);
        return;
      }
      const basePayload = section === "general"
        ? { name: draft.name, categoryCode: categoryCodeFromLabel(draft.category), secondaryCategoryCodes: draftSecondaryCategories.filter(item => item !== draft.category).map(categoryCodeFromLabel) }
          : section === "description" ? { description: draft.description }
          : section === "contact" ? { phone: formatPhone(phoneCountry, phoneNumber), whatsapp: formatPhone(whatsappCountry, whatsappNumber), email: draft.email || null, website: normalizedWebsite || null, instagram: normalizedInstagram || null }
          : section === "hours" ? { hours: scheduleToText(editHours) }
          : { cityName: draft.city, address: draft.address, latitude: draft.latitude ?? null, longitude: draft.longitude ?? null, additionalAddressInfo: draft.additionalAddressInfo?.trim() || null };
      const payload = deactivateModalities.length ? { ...basePayload, deactivateModalities } : basePayload;
      const response = await businessApi.update(business.id, payload);
      const nextBusiness = toBusinessDetails(response.business);
      setBusinesses(businesses.map(item => item === business ? nextBusiness : item));
      setBusiness(nextBusiness);
      setDraft(nextBusiness);
      setDraftSecondaryCategories(nextBusiness.secondaryCategories ?? []);
      if (Array.isArray(response.business.modalities)) setModalities(response.business.modalities);
      setSectionConfirmation(null);
      setEditingSection(null);
      setSectionNotice(section === "general" ? "Información general guardada." : section === "description" ? "Descripción guardada." : section === "contact" ? "Contacto guardado." : section === "hours" ? "Horario guardado." : "Ubicación guardada.");
      try {
        const modalityResponse = await businessApi.listModalities(business.id);
        setModalities(modalityResponse.modalities);
        setModalitiesError("");
      } catch {
        setModalitiesError("Los cambios se guardaron, pero no se pudo actualizar el estado de las modalidades.");
      }
    } catch (cause) {
      if (cause instanceof BusinessApiError && cause.code === "ACTIVE_MODALITY_REQUIREMENTS") {
        let details: Partial<Record<ModalityType, string[]>> = {};
        try {
          const parsed = JSON.parse(cause.fields.modalities ?? "{}") as Record<string, unknown>;
          details = Object.fromEntries(Object.entries(parsed).filter(([type, blockers]) => modalityTypes.includes(type as ModalityType) && Array.isArray(blockers))) as Partial<Record<ModalityType, string[]>>;
        } catch { details = {}; }
        setSectionConfirmation({ section, details });
        setSectionError("");
      } else setSectionError(cause instanceof BusinessApiError ? cause.message : "No se pudieron guardar los cambios.");
    } finally {
      setSectionSaving(null);
    }
  };
  const toggleModality = async (type: ModalityType): Promise<string | null> => {
    if (!business.id || !canEditModalities) return "No tienes permisos para modificar esta modalidad.";
    const modality = modalities.find(item => item.type === type);
    if (modality?.status === "ACTIVE") {
      setModalityBusy(`pause-${type}`);
      setModalitiesError("");
      try { const response = await businessApi.pauseModality(business.id, modality.id); setModalities(current => current.map(item => item.id === modality.id ? response.modality : item)); }
      catch (cause) { const message = modalityErrorMessage(cause, "No se pudo desactivar la modalidad."); setModalitiesError(message); return message; }
      finally { setModalityBusy(null); }
      return null;
    }
    if (type === "PHYSICAL" && !business.address.trim()) { const message = "Para activar Física debes registrar una ubicación física localizable."; setModalitiesError(message); setEditingSection("location"); return message; }
    if (type === "VIRTUAL" && !hasVirtualChannel) { const message = "Para activar la atención virtual, agrega WhatsApp, un sitio web o Instagram."; setModalitiesError(message); setEditingSection("contact"); return message; }
    if (type === "DELIVERY" && (!business.city.trim() || !hasContactChannel)) { const message = !business.city.trim() ? "Para activar A domicilio debes registrar tu ciudad o municipio." : "Para activar A domicilio debes registrar al menos un canal de contacto."; setModalitiesError(message); setEditingSection(!business.city.trim() ? "location" : "contact"); return message; }
    setModalityBusy(`activate-${type}`);
    setModalitiesError("");
    try {
      const current = modality ?? (await businessApi.createModality(business.id, type)).modality;
      const response = current.status === "PAUSED" ? await businessApi.reactivateModality(business.id, current.id) : await businessApi.activateModality(business.id, current.id);
      setModalities(items => items.some(item => item.id === response.modality.id) ? items.map(item => item.id === response.modality.id ? response.modality : item) : [...items, response.modality]);
    } catch (cause) { const message = modalityErrorMessage(cause, "No se pudo activar la modalidad."); setModalitiesError(message); return message; }
    finally { setModalityBusy(null); }
    return null;
  };
  const correctionSectionFor = (modality: RealModality): Exclude<EditableSection, null> => modality.type === "PHYSICAL" || modality.blockers?.some(blocker => blocker.toLowerCase().includes("ciudad")) ? "location" : "contact";
  const confirmIncompletePause = async () => {
    if (!modalityConfirmation) return;
    setModalityConfirmationError("");
    const error = await toggleModality(modalityConfirmation);
    if (error) setModalityConfirmationError(error);
    else setModalityConfirmation(null);
  };
  const addCollaborator = (event: FormEvent) => { event.preventDefault(); const usingNickname = Boolean(collaboratorNickname.trim()); const usingEmail = Boolean(collaboratorEmail.trim()); if (business.role !== "Propietario" || (!usingNickname && !usingEmail)) { setNicknameError("Escribe un nickname o un correo para enviar la invitación."); return; } if (usingNickname && !nicknamePattern.test(collaboratorNickname.trim())) { setNicknameError("No encontramos ese nickname. Verifica que esté escrito correctamente."); return; } const nickname = usingNickname ? (collaboratorNickname.trim().startsWith("@") ? collaboratorNickname.trim().toLowerCase() : `@${collaboratorNickname.trim().toLowerCase()}`) : undefined; if ((business.collaborators ?? []).some(item => (nickname && item.nickname === nickname) || (item.email && usingEmail && item.email.toLowerCase() === collaboratorEmail.trim().toLowerCase()))) { setNicknameError("El nickname o correo ya tiene una invitación en este negocio."); return; } const invitationId = crypto.randomUUID(); const invitationMethod = usingNickname ? "nickname" as const : "email" as const; const displayName = usingNickname ? nickname!.replace(/^@/, "") : collaboratorEmail.trim().split("@")[0]; const updated = { ...business, collaborators: [...(business.collaborators ?? []), { id: invitationId, nickname, name: displayName, email: usingEmail ? collaboratorEmail.trim().toLowerCase() : undefined, role: "Colaborador" as const, active: false, invitationMethod }] }; const invitation: BusinessNotification = { id: `collaboration-${invitationId}`, title: `Invitación para administrar ${business.name}`, description: invitationMethod === "email" ? `Te invitaron a administrar ${business.name}. Crea tu cuenta en XAMUKO con este correo para continuar con la invitación.` : `${business.name} te invitó como colaborador. Revisa la invitación y acepta para comenzar a administrarlo.`, date: "Ahora", type: "collaboration", read: false, createdAt: new Date().toISOString(), recipientNickname: nickname, recipientEmail: usingEmail ? collaboratorEmail.trim().toLowerCase() : undefined, businessName: business.name, businessId: business.name, invitationId }; setBusinesses(businesses.map(item => item === business ? updated : item)); setBusiness(updated); setNotifications([...notifications, invitation]); setCollaboratorNickname(""); setCollaboratorEmail(""); setActiveInviteField(null); setNicknameError(""); setShowCollaboratorForm(false); };
  const removeCollaborator = (id: string) => { if (business.role !== "Propietario") return; const updated = { ...business, collaborators: (business.collaborators ?? []).filter(item => item.id !== id) }; setBusinesses(businesses.map(item => item === business ? updated : item)); setBusiness(updated); };
  const leaveCollaboration = () => {
    if (business.role !== "Colaborador") return;
    const currentCollaborator = (business.collaborators ?? []).find(item => item.active && ((item.nickname && item.nickname === account.nickname) || (item.email && item.email.toLowerCase() === account.email.toLowerCase())));
    if (!currentCollaborator) return;
    const remaining = businesses.filter(item => item !== business);
    setBusinesses(remaining);
    const fallback = remaining.find(item => item.ownerNickname === account.nickname) ?? remaining[0];
    if (fallback) {
      setBusiness(fallback);
      navigate("/");
    } else {
      navigate("/sin-negocio");
    }
  };
  const generalSection = <section className="business-detail-section" data-business-section="general">
    <div className="business-section-heading"><div><h3>Información comercial</h3><p>Actualiza los datos principales que verán las personas.</p></div>{business.role === "Propietario" && <button className="text-button business-section-edit" type="button" onClick={() => beginSectionEdit("general")}>✎ Editar</button>}</div>
    {editingSection === "general" ? <form className="business-detail-inline-form" onSubmit={event => { event.preventDefault(); void saveSection("general"); }}>
      <div className="form-grid"><label className="form-field"><span>Nombre comercial</span><input value={draft.name} onChange={event => updateDraft("name", event.target.value)} required /></label><label className="form-field"><span>Categoría principal</span><select value={categoryLabel(draft.category)} onChange={event => { const next = event.target.value; updateDraft("category", next); setDraftSecondaryCategories(current => current.filter(item => categoryCodeFromLabel(item) !== categoryCodeFromLabel(next))); }} required>{categories.map(item => <option key={item}>{item}</option>)}</select></label></div>
      <fieldset className="form-field category-secondary-field"><legend>Categorías secundarias <small>(opcional)</small></legend><div className="category-secondary-grid">{categories.filter(item => categoryCodeFromLabel(item) !== categoryCodeFromLabel(draft.category)).map(item => <label className={`category-secondary-option${draftSecondaryCategories.some(value => categoryCodeFromLabel(value) === categoryCodeFromLabel(item)) ? " selected" : ""}`} key={item}><input type="checkbox" checked={draftSecondaryCategories.some(value => categoryCodeFromLabel(value) === categoryCodeFromLabel(item))} onChange={() => setDraftSecondaryCategories(current => current.some(value => categoryCodeFromLabel(value) === categoryCodeFromLabel(item)) ? current.filter(value => categoryCodeFromLabel(value) !== categoryCodeFromLabel(item)) : [...current, item])} /><span>{item}</span></label>)}</div></fieldset>
      {sectionError && <p className="form-error" role="alert">{sectionError}</p>}<div className="business-detail-inline-actions"><button className="outline-button" type="button" onClick={cancelSectionEdit}>Cancelar</button><button className="action-button" type="submit" disabled={sectionSaving !== null}>{sectionSaving === "general" ? "Guardando…" : "Guardar cambios"}</button></div>
    </form> : <>{info([["Nombre comercial", business.name], ["Categoría principal", business.category], ["Categorías secundarias", (business.secondaryCategories ?? []).join(", ") || "Ninguna"]])}</>}
  </section>;
  const locationSection = <section className="business-detail-section" data-business-section="location">
    <div className="business-section-heading"><div><h3>Ubicación</h3><p>La dirección pública solo se muestra cuando el negocio tiene atención física.</p></div>{business.role === "Propietario" && <button className="text-button business-section-edit" type="button" onClick={() => beginSectionEdit("location")}>✎ Editar</button>}</div>
    {editingSection === "location" ? <form className="business-detail-inline-form" onSubmit={event => { event.preventDefault(); void saveSection("location"); }}><div className="form-grid"><label className="form-field"><span>Departamento</span><select value={editDepartment} onChange={event => { setEditDepartment(event.target.value); updateDraft("city", ""); }} required>{locationCatalog.departments.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}</select></label><label className="form-field"><span>Ciudad o municipio</span><select value={draft.city} onChange={event => updateDraft("city", event.target.value)} required><option value="">Selecciona una ciudad o municipio</option>{municipalities.map(item => <option key={item.id}>{item.name}</option>)}</select></label></div><div className="location-mode-toggle" role="group" aria-label="Forma de indicar la ubicación"><button type="button" className={editLocationMode === "address" ? "active" : ""} onClick={() => setEditLocationMode("address")}>Escribir dirección</button><button type="button" className={editLocationMode === "map" ? "active" : ""} onClick={() => setEditLocationMode("map")}>Seleccionar en el mapa</button></div>{editLocationMode === "address" ? <><label className="form-field full-field"><span>Dirección</span><input value={draft.address} onChange={event => updateDraft("address", event.target.value)} placeholder="Calle, carrera y número" /></label><label className="form-field full-field"><span>Información adicional de la dirección (opcional)</span><input value={draft.additionalAddressInfo ?? ""} maxLength={200} onChange={event => updateDraft("additionalAddressInfo", event.target.value)} placeholder="Ej. Centro Comercial La Nube, local 204" /></label></> : <><BusinessLocationPicker value={draft.latitude != null && draft.longitude != null ? { lat: draft.latitude, lng: draft.longitude } : null} query={[draft.address, draft.city].filter(Boolean).join(", ")} onChange={value => { updateDraft("latitude", value.lat); updateDraft("longitude", value.lng); }} /><p className="form-help">Selecciona o mueve el marcador. Confirma después con “Guardar cambios”.</p></>}{sectionError && <p className="form-error" role="alert">{sectionError}</p>}<div className="business-detail-inline-actions"><button className="outline-button" type="button" onClick={cancelSectionEdit}>Cancelar</button><button className="action-button" type="submit" disabled={sectionSaving !== null}>{sectionSaving === "location" ? "Guardando…" : "Guardar cambios"}</button></div></form> : <>{info([["Ciudad", business.city], ["Dirección", business.address]])}{business.additionalAddressInfo?.trim() && <div className="business-detail-additional-address"><small>Información adicional de la dirección</small><strong>{business.additionalAddressInfo}</strong></div>}<StaticLocationPreview business={business} /></>}
  </section>;

  const descriptionSection = <section className="business-detail-section" data-business-section="description">
    <div className="business-section-heading">
      <div><h3>Descripción</h3><p>Presenta brevemente tu negocio.</p></div>
      {business.role === "Propietario" && <button className="text-button business-section-edit" type="button" onClick={() => beginSectionEdit("description")}>✎ Editar</button>}
    </div>
    {editingSection === "description" ? <form className="business-detail-inline-form" onSubmit={event => { event.preventDefault(); void saveSection("description"); }}>
      <label className="form-field"><span>Descripción</span><textarea value={draft.description} onChange={event => updateDraft("description", event.target.value)} rows={4} maxLength={300} /></label>
      {sectionError && <p className="form-error" role="alert">{sectionError}</p>}
      <div className="business-detail-inline-actions"><button className="outline-button" type="button" onClick={cancelSectionEdit}>Cancelar</button><button className="action-button" type="submit" disabled={sectionSaving !== null}>{sectionSaving === "description" ? "Guardando…" : "Guardar cambios"}</button></div>
    </form> : <><p>{business.description || "Sin descripción"}</p>{business.tags?.length ? <div className="business-tag-list">{business.tags.map(tag => <span key={tag}>{tag}</span>)}</div> : null}</>}
  </section>;
  const contactSection = <section className="business-detail-section" data-business-section="contact">
    <div className="business-section-heading"><div><h3>Contacto</h3><p>Canales para que tus clientes se comuniquen contigo.</p></div>{business.role === "Propietario" && <button className="text-button business-section-edit" type="button" onClick={() => beginSectionEdit("contact")}>✎ Editar</button>}</div>
    {editingSection === "contact" ? <form className="business-detail-inline-form" onSubmit={event => { event.preventDefault(); void saveSection("contact"); }}>
      <div className="form-grid"><PhoneNumberField label="WhatsApp" ariaLabel="WhatsApp" country={whatsappCountry} number={whatsappNumber} onCountryChange={country => { setWhatsappCountry(country); setWhatsappNumber(""); }} onNumberChange={setWhatsappNumber} /><label className="form-field"><span>Sitio web</span><input value={draft.website} onChange={event => updateDraft("website", event.target.value)} type="text" inputMode="url" placeholder="www.ejemplo.com" /></label><label className="form-field"><span>Instagram</span><input value={draft.instagram} onChange={event => updateDraft("instagram", event.target.value)} placeholder="@mitienda" /></label><PhoneNumberField label="Teléfono" ariaLabel="teléfono" country={phoneCountry} number={phoneNumber} onCountryChange={country => { setPhoneCountry(country); setPhoneNumber(""); }} onNumberChange={setPhoneNumber} lineType={phoneLineType} onLineTypeChange={type => { setPhoneLineType(type); setPhoneNumber(""); }} /><label className="form-field"><span>Correo electrónico</span><input value={draft.email} onChange={event => updateDraft("email", event.target.value)} type="email" /></label></div>
      {sectionError && <p className="form-error" role="alert">{sectionError}</p>}
      <div className="business-detail-inline-actions"><button className="outline-button" type="button" onClick={cancelSectionEdit}>Cancelar</button><button className="action-button" type="submit" disabled={sectionSaving !== null}>{sectionSaving === "contact" ? "Guardando…" : "Guardar cambios"}</button></div>
    </form> : <>{info([["Teléfono", business.phone], ["WhatsApp", business.whatsapp], ["Correo", business.email], ["Sitio web", business.website], ["Instagram", business.instagram]])}</>}
  </section>;
  return <>
    <div className="business-detail-layout">
      <section className={`surface-card business-detail-main${business.status === "Eliminado" ? " is-deleted" : ""}`}>
        <div className="business-detail-hero">
          {business.coverImage ? <img className="business-detail-image" src={business.coverImage} alt={business.name} /> : <div className="business-logo">☕</div>}
          <div className="business-detail-hero-copy"><span className="business-detail-category">{business.category}{business.tags?.length ? ` · ${business.tags.join(" · ")}` : ""}</span><h2>{business.name}</h2><span className="business-role-badge">{business.role}</span><p>{business.city} · {business.address}</p>{business.rating && <div className="business-detail-rating">★ {business.rating.toFixed(1)} <span>({business.reviewCount ?? 0} opiniones)</span></div>}{activeModalities.length > 0 && <div className="business-detail-hero-modalities" aria-label="Modalidades activas"><span>{activeModalities.join(" · ")}</span></div>}</div>
          
        </div>
        {business.status === "Eliminado" && <div className="business-deleted-notice"><strong>Tu negocio no se encuentra visible</strong><p>{recoveryAvailable ? `Cuentas con ${recoveryDaysLeft} días para recuperarlo. Toda su información se conserva durante ${BUSINESS_RECOVERY_DAYS} días.` : "El plazo de recuperación terminó. Toda su información queda pendiente de eliminación definitiva."}</p>{recoveryAvailable && <><button className="action-button" type="button" onClick={() => setConfirmingRecovery(true)}>Recuperar negocio</button>{confirmingRecovery && <div className="business-recovery-confirm"><strong>¿Quieres recuperar este negocio?</strong><p>Volverá a estado Verificación pendiente y podrás seguir editándolo.</p><div><button className="action-button" type="button" onClick={recover}>Sí, recuperar</button><button className="outline-button" type="button" onClick={() => setConfirmingRecovery(false)}>Cancelar</button></div></div>}</>}</div>}
        {descriptionSection}
        {business.images && business.images.length > 0 && <section className="business-detail-section"><div className="business-gallery-heading"><h3>Fotos del negocio</h3><span>{galleryIndex + 1} de {business.images.length}</span></div><div className="business-detail-gallery"><div className="business-gallery-featured"><img src={business.images[galleryIndex]} alt={`${business.name} ${galleryIndex + 1}`} />{business.images.length > 1 && <><button type="button" className="business-gallery-arrow previous" aria-label="Foto anterior" onClick={() => setGalleryIndex(index => (index - 1 + business.images!.length) % business.images!.length)}>‹</button><button type="button" className="business-gallery-arrow next" aria-label="Foto siguiente" onClick={() => setGalleryIndex(index => (index + 1) % business.images!.length)}>›</button></>}</div><button type="button" className="business-profile-photo-button" onClick={() => setAsProfilePhoto(business.images![galleryIndex])}>{business.coverImage === business.images[galleryIndex] ? "✓ Foto de perfil actual" : "Usar esta foto como perfil"}</button>{business.images.length > 1 && <div className="business-gallery-thumbnails">{business.images.map((image, imageIndex) => <button type="button" className={imageIndex === galleryIndex ? "active" : ""} key={`${image.slice(0, 20)}-${imageIndex}`} onClick={() => setGalleryIndex(imageIndex)}><img src={image} alt={`Ver foto ${imageIndex + 1}`} /></button>)}</div>}</div></section>}
        {sectionNotice && <p className="business-detail-save-notice" role="status">✓ {sectionNotice}</p>}
        {sectionConfirmation && <div className="business-detail-confirmation-overlay" role="presentation" onMouseDown={event => event.target === event.currentTarget && event.preventDefault()}><div className="business-detail-confirmation" role="dialog" aria-modal="true" aria-labelledby="business-detail-confirmation-title"><strong id="business-detail-confirmation-title">Este cambio afecta tus modalidades de atención</strong><p>Estás intentando modificar {sectionLabels[sectionConfirmation.section]}. Para conservar las modalidades activas, deben seguir cumpliendo sus requisitos.</p>{Object.keys(sectionConfirmation.details).length > 0 ? <ul>{Object.entries(sectionConfirmation.details).map(([type, blockers]) => <li key={type}><strong>{modalityLabels[type as ModalityType]}:</strong> {blockers?.join(" ")}</li>)}</ul> : <p>Las modalidades activas perderían información necesaria para funcionar.</p>}<p>Si continúas, las modalidades afectadas quedarán temporalmente inactivas. Sus datos se conservarán y podrás reactivarlas cuando cumplan los requisitos.</p>{sectionError && <p className="form-error" role="alert">{sectionError}</p>}<div className="business-detail-inline-actions"><button ref={confirmationCancelRef} className="outline-button" type="button" onClick={() => { setSectionConfirmation(null); setSectionError(""); }}>Cancelar</button><button className="action-button" type="button" disabled={sectionSaving !== null} onClick={() => void saveSection(sectionConfirmation.section, Object.keys(sectionConfirmation.details) as ModalityType[])}>{sectionSaving ? "Guardando…" : "Desactivar modalidades y guardar"}</button></div></div></div>}
        {modalityConfirmation && <div className="business-detail-confirmation-overlay" role="presentation"><div className="business-detail-confirmation" role="dialog" aria-modal="true" aria-labelledby="modality-confirmation-title"><strong id="modality-confirmation-title">¿Desactivar {modalityLabels[modalityConfirmation]}?</strong><p>Actualmente esta modalidad no cumple los requisitos para permanecer activa. Puedes volver a activarla cuando registres la información necesaria.</p>{modalityConfirmationError && <p className="form-error" role="alert">{modalityConfirmationError}</p>}<div className="business-detail-inline-actions"><button ref={modalityConfirmationCancelRef} className="outline-button" type="button" disabled={modalityBusy !== null} onClick={() => setModalityConfirmation(null)}>Cancelar</button><button className="action-button" type="button" disabled={modalityBusy !== null} onClick={() => void confirmIncompletePause()}>{modalityBusy ? "Desactivando…" : "Desactivar modalidad"}</button></div></div></div>}
        {generalSection}
        <section className="business-detail-section business-detail-modalities-section"><div className="business-section-heading"><div><h3>Modalidades de atención</h3><p>Activa o desactiva cómo atiendes a tus clientes.</p></div></div>{modalitiesError && <p className="form-error" role="alert">{modalitiesError}</p>}{incompleteActiveModalities.length > 0 && <div className="business-detail-modality-warning" role="alert"><strong>Hay modalidades activas que necesitan actualizarse</strong>{incompleteActiveModalities.map(modality => <div className="business-detail-modality-warning-item" key={modality.id}><div><strong>{modalityLabels[modality.type]} necesita actualizarse</strong><p>Esta modalidad figura como activa, pero {modality.blockers?.join(" ")}</p></div><div className="business-detail-modality-warning-actions"><button className="outline-button" type="button" onClick={() => beginSectionEdit(correctionSectionFor(modality))}>Corregir información</button><button className="text-button" type="button" onClick={() => { setModalityConfirmation(modality.type); setModalityConfirmationError(""); }}>Desactivar modalidad</button></div></div>)}</div>}{modalitiesLoading ? <p className="empty-state">Cargando modalidades…</p> : <div className="business-detail-modalities-grid">{modalityTypes.map(type => { const modality = modalities.find(item => item.type === type); const active = modality?.status === "ACTIVE"; const busy = modalityBusy === `pause-${type}` || modalityBusy === `activate-${type}`; return <article className="business-detail-modality-card" key={type}><div className="business-detail-modality-card-head"><div><strong>{modalityLabels[type]}</strong></div><span className={`status-pill ${active ? "modality-status-active" : "modality-status-inactive"}`}>{active ? "Activa" : "Inactiva"}</span></div><div className="business-detail-modality-actions"><button className={active ? "outline-button" : "action-button"} type="button" onClick={() => void toggleModality(type)} disabled={!canEditModalities || modalityBusy !== null}>{busy ? "Guardando…" : active ? "Desactivar" : "Activar"}</button></div></article>; })}</div>}{!canEditModalities && <p className="modality-permission-note">Tu acceso actual es de solo lectura.</p>}</section>
        {locationSection}
        {contactSection}
        <section className="business-detail-section business-team-section"><div className="business-section-heading"><div><h3>Personas con acceso</h3><p>Invita por nickname o correo electrónico.</p></div>{business.role === "Propietario" && <button className="outline-button" type="button" onClick={() => setShowCollaboratorForm(value => !value)}>{showCollaboratorForm ? "Cancelar" : "＋ Agregar colaborador"}</button>}</div><div className="business-team-owner"><span className="business-team-avatar">{business.role === "Propietario" ? "P" : "C"}</span><div><strong>{business.role === "Propietario" ? "Propietario" : "Propietario del negocio"}</strong><small>Control de propiedad y permisos especiales</small></div><span className="business-role-badge">Propietario</span></div>{(business.collaborators ?? []).map(collaborator => <div className="business-team-member" key={collaborator.id}><span className="business-team-avatar">{collaborator.name.split(" ").map(part => part[0]).slice(0, 2).join("")}</span><div><strong>{collaborator.name}</strong><small>{collaborator.nickname ? `${collaborator.nickname} · ` : "Invitado por correo · "}{collaborator.email || "Pendiente de registro"}</small>{!collaborator.active && <span className="business-invitation-status">Invitación pendiente</span>}</div>{business.role === "Propietario" && (confirmingCollaboratorRemoval === collaborator.id ? <div className="business-inline-confirm"><span>¿Retirar acceso?</span><button type="button" onClick={() => { removeCollaborator(collaborator.id); setConfirmingCollaboratorRemoval(null); }}>Sí, retirar</button><button type="button" onClick={() => setConfirmingCollaboratorRemoval(null)}>Cancelar</button></div> : <button className="text-button" type="button" onClick={() => setConfirmingCollaboratorRemoval(collaborator.id)}>Retirar acceso</button>)}{business.role === "Colaborador" && collaborator.active && ((collaborator.nickname && collaborator.nickname === account.nickname) || (collaborator.email && collaborator.email.toLowerCase() === account.email.toLowerCase())) && (confirmingLeave ? <div className="business-inline-confirm collaborator-leave-confirm"><span>¿Dejar tu acceso?</span><button type="button" onClick={leaveCollaboration}>Sí, salir</button><button type="button" onClick={() => setConfirmingLeave(false)}>Cancelar</button></div> : <button className="text-button collaborator-leave-button" type="button" onClick={() => setConfirmingLeave(true)}>Dejar de ser colaborador</button>)}</div>)}{showCollaboratorForm && business.role === "Propietario" && <form className="business-collaborator-form" onSubmit={addCollaborator}><label className="form-field full-field"><span>Nickname único</span><input value={collaboratorNickname} onFocus={() => setActiveInviteField("nickname")} onChange={event => { setCollaboratorNickname(event.target.value); setActiveInviteField(event.target.value ? "nickname" : null); setNicknameError(""); }} placeholder="Ej. @laura.gomez" pattern="@?[a-zA-Z0-9._-]{3,30}" disabled={activeInviteField === "email"} /><small>Si no encontramos el nickname, te avisaremos antes de enviar.</small>{activeInviteField === "email" && <button className="invite-method-switch" type="button" onClick={() => { setCollaboratorEmail(""); setActiveInviteField("nickname"); }}>Usar nickname en su lugar</button>}{nicknameError && <em className="form-error">{nicknameError}</em>}</label><label className="form-field full-field"><span>Correo electrónico</span><input type="email" value={collaboratorEmail} onFocus={() => setActiveInviteField("email")} onChange={event => { setCollaboratorEmail(event.target.value); setActiveInviteField(event.target.value ? "email" : null); setNicknameError(""); }} placeholder="colaborador@ejemplo.com" disabled={activeInviteField === "nickname"} /><small>Si no tiene una cuenta, podrá crearla con este correo.</small>{activeInviteField === "nickname" && <button className="invite-method-switch" type="button" onClick={() => { setCollaboratorNickname(""); setActiveInviteField("email"); }}>Usar correo en su lugar</button>}</label><button className="action-button" type="submit">Enviar invitación</button></form>}</section>
        <section className="business-detail-section" data-business-section="hours"><div className="business-section-heading"><div><h3>Horario</h3><p>Define cuándo está abierto tu negocio.</p></div>{business.role === "Propietario" && <button className="text-button business-section-edit" type="button" onClick={() => beginSectionEdit("hours")}>✎ Editar</button>}</div>{editingSection === "hours" ? <form className="business-detail-inline-form" onSubmit={event => { event.preventDefault(); void saveSection("hours"); }}><div className="wizard-hours">{scheduleDays.map(day => <div key={day}><label><input type="checkbox" checked={editHours[day].enabled} onChange={event => setEditHours(current => ({ ...current, [day]: { ...current[day], enabled: event.target.checked } }))} /> <strong>{day}</strong></label><label><input type="checkbox" checked={editHours[day].allDay} disabled={!editHours[day].enabled} onChange={event => { const allDay = event.target.checked; setEditHours(current => ({ ...current, [day]: { ...current[day], allDay, open: allDay ? "00:00" : current[day].open, close: allDay ? "23:59" : current[day].close } })); }} /> 24 horas</label><input type="time" value={editHours[day].open} disabled={!editHours[day].enabled || editHours[day].allDay} onChange={event => setEditHours(current => ({ ...current, [day]: { ...current[day], open: event.target.value } }))} /><span>–</span><input type="time" value={editHours[day].close} disabled={!editHours[day].enabled || editHours[day].allDay} onChange={event => setEditHours(current => ({ ...current, [day]: { ...current[day], close: event.target.value } }))} /></div>)}</div>{sectionError && <p className="form-error" role="alert">{sectionError}</p>}<div className="business-detail-inline-actions"><button className="outline-button" type="button" onClick={cancelSectionEdit}>Cancelar</button><button className="action-button" type="submit" disabled={sectionSaving !== null}>{sectionSaving === "hours" ? "Guardando…" : "Guardar cambios"}</button></div></form> : <div className="business-hours-list">{weeklyHours.map(([day, hours]) => <div key={day}><strong>{day}</strong><span>{hours}</span></div>)}</div>}</section>
        {business.status !== "Eliminado" && <>{business.role === "Propietario" && <div className="business-detail-edit-row"><button className="danger-button business-detail-delete-button" type="button" onClick={() => setConfirmingDelete(true)}>Eliminar negocio</button></div>}{business.role === "Propietario" && confirmingDelete && !editing && <div className="business-delete-confirm business-detail-delete-confirm"><strong>¿Eliminar este negocio?</strong><p>Tu negocio quedará no visible y podrás recuperarlo durante {BUSINESS_RECOVERY_DAYS} días.</p><div><button className="danger-button" type="button" onClick={remove}>Sí, eliminar</button><button className="outline-button" type="button" onClick={() => setConfirmingDelete(false)}>Cancelar</button></div></div>}</>}
      </section>

    </div>

    {editing && <div className="modal-backdrop" role="presentation"><form className="modal-card business-edit-modal" onSubmit={save}><div className="modal-heading"><div><span className="page-eyebrow">EDITAR NEGOCIO</span><h2>Edita la información de tu tienda</h2><p>Actualiza los mismos datos que diligenciaste al crearla.</p></div><button className="close-button" type="button" aria-label="Cerrar" onClick={() => setEditing(false)}>×</button></div><div className="edit-form-section"><h3>Datos básicos</h3><div className="form-grid"><label className="form-field">Nombre comercial<input value={draft.name} onChange={event => updateDraft("name", event.target.value)} required /></label><label className="form-field">Categoría principal<select value={categoryLabel(draft.category)} onChange={event => { const next = event.target.value; updateDraft("category", next); setDraftSecondaryCategories(current => current.filter(item => categoryCodeFromLabel(item) !== categoryCodeFromLabel(next))); }} required>{categories.map(item => <option key={item}>{item}</option>)}</select></label><label className="form-field full-field">Descripción corta<textarea value={draft.description} onChange={event => updateDraft("description", event.target.value)} rows={3} maxLength={300} /></label><fieldset className="form-field category-secondary-field"><legend>Categorías secundarias <small>(opcional)</small></legend><div className="category-secondary-grid">{categories.filter(item => categoryCodeFromLabel(item) !== categoryCodeFromLabel(draft.category)).map(item => <label className={`category-secondary-option${draftSecondaryCategories.some(value => categoryCodeFromLabel(value) === categoryCodeFromLabel(item)) ? " selected" : ""}`} key={item}><input type="checkbox" checked={draftSecondaryCategories.some(value => categoryCodeFromLabel(value) === categoryCodeFromLabel(item))} onChange={() => setDraftSecondaryCategories(current => current.some(value => categoryCodeFromLabel(value) === categoryCodeFromLabel(item)) ? current.filter(value => categoryCodeFromLabel(value) !== categoryCodeFromLabel(item)) : [...current, item])} /><span>{item}</span></label>)}</div></fieldset></div></div><div className="edit-form-section"><h3>Ubicación</h3><div className="form-grid"><label className="form-field">Departamento<select value={editDepartment} onChange={event => { setEditDepartment(event.target.value); updateDraft("city", ""); }} required>{locationCatalog.departments.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}</select></label><label className="form-field">Ciudad o municipio<select value={draft.city} onChange={event => updateDraft("city", event.target.value)} required>{municipalities.map(item => <option key={item.id}>{item.name}</option>)}</select></label></div><div className="location-mode-toggle" role="group" aria-label="Forma de indicar la ubicación"><button type="button" className={editLocationMode === "address" ? "active" : ""} onClick={() => setEditLocationMode("address")}>Escribir dirección</button><button type="button" className={editLocationMode === "map" ? "active" : ""} onClick={() => setEditLocationMode("map")}>Seleccionar en el mapa</button></div>{editLocationMode === "address" ? <><label className="form-field">Dirección<input value={draft.address} onChange={event => updateDraft("address", event.target.value)} required /></label><label className="form-field">Información adicional de la dirección (opcional)<input value={draft.additionalAddressInfo ?? ""} maxLength={200} onChange={event => updateDraft("additionalAddressInfo", event.target.value)} placeholder="Ej. Centro Comercial La Nube, local 204" /></label></> : <><BusinessLocationPicker value={draft.latitude != null && draft.longitude != null ? { lat: draft.latitude, lng: draft.longitude } : null} query={[draft.address, draft.city].filter(Boolean).join(", ")} onChange={value => { updateDraft("latitude", value.lat); updateDraft("longitude", value.lng); }} /><p className="form-help">Selecciona o mueve el marcador. Confirma después con “Guardar cambios”.</p></>}</div><div className="edit-form-section"><h3>Contacto general</h3><div className="form-grid"><label className="form-field">Teléfono<input value={draft.phone} onChange={event => updateDraft("phone", event.target.value)} type="tel" /></label><label className="form-field">WhatsApp<input value={draft.whatsapp} onChange={event => updateDraft("whatsapp", event.target.value)} type="tel" /></label><label className="form-field">Correo electrónico<input value={draft.email} onChange={event => updateDraft("email", event.target.value)} type="email" /></label><label className="form-field">Sitio web<input value={draft.website} onChange={event => updateDraft("website", event.target.value)} type="url" /></label><label className="form-field">Instagram<input value={draft.instagram} onChange={event => updateDraft("instagram", event.target.value)} /></label></div></div><div className="edit-form-section"><h3>Horarios y fotos</h3><label className="form-field">Horario general<input value={draft.hours} onChange={event => updateDraft("hours", event.target.value)} placeholder="Ej. Lun–Vie 8:00 a. m.–6:00 p. m." /></label><label className="form-field">Fotos del negocio <small>(opcional)</small><input type="file" accept="image/*" onChange={(event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => updateDraft("coverImage", typeof reader.result === "string" ? reader.result : (draft.coverImage ?? "")); reader.readAsDataURL(file); }} /></label></div>{saveError && <p className="form-error" role="alert">{saveError}</p>}<div className="modal-actions"><button className="outline-button" type="button" onClick={() => setEditing(false)}>Cancelar</button><button className="action-button" type="submit" disabled={saving}>{saving ? "Guardando…" : "Guardar cambios"}</button></div></form></div>}
  </>;
}
