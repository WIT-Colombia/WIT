import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FractionalStars } from "../components/FractionalStars";
import { useBusinessStore } from "../services/businessStore";
import { useBusinessAuth } from "../services/businessAuthContext";
import { businessApi, type BusinessReview } from "../services/businessApiClient";
import "./ReviewsPage.css";

const RESPONSE_WINDOW_MS = 12 * 60 * 60 * 1000;
const reasons = [{ value: "OFFENSIVE", label: "Contenido ofensivo o acoso" }, { value: "FALSE_INFORMATION", label: "Información presuntamente falsa" }, { value: "SPAM", label: "Publicidad o spam" }, { value: "PERSONAL_DATA", label: "Datos personales" }, { value: "OTHER", label: "Otro motivo" }];
const canEditResponse = (createdAt: string) => Date.now() - new Date(createdAt).getTime() <= RESPONSE_WINDOW_MS;

export function ReviewsPage() {
  const { business, businessesReady } = useBusinessStore(); const auth = useBusinessAuth(); const [reviews, setReviews] = useState<BusinessReview[]>([]); const [summary, setSummary] = useState({ average: null as number | null, total: 0, distribution: {} as Record<string, number> }); const [filter, setFilter] = useState("Todas"); const [replyingTo, setReplyingTo] = useState<string | null>(null); const [replyDraft, setReplyDraft] = useState(""); const [reportingTo, setReportingTo] = useState<string | null>(null); const [reason, setReason] = useState("OFFENSIVE"); const [reportDescription, setReportDescription] = useState(""); const [message, setMessage] = useState(""); const [error, setError] = useState(""); const [loading, setLoading] = useState(true); const bars = [5, 4, 3, 2, 1];
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [actionError, setActionError] = useState("");
  const reviewsOverlayRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!message) return; const timeout = window.setTimeout(() => setMessage(""), 4000); return () => window.clearTimeout(timeout); }, [message]);
  useEffect(() => { let cancelled = false; if (auth.state.status !== "authenticated" || !businessesReady) { setLoading(false); return () => { cancelled = true; }; } if (business.source !== "real" || !business.publicId) { setLoading(false); setError("No hay un establecimiento válido seleccionado."); return () => { cancelled = true; }; } setLoading(true); setError(""); businessApi.listReviews(business.publicId).then(data => { if (!cancelled) { setReviews(data.reviews); setSummary(data.summary); } }).catch(caught => { if (!cancelled) setError(caught instanceof Error ? caught.message : "No se pudieron cargar las opiniones."); }).finally(() => { if (!cancelled) setLoading(false); }); return () => { cancelled = true; }; }, [auth.state.status, businessesReady, business.source, business.publicId]);
  const visible = useMemo(() => reviews.filter(review => filter === "Todas" || review.rating === Number(filter)), [reviews, filter]);
  const currentReview = reviews.find(item => item.id === (replyingTo ?? reportingTo));
  const dialogKind = replyingTo ? "reply" : reportingTo ? "report" : null;
  const closeDialog = () => {
    if (submittingRef.current) return;
    setReplyingTo(null);
    setReportingTo(null);
    setActionError("");
  };
  const beginReply = (review: BusinessReview) => {
    setReportingTo(null);
    setReplyDraft(review.response?.body ?? "");
    setActionError("");
    setReplyingTo(review.id);
  };
  const beginReport = (review: BusinessReview) => {
    setReplyingTo(null);
    setReason("OFFENSIVE");
    setReportDescription("");
    setActionError("");
    setReportingTo(review.id);
  };
  // Keep both action dialogs inside the actual visible viewport on iPad/iOS,
  // independently of Business desktop/mobile sticky headers.
  useLayoutEffect(() => {
    if (!currentReview || !dialogKind) return;
    const overlay = reviewsOverlayRef.current;
    if (!overlay) return;
    const body = document.body;
    const previousOverflow = body.style.overflow;
    const viewport = window.visualViewport;
    const syncViewport = () => {
      overlay.style.setProperty("--reviews-viewport-top", `${viewport?.offsetTop ?? 0}px`);
      overlay.style.setProperty("--reviews-viewport-left", `${viewport?.offsetLeft ?? 0}px`);
      overlay.style.setProperty("--reviews-viewport-width", `${viewport?.width ?? window.innerWidth}px`);
      overlay.style.setProperty("--reviews-viewport-height", `${viewport?.height ?? window.innerHeight}px`);
    };
    body.classList.add("reviews-dialog-active");
    body.style.overflow = "hidden";
    syncViewport();
    window.addEventListener("resize", syncViewport);
    viewport?.addEventListener("resize", syncViewport);
    viewport?.addEventListener("scroll", syncViewport);
    overlay.querySelector<HTMLButtonElement>(".reviews-dialog-close")?.focus({ preventScroll:true });
    return () => {
      window.removeEventListener("resize", syncViewport);
      viewport?.removeEventListener("resize", syncViewport);
      viewport?.removeEventListener("scroll", syncViewport);
      body.style.overflow = previousOverflow;
      body.classList.remove("reviews-dialog-active");
    };
  }, [currentReview?.id, dialogKind]);
  useEffect(() => {
    if (!dialogKind) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submittingRef.current) closeDialog();
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [dialogKind]);
  async function saveResponse(review: BusinessReview) {
    if (!replyDraft.trim() || submittingRef.current) return;
    if (review.response && !canEditResponse(review.response.createdAt)) {
      setActionError("La ventana de edición de esta respuesta ha finalizado.");
      return;
    }
    submittingRef.current = true; setSubmitting(true); setActionError("");
    try {
      const result = await businessApi.saveReviewResponse(review.id, replyDraft.trim(), Boolean(review.response));
      setReviews(current => current.map(item => item.id === review.id ? { ...item, response: result.response ?? null } : item));
      setReplyingTo(null);
      setMessage("Respuesta guardada correctamente.");
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "No se pudo guardar la respuesta.");
    } finally { submittingRef.current = false; setSubmitting(false); }
  }
  async function sendReport(reviewId: string) {
    if (submittingRef.current) return;
    if (reason === "OTHER" && !reportDescription.trim()) {
      setActionError("Describe brevemente el motivo del reporte.");
      return;
    }
    submittingRef.current = true; setSubmitting(true); setActionError("");
    try {
      await businessApi.reportReview(reviewId, reason, reportDescription.trim());
      setReportingTo(null);
      setReportDescription("");
      setMessage("Reporte enviado.");
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "No se pudo enviar el reporte.");
    } finally { submittingRef.current = false; setSubmitting(false); }
  }
  return <><main className="reviews-page">
    <header className="page-heading reviews-page-heading">
      <div className="reviews-page-heading-copy">
        <span className="reviews-page-eyebrow">REPUTACIÓN</span>
        <div className="reviews-page-heading-main">
          <span className="reviews-page-heading-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M20 11.2c0 4.6-3.6 8-8.6 8a10 10 0 0 1-3.9-.8L3 20l1.3-4A7.9 7.9 0 0 1 3 11.2c0-4.6 3.6-8 8.6-8s8.4 3.4 8.4 8Z"/><path d="m11.5 6.4 1.2 2.5 2.8.4-2 1.9.5 2.7-2.5-1.3-2.5 1.3.5-2.7-2-1.9 2.8-.4z"/></svg></span>
          <div><h1>Opiniones y calificaciones</h1><p>{`Conoce lo que piensan las personas sobre ${business.name}.`}</p></div>
        </div>
      </div>
    </header>
    <div className="reviews-layout"><section className="surface-card review-overview"><div className="reviews-overview-heading"><span className="reviews-overview-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="m12 2 3.2 6.5 7.2 1-5.2 5.1 1.2 7.3L12 18.4l-6.4 3.5 1.2-7.3-5.2-5.1 7.2-1Z"/></svg></span><span className="page-eyebrow">CALIFICACIÓN GENERAL</span></div><div className="review-score"><strong>{summary.average?.toFixed(1) ?? "—"}</strong><div><FractionalStars rating={summary.average} /><p>{summary.total} calificaciones recibidas</p></div></div><h3 className="reviews-distribution-title">Distribución de calificaciones</h3><div className="rating-bars full">{bars.map(star => { const count = summary.distribution[String(star)] ?? 0; const percentage = summary.total ? Math.round(count / summary.total * 100) : 0; return <div key={star}><span>{star} ★</span><i><b style={{ width: `${percentage}%` }} /></i><small>{percentage}%</small></div>; })}</div></section><section className="surface-card review-feed"><div className="card-heading"><div><h2>Opiniones escritas</h2><p>Comentarios recientes de la comunidad XAMUKO</p><span className="reviews-feed-count">{visible.length} de {reviews.length} opiniones</span></div><label className="filter-box"><span className="sr-only">Filtrar opiniones</span><select value={filter} onChange={event => setFilter(event.target.value)}><option>Todas</option>{bars.map(star => <option key={star} value={star}>{star} estrellas</option>)}</select></label></div>{loading ? <div className="empty-state"><h2>Cargando opiniones…</h2></div> : error ? <div className="empty-state"><h2>No se pudieron cargar las opiniones</h2><p>{error}</p></div> : visible.length ? visible.map(review => <article className="review-entry" key={review.id}><div className="review-avatar">{review.author.charAt(0)}</div><div><div className="review-entry-head"><strong>{review.author}</strong><time>{new Date(review.createdAt).toLocaleDateString("es-CO")}</time></div><div className="review-stars" aria-label={`${review.rating} de 5 estrellas`}>{"★".repeat(review.rating)}<span>{"☆".repeat(5 - review.rating)}</span></div><p>{review.comment}</p><div className="review-actions"><button className="review-reply-button" type="button" disabled={Boolean(review.response && !canEditResponse(review.response.createdAt))} onClick={() => beginReply(review)}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 11.5a8 8 0 0 1-8 8 9 9 0 0 1-3.6-.7L4 20l1.2-4.2A8 8 0 1 1 20 11.5Z"/><path d="M8 11.5h8"/></svg>{review.response ? (canEditResponse(review.response.createdAt) ? "Editar respuesta" : "Respuesta bloqueada") : "Responder"}</button><button className="review-report-button" type="button" onClick={() => beginReport(review)}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 21V4m0 1c6-4 8 4 15 0v11c-7 4-9-4-15 0"/></svg>Reportar comentario</button></div>{review.response && <div className="business-response"><strong>Respuesta del negocio</strong><p>{review.response.body}</p></div>}</div></article>) : <div className="empty-state"><span aria-hidden="true">☆</span><h2>{filter === "Todas" ? "Sin opiniones todavía" : "Sin opiniones con esta calificación"}</h2><p>{filter === "Todas" ? "Cuando tus clientes compartan una experiencia aparecerá aquí." : "Selecciona otro número de estrellas para consultar las opiniones."}</p></div>}</section></div>
    </main>
    {currentReview && dialogKind && createPortal(<div ref={reviewsOverlayRef} className="reviews-dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) closeDialog(); }}>
      <section className="reviews-dialog" role="dialog" aria-modal="true" aria-labelledby="reviews-dialog-title" aria-describedby="reviews-dialog-description" aria-busy={submitting}>
        <header className="reviews-dialog-heading">
          <span className={dialogKind === "reply" ? "reviews-dialog-icon reply" : "reviews-dialog-icon report"} aria-hidden="true">{dialogKind === "reply" ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 11.5a8 8 0 0 1-8 8 9 9 0 0 1-3.6-.7L4 20l1.2-4.2A8 8 0 1 1 20 11.5Z"/><path d="M8 11.5h8"/></svg> : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 21V4m0 1c6-4 8 4 15 0v11c-7 4-9-4-15 0"/></svg>}</span>
          <div><span className="reviews-dialog-eyebrow">OPINIONES · XAMUKO BUSINESS</span><h2 id="reviews-dialog-title">{dialogKind === "reply" ? (currentReview.response ? "Editar respuesta" : "Responder opinión") : "Reportar comentario"}</h2><p id="reviews-dialog-description">{dialogKind === "reply" ? `Responde al comentario de ${currentReview.author}.` : `Indica por qué deseas reportar el comentario de ${currentReview.author}.`}</p></div>
          <button type="button" className="reviews-dialog-close" disabled={submitting} aria-label="Cerrar formulario" onClick={closeDialog}>×</button>
        </header>
        <div className="reviews-dialog-content">
          <div className="reviews-dialog-review"><strong>{currentReview.author}</strong><span aria-label={`${currentReview.rating} de 5 estrellas`}>{"★".repeat(currentReview.rating)}</span><p>{currentReview.comment}</p></div>
          {dialogKind === "reply" ? <label className="reviews-dialog-field">Tu respuesta<textarea value={replyDraft} onChange={event => setReplyDraft(event.target.value)} rows={5} placeholder="Escribe una respuesta amable…" /></label> : <><label className="reviews-dialog-field">Motivo del reporte<select value={reason} onChange={event => { setReason(event.target.value); setActionError(""); }}>{reasons.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label className="reviews-dialog-field">Explicación adicional <small>{reason === "OTHER" ? "(obligatoria)" : "(opcional)"}</small><textarea maxLength={1000} value={reportDescription} onChange={event => setReportDescription(event.target.value)} rows={4} placeholder="Describe brevemente el motivo…" /></label></>}
          {actionError && <p className="reviews-dialog-error" role="alert">{actionError}</p>}
        </div>
        <footer className="reviews-dialog-actions"><button type="button" className="outline-button reviews-dialog-cancel" disabled={submitting} onClick={closeDialog}>Cancelar</button><button type="button" className={dialogKind === "reply" ? "action-button reviews-dialog-submit" : "action-button reviews-dialog-submit report"} disabled={submitting || (dialogKind === "reply" && !replyDraft.trim())} onClick={() => { if (dialogKind === "reply") void saveResponse(currentReview); else void sendReport(currentReview.id); }}>{submitting ? "Enviando…" : dialogKind === "reply" ? "Guardar respuesta" : "Enviar a revisión"}</button></footer>
      </section>
    </div>, document.body)}
    {message && <div className="wit-toast" role="status" aria-live="polite"><span className="wit-toast__icon" aria-hidden="true">✓</span><span>{message}</span></div>}</>;
}
