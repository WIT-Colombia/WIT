import { usePaidPlans } from "@wit/utils";
import { normalizeImageForUpload, PHOTO_INPUT_ACCEPT } from "@wit/utils";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useBusinessStore } from "../services/businessStore";
import { businessApi, type BusinessPromotion, type PromotionLimits, type RealOffer } from "../services/businessApiClient";
import { effectivePromotionLimits } from "../services/effectivePlanLimits";
import { BusinessProBenefitsDialog } from "../components/business/BusinessProBenefitsDialog";
import { displayInternalCode } from "../utils/internalCode";
import "./PromotionsPage.css";

type Tab = "ALL" | "ACTIVE" | "SCHEDULED" | "FINISHED";
type FormValue = { type: "OFFER" | "PROMOTION"; title: string; description: string; conditions: string; category: string; relatedOfferId: string; originalPrice: string; promotionalPrice: string; startsAt: string; endsAt: string; recurrence: "NONE" | "DAILY" | "WEEKLY" | "MONTHLY"; recurrenceUntil: string };
const localInputValue = (value: Date) => { const offset = value.getTimezoneOffset() * 60_000; return new Date(value.getTime() - offset).toISOString().slice(0, 16); };
const createBlank = (): FormValue => ({ type: "OFFER", title: "", description: "", conditions: "", category: "", relatedOfferId: "", originalPrice: "", promotionalPrice: "", startsAt: localInputValue(new Date()), endsAt: localInputValue(new Date(Date.now() + 7 * 86_400_000)), recurrence: "NONE", recurrenceUntil: "" });
const pageSize = 5;
const promotionsRefreshInterval = 30_000;
const money = (value: string | null) => value === null ? "" : new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(Number(value));
const formatCopInput = (value: string) => value ? new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(Number(value)) : "";
const dateValue = (value: string) => value ? localInputValue(new Date(value)) : "";

function PromotionPhotoImage({ url, alt = "" }: { url: string; alt?: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let disposed = false;
    let objectUrl = "";
    void businessApi.photoBlob(url).then(blob => {
      if (disposed) return;
      objectUrl = URL.createObjectURL(blob);
      setSrc(objectUrl);
    }).catch(() => { if (!disposed) setSrc(""); });
    return () => { disposed = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [url]);
  return src ? <img src={src} alt={alt} /> : <span className="promotion-photo-placeholder" aria-hidden="true">▧</span>;
}

export function PromotionsPage() {
  const { businessPro: proEnabled } = usePaidPlans();
  const { business } = useBusinessStore();
  const [promotions, setPromotions] = useState<BusinessPromotion[]>([]);
  const [catalogItems, setCatalogItems] = useState<RealOffer[]>([]);
  const [serverLimits, setLimits] = useState<PromotionLimits | null>(null);
  const limits = effectivePromotionLimits(serverLimits, proEnabled);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const refreshInFlightRef = useRef<string | null>(null);
  const selectedBusinessIdRef = useRef(business.id);
  selectedBusinessIdRef.current = business.id;
  const createKeyRef = useRef<string | null>(null);
  const [error, setError] = useState("");
  const [query] = useState("");
  const [tab, setTab] = useState<Tab>("ALL");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<BusinessPromotion | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState<FormValue>(createBlank);
  const [files, setFiles] = useState<File[]>([]);
  const [processingPhotos, setProcessingPhotos] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [removalTarget, setRemovalTarget] = useState<BusinessPromotion | null>(null);
  const [removing, setRemoving] = useState(false);
  const [removalError, setRemovalError] = useState("");
  const editorOverlayRef = useRef<HTMLDivElement>(null);
  const removalOverlayRef = useRef<HTMLDivElement>(null);
  const [proDialog, setProDialog] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const isReal = business.source === "real" && Boolean(business.id);
  const canManage = business.role === "Propietario" || business.permissions?.includes("MANAGE_PROMOTIONS");

  const reload = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!isReal || !business.id) { setPromotions([]); setLimits(null); setLoading(false); return; }
    const businessId = business.id;
    if (refreshInFlightRef.current === businessId) return;
    refreshInFlightRef.current = businessId;
    if (!silent) { setLoading(true); setError(""); setLimits(null); }
    try {
      const data = await businessApi.listPromotions(businessId);
      if (selectedBusinessIdRef.current !== businessId) return;
      setPromotions(data.promotions);
      setLimits(data.limits);
      if (!silent) {
        const catalog = await businessApi.listOffers(businessId).catch(() => ({ offers: [] }));
        if (selectedBusinessIdRef.current !== businessId) return;
        setCatalogItems([...catalog.offers].sort((a, b) => (a.internalCode ?? "").localeCompare(b.internalCode ?? "", undefined, { numeric: true })));
      }
    } catch {
      if (selectedBusinessIdRef.current === businessId) {
        setLimits(null);
        if (!silent) setError("No pudimos cargar las ofertas de este negocio. Intenta de nuevo.");
      }
    } finally {
      if (refreshInFlightRef.current === businessId) refreshInFlightRef.current = null;
      if (!silent && selectedBusinessIdRef.current === businessId) setLoading(false);
    }
  }, [business.id, isReal]);
  useEffect(() => {
    // Never display limits or promotions belonging to the previously selected business.
    setPromotions([]);
    setCatalogItems([]);
    setLimits(null);
  }, [business.id]);
  useEffect(() => {
    void reload();
    if (!isReal) return;
    // Promotion state is calculated from its dates by the API. Refresh while
    // this page is open so summary cards and tabs follow those transitions.
    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") void reload({ silent: true });
    };
    const intervalId = window.setInterval(refreshIfVisible, promotionsRefreshInterval);
    document.addEventListener("visibilitychange", refreshIfVisible);
    window.addEventListener("focus", refreshIfVisible);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refreshIfVisible);
      window.removeEventListener("focus", refreshIfVisible);
    };
  }, [isReal, reload, proEnabled]);

  const counts = useMemo(() => ({ ALL: promotions.length, ACTIVE: promotions.filter(item => item.state === "ACTIVE").length, SCHEDULED: promotions.filter(item => item.state === "SCHEDULED").length, FINISHED: promotions.filter(item => item.state === "FINISHED").length }), [promotions]);
  const filtered = useMemo(() => promotions.filter(item => (tab === "ALL" || item.state === tab) && `${item.title} ${item.description} ${item.category ?? ""}`.toLocaleLowerCase("es-CO").includes(query.toLocaleLowerCase("es-CO"))), [promotions, query, tab]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize);
  const filePreviews = useMemo(() => files.map(file => URL.createObjectURL(file)), [files]);
  useEffect(() => () => filePreviews.forEach(url => URL.revokeObjectURL(url)), [filePreviews]);
  useEffect(() => { setPage(1); }, [query, tab]);
  useEffect(() => { setPage(current => Math.min(current, totalPages)); }, [totalPages]);

  const beginNew = () => { setEditing(null); createKeyRef.current = null; setForm(createBlank()); setFiles([]); setError(""); setPreviewOpen(false); setEditorOpen(true); };
  const beginEdit = (promotion: BusinessPromotion) => { setPreviewOpen(false); setEditing(promotion); setEditorOpen(true); setForm({ type: promotion.type, title: promotion.title, description: promotion.description, conditions: promotion.conditions ?? "", category: promotion.category ?? "", relatedOfferId: promotion.relatedOfferId ?? "", originalPrice: promotion.originalPrice ?? "", promotionalPrice: promotion.promotionalPrice ?? "", startsAt: dateValue(promotion.startsAt), endsAt: dateValue(promotion.endsAt), recurrence: promotion.recurrence, recurrenceUntil: promotion.recurrenceUntil ? dateValue(promotion.recurrenceUntil) : "" }); setFiles([]); setError(""); };
  const closeForm = () => { setEditing(null); setFiles([]); setPreviewOpen(false); setEditorOpen(false); };
  // Keep Create/Edit and Delete inside the visible viewport, independent of
  // fixed XAMUKO Business headers and browser chrome on iPhone/iPadOS.
  useLayoutEffect(() => {
    const overlay = removalTarget ? removalOverlayRef.current : editorOpen ? editorOverlayRef.current : null;
    if (!overlay) return;
    const body = document.body;
    const previousOverflow = body.style.overflow;
    const viewport = window.visualViewport;
    const syncViewport = () => {
      overlay.style.setProperty("--promotions-viewport-top", `${viewport?.offsetTop ?? 0}px`);
      overlay.style.setProperty("--promotions-viewport-left", `${viewport?.offsetLeft ?? 0}px`);
      overlay.style.setProperty("--promotions-viewport-width", `${viewport?.width ?? window.innerWidth}px`);
      overlay.style.setProperty("--promotions-viewport-height", `${viewport?.height ?? window.innerHeight}px`);
    };
    body.classList.add("promotions-dialog-active");
    body.style.overflow = "hidden";
    syncViewport();
    window.addEventListener("resize", syncViewport);
    viewport?.addEventListener("resize", syncViewport);
    viewport?.addEventListener("scroll", syncViewport);
    overlay.querySelector<HTMLButtonElement>(removalTarget ? ".promotion-confirm-cancel" : ".promotion-editor-heading>button")?.focus({ preventScroll: true });
    return () => {
      window.removeEventListener("resize", syncViewport);
      viewport?.removeEventListener("resize", syncViewport);
      viewport?.removeEventListener("scroll", syncViewport);
      body.style.overflow = previousOverflow;
      body.classList.remove("promotions-dialog-active");
    };
  }, [editorOpen, Boolean(removalTarget)]);
  useEffect(() => {
    if ((!editorOpen && !removalTarget) || proDialog) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || previewOpen) return;
      if (removalTarget && !removing) { setRemovalTarget(null); setRemovalError(""); }
      else if (editorOpen && !saving && !processingPhotos) closeForm();
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [editorOpen, Boolean(removalTarget), previewOpen, removing, saving, processingPhotos, proDialog]);

  const setField = (key: keyof FormValue, value: string) => setForm(current => ({ ...current, [key]: value }));
  const setPromotionalPrice = (value: string) => {
    value = value.replace(/\D/g, "");
    setField("promotionalPrice", value);
    const original = Number(form.originalPrice);
    const promotional = Number(value);
    if (value && Number.isFinite(original) && Number.isFinite(promotional) && promotional >= original) setError("El precio promocional debe ser menor que el precio original.");
    else if (error === "El precio promocional debe ser menor que el precio original.") setError("");
  };
  const selectCatalogItem = (offerId: string) => {
    const item = catalogItems.find(candidate => candidate.id === offerId);
    if (!item) { setField("relatedOfferId", ""); return; }
    const originalPrice = item.priceAmount ?? item.priceText?.replace(/[^\d.,-]/g, "").replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".") ?? "";
    setForm(current => ({ ...current, relatedOfferId: item.id, type: "OFFER", title: item.name, description: item.description ?? "", category: item.category ?? "", originalPrice, promotionalPrice: "" }));
  };
  const addFiles = async (selected: FileList | null) => {
    const requested = Array.from(selected ?? []);
    if (!requested.length || processingPhotos) return;
    const available = Math.max(0, (limits?.maxPhotos ?? 1) - (editing?.photos.length ?? 0) - files.length);
    if (requested.length > available) { setError("Has alcanzado el límite de imágenes de esta publicación."); return; }
    setProcessingPhotos(true);
    setError("");
    try {
      const photos: File[] = [];
      for (const file of requested) photos.push(await normalizeImageForUpload(file));
      setFiles(current => [...current, ...photos]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudieron procesar las fotografías.");
    } finally {
      setProcessingPhotos(false);
    }
  };
  const removeSavedPhoto = async (photoId: string) => {
    if (!editing || !business.id) return;
    try { await businessApi.deletePromotionPhoto(business.id, editing.id, photoId); setEditing({ ...editing, photos: editing.photos.filter(photo => photo.id !== photoId) }); setPromotions(current => current.map(item => item.id === editing.id ? { ...item, photos: item.photos.filter(photo => photo.id !== photoId) } : item)); }
    catch { setError("No pudimos quitar esa fotografía."); }
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!business.id || savingRef.current) return;
    if (!limits) { setError('No se pudieron verificar las cuotas actuales del negocio. Intenta actualizar.'); return; }
    if (!editing && limits.activeCount >= limits.maxActive) {
      setError('Alcanzaste el límite de publicaciones activas de tu plan actual.'); return;
    }
    if (form.type === "OFFER" && (!form.relatedOfferId || !form.originalPrice || !form.promotionalPrice || Number(form.promotionalPrice) >= Number(form.originalPrice))) { setError("Selecciona un producto o servicio y define un precio promocional menor al original."); return; }
    if (new Date(form.endsAt) <= new Date(form.startsAt)) { setError("La fecha final debe ser posterior a la fecha de inicio."); return; }
    if (form.recurrence !== "NONE" && (!form.recurrenceUntil || new Date(form.recurrenceUntil) <= new Date(form.endsAt))) { setError("Indica hasta cuándo se repetirá la promoción, después de la primera vigencia."); return; }
    savingRef.current = true; setSaving(true); setError("");
    try {
      const payload = { type: form.type, title: form.title.trim(), description: form.description.trim(), conditions: form.conditions.trim() || null, category: form.category.trim() || null, relatedOfferId: form.relatedOfferId || null, originalPrice: form.type === "OFFER" ? form.originalPrice || null : null, promotionalPrice: form.promotionalPrice || null, startsAt: new Date(form.startsAt).toISOString(), endsAt: new Date(form.endsAt).toISOString(), recurrence: form.recurrence, recurrenceUntil: form.recurrenceUntil ? new Date(form.recurrenceUntil).toISOString() : null };
      const result = editing ? await businessApi.updatePromotion(business.id, editing.id, payload) : await businessApi.createPromotion(business.id, { ...payload, idempotencyKey: createKeyRef.current ?? (createKeyRef.current = crypto.randomUUID()) });
      for (const file of files) await businessApi.uploadPromotionPhoto(business.id, result.promotion.id, file);
      createKeyRef.current = null;
      closeForm(); await reload();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No pudimos guardar la publicación."); }
    finally { savingRef.current = false; setSaving(false); }
  };
  const finish = async (item: BusinessPromotion) => { if (!business.id || !window.confirm(`¿Finalizar “${item.title}”?`)) return; try { await businessApi.finishPromotion(business.id, item.id); await reload(); } catch (cause) { setError(cause instanceof Error ? cause.message : "No pudimos finalizar la publicación."); } };
  const remove = async (item: BusinessPromotion) => {
    if (!business.id || removing) return;
    setRemoving(true); setRemovalError("");
    try { await businessApi.deletePromotion(business.id, item.id); setRemovalTarget(null); await reload(); }
    catch (cause) { setRemovalError(cause instanceof Error ? cause.message : "No pudimos eliminar la publicación."); }
    finally { setRemoving(false); }
  };
  const activeLimitReached = Boolean(limits && limits.activeCount >= limits.maxActive);
  // An unverified response never authorizes an additional promotion.
  const canCreate = Boolean(canManage && limits && !activeLimitReached);

  return <main className="promotions-page">
    <header className="page-heading promotions-heading">
      <div className="promotions-heading-copy"><span className="promotions-eyebrow">TU OFERTA</span>
        <div className="promotions-heading-main"><span className="promotions-heading-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m4 4 16 0v16H4z"/><path d="M9 9h6M9 13h3M9 17h6"/><path d="m17 14 4-4"/></svg></span>
          <div><h1>Ofertas y promociones</h1><p>{`Crea y administra las ofertas y promociones de ${business.name}. Atrae más clientes y aumenta tus ventas.`}</p></div>
        </div>
      </div>
      <button className="action-button promotions-new" type="button" onClick={() => { if (activeLimitReached) { setError("Alcanzaste el límite de publicaciones activas de tu plan actual."); return; } beginNew(); }} disabled={!canCreate}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>Crear publicación</button>
    </header>
    {!isReal && <div className="promotions-notice" role="status">Selecciona un negocio real para administrar sus publicaciones.</div>}
    {!canManage && isReal && <div className="promotions-notice" role="alert">Tu perfil no tiene permiso para administrar promociones de este negocio.</div>}
    {!limits && isReal && !loading && <div className="promotions-notice" role="status">No pudimos verificar las cuotas del negocio. La creación está bloqueada hasta actualizar la consulta.</div>}
    {activeLimitReached && <div className="promotions-notice">Alcanzaste el límite de publicaciones activas de tu plan {limits?.plan === "PRO" ? "Business PRO" : "Básico"}. Las publicaciones anteriores permanecen registradas. {proEnabled && limits?.plan === "BASIC" && <button type="button" onClick={() => setProDialog(true)}>Conocer Business Pro</button>}</div>}
    <section className="promotions-summary" aria-label="Resumen de promociones">
      <article><span className="promotions-summary-icon violet" aria-hidden="true"><svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round"><path d="M7.5 22 23 6.5H40.5V24L25 39.5a4.2 4.2 0 0 1-5.9 0L7.5 27.9a4.2 4.2 0 0 1 0-5.9Z"/><circle cx="33.6" cy="13.4" r="2.2" fill="currentColor" stroke="none"/></svg></span><div><strong>{counts.ACTIVE}</strong><small>Activas</small></div></article>
      <article><span className="promotions-summary-icon coral" aria-hidden="true"><svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="3.3" strokeLinecap="round" strokeLinejoin="round"><rect x="6.5" y="9" width="32" height="31" rx="5"/><path d="M6.5 18.5h32M15 5.8v7M30 5.8v7"/><circle cx="33" cy="33" r="10" fill="#f43b55"/><path d="M33 27.4v5.7l4.3 2.5"/></svg></span><div><strong>{counts.SCHEDULED}</strong><small>Programadas</small></div></article>
      <article><span className="promotions-summary-icon blue" aria-hidden="true"><svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="24" cy="24" r="18"/><path d="m15.2 24.2 6.3 6.3 12.1-13.2"/></svg></span><div><strong>{counts.FINISHED}</strong><small>Finalizadas</small></div></article>
      <article><span className="promotions-summary-icon magenta" aria-hidden="true"><svg viewBox="0 0 48 48" fill="currentColor"><rect x="7" y="27" width="9" height="14" rx="1.9"/><rect x="19.5" y="18.5" width="9" height="22.5" rx="1.9"/><rect x="32" y="8" width="9" height="33" rx="1.9"/></svg></span><div><strong>{limits ? limits.summary.totalViews.toLocaleString("es-CO") : "—"}</strong><small>Visualizaciones {limits?.detailedAnalytics ? "totales" : "generales"}</small></div></article>
    </section>
    {error && !editing && <p className="promotions-error" role="alert">{error}</p>}
    <div className="promotions-workspace">
      <section className="promotions-list-panel">
        <div className="promotions-tabs" role="tablist" aria-label="Filtrar publicaciones"><span className="promotions-active-counter">Publicaciones activas: {limits ? `${limits.summary.active}/${limits.maxActive}` : "—"}</span>{([["ALL", "Todas"], ["ACTIVE", "Activas"], ["SCHEDULED", "Programadas"], ["FINISHED", "Finalizadas"]] as const).map(([key, label]) => <button type="button" key={key} role="tab" aria-selected={tab === key} className={tab === key ? "selected" : ""} onClick={() => setTab(key)}>{label} <span>{counts[key]}</span></button>)}</div>
        {loading ? <div className="promotions-empty">Cargando promociones…</div> : pageItems.length ? <div className="promotions-items">{pageItems.map(item => <article className="promotion-row" key={item.id}><div className="promotion-row-photos">{item.photos[0] ? <PromotionPhotoImage url={item.photos[0].url} /> : <span aria-hidden="true">{item.type === "OFFER" ? "%" : "✦"}</span>}</div><div className="promotion-row-main"><div className="promotion-row-labels"><span className={`promotion-type ${item.type.toLowerCase()}`}>{item.type === "OFFER" ? "OFERTA" : "PROMOCIÓN"}</span><span className={`promotion-state ${item.state.toLowerCase()}`}>{item.state === "ACTIVE" ? "Activa" : item.state === "SCHEDULED" ? "Programada" : "Finalizada"}</span></div><h2>{item.title}</h2><p>{item.description}</p><div className="promotion-row-meta">{item.category && <span>◇ {item.category}</span>}<span>◷ {new Date(item.startsAt).toLocaleDateString("es-CO")} – {new Date(item.endsAt).toLocaleDateString("es-CO")}</span>{item.state !== "SCHEDULED" && <span>◉ {item.viewCount.toLocaleString("es-CO")} visualizaciones</span>}</div>{item.originalPrice && <strong className="promotion-prices">{money(item.promotionalPrice)} <del>{money(item.originalPrice)}</del><small>{Math.round((1 - Number(item.promotionalPrice) / Number(item.originalPrice)) * 100)}% dto.</small></strong>}</div><div className="promotion-row-actions"><button type="button" onClick={() => beginEdit(item)} aria-label={`Editar ${item.title}`}>Editar</button>{item.state !== "FINISHED" && <button type="button" onClick={() => void finish(item)}>Finalizar</button>}<button type="button" className="danger" onClick={() => { setRemovalError(""); setRemovalTarget(item); }}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M10 4h4m-7 3 .7 13h8.6L17 7M10 11v6m4-6v6"/></svg>Eliminar</button></div></article>)}</div> : <div className="promotions-empty"><span aria-hidden="true">◇</span><h2>{promotions.length ? "No hay publicaciones con estos filtros" : "Aún no tienes ofertas o promociones"}</h2><p>{promotions.length ? "Prueba otra búsqueda o pestaña." : "Crea una oferta o promoción para compartirla con tus clientes."}</p>{!promotions.length && canCreate && <button className="action-button" type="button" onClick={beginNew}>＋ Crear primera publicación</button>}</div>}
        {!loading && filtered.length > pageSize && <nav className="promotions-pagination" aria-label="Paginación de promociones"><span>Mostrando {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} de {filtered.length}</span><button type="button" disabled={page <= 1} onClick={() => setPage(current => current - 1)}>‹</button><span>{page} / {totalPages}</span><button type="button" disabled={page >= totalPages} onClick={() => setPage(current => current + 1)}>›</button></nav>}
      </section>
    </div>
    {editorOpen && createPortal(<div className="promotion-editor-overlay" ref={editorOverlayRef} role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !saving && !processingPhotos) closeForm(); }}><aside className="promotion-editor promotion-editor-modal" role="dialog" aria-modal="true" aria-labelledby="promotion-editor-title" aria-describedby="promotion-editor-description"><div className="promotion-editor-heading"><div><span>{editing ? "ADMINISTRAR PUBLICACIÓN" : "NUEVA PUBLICACIÓN"}</span><h2 id="promotion-editor-title">{editing ? "Editar publicación" : "Nueva oferta o promoción"}</h2><p id="promotion-editor-description">Completa la información que verán las personas en XAMUKO.</p></div><button type="button" aria-label="Cerrar formulario" disabled={saving || processingPhotos} onClick={closeForm}>×</button></div><form className={`promotion-form promotion-form-${form.type.toLowerCase()}`} onSubmit={save}>
        <fieldset><legend>Tipo de publicación</legend><div className="promotion-type-picker"><button type="button" className={form.type === "OFFER" ? "selected" : ""} onClick={() => setForm(current => ({ ...current, type: "OFFER", originalPrice: current.type === "PROMOTION" ? "" : current.originalPrice, promotionalPrice: current.type === "PROMOTION" ? "" : current.promotionalPrice }))}>％ <span><b>Descuento en producto o servicio</b><small>Selecciona un registro existente y define el nuevo precio</small></span></button><button type="button" className={form.type === "PROMOTION" ? "selected" : ""} onClick={() => setForm(current => ({ ...current, type: "PROMOTION", originalPrice: "", promotionalPrice: "", relatedOfferId: "" }))}>✦ <span><b>Evento especial</b><small>Publicación independiente sin precio</small></span></button></div></fieldset>
        <label>Producto o servicio existente <select value={form.relatedOfferId} onChange={event => selectCatalogItem(event.target.value)}><option value="">Seleccione producto o servicio</option>{catalogItems.map(item => <option key={item.id} value={item.id}>{displayInternalCode(item.internalCode)} · {item.kind === "PRODUCT" ? "Producto" : "Servicio"}</option>)}</select></label>
        <label>Título <i>*</i><input required maxLength={120} value={form.title} onChange={event => setField("title", event.target.value)} placeholder="Ej. 2x1 en productos seleccionados" /></label>
        <label>Descripción <i>*</i><textarea required maxLength={500} value={form.description} onChange={event => setField("description", event.target.value)} placeholder="Describe tu oferta o promoción…" /><small className="promotion-counter">{form.description.length}/500</small></label>
        <label>Condiciones <span>(opcional)</span><textarea maxLength={500} value={form.conditions} onChange={event => setField("conditions", event.target.value)} placeholder="Días, productos incluidos u otras condiciones" /></label>
        <div className="promotion-photo-label">Imágenes <span>(máximo {limits?.maxPhotos ?? 1})</span> <small>JPG, PNG o WebP, hasta 5 MB</small></div><div className="promotion-photos">{editing?.photos.map(photo => <div className="promotion-photo" key={photo.id}><PromotionPhotoImage url={photo.url}/><button type="button" aria-label="Quitar fotografía" onClick={() => void removeSavedPhoto(photo.id)}>×</button></div>)}{files.map((file, index) => <div className="promotion-photo" key={`${file.name}-${file.lastModified}`}><img src={filePreviews[index]} alt=""/><button type="button" aria-label="Quitar fotografía" onClick={() => setFiles(current => current.filter((_, itemIndex) => itemIndex !== index))}>×</button></div>)}{(editing?.photos.length ?? 0) + files.length < (limits?.maxPhotos ?? 1) && <button className="promotion-photo-add" type="button" disabled={processingPhotos} onClick={() => fileInput.current?.click()}>＋<span>{processingPhotos ? "Procesando…" : "Agregar fotos"}</span></button>}<input ref={fileInput} hidden type="file" accept={PHOTO_INPUT_ACCEPT} multiple disabled={processingPhotos} onChange={event => { void addFiles(event.target.files); event.target.value = ""; }} /></div>
        {form.type === "OFFER" && <div className="promotion-price-fields"><label>Precio original (COP)<input type="text" inputMode="numeric" required readOnly value={formatCopInput(form.originalPrice)} aria-readonly="true" /></label><label>Precio promocional (COP)<input type="text" inputMode="numeric" required value={formatCopInput(form.promotionalPrice)} onChange={event => setPromotionalPrice(event.target.value)} placeholder="$ 0" /></label></div>}
        {form.type === "PROMOTION" && <label>Precio opcional (COP)<input type="number" min="0" step="1" value={form.promotionalPrice} onChange={event => setField("promotionalPrice", event.target.value)} placeholder="No requerido" /></label>}
        <fieldset><legend>Vigencia</legend><div className="promotion-price-fields"><label>Fecha de inicio <i>*</i><input type="datetime-local" required disabled={!limits?.canSchedule && !editing} value={form.startsAt} onChange={event => setField("startsAt", event.target.value)} /></label><label>Fecha de finalización <i>*</i><input type="datetime-local" required value={form.endsAt} onChange={event => setField("endsAt", event.target.value)} /></label></div>{!limits?.canSchedule && !editing && <small>El plan Básico publica de inmediato, sin programación futura.</small>}</fieldset>
        {limits?.canRecur && <><label>Repetición {proEnabled && <span className="promotion-pro-tag">PRO</span>}<select value={form.recurrence} onChange={event => setField("recurrence", event.target.value)}><option value="NONE">Sin repetición</option><option value="DAILY">Diaria</option><option value="WEEKLY">Semanal</option><option value="MONTHLY">Mensual</option></select></label>{form.recurrence !== "NONE" && <label>Repetir hasta <i>*</i><input type="datetime-local" required min={form.endsAt} value={form.recurrenceUntil} onChange={event => setField("recurrenceUntil", event.target.value)} /></label>}</>}{proEnabled && !limits?.canRecur && <button className="promotion-upgrade-link" type="button" onClick={() => setProDialog(true)}>Repetición de promociones · Conocer Business Pro</button>}
        <label>Categoría <span>(opcional)</span><input maxLength={100} value={form.category} onChange={event => setField("category", event.target.value)} placeholder="Ej. Panadería" /></label>
        {error && <p className="promotions-error" role="alert">{error}</p>}
        <div className="promotion-editor-actions"><button type="button" className="outline-button" onClick={() => setPreviewOpen(true)}>Vista previa</button><button type="button" className="outline-button" disabled={saving || processingPhotos} onClick={closeForm}>Cancelar</button><button className="action-button" type="submit" disabled={saving || processingPhotos}>{saving ? "Guardando…" : processingPhotos ? "Procesando fotos…" : editing ? "Guardar cambios" : "Guardar publicación"}</button></div>
      </form></aside></div>, document.body)}
    {previewOpen && createPortal(<div className="promotion-preview-overlay" role="presentation" onMouseDown={event => event.target === event.currentTarget && setPreviewOpen(false)}><section className="promotion-preview" role="dialog" aria-modal="true" aria-labelledby="promotion-preview-title"><button type="button" className="promotion-preview-close" onClick={() => setPreviewOpen(false)} aria-label="Cerrar vista previa">×</button><span className="promotion-type">{form.type === "OFFER" ? "OFERTA" : "PROMOCIÓN"}</span><h2 id="promotion-preview-title">{form.title || "Título de la publicación"}</h2><p>{form.description || "La descripción aparecerá aquí."}</p>{form.promotionalPrice && <strong>{money(form.promotionalPrice)} {form.originalPrice && <del>{money(form.originalPrice)}</del>}</strong>}<small>{form.startsAt && new Date(form.startsAt).toLocaleString("es-CO")} – {form.endsAt && new Date(form.endsAt).toLocaleString("es-CO")}</small></section></div>, document.body)}
    {removalTarget && createPortal(<div ref={removalOverlayRef} className="promotion-confirm-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !removing) { setRemovalTarget(null); setRemovalError(""); } }}><section className="promotion-confirm" role="alertdialog" aria-modal="true" aria-labelledby="promotion-confirm-title" aria-describedby="promotion-confirm-copy" aria-busy={removing}><div className="promotion-confirm-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M10 4h4m-7 3 .7 13h8.6L17 7M10 11v6m4-6v6"/></svg></div><h2 id="promotion-confirm-title">¿Eliminar esta publicación?</h2><p id="promotion-confirm-copy">“{removalTarget.title}” se eliminará de tus ofertas y promociones. Esta acción no se puede deshacer.</p>{removalError && <p className="promotions-error" role="alert">{removalError}</p>}<div className="promotion-confirm-actions"><button type="button" className="subtle-button promotion-confirm-cancel" disabled={removing} onClick={() => { setRemovalTarget(null); setRemovalError(""); }}>Cancelar</button><button type="button" className="danger-button" disabled={removing} onClick={() => void remove(removalTarget)}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M10 4h4m-7 3 .7 13h8.6L17 7M10 11v6m4-6v6"/></svg>{removing ? "Eliminando…" : "Eliminar publicación"}</button></div></section></div>, document.body)}
    {proEnabled && proDialog && <BusinessProBenefitsDialog onClose={() => setProDialog(false)} />}
  </main>;
}
