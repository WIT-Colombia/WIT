import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useBusinessStore } from "../services/businessStore";
import { businessApi, BusinessApiError, type ModalityHour, type ModalityStatus, type ModalityType, type RealModality } from "../services/businessApiClient";
import { PhoneNumberField, phoneCountryFor, splitInternationalPhone, type PhoneCountryCode } from "../components/common/PhoneNumberField";

const typeLabels: Record<ModalityType, string> = { PHYSICAL: "Física", VIRTUAL: "Virtual", DELIVERY: "A domicilio" };
const modalityTypes: ModalityType[] = ["PHYSICAL", "VIRTUAL", "DELIVERY"];
const modalityDescriptions: Record<ModalityType, string> = {
  PHYSICAL: "Atiende clientes en un establecimiento.",
  VIRTUAL: "Ofrece productos o servicios por internet.",
  DELIVERY: "Atiende clientes en su ubicación.",
};
const statusLabels: Record<ModalityStatus, string> = { CONFIGURING: "En configuración", ACTIVE: "Activa", PAUSED: "Pausada" };
const days = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const emptyHours = (): ModalityHour[] => days.map((_, dayOfWeek) => ({ dayOfWeek, isClosed: true, opensAt: null, closesAt: null, timezone: "America/Bogota" }));

function normalizeHours(modality: RealModality): ModalityHour[] {
  const saved = new Map(modality.hours.map(hour => [hour.dayOfWeek, hour]));
  return emptyHours().map(hour => saved.get(hour.dayOfWeek) ?? hour);
}

export function BusinessModalitiesPage() {
  const navigate = useNavigate();
  const { index = "0" } = useParams();
  const { business } = useBusinessStore();
  const [modalities, setModalities] = useState<RealModality[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [contactDrafts, setContactDrafts] = useState<Record<string, NonNullable<RealModality["contact"]>>>({});
  const [customizeContact, setCustomizeContact] = useState<Record<string, boolean>>({});
  const [hoursDrafts, setHoursDrafts] = useState<Record<string, ModalityHour[]>>({});
  const [phoneLineTypes, setPhoneLineTypes] = useState<Record<string, "fixed" | "mobile"> >({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pendingCancel, setPendingCancel] = useState<RealModality | null>(null);

  const canEdit = business.role === "Propietario" || business.permissions?.includes("EDIT_BUSINESS") === true;
  const canHours = business.role === "Propietario" || business.permissions?.includes("MANAGE_HOURS") === true;
  const canPublication = business.role === "Propietario" || business.permissions?.includes("CHANGE_PUBLICATION") === true;

  useEffect(() => {
    if (!business.id) return;
    let cancelled = false;
    setLoading(true);
    businessApi.listModalities(business.id).then(response => {
      if (cancelled) return;
      setModalities(response.modalities);
      setExpanded(response.modalities[0]?.id ?? null);
      setContactDrafts(Object.fromEntries(response.modalities.map(modality => [modality.id, { email: modality.contact?.email ?? null, website: modality.contact?.website ?? null, phone: modality.contact?.phone ?? null, whatsapp: modality.contact?.whatsapp ?? null }])));
      setCustomizeContact(Object.fromEntries(response.modalities.map(modality => [modality.id, Boolean(modality.contact && Object.values(modality.contact).some(Boolean))])));
      setHoursDrafts(Object.fromEntries(response.modalities.map(modality => [modality.id, normalizeHours(modality)])));
      setPhoneLineTypes(Object.fromEntries(response.modalities.map(modality => [modality.id, "mobile" as const])));
    }).catch(cause => { if (!cancelled) setError(cause instanceof BusinessApiError ? cause.message : "No se pudieron cargar las modalidades."); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [business.id]);

  if (!business.id) return <Navigate to="/mis-negocios" replace />;

  const replaceModality = (value: RealModality) => {
    setModalities(current => current.map(item => item.id === value.id ? value : item));
    setContactDrafts(current => ({ ...current, [value.id]: { email: value.contact?.email ?? null, website: value.contact?.website ?? null, phone: value.contact?.phone ?? null, whatsapp: value.contact?.whatsapp ?? null } }));
    setCustomizeContact(current => ({ ...current, [value.id]: Boolean(value.contact && Object.values(value.contact).some(Boolean)) }));
    setHoursDrafts(current => ({ ...current, [value.id]: normalizeHours(value) }));
  };

  const run = async (key: string, action: () => Promise<{ modality: RealModality }>, success: string) => {
    setBusy(key); setError(""); setNotice("");
    try { const response = await action(); replaceModality(response.modality); setNotice(success); } catch (cause) { setError(cause instanceof BusinessApiError ? `${cause.message}${cause.fields.modality ? ` ${cause.fields.modality}` : ""}` : "No se pudo completar la operación."); } finally { setBusy(null); }
  };

  const add = async (type: ModalityType) => {
    if (!canEdit || modalities.some(item => item.type === type)) return;
    setBusy("create"); setError(""); setNotice("");
    try {
      const response = await businessApi.createModality(business.id!, type);
      setModalities(current => [...current, response.modality]); setExpanded(response.modality.id);
      setContactDrafts(current => ({ ...current, [response.modality.id]: { email: null, website: null, phone: null, whatsapp: null } })); setCustomizeContact(current => ({ ...current, [response.modality.id]: false })); setHoursDrafts(current => ({ ...current, [response.modality.id]: emptyHours() })); setNotice("Modalidad creada. Completa sus datos antes de activarla.");
    } catch (cause) {
      if (cause instanceof BusinessApiError && cause.status === 409 && cause.code === "MODALITY_TYPE_ALREADY_EXISTS") {
        const existing = (await businessApi.listModalities(business.id!)).modalities.find(item => item.type === type);
        if (existing) {
          setModalities(current => [...current.filter(item => item.type !== type), existing]); setExpanded(existing.id);
          setNotice("Modalidad agregada nuevamente. Revisa su configuración antes de activarla.");
        } else setError(cause.message);
      } else setError(cause instanceof BusinessApiError ? cause.message : "No se pudo crear la modalidad.");
    } finally { setBusy(null); }
  };

  const saveContact = (modality: RealModality) => run(`contact-${modality.id}`, () => businessApi.updateModalityContact(business.id!, modality.id, customizeContact[modality.id] ? contactDrafts[modality.id] : { email: null, website: null, phone: null, whatsapp: null }), "Contacto guardado.");
  const setPhoneLineType = (modalityId: string, type: "fixed" | "mobile") => setPhoneLineTypes(current => ({ ...current, [modalityId]: type }));
  const updateContactNumber = (modalityId: string, field: "phone" | "whatsapp", country: PhoneCountryCode, number: string) => setContactDrafts(current => ({ ...current, [modalityId]: { ...(current[modalityId] ?? { email: null, website: null, phone: null, whatsapp: null }), [field]: number ? `${phoneCountryFor(country).dialCode ?? country} ${number}` : null } }));
  const saveHours = (modality: RealModality) => run(`hours-${modality.id}`, () => businessApi.updateModalityHours(business.id!, modality.id, hoursDrafts[modality.id] ?? []), "Horarios guardados.");
  const cancelModality = async () => {
    if (!pendingCancel) return;
    const modality = pendingCancel;
    setBusy(`cancel-${modality.id}`); setError(""); setNotice("");
    try {
      await businessApi.retireModality(business.id!, modality.id);
      setModalities(current => current.filter(item => item.id !== modality.id));
      setExpanded(current => current === modality.id ? null : current);
      setPendingCancel(null);
      setNotice(`${typeLabels[modality.type]} cancelada. Puedes agregarla nuevamente cuando la necesites.`);
    } catch (cause) {
      setError(cause instanceof BusinessApiError ? cause.message : "No se pudo cancelar la modalidad.");
    } finally { setBusy(null); }
  };

  return <div className="page-wrap business-modalities-page">
    <div className="page-heading"><div><span className="page-eyebrow">CONFIGURACIÓN DEL NEGOCIO</span><h1>Modalidades comerciales</h1><p>Administra cómo pueden encontrarte y atender a tus clientes.</p></div><button className="outline-button" type="button" onClick={() => navigate(`/mi-negocio/detalle/${index}`)}>Volver al negocio</button></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {notice && <p className="business-modalities-notice" role="status">{notice}</p>}
    <section className="surface-card business-modalities-card">
      <div className="business-modalities-intro"><div><h2>Formas de atención</h2><p>Elige libremente una o varias modalidades. Cada una se configura y activa por separado.</p></div></div>
      {loading ? <p className="empty-state">Cargando modalidades…</p> : <div className="business-modalities-list">{modalityTypes.map(type => {
        const modality = modalities.find(item => item.type === type);
        if (!modality) return <article className="modality-card modality-card-empty" key={type}><div className="modality-card-heading"><span className="modality-card-icon" aria-hidden="true">{type === "PHYSICAL" ? "⌂" : type === "VIRTUAL" ? "⌁" : "↗"}</span><span><strong>{typeLabels[type]}</strong><small>{modalityDescriptions[type]}</small></span></div>{canEdit && <button className="action-button" type="button" onClick={() => add(type)} disabled={busy === "create"}>{busy === "create" ? "Creando…" : "＋ Agregar modalidad"}</button>}</article>;
        const contact = contactDrafts[modality.id] ?? { email: null, website: null, phone: null, whatsapp: null };
        const hours = hoursDrafts[modality.id] ?? emptyHours();
        const open = expanded === modality.id;
        return <article className="modality-card" key={modality.id}>
          <button className="modality-card-heading" type="button" onClick={() => setExpanded(open ? null : modality.id)} aria-expanded={open}><span className="modality-card-icon" aria-hidden="true">{modality.type === "PHYSICAL" ? "⌂" : modality.type === "VIRTUAL" ? "⌁" : "↗"}</span><span><strong>{typeLabels[modality.type]}</strong><small>{statusLabels[modality.status]}</small></span><span className={`status-pill modality-status-${modality.status.toLowerCase()}`}>{statusLabels[modality.status]}</span><span className="modality-card-chevron" aria-hidden="true">{open ? "⌃" : "⌄"}</span></button>
          {open && <div className="modality-card-body">
            <div className="modality-form-section"><div><h3>Contacto del negocio</h3><p>Esta modalidad utiliza los datos generales de contacto de tu negocio.</p><div className="modality-contact-summary">{[ ["Correo", modality.effectiveContact?.email ?? business.email], ["Teléfono", modality.effectiveContact?.phone ?? business.phone], ["WhatsApp", modality.effectiveContact?.whatsapp ?? business.whatsapp], ["Sitio web", modality.effectiveContact?.website ?? business.website] ].filter(([, value]) => value).map(([label, value]) => <span key={label}><strong>{label}</strong> {value}</span>)}{![modality.effectiveContact?.email ?? business.email, modality.effectiveContact?.phone ?? business.phone, modality.effectiveContact?.whatsapp ?? business.whatsapp, modality.effectiveContact?.website ?? business.website].some(Boolean) && <span>Sin datos de contacto generales</span>}</div></div>{canEdit && <label className="modality-contact-toggle"><input type="checkbox" checked={customizeContact[modality.id] === true} onChange={event => setCustomizeContact(current => ({ ...current, [modality.id]: event.target.checked }))} /> Personalizar contacto para esta modalidad</label>}{customizeContact[modality.id] && <><div className="modality-form-grid"><label className="form-field">Correo<input type="email" value={contact.email ?? ""} disabled={!canEdit || busy !== null} onChange={event => setContactDrafts(current => ({ ...current, [modality.id]: { ...contact, email: event.target.value || null } }))} /></label><label className="form-field">Sitio web<input type="url" value={contact.website ?? ""} disabled={!canEdit || busy !== null} onChange={event => setContactDrafts(current => ({ ...current, [modality.id]: { ...contact, website: event.target.value || null } }))} /></label><PhoneNumberField label="Teléfono" ariaLabel="teléfono" lineType={phoneLineTypes[modality.id] ?? "mobile"} onLineTypeChange={type => setPhoneLineType(modality.id, type)} country={splitInternationalPhone(contact.phone).country} number={splitInternationalPhone(contact.phone).number} disabled={!canEdit || busy !== null} onCountryChange={country => updateContactNumber(modality.id, "phone", country, splitInternationalPhone(contact.phone).number)} onNumberChange={number => updateContactNumber(modality.id, "phone", splitInternationalPhone(contact.phone).country, number)} /><PhoneNumberField label="WhatsApp" ariaLabel="WhatsApp" country={splitInternationalPhone(contact.whatsapp).country} number={splitInternationalPhone(contact.whatsapp).number} disabled={!canEdit || busy !== null} onCountryChange={country => updateContactNumber(modality.id, "whatsapp", country, splitInternationalPhone(contact.whatsapp).number)} onNumberChange={number => updateContactNumber(modality.id, "whatsapp", splitInternationalPhone(contact.whatsapp).country, number)} /></div>{canEdit && <button className="outline-button" type="button" onClick={() => saveContact(modality)} disabled={busy !== null}>{busy === `contact-${modality.id}` ? "Guardando…" : "Guardar contacto"}</button>}</>}</div>
            <div className="modality-form-section"><div><h3>Horarios</h3><p>Configura al menos un día abierto para activar una modalidad.</p></div><div className="modality-hours-grid">{hours.map((hour, index) => <div className="modality-hour-row" key={hour.dayOfWeek}><strong>{days[hour.dayOfWeek]}</strong><label><input type="checkbox" checked={!hour.isClosed} disabled={!canHours || busy !== null} onChange={event => setHoursDrafts(current => ({ ...current, [modality.id]: hours.map((item, itemIndex) => itemIndex === index ? { ...item, isClosed: !event.target.checked, opensAt: event.target.checked ? (item.opensAt ?? "08:00") : null, closesAt: event.target.checked ? (item.closesAt ?? "18:00") : null } : item) }))} /> Abierto</label><input aria-label={`${days[hour.dayOfWeek]} abre`} type="time" value={hour.opensAt ?? ""} disabled={!canHours || hour.isClosed || busy !== null} onChange={event => setHoursDrafts(current => ({ ...current, [modality.id]: hours.map((item, itemIndex) => itemIndex === index ? { ...item, opensAt: event.target.value || null } : item) }))} /><span>–</span><input aria-label={`${days[hour.dayOfWeek]} cierra`} type="time" value={hour.closesAt ?? ""} disabled={!canHours || hour.isClosed || busy !== null} onChange={event => setHoursDrafts(current => ({ ...current, [modality.id]: hours.map((item, itemIndex) => itemIndex === index ? { ...item, closesAt: event.target.value || null } : item) }))} /></div>)}</div>{canHours && <button className="outline-button" type="button" onClick={() => saveHours(modality)} disabled={busy !== null}>{busy === `hours-${modality.id}` ? "Guardando…" : "Guardar horarios"}</button>}</div>
            <div className="modality-actions">{modality.status === "CONFIGURING" && <><button className="action-button" type="button" disabled={!canPublication || busy !== null} onClick={() => run(`activate-${modality.id}`, () => businessApi.activateModality(business.id!, modality.id), "Modalidad activada.")}>Activar modalidad</button><button className="outline-button" type="button" disabled={!canPublication || busy !== null} onClick={() => setPendingCancel(modality)}>Cancelar modalidad</button></>}{modality.status === "ACTIVE" && <button className="outline-button" type="button" disabled={!canPublication || busy !== null} onClick={() => run(`pause-${modality.id}`, () => businessApi.pauseModality(business.id!, modality.id), "Modalidad pausada.")}>Pausar</button>}{modality.status === "PAUSED" && <button className="action-button" type="button" disabled={!canPublication || busy !== null} onClick={() => run(`reactivate-${modality.id}`, () => businessApi.reactivateModality(business.id!, modality.id), "Modalidad reactivada.")}>Reactivar</button>}{(modality.status === "ACTIVE" || modality.status === "PAUSED") && <button className="text-button modality-retire-button" type="button" disabled={!canPublication || busy !== null} onClick={() => run(`retire-${modality.id}`, () => businessApi.retireModality(business.id!, modality.id), "Modalidad retirada y devuelta a configuración.")}>Retirar</button>}</div>
            {!canEdit && <p className="modality-permission-note">Tu acceso actual es de solo lectura. Solicita el permiso EDIT_BUSINESS para modificar esta modalidad.</p>}
            {(modality.type === "VIRTUAL" || modality.type === "DELIVERY") && <p className="modality-phase-note">La cobertura de esta modalidad se habilitará en la Fase 2. La activación seguirá las validaciones del backend.</p>}
          </div>}
        </article>;
      })}</div>}
    </section>
    {pendingCancel && <div className="modal-backdrop" role="presentation"><section className="modal-card confirm-card" role="dialog" aria-modal="true" aria-labelledby="cancel-modality-title"><div className="modal-heading"><div><span className="page-eyebrow">{typeLabels[pendingCancel.type]}</span><h2 id="cancel-modality-title">¿Quieres cancelar esta modalidad?</h2></div><button className="close-button" type="button" aria-label="Cerrar confirmación" onClick={() => setPendingCancel(null)} disabled={busy !== null}>×</button></div><p>La modalidad dejará de estar configurada para tu negocio. Podrás agregarla nuevamente cuando lo necesites.</p><div className="modal-actions"><button className="outline-button" type="button" onClick={() => setPendingCancel(null)} disabled={busy !== null}>Volver</button><button className="action-button" type="button" onClick={() => void cancelModality()} disabled={busy !== null}>{busy === `cancel-${pendingCancel.id}` ? "Cancelando…" : "Sí, cancelar modalidad"}</button></div></section></div>}
  </div>;
}
