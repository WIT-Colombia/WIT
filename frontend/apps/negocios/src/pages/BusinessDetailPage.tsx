import { useEffect, useRef, useState, type FormEvent, type ChangeEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useBusinessStore } from "../services/businessStore";
import { getColombianAdministrativeDivisions } from "../../../usuario/src/services/administrativeDivisionService";
import { BUSINESS_RECOVERY_DAYS } from "../services/visibilityPolicy";
import type { BusinessNotification, BusinessDetails } from "../types/business";
import { businessApi, BusinessApiError, type BusinessReferralSummary, type ModalityType, type RealModality } from "../services/businessApiClient";
import { categoryCodeFromLabel, formatCategoryName, toBusinessDetails } from "../services/realBusinessAdapter";
import { PhoneNumberField, phoneCountryFor, splitInternationalPhone, type PhoneCountryCode } from "../components/common/PhoneNumberField";
import { BusinessLocationPicker, geocodeBusinessAddress } from "../components/BusinessLocationPicker";
import { PersistedPhoto } from "../components/common/PersistedPhoto";
import { BusinessCardPanel } from "../components/business/BusinessCardPanel";
import { getBusinessOpeningState } from "../services/businessPresentation";
import { getPublicBusinessUrl } from "../config/publicApp";
import { shareLink } from "../../../usuario/src/utils/share";
import "./BusinessDetailPage.css";

const categories = ["Restaurantes", "Droguerías", "Ferreterías", "Talleres", "Barberías", "Tecnología", "Cafeterías", "Panaderías y reposterías", "Supermercados y tiendas", "Frutas y verduras", "Carnicerías y pescaderías", "Salud y bienestar", "Clínicas y consultorios", "Ópticas", "Peluquerías y belleza", "Ropa y calzado", "Hogar y decoración", "Construcción y remodelación", "Repuestos y accesorios", "Lavanderías y tintorerías", "Mascotas y veterinarias", "Papelerías y librerías", "Educación y cursos", "Deportes y recreación", "Transporte y movilidad", "Servicios para el hogar", "Servicios técnicos", "Servicios profesionales", "Floristerías y regalos", "Hoteles y turismo", "Eventos y entretenimiento", "Belleza y cuidado personal", "Otros"];
const locationCatalog = getColombianAdministrativeDivisions();
const dayNames: Record<string, string> = { Lun: "Lunes", Mar: "Martes", Mié: "Miércoles", Jue: "Jueves", Vie: "Viernes", Sáb: "Sábado", Dom: "Domingo" };
const scheduleDays = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"] as const;
type ScheduleDay = { enabled: boolean; allDay: boolean; open: string; close: string };
const defaultSchedule: Record<string, ScheduleDay> = Object.fromEntries(scheduleDays.map(day => [day, { enabled: false, allDay: false, open: "08:00", close: "18:00" }])) as Record<string, ScheduleDay>;
const scheduleDayOfWeek: Record<(typeof scheduleDays)[number], number> = { Lunes: 1, Martes: 2, Miércoles: 3, Jueves: 4, Viernes: 5, Sábado: 6, Domingo: 0 };
const scheduleFromText = (value: string) => {
  const result = Object.fromEntries(scheduleDays.map(day => [day, { ...defaultSchedule[day] }])) as Record<string, ScheduleDay>;
  value.split(" · ").filter(Boolean).forEach(part => { const match = part.match(/^(.{3})\s+(24 horas|([0-9]{2}:[0-9]{2})[–-]([0-9]{2}:[0-9]{2}))$/); if (!match) return; const day = dayNames[match[1]]; if (!day) return; result[day] = { enabled: true, allDay: match[2] === "24 horas", open: match[3] ?? "00:00", close: match[4] ?? "23:59" }; });
  return result;
};
const scheduleToText = (value: Record<string, ScheduleDay>) => scheduleDays.filter(day => value[day].enabled).map(day => `${day.slice(0, 3)} ${value[day].allDay ? "24 horas" : `${value[day].open}–${value[day].close}`}`).join(" · ") || "Cerrado todos los días";
const scheduleModality = (modalities: RealModality[]) => modalities.find(modality => modality.type === "PHYSICAL") ?? modalities[0];
const scheduleFromModalities = (modalities: RealModality[], fallback: string) => {
  const modality = scheduleModality(modalities);
  if (!modality) return scheduleFromText(fallback);
  const persisted = new Map(modality.hours.map(hour => [hour.dayOfWeek, hour]));
  return Object.fromEntries(scheduleDays.map(day => {
    const hour = persisted.get(scheduleDayOfWeek[day]);
    if (!hour || hour.isClosed) return [day, { ...defaultSchedule[day] }];
    const allDay = hour.opensAt === "00:00" && hour.closesAt === "23:59";
    return [day, { enabled: true, allDay, open: hour.opensAt ?? "08:00", close: hour.closesAt ?? "18:00" }];
  })) as Record<string, ScheduleDay>;
};
const scheduleToModalityHours = (value: Record<string, ScheduleDay>) => scheduleDays.map(day => {
  const entry = value[day];
  return { dayOfWeek: scheduleDayOfWeek[day], isClosed: !entry.enabled, opensAt: entry.enabled ? (entry.allDay ? "00:00" : entry.open) : null, closesAt: entry.enabled ? (entry.allDay ? "23:59" : entry.close) : null, timezone: "America/Bogota" };
});
const displaySchedule = (value: Record<string, ScheduleDay>) => scheduleDays.map(day => [day, !value[day].enabled ? "Cerrado" : value[day].allDay ? "24 horas" : `${formatHour(value[day].open)} – ${formatHour(value[day].close)}`]);
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
function normalizeSocialUrl(value: string, domains: string[]) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    const hostname = parsed.hostname.toLowerCase();
    const isOfficialDomain = domains.some(domain => hostname === domain || hostname.endsWith(`.${domain}`));
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || !isOfficialDomain) return null;
    const pathname = parsed.pathname === "/" ? "" : parsed.pathname.replace(/\/+$/, "");
    return `https://${hostname}${pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}
const normalizeInstagram = (value: string) => normalizeSocialUrl(value, ["instagram.com"]);
const formatHour = (value: string) => { const [hour, minute] = value.split(":").map(Number); if (!Number.isFinite(hour)) return value; const suffix = hour >= 12 ? "p. m." : "a. m."; const displayHour = hour % 12 || 12; return `${displayHour}:${String(minute).padStart(2, "0")} ${suffix}`; };
const nicknamePattern = /^@?[a-zA-Z0-9._-]{3,30}$/;
const modalityTypes: ModalityType[] = ["PHYSICAL", "VIRTUAL", "DELIVERY"];
const modalityLabels: Record<ModalityType, string> = { PHYSICAL: "Física", VIRTUAL: "Virtual", DELIVERY: "A domicilio" };
const sectionLabels: Record<Exclude<EditableSection, null>, string> = { general: "la información comercial", sede: "la sede", description: "la descripción", location: "la ubicación", contact: "el contacto", hours: "el horario" };
const categoryLabel = (value: string) => categories.find(item => categoryCodeFromLabel(item) === categoryCodeFromLabel(value)) ?? value;
const verificationStatusLabel = (business: BusinessDetails) => business.verificationStatus === "APPROVED" ? "Verificado" : business.verificationStatus === "INFORMATION" ? "Requiere confirmación" : business.verificationStatus === "REJECTED" ? "Rechazado" : business.status === "Verificado" ? "Verificado" : business.status === "Requiere confirmación" ? "Requiere confirmación" : "Pendiente";
function DetailSectionIcon({ title }: { title: string }) {
  const paths: Record<string, ReactNode> = {
    "Cámara": <><path d="M8 5 10 3h4l2 2h5v16H3V5h5Z" /><circle cx="12" cy="12" r="4" /></>,
    "Ver perfil": <><path d="M14 3h7v7M21 3l-10 10M10 3H3v18h18v-7" /></>,
    "Compartir": <><path d="M12 16V3m-5 5 5-5 5 5M4 13v8h16v-8" /></>,
    "Más opciones": <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
    "Descripción": <><path d="M8 4h8l4 4v12H4V4h4M14 4v5h6M8 13h8M8 17h5" /></>,
    "Fotografías": <><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="8" cy="9" r="1.5" /><path d="m3 17 5-5 4 4 4-6 5 7" /></>,
    "Nombre y sede": <><path d="M5 7h14l2 5H3l2-5ZM4 12v9h16v-9M9 21v-6h6v6M6 3h12" /></>,
    "Modalidades de atención": <><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></>,
    "Ubicación y dirección": <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    "Información de contacto": <path d="m8 3 3 5-3 3a17 17 0 0 0 5 5l3-3 5 3-1 4c-1 3-9-1-13-5S0 4 3 3l5 0Z" />,
    "Clasificación +18": <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z" /><path d="M8 12h8M12 8v8" /></>,
    "Personas con acceso": <><circle cx="9" cy="8" r="3" /><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6M18 15a5 5 0 0 1 3 5" /></>,
    "Horarios de atención": <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[title]}</svg>;
}
type SocialNetworkPlatform = "facebook" | "instagram" | "x" | "tiktok";
function SocialNetworkIcon({ platform }: { platform: SocialNetworkPlatform }) {
  if (platform === "facebook") return <svg className="business-social-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#1877F2" /><path fill="white" d="M13.46 19v-6.13h2.06l.31-2.39h-2.37V8.95c0-.69.19-1.17 1.19-1.17h1.27V5.64c-.22-.03-.98-.1-1.87-.1-1.85 0-3.12 1.13-3.12 3.21v1.73H9v2.39h2.1V19h2.36Z" /></svg>;
  if (platform === "instagram") return <svg className="business-social-icon" viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="business-instagram-gradient" x1="3" y1="21" x2="21" y2="3" gradientUnits="userSpaceOnUse"><stop stopColor="#FEDA75" /><stop offset=".28" stopColor="#FA7E1E" /><stop offset=".62" stopColor="#D62976" /><stop offset="1" stopColor="#7B2CBF" /></linearGradient></defs><rect x="1.4" y="1.4" width="21.2" height="21.2" rx="5.9" fill="url(#business-instagram-gradient)" /><rect x="6.25" y="6.25" width="11.5" height="11.5" rx="3.5" fill="none" stroke="white" strokeWidth="1.8" /><circle cx="12" cy="12" r="2.75" fill="none" stroke="white" strokeWidth="1.8" /><circle cx="17.25" cy="6.9" r="1.05" fill="white" /></svg>;
  if (platform === "x") return <svg className="business-social-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="1.4" y="1.4" width="21.2" height="21.2" rx="3.2" fill="#050505" /><path fill="white" d="M17.87 4.6h2.05l-4.48 5.12L20.72 19h-4.14l-3.24-4.13L9.73 19H7.67l4.81-5.5L7.42 4.6h4.22l2.93 3.79 3.3-3.79Zm-.72 12.91h1.14L11.02 6h-1.22l7.35 11.51Z" /></svg>;
  return <svg className="business-social-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="1.4" y="1.4" width="21.2" height="21.2" rx="3.2" fill="#050505" /><path fill="#25F4EE" d="M14.34 3.05c.55 3.48 2.49 5.55 5.66 5.98v3.55c-1.85-.06-3.57-.57-5.12-1.52v6.36a6.38 6.38 0 1 1-5.5-6.32v3.59a2.91 2.91 0 1 0 2.05 2.79V3.05h2.91Z" /><path fill="#FE2C55" d="M12.85 2.05c.56 3.49 2.5 5.56 5.67 5.99v2.66a9.12 9.12 0 0 1-4.17-1.17v7.39a6.38 6.38 0 1 1-5.5-6.32v2.66a3.72 3.72 0 1 0 2.06 3.34V2.05h1.94Z" /><path fill="white" d="M13.56 2.6c.5 3.12 2.26 4.98 5.14 5.36v1.67a8.44 8.44 0 0 1-4.3-1.55v8.59a5.68 5.68 0 1 1-5.5-5.67v1.88a3.8 3.8 0 1 0 2.73 3.64V2.6h1.93Z" /></svg>;
}
const StaticLocationPreview = ({ business }: { business: BusinessDetails }) => {
  const [expanded, setExpanded] = useState(false);
  const [staticMapFailed, setStaticMapFailed] = useState(false);
  const returnFocusRef = useRef<HTMLButtonElement | null>(null);
  const hasCoordinates = business.latitude != null && business.longitude != null && (business.locationVisibility === "PUBLIC" || business.role === "Propietario");
  const query = hasCoordinates ? `${business.latitude},${business.longitude}` : "";
  const key = import.meta.env.VITE_GOOGLE_MAPS_STATIC_API_KEY?.trim();
  useEffect(() => { setStaticMapFailed(false); }, [query]);
  useEffect(() => {
    if (!expanded) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setExpanded(false); }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [expanded]);
  if (!hasCoordinates) return null;
  const previewUrl = key ? `https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(query)}&zoom=16&size=640x240&scale=2&maptype=satellite&markers=color:red%7C${encodeURIComponent(query)}&key=${encodeURIComponent(key)}` : "";
  const expandedUrl = key ? `https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(query)}&zoom=18&size=640x640&scale=2&maptype=satellite&markers=color:red%7C${encodeURIComponent(query)}&key=${encodeURIComponent(key)}` : "";
  const closeExpanded = () => { setExpanded(false); window.requestAnimationFrame(() => returnFocusRef.current?.focus({ preventScroll: true })); };
  return <>
    <div className="business-detail-static-map">
      <div className="business-detail-static-map__frame">
        {key && !staticMapFailed ? <button ref={returnFocusRef} type="button" className="business-detail-static-map__trigger" onClick={() => setExpanded(true)} aria-label="Ampliar mapa de ubicación">
          <img src={previewUrl} alt={`Mapa de ${business.name}`} loading="lazy" onError={() => setStaticMapFailed(true)} /><span className="business-detail-static-map__expand" aria-hidden="true">⤢</span>
        </button> : <span>Vista previa no disponible.</span>}
      </div>
    </div>
    {expanded && key && <div className="business-static-map-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) closeExpanded(); }}>
      <div className="business-static-map-modal" role="dialog" aria-modal="true" aria-labelledby="business-static-map-title">
        <div className="business-static-map-modal__heading"><h2 id="business-static-map-title">Ubicación de {business.name}</h2><button type="button" className="close-button" onClick={closeExpanded} aria-label="Cerrar mapa ampliado">×</button></div>
        <img src={expandedUrl} alt={`Mapa satelital ampliado de ${business.name}`} />
      </div>
    </div>}
  </>;
};
type EditableSection = "general" | "sede" | "description" | "location" | "contact" | "hours" | null;
type HeaderImagePosition = { x: number; y: number };
type CoverDraft = { file: File; previewUrl: string; position: HeaderImagePosition };
const safeImagePosition = (value?: HeaderImagePosition): HeaderImagePosition => ({ x: Number.isFinite(value?.x) ? Math.min(100, Math.max(0, value!.x)) : 50, y: Number.isFinite(value?.y) ? Math.min(100, Math.max(0, value!.y)) : 50 });

export function BusinessDetailPage() {
  const { index = "0" } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [clock, setClock] = useState(() => new Date());
  const tabKeys = ["general", "location", "hours", "photos", "contact"] as const;
  type DetailTab = typeof tabKeys[number];
  const tabParam = searchParams.get("tab");
  const activeTab: DetailTab = tabKeys.includes(tabParam as DetailTab) ? tabParam as DetailTab : "general";
  const showCollaborators = searchParams.get("section") === "collaborators";
  useEffect(() => {
    if (searchParams.get("tab") !== "card") return;
    const next = new URLSearchParams(searchParams);
    next.delete("tab");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);
  const selectTab = (tab: DetailTab) => {
    const next = new URLSearchParams(searchParams);
    next.delete("section");
    next.set("tab", tab);
    setSearchParams(next, { replace: true });
  };
  useEffect(() => { const timer = window.setInterval(() => setClock(new Date()), 60000); return () => window.clearInterval(timer); }, []);
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
  const [manualLocationStatus, setManualLocationStatus] = useState("");
  const [manualLocationBusy, setManualLocationBusy] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const photoEditorBusinessRef = useRef<string | null>(null);
  const [editingPhotos, setEditingPhotos] = useState(false);
  const [photoDeleteConfirmation, setPhotoDeleteConfirmation] = useState<string | null>(null);
  const [galleryScroll, setGalleryScroll] = useState({ left: 0, max: 0 });
  const galleryStripRef = useRef<HTMLDivElement>(null);
  const galleryDragRef = useRef({ active: false, startX: 0, startScrollLeft: 0, moved: false });
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [headerImageError, setHeaderImageError] = useState("");
  const [coverDraft, setCoverDraft] = useState<CoverDraft | null>(null);
  const [coverPickerOpen, setCoverPickerOpen] = useState(false);
  const [selectedCoverPhotoId, setSelectedCoverPhotoId] = useState<string | null>(null);
  const [profilePickerOpen, setProfilePickerOpen] = useState(false);
  const [selectedProfilePhotoId, setSelectedProfilePhotoId] = useState<string | null>(null);
  const [profilePosition, setProfilePosition] = useState<HeaderImagePosition>({ x: 50, y: 50 });
  const coverInputRef = useRef<HTMLInputElement>(null);
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
  const [modalityRecords, setModalities] = useState<RealModality[]>([]);
  const [modalitiesBusinessId, setModalitiesBusinessId] = useState<string | null>(null);
  const [modalitiesLoading, setModalitiesLoading] = useState(false);
  const [modalitiesError, setModalitiesError] = useState("");
  const [modalityBusy, setModalityBusy] = useState<string | null>(null);
  const [modalityConfirmation, setModalityConfirmation] = useState<ModalityType | null>(null);
  const [modalityConfirmationError, setModalityConfirmationError] = useState("");
  const [referralSummary, setReferralSummary] = useState<BusinessReferralSummary | null>(null);
  const [referralState, setReferralState] = useState<'loading' | 'available' | 'unavailable'>('loading');
  const [shareMessage, setShareMessage] = useState("");
  const [sharing, setSharing] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const shareWrapRef = useRef<HTMLDivElement>(null);
  const modalityConfirmationCancelRef = useRef<HTMLButtonElement>(null);
  const businessIndex = Number(index);
  const businessById = businesses.find(item => item.id === index);
  const hasValidIndex = Number.isInteger(businessIndex) && businessIndex >= 0 && businessIndex < businesses.length;
  const hasValidBusiness = Boolean(businessById) || hasValidIndex;
  const business = businessById ?? businesses[hasValidIndex ? businessIndex : 0];
  const shareUrl = getPublicBusinessUrl(business?.publicId);
  const modalities = modalitiesBusinessId === (business?.id ?? null) ? modalityRecords : [];
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
    const businessChanged = photoEditorBusinessRef.current !== business.id;
    setGalleryIndex(0);
    setGalleryScroll({ left: 0, max: 0 });
    if (businessChanged) {
      setEditingPhotos(false);
      setEditingSection(null);
      setSectionConfirmation(null);
      setSectionError("");
      setSectionNotice("");
      setModalityConfirmation(null);
      setCoverDraft(null);
      setCoverPickerOpen(false);
      setProfilePickerOpen(false);
      setHeaderImageError("");
    }
    setPhotoDeleteConfirmation(null);
    photoEditorBusinessRef.current = business.id ?? null;
    setConfirmingDelete(false);
    setConfirmingRecovery(false);
    setShowCollaboratorForm(false);
    setConfirmingCollaboratorRemoval(null);
    setConfirmingLeave(false);
  }, [business, setBusiness]);
  useEffect(() => () => { if (coverDraft?.previewUrl) URL.revokeObjectURL(coverDraft.previewUrl); }, [coverDraft?.previewUrl]);
  useEffect(() => {
    if (!coverDraft && !coverPickerOpen && !profilePickerOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape" && !photoBusy) { setCoverDraft(null); setCoverPickerOpen(false); setProfilePickerOpen(false); setHeaderImageError(""); } };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [coverDraft, coverPickerOpen, photoBusy, profilePickerOpen]);
  useEffect(() => {
    if (!business?.id) { setModalities([]); setModalitiesBusinessId(null); setModalitiesLoading(false); return; }
    let cancelled = false;
    setModalitiesLoading(true);
    setModalitiesError("");
    businessApi.listModalities(business.id).then(response => {
      if (!cancelled) { setModalities(response.modalities); setModalitiesBusinessId(business.id ?? null); }
    }).catch(cause => {
      if (!cancelled) setModalitiesError(cause instanceof BusinessApiError ? cause.message : "No se pudieron cargar las modalidades.");
    }).finally(() => { if (!cancelled) setModalitiesLoading(false); });
    return () => { cancelled = true; };
  }, [business?.id]);
  useEffect(() => {
    if (!business?.id) { setReferralSummary(null); setReferralState('unavailable'); return; }
    let cancelled = false;
    setReferralSummary(null);
    setReferralState('loading');
    businessApi.getReferralSummary(business.id).then(response => {
      if (!cancelled) { setReferralSummary(response.referralSummary); setReferralState('available'); }
    }).catch(() => {
      if (!cancelled) setReferralState('unavailable');
    });
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
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const strip = galleryStripRef.current;
      if (strip) setGalleryScroll({ left: strip.scrollLeft, max: Math.max(0, strip.scrollWidth - strip.clientWidth) });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [business.images?.length, editingPhotos, activeTab]);
  useEffect(() => {
    if (!shareOpen) return;
    const close = (event: PointerEvent) => { if (!shareWrapRef.current?.contains(event.target as Node)) setShareOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setShareOpen(false); };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); };
  }, [shareOpen]);
  if (!hasValidBusiness || !business) return <Navigate to="/mis-negocios" replace />;
  const shareBusiness = async () => {
    if (!shareUrl || sharing) return;
    setShareOpen(false);
    setSharing(true);
    setShareMessage("");
    const result = await shareLink(business.name, `Descubre ${business.name} en XAMUKO.`, shareUrl);
    setShareMessage(result === "copied" ? "Enlace copiado." : result === "unavailable" ? "No se pudo compartir el enlace." : "");
    setSharing(false);
  };
  const weeklyHours = modalities.some(item => item.hours.length > 0) || business.hours.trim()
    ? displaySchedule(scheduleFromModalities(modalities, business.hours))
    : scheduleDays.map(day => [day, "Sin horario configurado"]);
  const incompleteActiveModalities = modalities.filter(item => item.status === "ACTIVE" && (item.blockers?.length ?? 0) > 0);
  const replaceBusiness = (nextBusiness: BusinessDetails) => { setBusinesses(businesses.map(item => item === business ? nextBusiness : item)); setBusiness(nextBusiness); setDraft(nextBusiness); };
  const selectCoverImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) { setHeaderImageError("La portada debe ser JPG, PNG o WebP y pesar máximo 5 MB."); return; }
    setHeaderImageError("");
    setCoverPickerOpen(false);
    setCoverDraft({ file, previewUrl: URL.createObjectURL(file), position: safeImagePosition(business.coverImagePosition) });
  };
  const openCoverPicker = () => {
    setSelectedCoverPhotoId(business.coverPhotoId ?? business.photos?.find(photo => photo.isCover)?.id ?? business.photos?.[0]?.id ?? null);
    setHeaderImageError("");
    setCoverPickerOpen(true);
  };
  const saveSelectedCover = async () => {
    if (!business.id || !selectedCoverPhotoId) return;
    setPhotoBusy(true); setHeaderImageError("");
    try { await businessApi.setPhotoCover(business.id, selectedCoverPhotoId); replaceBusiness(toBusinessDetails((await businessApi.get(business.id)).business)); setCoverPickerOpen(false); }
    catch (cause) { setHeaderImageError(cause instanceof BusinessApiError ? cause.message : "No se pudo actualizar la portada."); }
    finally { setPhotoBusy(false); }
  };
  const clearSelectedCover = async () => {
    if (!business.id || !business.coverPhotoId) return;
    setPhotoBusy(true); setHeaderImageError("");
    try { await businessApi.clearCoverPhoto(business.id); replaceBusiness(toBusinessDetails((await businessApi.get(business.id)).business)); setCoverPickerOpen(false); }
    catch (cause) { setHeaderImageError(cause instanceof BusinessApiError ? cause.message : "No se pudo quitar la portada."); }
    finally { setPhotoBusy(false); }
  };
  const saveCoverImage = async () => {
    if (!business.id || !coverDraft) return;
    setPhotoBusy(true); setHeaderImageError("");
    try { await businessApi.uploadCoverPhoto(business.id, coverDraft.file, coverDraft.position); replaceBusiness(toBusinessDetails((await businessApi.get(business.id)).business)); setCoverDraft(null); }
    catch (cause) { setHeaderImageError(cause instanceof BusinessApiError ? cause.message : "No se pudo actualizar la portada."); }
    finally { setPhotoBusy(false); }
  };
  const openProfilePicker = () => {
    setSelectedProfilePhotoId(business.profilePhotoId ?? null);
    setProfilePosition(safeImagePosition(business.profileImagePosition));
    setHeaderImageError("");
    setProfilePickerOpen(true);
  };
  const saveProfileImage = async () => {
    if (!business.id) return;
    setPhotoBusy(true); setHeaderImageError("");
    try { await businessApi.setProfilePhoto(business.id, selectedProfilePhotoId, profilePosition); replaceBusiness(toBusinessDetails((await businessApi.get(business.id)).business)); setProfilePickerOpen(false); }
    catch (cause) { setHeaderImageError(cause instanceof BusinessApiError ? cause.message : "No se pudo actualizar la imagen del negocio."); }
    finally { setPhotoBusy(false); }
  };
  const uploadDetailPhotos = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!business.id || !files.length) return;
    if ((business.photos?.length ?? 0) + files.length > 10) { setPhotoError("Cada negocio puede tener máximo 10 fotografías."); return; }
    const invalid = files.find(file => !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024);
    if (invalid) { setPhotoError("Cada fotografía debe ser JPG, PNG o WebP y pesar máximo 5 MB."); return; }
    setPhotoBusy(true); setPhotoError("");
    let uploadedCount = 0;
    try { for (const [index, file] of files.entries()) { await businessApi.uploadPhoto(business.id, file, !business.photos?.length && index === 0); uploadedCount += 1; } }
    catch (cause) { setPhotoError(cause instanceof BusinessApiError ? cause.message : "No se pudieron guardar las fotografías."); }
    finally { if (uploadedCount > 0) { try { replaceBusiness(toBusinessDetails((await businessApi.get(business.id)).business)); } catch { setPhotoError(current => current || "Las fotos se guardaron, pero no se pudo actualizar la galería."); } } setPhotoBusy(false); }
  };
  const removeDetailPhoto = async (photoId: string) => {
    if (!business.id) return;
    setPhotoBusy(true); setPhotoError("");
    try { await businessApi.deletePhoto(business.id, photoId); replaceBusiness(toBusinessDetails((await businessApi.get(business.id)).business)); setGalleryIndex(0); setPhotoDeleteConfirmation(null); }
    catch (cause) { setPhotoError(cause instanceof BusinessApiError ? cause.message : "No se pudo eliminar la fotografía."); }
    finally { setPhotoBusy(false); }
  };
  const beginGalleryDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const strip = galleryStripRef.current;
    if (!strip) return;
    galleryDragRef.current = { active: true, startX: event.clientX, startScrollLeft: strip.scrollLeft, moved: false };
    strip.setPointerCapture(event.pointerId);
  };
  const moveGalleryDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = galleryDragRef.current;
    const strip = galleryStripRef.current;
    if (!drag.active || !strip) return;
    const distance = event.clientX - drag.startX;
    if (Math.abs(distance) > 4) drag.moved = true;
    strip.scrollLeft = drag.startScrollLeft - distance;
  };
  const endGalleryDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (galleryDragRef.current.active && galleryStripRef.current?.hasPointerCapture(event.pointerId)) galleryStripRef.current.releasePointerCapture(event.pointerId);
    galleryDragRef.current.active = false;
  };
  const selectGalleryImage = (imageIndex: number) => {
    setGalleryIndex(imageIndex);
    galleryDragRef.current.moved = false;
  };
  const info = (entries: string[][]) => <div className="business-detail-grid">{entries.map(([label, value]) => <div key={label}><small>{label}</small><strong>{value || "Sin información"}</strong></div>)}</div>;
  const recoveryDeadline = business.recoveryUntil ? new Date(business.recoveryUntil).getTime() : NaN;
  const recoveryHasDeadline = Number.isFinite(recoveryDeadline);
  const recoveryAvailable = business.deletionStatus === "RECOVERY" && (!recoveryHasDeadline || recoveryDeadline > Date.now());
  const recoveryDaysLeft = recoveryHasDeadline ? Math.max(0, Math.ceil((recoveryDeadline - Date.now()) / 86400000)) : 0;
  const remove = async () => { if (business.role !== "Propietario" || !business.id) return; setSaveError(""); try { const response = await businessApi.requestDeletion(business.id); const nextBusiness = toBusinessDetails(response.business); setBusinesses(businesses.map(item => item === business ? nextBusiness : item)); setBusiness(nextBusiness); setDraft(nextBusiness); setConfirmingDelete(false); setEditing(false); } catch (cause) { setSaveError(cause instanceof BusinessApiError ? cause.message : "No se pudo solicitar la eliminación del negocio."); } };
  const recover = async () => { if (!recoveryAvailable || !business.id) return; setSaveError(""); try { const response = await businessApi.recoverBusiness(business.id); const recovered = toBusinessDetails(response.business); setBusinesses(businesses.map(item => item === business ? recovered : item)); setBusiness(recovered); setDraft(recovered); setConfirmingRecovery(false); } catch (cause) { setSaveError(cause instanceof BusinessApiError ? cause.message : "No se pudo recuperar el negocio."); } };
  const updateDraft = (field: keyof typeof draft, value: string | number | boolean | undefined) => setDraft(current => ({ ...current, [field]: value }));
  const formatPhone = (country: PhoneCountryCode, number: string) => number ? `${phoneCountryFor(country).dialCode ?? country} ${number}` : null;
  const hasContactChannel = Boolean(business.phone || business.whatsapp || business.email || business.website || business.instagram);
  const hasVirtualChannel = Boolean(business.whatsapp || normalizeWebsite(business.website) || normalizeInstagram(business.instagram));
  const modalityErrorMessage = (cause: unknown, fallback: string) => cause instanceof BusinessApiError ? cause.fields.modality || cause.message : fallback;
  const canEditModalities = business.role === "Propietario" || business.permissions?.includes("EDIT_BUSINESS") === true;
  const canEditContact = business.role === "Propietario" || business.permissions?.includes("EDIT_BUSINESS") === true;
  const municipalities = locationCatalog.municipalities.filter(item => item.departmentCode === editDepartment);
  const save = async (event: FormEvent) => { event.preventDefault(); setSaveError(""); if (business.id && draft.address.trim() !== business.address.trim() && (draft.latitude == null || draft.longitude == null)) { setSaveError("Confirma la ubicación encontrada para la nueva dirección o selecciónala en el mapa."); return; } if (business.id) { setSaving(true); try { const response = await businessApi.update(business.id, { name: draft.name, adultOnly: Boolean(draft.adultOnly), categoryCode: categoryCodeFromLabel(draft.category), secondaryCategoryCodes: draftSecondaryCategories.filter(item => item !== draft.category).map(categoryCodeFromLabel), description: draft.description, cityName: draft.city, address: draft.address, latitude: draft.latitude ?? null, longitude: draft.longitude ?? null, additionalAddressInfo: draft.additionalAddressInfo?.trim() || null, phone: draft.phone || null, whatsapp: draft.whatsapp || null, email: draft.email || null, website: draft.website || null, instagram: draft.instagram || null }); const nextBusiness = toBusinessDetails(response.business); setBusinesses(businesses.map(item => item === business ? nextBusiness : item)); setBusiness(nextBusiness); setDraft(nextBusiness); setEditing(false); } catch (cause) { setSaveError(cause instanceof BusinessApiError ? cause.message : "No se pudieron guardar los cambios."); } finally { setSaving(false); } return; } const next = businesses.map(item => item === business ? draft : item); setBusinesses(next); setBusiness(draft); setEditing(false); };
  const beginSectionEdit = (section: Exclude<EditableSection, null>) => {
    selectTab(section === "sede" || section === "description" ? "general" : section);
    setDraft(business);
    setDraftSecondaryCategories(business.secondaryCategories ?? []);
    setSectionError("");
    setSectionNotice("");
    setSectionConfirmation(null);
    if (section === "location") {
      const municipality = locationCatalog.municipalities.find(item => item.name === business.city);
      if (municipality) setEditDepartment(municipality.departmentCode);
    }
    if (section === "hours") setEditHours(scheduleFromModalities(modalities, business.hours));
    setEditingSection(section);
  };
  const cancelSectionEdit = () => { setEditingSection(null); setSectionError(""); setSectionNotice(""); setSectionConfirmation(null); setDraft(business); setDraftSecondaryCategories(business.secondaryCategories ?? []); setEditHours(scheduleFromModalities(modalities, business.hours)); };
  const confirmManualLocation = async () => {
    const query = [draft.address.trim(), draft.city.trim(), locationCatalog.departments.find(item => item.code === editDepartment)?.name].filter(Boolean).join(", ");
    if (!draft.address.trim() || !draft.city.trim()) { setManualLocationStatus("Escribe la dirección y selecciona la ciudad para continuar."); return; }
    setManualLocationBusy(true); setManualLocationStatus("");
    try {
      const result = await geocodeBusinessAddress(query);
      if (!result) { updateDraft("latitude", undefined); updateDraft("longitude", undefined); setManualLocationStatus("No encontramos esa dirección. Corrígela o selecciónala en el mapa."); return; }
      updateDraft("latitude", result.lat); updateDraft("longitude", result.lng);
      setManualLocationStatus("Ubicación encontrada. Confirma que corresponde a tu negocio antes de guardar.");
    } catch {
      updateDraft("latitude", undefined); updateDraft("longitude", undefined);
      setManualLocationStatus("No se pudo geocodificar la dirección. Puedes seleccionarla en el mapa.");
    } finally { setManualLocationBusy(false); }
  };

  const saveSection = async (section: Exclude<EditableSection, null>, deactivateModalities: ModalityType[] = []) => {
    if (!business.id) {
      setEditingSection(null);
      return;
    }
    setSectionSaving(section);
    setSectionError("");
    if (section === "location" && editLocationMode === "address" && (draft.latitude == null || draft.longitude == null)) {
      setSectionError("Confirma la ubicación encontrada para esta dirección o selecciónala en el mapa.");
      setSectionSaving(null);
      return;
    }
    setSectionNotice("");
    if (!deactivateModalities.length) setSectionConfirmation(null);
    try {
      if (section === "hours") {
        const modality = scheduleModality(modalities);
        if (!modality) {
          setSectionError("Configura una modalidad antes de guardar los horarios.");
          return;
        }
        const response = await businessApi.updateModalityHours(business.id, modality.id, scheduleToModalityHours(editHours));
        const nextBusiness = { ...business, hours: scheduleToText(editHours) };
        setModalities(current => current.map(item => item.id === modality.id ? response.modality : item));
        setBusinesses(businesses.map(item => item === business ? nextBusiness : item));
        setBusiness(nextBusiness);
        setDraft(nextBusiness);
        setEditingSection(null);
        setSectionNotice("Horario guardado.");
        return;
      }
      const normalizedWebsite = section === "contact" ? normalizeWebsite(draft.website) : undefined;
      const normalizedInstagram = section === "contact" ? normalizeInstagram(draft.instagram) : undefined;
      const normalizedFacebook = section === "contact" ? normalizeSocialUrl(draft.facebookUrl, ["facebook.com", "fb.com"]) : undefined;
      const normalizedX = section === "contact" ? normalizeSocialUrl(draft.xUrl, ["x.com", "twitter.com"]) : undefined;
      const normalizedTiktok = section === "contact" ? normalizeSocialUrl(draft.tiktokUrl, ["tiktok.com"]) : undefined;
      if (section === "contact" && normalizedWebsite === null) {
        setSectionError("Ingresa un dominio válido, por ejemplo www.ejemplo.com.");
        setSectionSaving(null);
        return;
      }
      if (section === "contact" && normalizedInstagram === null) {
        setSectionError("Ingresa un enlace válido de Instagram.");
        setSectionSaving(null);
        return;
      }
      if (section === "contact" && normalizedFacebook === null) {
        setSectionError("Ingresa un enlace válido de Facebook.");
        setSectionSaving(null);
        return;
      }
      if (section === "contact" && normalizedX === null) {
        setSectionError("Ingresa un enlace válido de X.");
        setSectionSaving(null);
        return;
      }
      if (section === "contact" && normalizedTiktok === null) {
        setSectionError("Ingresa un enlace válido de TikTok.");
        setSectionSaving(null);
        return;
      }
      const basePayload = section === "general"
        ? { name: draft.name, sede: draft.sede?.trim() || null, description: draft.description, adultOnly: Boolean(draft.adultOnly), categoryCode: categoryCodeFromLabel(draft.category), secondaryCategoryCodes: draftSecondaryCategories.filter(item => item !== draft.category).map(categoryCodeFromLabel) }
          : section === "sede" ? { sede: draft.sede?.trim() || null }
          : section === "description" ? { description: draft.description }
          : section === "contact" ? { phone: formatPhone(phoneCountry, phoneNumber), whatsapp: formatPhone(whatsappCountry, whatsappNumber), email: draft.email || null, website: normalizedWebsite || null, instagram: normalizedInstagram || null, facebookUrl: normalizedFacebook || null, xUrl: normalizedX || null, tiktokUrl: normalizedTiktok || null }
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
      setSectionNotice(section === "general" ? "Información general guardada." : section === "sede" ? "Sede guardada." : section === "description" ? "Descripción guardada." : section === "contact" ? "Contacto guardado." : "Ubicación guardada.");
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
    {editingSection === "general" ? <form className="business-detail-inline-form" onSubmit={event => { event.preventDefault(); void saveSection("general"); }}>
      <div className="form-grid"><label className="form-field"><span>Nombre comercial</span><input value={draft.name} onChange={event => updateDraft("name", event.target.value)} required /></label><label className="form-field"><span>Categoría principal</span><select value={categoryLabel(draft.category)} onChange={event => { const next = event.target.value; updateDraft("category", next); setDraftSecondaryCategories(current => current.filter(item => categoryCodeFromLabel(item) !== categoryCodeFromLabel(next))); }} required>{categories.map(item => <option key={item} value={item}>{formatCategoryName(item)}</option>)}</select></label><label className="form-field full-field"><span>Sede (opcional)</span><input value={draft.sede ?? ""} maxLength={160} onChange={event => updateDraft("sede", event.target.value)} placeholder="Ej. Centro" /></label><label className="form-field full-field"><span>Descripción del negocio</span><textarea value={draft.description} onChange={event => updateDraft("description", event.target.value)} rows={4} maxLength={300} /></label></div>
      <fieldset className="form-field category-secondary-field"><legend>Categorías secundarias <small>(opcional)</small></legend><div className="category-secondary-grid">{categories.filter(item => categoryCodeFromLabel(item) !== categoryCodeFromLabel(draft.category)).map(item => <label className={`category-secondary-option${draftSecondaryCategories.some(value => categoryCodeFromLabel(value) === categoryCodeFromLabel(item)) ? " selected" : ""}`} key={item}><input type="checkbox" checked={draftSecondaryCategories.some(value => categoryCodeFromLabel(value) === categoryCodeFromLabel(item))} onChange={() => setDraftSecondaryCategories(current => current.some(value => categoryCodeFromLabel(value) === categoryCodeFromLabel(item)) ? current.filter(value => categoryCodeFromLabel(value) !== categoryCodeFromLabel(item)) : [...current, item])} /><span>{formatCategoryName(item)}</span></label>)}</div></fieldset><fieldset className="form-field adult-only-field"><label className="adult-only-row"><span className="adult-only-copy"><strong>Contenido exclusivo para mayores de 18 años</strong><small>Actívalo únicamente si tu establecimiento está dirigido exclusivamente a adultos.</small></span><span className="adult-only-control"><input type="checkbox" checked={Boolean(draft.adultOnly)} onChange={event => updateDraft("adultOnly", event.target.checked)} /><span className="adult-only-info" role="img" aria-label="La clasificación +18 es informativa, no una verificación legal">ⓘ</span></span></label></fieldset>
      {sectionError && <p className="form-error" role="alert">{sectionError}</p>}<div className="business-detail-inline-actions"><button className="outline-button" type="button" onClick={cancelSectionEdit}>Cancelar</button><button className="action-button" type="submit" disabled={sectionSaving !== null}>{sectionSaving === "general" ? "Guardando…" : "Guardar cambios"}</button></div>
    </form> : <>{info([["Nombre comercial", business.name], ["Categoría principal", categoryLabel(business.category)], ["Categorías secundarias", (business.secondaryCategories ?? []).map(categoryLabel).join(", ") || "Ninguna"]])}</>}
  </section>;
  const locationSection = <section className="business-detail-section" data-business-section="location">
    <div className="business-section-heading"><div><h3>Ubicación</h3><p>La dirección pública solo se muestra cuando el negocio tiene atención física.</p></div>{business.role === "Propietario" && <button className="text-button business-section-edit" type="button" onClick={() => beginSectionEdit("location")}>✎ Editar</button>}</div>
    {editingSection === "location" ? <form className="business-detail-inline-form" onSubmit={event => { event.preventDefault(); void saveSection("location"); }}><div className="form-grid"><label className="form-field"><span>Departamento</span><select value={editDepartment} onChange={event => { setEditDepartment(event.target.value); updateDraft("city", ""); }} required>{locationCatalog.departments.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}</select></label><label className="form-field"><span>Ciudad o municipio</span><select value={draft.city} onChange={event => updateDraft("city", event.target.value)} required><option value="">Selecciona una ciudad o municipio</option>{municipalities.map(item => <option key={item.id}>{item.name}</option>)}</select></label></div><div className="location-mode-toggle" role="group" aria-label="Forma de indicar la ubicación"><button type="button" className={editLocationMode === "address" ? "active" : ""} onClick={() => setEditLocationMode("address")}>Escribir dirección</button><button type="button" className={editLocationMode === "map" ? "active" : ""} onClick={() => setEditLocationMode("map")}>Seleccionar en el mapa</button></div>{editLocationMode === "address" ? <><label className="form-field full-field"><span>Dirección</span><input value={draft.address} onChange={event => { updateDraft("address", event.target.value); updateDraft("latitude", undefined); updateDraft("longitude", undefined); setManualLocationStatus(""); }} placeholder="Calle, carrera y número" /><button type="button" className="outline-button location-confirm-button" onClick={() => void confirmManualLocation()} disabled={manualLocationBusy}>{manualLocationBusy ? "Buscando ubicación…" : "Confirmar ubicación"}</button>{manualLocationStatus && <small className={`location-geocode-status ${manualLocationStatus.includes("Ubicación encontrada") ? "is-success" : manualLocationStatus.includes("No encontramos") || manualLocationStatus.includes("No se pudo") ? "is-error" : "is-warning"}`} role="status">{manualLocationStatus}</small>}</label><label className="form-field full-field"><span>Información adicional de la dirección (opcional)</span><input value={draft.additionalAddressInfo ?? ""} maxLength={200} onChange={event => updateDraft("additionalAddressInfo", event.target.value)} placeholder="Ej. Centro Comercial La Nube, local 204" /></label></> : <><BusinessLocationPicker value={draft.latitude != null && draft.longitude != null ? { lat: draft.latitude, lng: draft.longitude } : null} query={[draft.address, draft.city].filter(Boolean).join(", ")} onChange={value => { updateDraft("latitude", value.lat); updateDraft("longitude", value.lng); }} /><p className="form-help">Selecciona o mueve el marcador. Confirma después con “Guardar cambios”.</p></>}{sectionError && <p className="form-error" role="alert">{sectionError}</p>}<div className="business-detail-inline-actions"><button className="outline-button" type="button" onClick={cancelSectionEdit}>Cancelar</button><button className="action-button" type="submit" disabled={sectionSaving !== null}>{sectionSaving === "location" ? "Guardando…" : "Guardar cambios"}</button></div></form> : <>{info([["País", business.countryCode ? (new Intl.DisplayNames(["es"], { type: "region" }).of(business.countryCode) ?? business.countryCode) : ""], ["Departamento", business.regionName ?? ""], ["Ciudad", business.city], ["Dirección", business.address], ["Coordenadas", business.latitude != null && business.longitude != null ? `${business.latitude}, ${business.longitude}` : ""]])}{business.additionalAddressInfo?.trim() && <div className="business-detail-additional-address"><small>Información adicional de la dirección</small><strong>{business.additionalAddressInfo}</strong></div>}<StaticLocationPreview business={business} /></>}
  </section>;

  const socialLinks = [
    { key: "facebookUrl" as const, label: "Facebook", platform: "facebook" as const, placeholder: "https://facebook.com/…", value: business.facebookUrl },
    { key: "instagram" as const, label: "Instagram", platform: "instagram" as const, placeholder: "https://instagram.com/…", value: business.instagram },
    { key: "xUrl" as const, label: "X", platform: "x" as const, placeholder: "https://x.com/…", value: business.xUrl },
    { key: "tiktokUrl" as const, label: "TikTok", platform: "tiktok" as const, placeholder: "https://tiktok.com/@…", value: business.tiktokUrl },
  ];
  const contactSection = <section className="business-detail-section" data-business-section="contact">
    <div className="business-section-heading"><div><h3>Información de contacto pública</h3><p>Los datos que registres aquí aparecerán en el perfil público de tu negocio.</p></div>{canEditContact && <button className="text-button business-section-edit" type="button" onClick={() => beginSectionEdit("contact")}>✎ Editar</button>}</div>
    {editingSection === "contact" ? <form className="business-detail-inline-form" onSubmit={event => { event.preventDefault(); void saveSection("contact"); }}>
      <div className="form-grid"><div><PhoneNumberField label="WhatsApp" ariaLabel="WhatsApp" country={whatsappCountry} number={whatsappNumber} onCountryChange={country => { setWhatsappCountry(country); setWhatsappNumber(""); }} onNumberChange={setWhatsappNumber} /></div><label className="form-field"><span>Sitio web</span><input value={draft.website} onChange={event => updateDraft("website", event.target.value)} type="text" inputMode="url" placeholder="www.ejemplo.com" /></label><div><PhoneNumberField label="Teléfono" ariaLabel="teléfono" country={phoneCountry} number={phoneNumber} onCountryChange={country => { setPhoneCountry(country); setPhoneNumber(""); }} onNumberChange={setPhoneNumber} lineType={phoneLineType} onLineTypeChange={type => { setPhoneLineType(type); setPhoneNumber(""); }} /></div><div><label className="form-field"><span>Correo electrónico</span><input value={draft.email} onChange={event => updateDraft("email", event.target.value)} type="email" /></label></div></div>
      <section className="business-socials-editor" aria-labelledby="business-socials-heading"><div><h4 id="business-socials-heading">Redes sociales</h4><p>Conecta tus redes sociales para que tus clientes puedan conocerte y seguirte.</p></div><div className="business-socials-editor-grid">{socialLinks.map(network => <label className="business-social-field" data-social-network={network.platform} key={network.key}><span className="business-social-field-label"><SocialNetworkIcon platform={network.platform} />{network.label}</span><span className="business-social-field-control"><input value={draft[network.key]} onChange={event => updateDraft(network.key, event.target.value)} type="url" inputMode="url" placeholder={network.placeholder} /><button type="button" className="business-social-clear" onClick={() => updateDraft(network.key, "")} disabled={!draft[network.key]} aria-label={`Eliminar enlace de ${network.label}`}>Eliminar</button></span></label>)}</div></section>
      {sectionError && <p className="form-error" role="alert">{sectionError}</p>}
      <div className="business-detail-inline-actions"><button className="outline-button" type="button" onClick={cancelSectionEdit}>Cancelar</button><button className="action-button" type="submit" disabled={sectionSaving !== null}>{sectionSaving === "contact" ? "Guardando…" : "Guardar cambios"}</button></div>
    </form> : <><>{info([["Teléfono", business.phone], ["WhatsApp", business.whatsapp], ["Correo", business.email], ["Sitio web", business.website]])}</><section className="business-socials" aria-labelledby="business-socials-title"><div><h4 id="business-socials-title">Redes sociales</h4><p>Conecta tus redes sociales para que tus clientes puedan conocerte y seguirte.</p></div>{socialLinks.some(network => network.value) ? <div className="business-social-links">{socialLinks.filter(network => network.value).map(network => <a data-social-network={network.platform} key={network.key} href={network.value} target="_blank" rel="noopener noreferrer"><SocialNetworkIcon platform={network.platform} /><span>{network.label}</span></a>)}</div> : <p className="business-socials-empty">Aún no has agregado redes sociales.</p>}</section></>}
  </section>;
  const openingState = modalitiesLoading ? { label: "Cargando horario…", isOpen: null } : getBusinessOpeningState(modalities, clock);
  const sedeLabel = business.sede?.trim() ? (/^sede\b/i.test(business.sede.trim()) ? business.sede.trim() : `Sede ${business.sede.trim()}`) : "";
  const businessCategories = Array.from(new Set([business.category, ...(business.secondaryCategories ?? [])].filter(Boolean).map(value => categoryLabel(value))));
  const detailTabs: Array<{ id: DetailTab; label: string; icon: string }> = [
    { id: "general", label: "Información general", icon: "Nombre y sede" },
    { id: "location", label: "Ubicación", icon: "Ubicación y dirección" },
    { id: "hours", label: "Horarios", icon: "Horarios de atención" },
    { id: "photos", label: "Fotografías", icon: "Fotografías" },
    { id: "contact", label: "Contacto", icon: "Información de contacto" },
  ];
  const photosSection = <section className="business-detail-section business-photos-section">
          <div className="business-section-heading business-gallery-heading">
            <div>
              <h3>Fotos del negocio</h3>
              <span>{business.images?.length ?? 0} de 10 fotografías</span>
            </div>
            {editingPhotos ? <label className="outline-button business-add-photos-button" onClick={() => { if ((business.photos?.length ?? 0) >= 10) setPhotoError("Has alcanzado el máximo permitido de 10 fotografías."); }}>{photoBusy ? "Guardando…" : "＋ Agregar fotos"}<input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={uploadDetailPhotos} disabled={photoBusy || (business.photos?.length ?? 0) >= 10} /></label> : <button type="button" className="text-button business-section-edit" onClick={() => setEditingPhotos(true)}>✎ Editar</button>}
          </div>
          {photoError && <p className="form-error business-photo-limit-alert" role="alert" aria-live="assertive">{photoError}</p>}
          {business.images && business.images.length > 0 ? (editingPhotos ? <div className="business-detail-gallery">
            <div className="business-gallery-featured"><PersistedPhoto src={business.images[galleryIndex]} alt={`${business.name} ${galleryIndex + 1}`} /></div>
            <div className="business-gallery-management"><button type="button" className="text-button business-photo-delete-button" disabled={photoBusy} onClick={() => setPhotoDeleteConfirmation(business.photos?.[galleryIndex]?.id ?? null)} aria-label="Eliminar foto">🗑️ Eliminar foto</button></div>
            <div ref={galleryStripRef} className="business-gallery-thumbnails" onPointerDown={beginGalleryDrag} onPointerMove={moveGalleryDrag} onPointerUp={endGalleryDrag} onPointerCancel={endGalleryDrag} onScroll={() => { const strip = galleryStripRef.current; if (strip) setGalleryScroll({ left: strip.scrollLeft, max: Math.max(0, strip.scrollWidth - strip.clientWidth) }); }}>{business.images.map((image, imageIndex) => <button type="button" className={imageIndex === galleryIndex ? "active" : ""} key={`${image.slice(0, 20)}-${imageIndex}`} onPointerDown={event => { event.stopPropagation(); selectGalleryImage(imageIndex); }} onClick={() => selectGalleryImage(imageIndex)}><PersistedPhoto src={image} alt={`Ver foto ${imageIndex + 1}`} /></button>)}</div>
            {photoDeleteConfirmation && <div className="business-photo-confirm"><strong>¿Eliminar esta fotografía?</strong><div><button type="button" className="outline-button" onClick={() => setPhotoDeleteConfirmation(null)}>Cancelar</button><button type="button" className="danger-button" disabled={photoBusy} onClick={() => void removeDetailPhoto(photoDeleteConfirmation)}>Eliminar foto</button></div></div>}
          </div> : <div ref={galleryStripRef} className="business-gallery-thumbnails business-gallery-preview-strip" onPointerDown={beginGalleryDrag} onPointerMove={moveGalleryDrag} onPointerUp={endGalleryDrag} onPointerCancel={endGalleryDrag} onScroll={() => { const strip = galleryStripRef.current; if (strip) setGalleryScroll({ left: strip.scrollLeft, max: Math.max(0, strip.scrollWidth - strip.clientWidth) }); }}>{business.images.map((image, imageIndex) => <button type="button" className={imageIndex === galleryIndex ? "active" : ""} key={`${image.slice(0, 20)}-${imageIndex}`} onPointerDown={event => { event.stopPropagation(); selectGalleryImage(imageIndex); }} onClick={() => selectGalleryImage(imageIndex)}><PersistedPhoto src={image} alt={`Foto ${imageIndex + 1}`} /></button>)}</div>) : <p className="business-detail-empty">Aún no has agregado fotografías.</p>}
          {(business.images?.length ?? 0) > 1 && <div className="business-gallery-scroll-control"><input type="range" min="0" max={Math.max(1, galleryScroll.max)} step="1" value={Math.min(galleryScroll.left, Math.max(1, galleryScroll.max))} aria-label="Desplazar fotografías" onChange={event => { const left = Number(event.target.value); if (galleryStripRef.current) galleryStripRef.current.scrollLeft = left; setGalleryScroll(current => ({ ...current, left })); }} /></div>}
          {editingPhotos && <div className="business-detail-inline-actions business-gallery-close"><button type="button" className="outline-button" onClick={() => setEditingPhotos(false)}>Cancelar</button><button type="button" className="action-button" onClick={() => setEditingPhotos(false)}>Guardar cambios</button></div>}
        </section>;
  const modalitiesSection = <section className="business-detail-section business-detail-modalities-section"><div className="business-section-heading"><div><h3>Modalidades de atención</h3><p>Activa o desactiva cómo atiendes a tus clientes.</p></div></div>{modalitiesError && <p className="form-error" role="alert">{modalitiesError}</p>}{incompleteActiveModalities.length > 0 && <div className="business-detail-modality-warning" role="alert"><strong>Hay modalidades activas que necesitan actualizarse</strong>{incompleteActiveModalities.map(modality => <div className="business-detail-modality-warning-item" key={modality.id}><div><strong>{modalityLabels[modality.type]} necesita actualizarse</strong><p>Esta modalidad figura como activa, pero {modality.blockers?.join(" ")}</p></div><div className="business-detail-modality-warning-actions"><button className="outline-button" type="button" onClick={() => beginSectionEdit(correctionSectionFor(modality))}>Corregir información</button><button className="text-button" type="button" onClick={() => { setModalityConfirmation(modality.type); setModalityConfirmationError(""); }}>Desactivar modalidad</button></div></div>)}</div>}{modalitiesLoading ? <p className="empty-state">Cargando modalidades…</p> : <div className="business-detail-modalities-grid">{modalityTypes.map(type => { const modality = modalities.find(item => item.type === type); const active = modality?.status === "ACTIVE"; const busy = modalityBusy === `pause-${type}` || modalityBusy === `activate-${type}`; return <article className="business-detail-modality-card" key={type}><div className="business-detail-modality-card-head"><div><strong>{modalityLabels[type]}</strong></div><span className={`status-pill ${active ? "modality-status-active" : "modality-status-inactive"}`}>{active ? "Activa" : "Inactiva"}</span></div><div className="business-detail-modality-actions"><button className={active ? "outline-button" : "action-button"} type="button" onClick={() => void toggleModality(type)} disabled={!canEditModalities || modalityBusy !== null}>{busy ? "Guardando…" : active ? "Desactivar" : "Activar"}</button></div></article>; })}</div>}{!canEditModalities && <p className="modality-permission-note">Tu acceso actual es de solo lectura.</p>}</section>;
  const teamSection = <section className="business-detail-section business-team-section"><div className="business-section-heading"><div><h3>Personas con acceso</h3><p>Invita por nickname o correo electrónico.</p></div>{business.role === "Propietario" && <button className="outline-button" type="button" onClick={() => setShowCollaboratorForm(value => !value)}>{showCollaboratorForm ? "Cancelar" : "＋ Agregar colaborador"}</button>}</div><div className="business-team-owner"><span className="business-team-avatar">{business.role === "Propietario" ? "P" : "C"}</span><div><strong>{business.role === "Propietario" ? "Propietario" : "Propietario del negocio"}</strong><small>Control de propiedad y permisos especiales</small></div><span className="business-role-badge">Propietario</span></div>{(business.collaborators ?? []).map(collaborator => <div className="business-team-member" key={collaborator.id}><span className="business-team-avatar">{collaborator.name.split(" ").map(part => part[0]).slice(0, 2).join("")}</span><div><strong>{collaborator.name}</strong><small>{collaborator.nickname ? `${collaborator.nickname} · ` : "Invitado por correo · "}{collaborator.email || "Pendiente de registro"}</small>{!collaborator.active && <span className="business-invitation-status">Invitación pendiente</span>}</div>{business.role === "Propietario" && (confirmingCollaboratorRemoval === collaborator.id ? <div className="business-inline-confirm"><span>¿Retirar acceso?</span><button type="button" onClick={() => { removeCollaborator(collaborator.id); setConfirmingCollaboratorRemoval(null); }}>Sí, retirar</button><button type="button" onClick={() => setConfirmingCollaboratorRemoval(null)}>Cancelar</button></div> : <button className="text-button" type="button" onClick={() => setConfirmingCollaboratorRemoval(collaborator.id)}>Retirar acceso</button>)}{business.role === "Colaborador" && collaborator.active && ((collaborator.nickname && collaborator.nickname === account.nickname) || (collaborator.email && collaborator.email.toLowerCase() === account.email.toLowerCase())) && (confirmingLeave ? <div className="business-inline-confirm collaborator-leave-confirm"><span>¿Dejar tu acceso?</span><button type="button" onClick={leaveCollaboration}>Sí, salir</button><button type="button" onClick={() => setConfirmingLeave(false)}>Cancelar</button></div> : <button className="text-button collaborator-leave-button" type="button" onClick={() => setConfirmingLeave(true)}>Dejar de ser colaborador</button>)}</div>)}{showCollaboratorForm && business.role === "Propietario" && <form className="business-collaborator-form" onSubmit={addCollaborator}><label className="form-field full-field"><span>Nickname único</span><input value={collaboratorNickname} onFocus={() => setActiveInviteField("nickname")} onChange={event => { setCollaboratorNickname(event.target.value); setActiveInviteField(event.target.value ? "nickname" : null); setNicknameError(""); }} placeholder="Ej. @laura.gomez" pattern="@?[a-zA-Z0-9._-]{3,30}" disabled={activeInviteField === "email"} /><small>Si no encontramos el nickname, te avisaremos antes de enviar.</small>{activeInviteField === "email" && <button className="invite-method-switch" type="button" onClick={() => { setCollaboratorEmail(""); setActiveInviteField("nickname"); }}>Usar nickname en su lugar</button>}{nicknameError && <em className="form-error">{nicknameError}</em>}</label><label className="form-field full-field"><span>Correo electrónico</span><input type="email" value={collaboratorEmail} onFocus={() => setActiveInviteField("email")} onChange={event => { setCollaboratorEmail(event.target.value); setActiveInviteField(event.target.value ? "email" : null); setNicknameError(""); }} placeholder="colaborador@ejemplo.com" disabled={activeInviteField === "nickname"} /><small>Si no tiene una cuenta, podrá crearla con este correo.</small>{activeInviteField === "nickname" && <button className="invite-method-switch" type="button" onClick={() => { setCollaboratorNickname(""); setActiveInviteField("email"); }}>Usar correo en su lugar</button>}</label><button className="action-button" type="submit">Enviar invitación</button></form>}</section>;
  const hoursSection = <section className="business-detail-section" data-business-section="hours"><div className="business-section-heading"><div><h3>Horario</h3><p>Define cuándo está abierto tu negocio.</p></div>{business.role === "Propietario" && <button className="text-button business-section-edit" type="button" onClick={() => beginSectionEdit("hours")}>✎ Editar</button>}</div>{editingSection === "hours" ? <form className="business-detail-inline-form" onSubmit={event => { event.preventDefault(); void saveSection("hours"); }}><div className="wizard-hours">{scheduleDays.map(day => <div key={day}><label><input type="checkbox" checked={editHours[day].enabled} onChange={event => setEditHours(current => ({ ...current, [day]: { ...current[day], enabled: event.target.checked } }))} /> <strong>{day}</strong></label><label><input type="checkbox" checked={editHours[day].allDay} disabled={!editHours[day].enabled} onChange={event => { const allDay = event.target.checked; setEditHours(current => ({ ...current, [day]: { ...current[day], allDay, open: allDay ? "00:00" : current[day].open, close: allDay ? "23:59" : current[day].close } })); }} /> 24 horas</label><input type="time" value={editHours[day].open} disabled={!editHours[day].enabled || editHours[day].allDay} onChange={event => setEditHours(current => ({ ...current, [day]: { ...current[day], open: event.target.value } }))} /><span>–</span><input type="time" value={editHours[day].close} disabled={!editHours[day].enabled || editHours[day].allDay} onChange={event => setEditHours(current => ({ ...current, [day]: { ...current[day], close: event.target.value } }))} /></div>)}</div>{sectionError && <p className="form-error" role="alert">{sectionError}</p>}<div className="business-detail-inline-actions"><button className="outline-button" type="button" onClick={cancelSectionEdit}>Cancelar</button><button className="action-button" type="submit" disabled={sectionSaving !== null}>{sectionSaving === "hours" ? "Guardando…" : "Guardar cambios"}</button></div></form> : <div className="business-hours-list">{weeklyHours.map(([day, hours]) => <div key={day}><strong>{day}</strong><span>{hours}</span></div>)}</div>}</section>;
  const coverPicker = coverPickerOpen ? <div className="business-header-image-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !photoBusy) { setCoverPickerOpen(false); setHeaderImageError(""); } }}><section className="business-header-image-modal business-cover-picker-modal" role="dialog" aria-modal="true" aria-labelledby="cover-picker-title"><div className="business-header-image-heading"><div><h2 id="cover-picker-title">Elegir portada</h2><p>Selecciona una fotografía de tu galería para mostrarla como portada.</p></div><button type="button" className="close-button" aria-label="Cerrar selector de portada" onClick={() => { setCoverPickerOpen(false); setHeaderImageError(""); }} disabled={photoBusy}>×</button></div>{business.photos?.length ? <><div className="business-cover-photo-options" role="list" aria-label="Fotografías disponibles para portada">{business.photos.map(photo => <button type="button" role="listitem" key={photo.id} className={selectedCoverPhotoId === photo.id ? "selected" : ""} onClick={() => setSelectedCoverPhotoId(photo.id)} aria-pressed={selectedCoverPhotoId === photo.id}><PersistedPhoto src={photo.url} alt="" /></button>)}</div>{selectedCoverPhotoId && business.photos.find(photo => photo.id === selectedCoverPhotoId) && <div className="business-cover-preview"><PersistedPhoto src={business.photos.find(photo => photo.id === selectedCoverPhotoId)!.url} alt="Vista previa de la portada seleccionada" /></div>}</> : <div className="business-profile-photo-empty"><p>Aún no tienes fotografías para usar como portada.</p><button type="button" className="text-link" onClick={() => coverInputRef.current?.click()}>Subir una fotografía</button></div>}{headerImageError && <p className="form-error" role="alert">{headerImageError}</p>}<div className="modal-actions"><button type="button" className="outline-button" onClick={() => { setCoverPickerOpen(false); setHeaderImageError(""); }} disabled={photoBusy}>Cancelar</button><button type="button" className="outline-button" onClick={() => void clearSelectedCover()} disabled={photoBusy || !business.coverPhotoId}>Quitar imagen de portada</button><button type="button" className="action-button" onClick={() => void saveSelectedCover()} disabled={photoBusy || !selectedCoverPhotoId}>{photoBusy ? "Guardando…" : "Guardar portada"}</button></div></section></div> : null;
  return <div className="business-detail-page">{coverPicker}
    <div className="business-detail-layout">
      <section className={`surface-card business-detail-main${business.status === "Eliminado" ? " is-deleted" : ""}`}>
        <div className="business-detail-profile">
          <div className="business-detail-cover">
            {business.coverImage && <PersistedPhoto className="business-detail-cover__photo" style={{ objectPosition: `${safeImagePosition(business.coverImagePosition).x}% ${safeImagePosition(business.coverImagePosition).y}%` }} src={business.coverImage} alt={`Portada de ${business.name}`} />}
            <span className="business-detail-cover__shade" />
            {business.status !== "Eliminado" && <><input ref={coverInputRef} className="business-header-image-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={selectCoverImage} /><button type="button" className="business-cover-change" onClick={openCoverPicker}><DetailSectionIcon title="Cámara" />Cambiar portada</button></>}
          </div>
          <div className="business-management-hero">
            <div className="business-identity-photo">{business.profileImage ? <PersistedPhoto className="business-detail-image" style={{ objectPosition: `${safeImagePosition(business.profileImagePosition).x}% ${safeImagePosition(business.profileImagePosition).y}%` }} src={business.profileImage} alt={business.name} /> : <div className="business-logo business-logo--default" aria-label="Sin foto de perfil seleccionada"><DetailSectionIcon title="Nombre y sede" /></div>}{business.status !== "Eliminado" && <button type="button" aria-label="Cambiar imagen del negocio" title="Elegir una fotografía de la galería" onClick={openProfilePicker}><DetailSectionIcon title="Cámara" /></button>}</div>
            <div className="business-detail-hero-copy">
              <h1>{business.name}{verificationStatusLabel(business) === "Verificado" && <span className="business-verified-check" aria-label="Verificado">✓</span>}</h1>
              <p className="business-detail-place">{sedeLabel && <span><DetailSectionIcon title="Nombre y sede" />{sedeLabel}</span>}{business.city && <span><DetailSectionIcon title="Ubicación y dirección" />{Array.from(new Set([business.city, business.regionName].filter(Boolean))).join(", ")}</span>}</p>
              <div className="business-detail-reputation">{business.reviewCount && business.rating ? <span className="business-detail-rating">★ <b>{business.rating.toFixed(1)}</b> <span>({business.reviewCount} opiniones)</span></span> : <span className="business-no-reviews">Sin opiniones todavía</span>}<span className={`business-opening-state ${openingState.isOpen === true ? "is-open" : openingState.isOpen === false ? "is-closed" : "is-unknown"}`}>{openingState.label}</span>{verificationStatusLabel(business) !== "Verificado" && <span className="business-verification-status business-verification-status-pending">Verificación: {verificationStatusLabel(business)}</span>}</div>
              <div className="business-detail-category-chips">{businessCategories.map(value => <span key={value}>{value}</span>)}{business.adultOnly && <span className="adult-only-badge">+18</span>}</div>
              <div className="business-detail-identity-badges">{business.deletionStatus === "RECOVERY" && <span className="business-deletion-status">Eliminación pendiente</span>}{business.deletionStatus === "DELETED" && <span className="business-deletion-status">Eliminado</span>}</div>
            </div>
            <div className="business-detail-hero-actions">{business.publicId ? <Link className="outline-button" to={`/mi-negocio/preview/${encodeURIComponent(business.publicId)}?preview=business&returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`}>Ver perfil</Link> : <button type="button" className="outline-button" disabled title="Este negocio todavía no tiene un identificador público">Ver perfil</button>}<div className="business-detail-share-wrap" ref={shareWrapRef}><button type="button" className="outline-button" disabled={!shareUrl || sharing} onClick={() => setShareOpen(open => !open)} aria-expanded={shareOpen} aria-haspopup="menu" title={shareUrl ? "Compartir el enlace público" : "Este negocio todavía no tiene un identificador público"}><DetailSectionIcon title="Compartir" />{sharing ? "Compartiendo…" : "Compartir"}</button>{shareOpen && shareUrl && <div className="business-detail-share-menu" role="menu"><a className="business-share-whatsapp" href={`https://wa.me/?text=${encodeURIComponent(`Descubre ${business.name} en XAMUKO. ${shareUrl}`)}`} target="_blank" rel="noopener noreferrer" role="menuitem">WhatsApp <span>↗</span></a><button type="button" onClick={() => void shareBusiness()} role="menuitem">Compartir enlace <span>↗</span></button></div>}</div></div>
          </div>
          <nav className="business-detail-tabs" role="tablist" aria-label="Información del negocio">{detailTabs.map((tab, tabIndex) => <button className="business-detail-tab" key={tab.id} id={`business-tab-${tab.id}`} type="button" role="tab" aria-selected={!showCollaborators && activeTab === tab.id} aria-controls={`business-panel-${tab.id}`} tabIndex={(showCollaborators ? tab.id === "general" : activeTab === tab.id) ? 0 : -1} onClick={() => selectTab(tab.id)} onKeyDown={event => { const nextIndex = event.key === "ArrowRight" ? (tabIndex + 1) % detailTabs.length : event.key === "ArrowLeft" ? (tabIndex + detailTabs.length - 1) % detailTabs.length : event.key === "Home" ? 0 : event.key === "End" ? detailTabs.length - 1 : null; if (nextIndex !== null) { event.preventDefault(); selectTab(detailTabs[nextIndex].id); event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("[role=tab]")[nextIndex]?.focus(); } }}><DetailSectionIcon title={tab.icon} /><span className="business-detail-tab__label">{tab.label}</span></button>)}</nav>
        </div>
        {business.status === "Eliminado" && <div className="business-deleted-notice"><strong>Tu negocio no se encuentra visible</strong><p>{recoveryAvailable ? (recoveryHasDeadline ? `Cuentas con ${recoveryDaysLeft} días para recuperarlo.` : "Puedes recuperarlo mientras permanezca en estado de eliminación.") : "El plazo de recuperación terminó. Toda su información queda pendiente de eliminación definitiva."}</p>{recoveryAvailable && <><button className="action-button" type="button" onClick={() => setConfirmingRecovery(true)}>Recuperar negocio</button>{confirmingRecovery && <div className="business-recovery-confirm"><strong>¿Quieres recuperar este negocio?</strong><p>Volverá a estado Verificación pendiente y podrás seguir editándolo.</p><div><button className="action-button" type="button" onClick={recover}>Sí, recuperar</button><button className="outline-button" type="button" onClick={() => setConfirmingRecovery(false)}>Cancelar</button></div></div>}</>}</div>}
        {saveError && !editing && <p className="form-error" role="alert">{saveError}</p>}
        {shareMessage && <p className="business-detail-save-notice" role="status">{shareMessage}</p>}
        {sectionNotice && <p className="business-detail-save-notice" role="status">✓ {sectionNotice}</p>}
        {sectionConfirmation && <div className="business-detail-confirmation-overlay" role="presentation" onMouseDown={event => event.target === event.currentTarget && event.preventDefault()}><div className="business-detail-confirmation" role="dialog" aria-modal="true" aria-labelledby="business-detail-confirmation-title"><strong id="business-detail-confirmation-title">Este cambio afecta tus modalidades de atención</strong><p>Estás intentando modificar {sectionLabels[sectionConfirmation.section]}. Para conservar las modalidades activas, deben seguir cumpliendo sus requisitos.</p>{Object.keys(sectionConfirmation.details).length > 0 ? <ul>{Object.entries(sectionConfirmation.details).map(([type, blockers]) => <li key={type}><strong>{modalityLabels[type as ModalityType]}:</strong> {blockers?.join(" ")}</li>)}</ul> : <p>Las modalidades activas perderían información necesaria para funcionar.</p>}<p>Si continúas, las modalidades afectadas quedarán temporalmente inactivas. Sus datos se conservarán y podrás reactivarlas cuando cumplan los requisitos.</p>{sectionError && <p className="form-error" role="alert">{sectionError}</p>}<div className="business-detail-inline-actions"><button ref={confirmationCancelRef} className="outline-button" type="button" onClick={() => { setSectionConfirmation(null); setSectionError(""); }}>Cancelar</button><button className="action-button" type="button" disabled={sectionSaving !== null} onClick={() => void saveSection(sectionConfirmation.section, Object.keys(sectionConfirmation.details) as ModalityType[])}>{sectionSaving ? "Guardando…" : "Desactivar modalidades y guardar"}</button></div></div></div>}
        {modalityConfirmation && <div className="business-detail-confirmation-overlay" role="presentation"><div className="business-detail-confirmation" role="dialog" aria-modal="true" aria-labelledby="modality-confirmation-title"><strong id="modality-confirmation-title">¿Desactivar {modalityLabels[modalityConfirmation]}?</strong><p>Actualmente esta modalidad no cumple los requisitos para permanecer activa. Puedes volver a activarla cuando registres la información necesaria.</p>{modalityConfirmationError && <p className="form-error" role="alert">{modalityConfirmationError}</p>}<div className="business-detail-inline-actions"><button ref={modalityConfirmationCancelRef} className="outline-button" type="button" disabled={modalityBusy !== null} onClick={() => setModalityConfirmation(null)}>Cancelar</button><button className="action-button" type="button" disabled={modalityBusy !== null} onClick={() => void confirmIncompletePause()}>{modalityBusy ? "Desactivando…" : "Desactivar modalidad"}</button></div></div></div>}
        <div className="business-detail-workspace" inert={business.status === "Eliminado"}>
          <div className="business-detail-tab-content">
            {showCollaborators ? <section className="business-detail-panel business-collaborators-panel"><div className="business-panel-title"><span className="business-panel-title-icon"><DetailSectionIcon title="Personas con acceso" /></span><div><h2>Colaboradores</h2><p>Administra las personas con acceso a este establecimiento.</p></div></div>{teamSection}</section> : <>
              <section id="business-panel-general" role="tabpanel" aria-labelledby="business-tab-general" hidden={activeTab !== "general"} className="business-detail-panel">
                <div className="business-panel-title business-section-heading business-general-panel-title"><div><h3>Información general</h3><p>Presenta tu negocio, destaca lo que te hace único y muestra la categoría de tu establecimiento.</p></div>{business.role === "Propietario" && <button className="text-button business-section-edit" type="button" onClick={() => beginSectionEdit("general")}>✎ Editar</button>}</div>
                <div className={`business-reference-grid${editingSection === "general" ? " is-editing-general" : ""}`}>
                  {editingSection === "general" ? <div className="business-reference-editor">{generalSection}</div> : <><div className="business-reference-field"><div><h3>Nombre del negocio</h3><div className="business-reference-value">{business.name}</div></div></div><div className="business-reference-field business-reference-categories"><div><h3>Categorías</h3><div className="business-detail-category-chips">{businessCategories.map(value => <span key={value}>{value}</span>)}</div></div></div><div className="business-reference-field business-reference-adult"><div><h3>Clasificación +18 <span title="Esta clasificación es informativa y no constituye una verificación legal">ⓘ</span></h3><div className="business-reference-value">{business.adultOnly ? "Exclusivo para mayores de 18 años" : "Sin clasificación +18"}</div></div></div><div className="business-reference-field business-reference-sede"><div><h3>Sede</h3><div className="business-reference-value">{sedeLabel || "Sin especificar"}</div></div></div><div className="business-reference-field business-reference-description"><div><h3>Descripción del negocio</h3><div className="business-reference-value">{business.description || "Sin descripción"}</div></div></div></>}
                </div>
              </section>
              <section id="business-panel-location" role="tabpanel" aria-labelledby="business-tab-location" hidden={activeTab !== "location"} className="business-detail-panel">{locationSection}{modalitiesSection}</section>
              <section id="business-panel-hours" role="tabpanel" aria-labelledby="business-tab-hours" hidden={activeTab !== "hours"} className="business-detail-panel">{hoursSection}</section>
              <section id="business-panel-photos" role="tabpanel" aria-labelledby="business-tab-photos" hidden={activeTab !== "photos"} className="business-detail-panel">{photosSection}</section>
              <section id="business-panel-contact" role="tabpanel" aria-labelledby="business-tab-contact" hidden={activeTab !== "contact"} className="business-detail-panel">{contactSection}</section>
            </>}
          </div>
          <BusinessCardPanel key={business.id ?? index} business={{ ...business, category: categoryLabel(business.category) }} cardData={{ referredUsers: referralSummary?.referredUsers, currentLevel: referralSummary?.currentLevel, referralState }} />
        </div>
        {business.status !== "Eliminado" && <>{business.role === "Propietario" && <div className="business-detail-edit-row"><button className="danger-button business-detail-delete-button" type="button" onClick={() => setConfirmingDelete(true)}>Eliminar negocio</button></div>}{business.role === "Propietario" && confirmingDelete && !editing && <div className="business-delete-confirm business-detail-delete-confirm"><strong>¿Eliminar este negocio?</strong><p>Tu negocio quedará no visible y podrás recuperarlo durante {BUSINESS_RECOVERY_DAYS} días.</p><div><button className="danger-button" type="button" onClick={remove}>Sí, eliminar</button><button className="outline-button" type="button" onClick={() => setConfirmingDelete(false)}>Cancelar</button></div></div>}</>}
      </section>

    </div>

    {coverDraft && <div className="business-header-image-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !photoBusy) { setCoverDraft(null); setHeaderImageError(""); } }}><section className="business-header-image-modal" role="dialog" aria-modal="true" aria-labelledby="cover-image-editor-title"><div className="business-header-image-heading"><div><h2 id="cover-image-editor-title">Cambiar portada</h2><p>Ajusta el encuadre horizontal antes de guardar.</p></div><button type="button" className="close-button" aria-label="Cerrar cambio de portada" onClick={() => { setCoverDraft(null); setHeaderImageError(""); }} disabled={photoBusy}>×</button></div><div className="business-image-crop-preview business-image-crop-preview--cover"><img src={coverDraft.previewUrl} alt="Vista previa de la nueva portada" style={{ objectPosition: `${coverDraft.position.x}% ${coverDraft.position.y}%` }} /></div><div className="business-image-crop-controls"><label>Encuadre horizontal<input type="range" min="0" max="100" value={coverDraft.position.x} onChange={event => setCoverDraft(current => current ? { ...current, position: { ...current.position, x: Number(event.target.value) } } : current)} /></label><label>Encuadre vertical<input type="range" min="0" max="100" value={coverDraft.position.y} onChange={event => setCoverDraft(current => current ? { ...current, position: { ...current.position, y: Number(event.target.value) } } : current)} /></label></div>{headerImageError && <p className="form-error" role="alert">{headerImageError}</p>}<div className="modal-actions"><button type="button" className="outline-button" onClick={() => { setCoverDraft(null); setHeaderImageError(""); }} disabled={photoBusy}>Cancelar</button><button type="button" className="action-button" onClick={() => void saveCoverImage()} disabled={photoBusy}>{photoBusy ? "Guardando…" : "Guardar portada"}</button></div></section></div>}
    {profilePickerOpen && <div className="business-header-image-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !photoBusy) { setProfilePickerOpen(false); setHeaderImageError(""); } }}><section className="business-header-image-modal" role="dialog" aria-modal="true" aria-labelledby="profile-image-editor-title"><div className="business-header-image-heading"><div><h2 id="profile-image-editor-title">Imagen del negocio</h2><p>Elige una fotografía de tu galería para usarla como imagen de perfil.</p></div><button type="button" className="close-button" aria-label="Cerrar selector de imagen" onClick={() => { setProfilePickerOpen(false); setHeaderImageError(""); }} disabled={photoBusy}>×</button></div>{business.photos?.length ? <><div className="business-profile-photo-options" role="list" aria-label="Fotografías del negocio">{business.photos.map(photo => <button type="button" role="listitem" key={photo.id} className={selectedProfilePhotoId === photo.id ? "selected" : ""} onClick={() => setSelectedProfilePhotoId(photo.id)} aria-pressed={selectedProfilePhotoId === photo.id}><PersistedPhoto src={photo.url} alt="" /></button>)}</div>{selectedProfilePhotoId && business.photos.find(photo => photo.id === selectedProfilePhotoId) && <><div className="business-image-crop-preview business-image-crop-preview--profile"><PersistedPhoto src={business.photos.find(photo => photo.id === selectedProfilePhotoId)!.url} alt="Vista previa de la imagen del negocio" style={{ objectPosition: `${profilePosition.x}% ${profilePosition.y}%` }} /></div></>}</> : <div className="business-profile-photo-empty"><p>Aún no tienes fotografías para elegir.</p><button type="button" className="text-link" onClick={() => { setProfilePickerOpen(false); selectTab("photos"); }}>Ir a Fotografías</button></div>}{headerImageError && <p className="form-error" role="alert">{headerImageError}</p>}<div className="modal-actions"><button type="button" className="outline-button" onClick={() => { setProfilePickerOpen(false); setHeaderImageError(""); }} disabled={photoBusy}>Cancelar</button><button type="button" className="outline-button" onClick={() => setSelectedProfilePhotoId(null)} disabled={photoBusy || !business.profilePhotoId}>Quitar foto de perfil</button><button type="button" className="action-button" onClick={() => void saveProfileImage()} disabled={photoBusy || (!selectedProfilePhotoId && !business.profilePhotoId)}>{photoBusy ? "Guardando…" : selectedProfilePhotoId ? "Guardar imagen" : "Quitar foto de perfil"}</button></div></section></div>}
    {editing && <div className="modal-backdrop" role="presentation"><form className="modal-card business-edit-modal" onSubmit={save}><div className="modal-heading"><div><span className="page-eyebrow">EDITAR NEGOCIO</span><h2>Edita la información de tu tienda</h2><p>Actualiza los mismos datos que diligenciaste al crearla.</p></div><button className="close-button" type="button" aria-label="Cerrar" onClick={() => setEditing(false)}>×</button></div><div className="edit-form-section"><h3>Datos básicos</h3><div className="form-grid"><label className="form-field">Nombre comercial<input value={draft.name} onChange={event => updateDraft("name", event.target.value)} required /></label><label className="form-field">Categoría principal<select value={categoryLabel(draft.category)} onChange={event => { const next = event.target.value; updateDraft("category", next); setDraftSecondaryCategories(current => current.filter(item => categoryCodeFromLabel(item) !== categoryCodeFromLabel(next))); }} required>{categories.map(item => <option key={item} value={item}>{formatCategoryName(item)}</option>)}</select></label><label className="form-field full-field"><span>Sede (opcional)</span><input value={draft.sede ?? ""} maxLength={160} onChange={event => updateDraft("sede", event.target.value)} placeholder="Ej. Centro" /></label><label className="form-field full-field">Descripción corta<textarea value={draft.description} onChange={event => updateDraft("description", event.target.value)} rows={3} maxLength={300} /></label><fieldset className="form-field category-secondary-field"><legend>Categorías secundarias <small>(opcional)</small></legend><div className="category-secondary-grid">{categories.filter(item => categoryCodeFromLabel(item) !== categoryCodeFromLabel(draft.category)).map(item => <label className={`category-secondary-option${draftSecondaryCategories.some(value => categoryCodeFromLabel(value) === categoryCodeFromLabel(item)) ? " selected" : ""}`} key={item}><input type="checkbox" checked={draftSecondaryCategories.some(value => categoryCodeFromLabel(value) === categoryCodeFromLabel(item))} onChange={() => setDraftSecondaryCategories(current => current.some(value => categoryCodeFromLabel(value) === categoryCodeFromLabel(item)) ? current.filter(value => categoryCodeFromLabel(value) !== categoryCodeFromLabel(item)) : [...current, item])} /><span>{formatCategoryName(item)}</span></label>)}</div></fieldset></div></div><div className="edit-form-section"><h3>Ubicación</h3><div className="form-grid"><label className="form-field">Departamento<select value={editDepartment} onChange={event => { setEditDepartment(event.target.value); updateDraft("city", ""); }} required>{locationCatalog.departments.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}</select></label><label className="form-field">Ciudad o municipio<select value={draft.city} onChange={event => updateDraft("city", event.target.value)} required>{municipalities.map(item => <option key={item.id}>{item.name}</option>)}</select></label></div><div className="location-mode-toggle" role="group" aria-label="Forma de indicar la ubicación"><button type="button" className={editLocationMode === "address" ? "active" : ""} onClick={() => setEditLocationMode("address")}>Escribir dirección</button><button type="button" className={editLocationMode === "map" ? "active" : ""} onClick={() => setEditLocationMode("map")}>Seleccionar en el mapa</button></div>{editLocationMode === "address" ? <><label className="form-field">Dirección<input value={draft.address} onChange={event => { updateDraft("address", event.target.value); updateDraft("latitude", undefined); updateDraft("longitude", undefined); setManualLocationStatus(""); }} required /><button type="button" className="outline-button location-confirm-button" onClick={() => void confirmManualLocation()} disabled={manualLocationBusy}>{manualLocationBusy ? "Buscando ubicación…" : "Confirmar ubicación"}</button>{manualLocationStatus && <small className={`location-geocode-status ${manualLocationStatus.includes("Ubicación encontrada") ? "is-success" : manualLocationStatus.includes("No encontramos") || manualLocationStatus.includes("No se pudo") ? "is-error" : "is-warning"}`} role="status">{manualLocationStatus}</small>}</label><label className="form-field">Información adicional de la dirección (opcional)<input value={draft.additionalAddressInfo ?? ""} maxLength={200} onChange={event => updateDraft("additionalAddressInfo", event.target.value)} placeholder="Ej. Centro Comercial La Nube, local 204" /></label></> : <><BusinessLocationPicker value={draft.latitude != null && draft.longitude != null ? { lat: draft.latitude, lng: draft.longitude } : null} query={[draft.address, draft.city].filter(Boolean).join(", ")} onChange={value => { updateDraft("latitude", value.lat); updateDraft("longitude", value.lng); }} /><p className="form-help">Selecciona o mueve el marcador. Confirma después con “Guardar cambios”.</p></>}</div><div className="edit-form-section"><h3>Información de contacto pública</h3><p>Los datos que registres aquí aparecerán en el perfil público de tu negocio.</p><div className="form-grid"><label className="form-field">Teléfono<input value={draft.phone} onChange={event => updateDraft("phone", event.target.value)} type="tel" /></label><label className="form-field">WhatsApp<input value={draft.whatsapp} onChange={event => updateDraft("whatsapp", event.target.value)} type="tel" /></label><label className="form-field">Correo electrónico<input value={draft.email} onChange={event => updateDraft("email", event.target.value)} type="email" /></label><label className="form-field">Sitio web<input value={draft.website} onChange={event => updateDraft("website", event.target.value)} type="url" /></label><label className="form-field">Instagram<input value={draft.instagram} onChange={event => updateDraft("instagram", event.target.value)} /></label></div></div><div className="edit-form-section"><h3>Horarios y fotos</h3><label className="form-field">Horario general<input value={draft.hours} onChange={event => updateDraft("hours", event.target.value)} placeholder="Ej. Lun–Vie 8:00 a. m.–6:00 p. m." /></label><label className="form-field">Fotos del negocio <small>(opcional)</small><input type="file" accept="image/*" onChange={(event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => updateDraft("coverImage", typeof reader.result === "string" ? reader.result : (draft.coverImage ?? "")); reader.readAsDataURL(file); }} /></label></div>{saveError && <p className="form-error" role="alert">{saveError}</p>}<div className="modal-actions"><button className="outline-button" type="button" onClick={() => setEditing(false)}>Cancelar</button><button className="action-button" type="submit" disabled={saving}>{saving ? "Guardando…" : "Guardar cambios"}</button></div></form></div>}
  </div>;
}
