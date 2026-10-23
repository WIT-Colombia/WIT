import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { PageHeader } from "../components/common/PageHeader";
import { useBusinessStore } from "../services/businessStore";
import { businessApi, type BusinessPromotion, type PromotionLimits, type RealOffer } from "../services/businessApiClient";
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
  const { business } = useBusinessStore();
  const [promotions, setPromotions] = useState<BusinessPromotion[]>([]);
  const [catalogItems, setCatalogItems] = useState<RealOffer[]>([]);
  const [limits, setLimits] = useState<PromotionLimits | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const refreshInFlightRef = useRef(false);
  const createKeyRef = useRef<string | null>(null);
  const [error, setError] = useState("");
  const [query] = useState("");
  const [tab, setTab] = useState<Tab>("ALL");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<BusinessPromotion | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState<FormValue>(createBlank);
  const [files, setFiles] = useState<File[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [removalTarget, setRemovalTarget] = useState<BusinessPromotion | null>(null);
  const [proDialog, setProDialog] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const isReal = business.source === "real" && Boolean(business.id);
  const canManage = business.role === "Propietario" || business.permissions?.includes("MANAGE_PROMOTIONS");

  const reload = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!isReal || !business.id) { setPromotions([]); setLimits(null); setLoading(false); return; }
    if (refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;
    if (!silent) { setLoading(true); setError(""); }
    try {
      const data = await businessApi.listPromotions(business.id);
      setPromotions(data.promotions); setLimits(data.limits);
      if (!silent) {
        const catalog = await businessApi.listOffers(business.id).catch(() => ({ offers: [] }));
        setCatalogItems([...catalog.offers].sort((a, b) => (a.internalCode ?? "").localeCompare(b.internalCode ?? "", undefined, { numeric: true })));
      }
    }
    catch { if (!silent) setError("No pudimos cargar las ofertas de este negocio. Intenta de nuevo."); }
    finally { refreshInFlightRef.current = false; if (!silent) setLoading(false); }
  }, [business.id, isReal]);
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
  }, [isReal, reload]);

  const counts = useMemo(() => ({ ALL: promotions.length, ACTIVE: promotions.filter(item => item.state === "ACTIVE").length, SCHEDULED: promotions.filter(item => item.state === "SCHEDULED").length, FINISHED: promotions.filter(item => item.state === "FINISHED").length }), [promotions]);
  const filtered = useMemo(() => promotions.filter(item => (tab === "ALL" || item.state === tab) && `${item.title} ${item.description} ${item.category ?? ""}`.toLocaleLowerCase("es-CO").includes(query.toLocaleLowerCase("es-CO"))), [promotions, query, tab]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize);
  const filePreviews = useMemo(() => files.map(file => URL.createObjectURL(file)), [files]);
  useEffect(() => () => filePreviews.forEach(url => URL.revokeObjectURL(url)), [filePreviews]);
  useEffect(() => { setPage(1); }, [query, tab]);
  useEffect(() => { setPage(current => Math.min(current, totalPages)); }, [totalPages]);

  const beginNew = () => { setEditing(null); createKeyRef.current = null; setForm(createBlank()); setFiles([]); setError(""); setPreviewOpen(false); setEditorOpen(true); };
  const beginEdit = (promotion: BusinessPromotion) => { setEditing(promotion); setEditorOpen(true); setForm({ type: promotion.type, title: promotion.title, description: promotion.description, conditions: promotion.conditions ?? "", category: promotion.category ?? "", relatedOfferId: promotion.relatedOfferId ?? "", originalPrice: promotion.originalPrice ?? "", promotionalPrice: promotion.promotionalPrice ?? "", startsAt: dateValue(promotion.startsAt), endsAt: dateValue(promotion.endsAt), recurrence: promotion.recurrence, recurrenceUntil: promotion.recurrenceUntil ? dateValue(promotion.recurrenceUntil) : "" }); setFiles([]); setError(""); };
  const closeForm = () => { setEditing(null); setFiles([]); setPreviewOpen(false); setEditorOpen(false); };
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
  const addFiles = (selected: FileList | null) => {
    if (!selected) return;
    const max = limits?.maxPhotos ?? 1;
    const valid = Array.from(selected).filter(file => file.type.startsWith("image/") && file.size <= 5 * 1024 * 1024);
    setFiles(current => [...current, ...valid].slice(0, Math.max(0, max - (editing?.photos.length ?? 0))));
    if (valid.length !== selected.length) setError("Agrega imágenes JPG, PNG o WebP de máximo 5 MB.");
  };
  const removeSavedPhoto = async (photoId: string) => {
    if (!editing || !business.id) return;
    try { await businessApi.deletePromotionPhoto(business.id, editing.id, photoId); setEditing({ ...editing, photos: editing.photos.filter(photo => photo.id !== photoId) }); setPromotions(current => current.map(item => item.id === editing.id ? { ...item, photos: item.photos.filter(photo => photo.id !== photoId) } : item)); }
    catch { setError("No pudimos quitar esa fotografía."); }
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!business.id || savingRef.current) return;
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
  const remove = async (item: BusinessPromotion) => { if (!business.id) return; try { await businessApi.deletePromotion(business.id, item.id); setRemovalTarget(null); await reload(); } catch (cause) { setError(cause instanceof Error ? cause.message : "No pudimos eliminar la publicación."); } };
  const activeLimitReached = Boolean(limits && limits.activeCount >= limits.maxActive);
  const canCreate = canManage && !activeLimitReached;

  return <main className="promotions-page">
    <PageHeader eyebrow="Ofertas y promociones" title="Ofertas y promociones" description={`Crea y administra las ofertas y promociones de ${business.name}. Atrae más clientes y aumenta tus ventas.`} action={<button className="action-button promotions-new" type="button" onClick={() => { if (activeLimitReached) { setError(`Alcanzaste el límite de publicaciones activas de tu plan ${limits?.plan === "PRO" ? "Business Pro (10)" : "Básico (1)"}.`); return; } beginNew(); }} disabled={!canManage}>＋ Crear publicación</button>} />
    {!isReal && <div className="promotions-notice" role="status">Selecciona un negocio real para administrar sus publicaciones.</div>}
    {!canManage && isReal && <div className="promotions-notice" role="alert">Tu perfil no tiene permiso para administrar promociones de este negocio.</div>}
    {activeLimitReached && <div className="promotions-notice">Alcanzaste el límite de publicaciones activas de tu plan {limits?.plan === "PRO" ? "Business Pro" : "Básico"}. {limits?.plan === "BASIC" && <button type="button" onClick={() => setProDialog(true)}>Conocer Business Pro</button>}</div>}
    <section className="promotions-summary" aria-label="Resumen de promociones">
      <article><span className="promotions-summary-icon violet">◆</span><div><strong>{counts.ACTIVE}</strong><small>Activas</small></div></article>
      <article><span className="promotions-summary-icon coral">◷</span><div><strong>{counts.SCHEDULED}</strong><small>Programadas</small></div></article>
      <article><span className="promotions-summary-icon blue">✓</span><div><strong>{counts.FINISHED}</strong><small>Finalizadas</small></div></article>
      <article><span className="promotions-summary-icon violet">▥</span><div><strong>{limits ? limits.summary.totalViews.toLocaleString("es-CO") : "—"}</strong><small>Visualizaciones {limits?.detailedAnalytics ? "totales" : "generales"}</small></div></article>
    </section>
    {error && !editing && <p className="promotions-error" role="alert">{error}</p>}
    <div className={`promotions-workspace${editorOpen ? " has-editor" : ""}`}>
      <section className="promotions-list-panel">
        <div className="promotions-tabs" role="tablist" aria-label="Filtrar publicaciones"><span className="promotions-active-counter">Publicaciones activas: {limits ? `${limits.summary.active}/${limits.maxActive}` : "—"}</span>{([["ALL", "Todas"], ["ACTIVE", "Activas"], ["SCHEDULED", "Programadas"], ["FINISHED", "Finalizadas"]] as const).map(([key, label]) => <button type="button" key={key} role="tab" aria-selected={tab === key} className={tab === key ? "selected" : ""} onClick={() => setTab(key)}>{label} <span>{counts[key]}</span></button>)}</div>
        {loading ? <div className="promotions-empty">Cargando promociones…</div> : pageItems.length ? <div className="promotions-items">{pageItems.map(item => <article className="promotion-row" key={item.id}><div className="promotion-row-photos">{item.photos[0] ? <PromotionPhotoImage url={item.photos[0].url} /> : <span aria-hidden="true">{item.type === "OFFER" ? "%" : "✦"}</span>}</div><div className="promotion-row-main"><div className="promotion-row-labels"><span className={`promotion-type ${item.type.toLowerCase()}`}>{item.type === "OFFER" ? "OFERTA" : "PROMOCIÓN"}</span><span className={`promotion-state ${item.state.toLowerCase()}`}>{item.state === "ACTIVE" ? "Activa" : item.state === "SCHEDULED" ? "Programada" : "Finalizada"}</span></div><h2>{item.title}</h2><p>{item.description}</p><div className="promotion-row-meta">{item.category && <span>◇ {item.category}</span>}<span>◷ {new Date(item.startsAt).toLocaleDateString("es-CO")} – {new Date(item.endsAt).toLocaleDateString("es-CO")}</span>{item.state !== "SCHEDULED" && <span>◉ {item.viewCount.toLocaleString("es-CO")} visualizaciones</span>}</div>{item.originalPrice && <strong className="promotion-prices">{money(item.promotionalPrice)} <del>{money(item.originalPrice)}</del><small>{Math.round((1 - Number(item.promotionalPrice) / Number(item.originalPrice)) * 100)}% dto.</small></strong>}</div><div className="promotion-row-actions"><button type="button" onClick={() => beginEdit(item)} aria-label={`Editar ${item.title}`}>Editar</button>{item.state !== "FINISHED" && <button type="button" onClick={() => void finish(item)}>Finalizar</button>}<button type="button" className="danger" onClick={() => setRemovalTarget(item)}>Eliminar</button></div></article>)}</div> : <div className="promotions-empty"><span aria-hidden="true">◇</span><h2>{promotions.length ? "No hay publicaciones con estos filtros" : "Aún no tienes ofertas o promociones"}</h2><p>{promotions.length ? "Prueba otra búsqueda o pestaña." : "Crea una oferta o promoción para compartirla con tus clientes."}</p>{!promotions.length && canCreate && <button className="action-button" type="button" onClick={beginNew}>＋ Crear primera publicación</button>}</div>}
        {!loading && filtered.length > pageSize && <nav className="promotions-pagination" aria-label="Paginación de promociones"><span>Mostrando {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} de {filtered.length}</span><button type="button" disabled={page <= 1} onClick={() => setPage(current => current - 1)}>‹</button><span>{page} / {totalPages}</span><button type="button" disabled={page >= totalPages} onClick={() => setPage(current => current + 1)}>›</button></nav>}
      </section>
      {editorOpen && <aside className="promotion-editor"><div className="promotion-editor-heading"><div><span>{editing ? "ADMINISTRAR PUBLICACIÓN" : "NUEVA PUBLICACIÓN"}</span><h2>{editing ? "Editar publicación" : "Nueva oferta o promoción"}</h2></div><button type="button" aria-label="Cerrar formulario" onClick={closeForm}>×</button></div><form className={`promotion-form promotion-form-${form.type.toLowerCase()}`} onSubmit={save}>
        <fieldset><legend>Tipo de publicación</legend><div className="promotion-type-picker"><button type="button" className={form.type === "OFFER" ? "selected" : ""} onClick={() => setForm(current => ({ ...current, type: "OFFER", originalPrice: current.type === "PROMOTION" ? "" : current.originalPrice, promotionalPrice: current.type === "PROMOTION" ? "" : current.promotionalPrice }))}>％ <span><b>Descuento en producto o servicio</b><small>Selecciona un registro existente y define el nuevo precio</small></span></button><button type="button" className={form.type === "PROMOTION" ? "selected" : ""} onClick={() => setForm(current => ({ ...current, type: "PROMOTION", originalPrice: "", promotionalPrice: "", relatedOfferId: "" }))}>✦ <span><b>Evento especial</b><small>Publicación independiente sin precio</small></span></button></div></fieldset>
        <label>Producto o servicio existente <select value={form.relatedOfferId} onChange={event => selectCatalogItem(event.target.value)}><option value="">Seleccione producto o servicio</option>{catalogItems.map(item => <option key={item.id} value={item.id}>{displayInternalCode(item.internalCode)} · {item.kind === "PRODUCT" ? "Producto" : "Servicio"}</option>)}</select></label>
        <label>Título <i>*</i><input required maxLength={120} value={form.title} onChange={event => setField("title", event.target.value)} placeholder="Ej. 2x1 en productos seleccionados" /></label>
        <label>Descripción <i>*</i><textarea required maxLength={500} value={form.description} onChange={event => setField("description", event.target.value)} placeholder="Describe tu oferta o promoción…" /><small className="promotion-counter">{form.description.length}/500</small></label>
        <label>Condiciones <span>(opcional)</span><textarea maxLength={500} value={form.conditions} onChange={event => setField("conditions", event.target.value)} placeholder="Días, productos incluidos u otras condiciones" /></label>
        <div className="promotion-photo-label">Imágenes <span>(máximo {limits?.maxPhotos ?? 1})</span> <small>JPG, PNG o WebP, hasta 5 MB</small></div><div className="promotion-photos">{editing?.photos.map(photo => <div className="promotion-photo" key={photo.id}><PromotionPhotoImage url={photo.url}/><button type="button" aria-label="Quitar fotografía" onClick={() => void removeSavedPhoto(photo.id)}>×</button></div>)}{files.map((file, index) => <div className="promotion-photo" key={`${file.name}-${file.lastModified}`}><img src={filePreviews[index]} alt=""/><button type="button" aria-label="Quitar fotografía" onClick={() => setFiles(current => current.filter((_, itemIndex) => itemIndex !== index))}>×</button></div>)}{(editing?.photos.length ?? 0) + files.length < (limits?.maxPhotos ?? 1) && <button className="promotion-photo-add" type="button" onClick={() => fileInput.current?.click()}>＋<span>Agregar fotos</span></button>}<input ref={fileInput} hidden type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={event => { addFiles(event.target.files); event.target.value = ""; }} /></div>
        {form.type === "OFFER" && <div className="promotion-price-fields"><label>Precio original (COP)<input type="text" inputMode="numeric" required readOnly value={formatCopInput(form.originalPrice)} aria-readonly="true" /></label><label>Precio promocional (COP)<input type="text" inputMode="numeric" required value={formatCopInput(form.promotionalPrice)} onChange={event => setPromotionalPrice(event.target.value)} placeholder="$ 0" /></label></div>}
        {form.type === "PROMOTION" && <label>Precio opcional (COP)<input type="number" min="0" step="1" value={form.promotionalPrice} onChange={event => setField("promotionalPrice", event.target.value)} placeholder="No requerido" /></label>}
        <fieldset><legend>Vigencia</legend><div className="promotion-price-fields"><label>Fecha de inicio <i>*</i><input type="datetime-local" required disabled={!limits?.canSchedule && !editing} value={form.startsAt} onChange={event => setField("startsAt", event.target.value)} /></label><label>Fecha de finalización <i>*</i><input type="datetime-local" required value={form.endsAt} onChange={event => setField("endsAt", event.target.value)} /></label></div>{!limits?.canSchedule && !editing && <small>El plan Básico publica de inmediato, sin programación futura.</small>}</fieldset>
        {limits?.canRecur && <><label>Repetición <span className="promotion-pro-tag">PRO</span><select value={form.recurrence} onChange={event => setField("recurrence", event.target.value)}><option value="NONE">Sin repetición</option><option value="DAILY">Diaria</option><option value="WEEKLY">Semanal</option><option value="MONTHLY">Mensual</option></select></label>{form.recurrence !== "NONE" && <label>Repetir hasta <i>*</i><input type="datetime-local" required min={form.endsAt} value={form.recurrenceUntil} onChange={event => setField("recurrenceUntil", event.target.value)} /></label>}</>}{!limits?.canRecur && <button className="promotion-upgrade-link" type="button" onClick={() => setProDialog(true)}>Repetición de promociones · Conocer Business Pro</button>}
        <label>Categoría <span>(opcional)</span><input maxLength={100} value={form.category} onChange={event => setField("category", event.target.value)} placeholder="Ej. Panadería" /></label>
        {error && <p className="promotions-error" role="alert">{error}</p>}
        <div className="promotion-editor-actions"><button type="button" className="outline-button" onClick={() => setPreviewOpen(true)}>Vista previa</button><button type="button" className="outline-button" onClick={closeForm}>Cancelar</button><button className="action-button" type="submit" disabled={saving}>{saving ? "Guardando…" : editing ? "Guardar cambios" : "Guardar publicación"}</button></div>
      </form></aside>}
    </div>
    {previewOpen && <div className="promotion-preview-overlay" role="presentation" onMouseDown={event => event.target === event.currentTarget && setPreviewOpen(false)}><section className="promotion-preview" role="dialog" aria-modal="true" aria-labelledby="promotion-preview-title"><button type="button" className="promotion-preview-close" onClick={() => setPreviewOpen(false)} aria-label="Cerrar vista previa">×</button><span className="promotion-type">{form.type === "OFFER" ? "OFERTA" : "PROMOCIÓN"}</span><h2 id="promotion-preview-title">{form.title || "Título de la publicación"}</h2><p>{form.description || "La descripción aparecerá aquí."}</p>{form.promotionalPrice && <strong>{money(form.promotionalPrice)} {form.originalPrice && <del>{money(form.originalPrice)}</del>}</strong>}<small>{form.startsAt && new Date(form.startsAt).toLocaleString("es-CO")} – {form.endsAt && new Date(form.endsAt).toLocaleString("es-CO")}</small></section></div>}
    {removalTarget && <div className="promotion-confirm-overlay" role="presentation" onMouseDown={event => event.target === event.currentTarget && setRemovalTarget(null)}><section className="promotion-confirm" role="dialog" aria-modal="true" aria-labelledby="promotion-confirm-title"><div className="promotion-confirm-icon" aria-hidden="true">!</div><h2 id="promotion-confirm-title">¿Eliminar esta publicación?</h2><p>“{removalTarget.title}” se eliminará de tus ofertas y promociones. Esta acción no se puede deshacer.</p><div className="promotion-confirm-actions"><button type="button" className="subtle-button" onClick={() => setRemovalTarget(null)}>Cancelar</button><button type="button" className="danger-button" onClick={() => void remove(removalTarget)}>Eliminar publicación</button></div></section></div>}
    {proDialog && <BusinessProBenefitsDialog onClose={() => setProDialog(false)} />}
  </main>;
}
