import { useEffect, useRef, useState, type FormEvent } from "react";
import { reportBusiness, type BusinessReportReason } from "../services/businessReportService";
import "./BusinessReportDialog.css";

const reasons: Array<{ value: BusinessReportReason; label: string }> = [
  { value: "IMPERSONATION", label: "Suplantación de identidad o negocio" },
  { value: "FALSE_INFORMATION", label: "Información falsa o engañosa" },
  { value: "SUSPECTED_FRAUD", label: "Posible fraude o estafa" },
  { value: "INAPPROPRIATE_CONTENT", label: "Contenido inapropiado" },
  { value: "OTHER", label: "Otro motivo" },
];

export function BusinessReportDialog({ businessId, businessName, disabled = false }: { businessId: string; businessName: string; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<BusinessReportReason>("IMPERSONATION");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (!open) return;
    selectRef.current?.focus();
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) { setOpen(false); triggerRef.current?.focus(); }
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [open, submitting]);

  function close() {
    if (submitting) return;
    setOpen(false);
    triggerRef.current?.focus();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      await reportBusiness(businessId, reason, description.trim());
      setSubmitted(true);
    } catch {
      setError("No pudimos enviar el reporte. Comprueba tu conexión e inténtalo nuevamente.");
    } finally {
      setSubmitting(false);
    }
  }

  return <>
    <button type="button" ref={triggerRef} className="business-report-trigger" disabled={disabled} title={disabled ? "Disponible en la página pública del negocio" : "Enviar un reporte sobre este negocio"} onClick={() => {
      setReason("IMPERSONATION"); setDescription(""); setSubmitted(false); setError(""); setOpen(true);
    }}><span aria-hidden="true">⚑</span> Reportar negocio</button>
    {open && <div className="business-report-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}>
      <section className="business-report-dialog" role="dialog" aria-modal="true" aria-labelledby="business-report-title" aria-describedby="business-report-intro">
        <svg className="business-report-decor" viewBox="0 0 640 210" fill="none" aria-hidden="true" focusable="false">
          <defs>
            <linearGradient id="business-report-wave-violet" x1="160" y1="0" x2="640" y2="165" gradientUnits="userSpaceOnUse"><stop stopColor="#7B3FFB"/><stop offset=".56" stopColor="#904BF5"/><stop offset="1" stopColor="#3A8EFF"/></linearGradient>
            <linearGradient id="business-report-wave-pale" x1="200" y1="30" x2="580" y2="200" gradientUnits="userSpaceOnUse"><stop stopColor="#F4EBFF"/><stop offset="1" stopColor="#DDEBFF"/></linearGradient>
          </defs>
          <path d="M145 0H640V210C521 187 444 153 368 104 287 52 230 27 145 0Z" fill="url(#business-report-wave-pale)" opacity=".65"/>
          <path d="M240 0H640V173C556 158 506 134 450 93 396 54 353 31 240 0Z" fill="url(#business-report-wave-violet)" opacity=".93"/>
          <path d="M371 0H640V128C578 124 526 95 493 63 461 32 427 14 371 0Z" fill="#B898FF" opacity=".48"/>
          <path d="M516 0H640V134C597 125 579 106 559 79 540 52 538 20 516 0Z" fill="#5AC5FF" opacity=".38"/>
        </svg>
        <button type="button" className="business-report-close" onClick={close} disabled={submitting} aria-label="Cerrar reporte" title="Cerrar">×</button>
        <div className="business-report-heading">
          <span className="business-report-shield" aria-hidden="true">
            <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="3.3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M24 4 40 11v12c0 10.5-6.5 17-16 21C14.5 40 8 33.5 8 23V11L24 4Z"/>
              <path d="M24 15v12"/><circle cx="24" cy="33" r="1.8" fill="currentColor" stroke="none"/>
            </svg>
          </span>
          <h2 id="business-report-title">{submitted ? "Reporte recibido" : "Reportar negocio"}</h2>
        </div>
        {submitted ? <>
          <p id="business-report-intro" className="business-report-intro">Gracias por ayudarnos a cuidar XAMUKO. Revisaremos la información de forma confidencial.</p>
          <div className="business-report-actions">
            <button type="button" className="business-report-submit" onClick={close}>Cerrar</button>
          </div>
        </> : <>
          <p id="business-report-intro" className="business-report-intro">Cuéntanos qué ocurre con <strong>{businessName}</strong>. Tu reporte será revisado por XAMUKO y no aparecerá públicamente.</p>
          <form onSubmit={submit}>
            <label htmlFor="business-report-reason" className="business-report-label">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 3H5a2 2 0 0 0-2 2v6l9 9a2 2 0 0 0 3 0l6-6a2 2 0 0 0 0-3l-9-9Z"/><circle cx="7.5" cy="7.5" r="1"/></svg>
              Motivo
            </label>
            <select ref={selectRef} id="business-report-reason" value={reason} onChange={event => setReason(event.target.value as BusinessReportReason)} required>
              {reasons.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
            <label htmlFor="business-report-description" className="business-report-label">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 9 9 0 0 1-4-.9L3 21l1.9-5.4A8.5 8.5 0 1 1 21 11.5Z"/></svg>
              Describe lo sucedido
            </label>
            <textarea id="business-report-description" aria-describedby="business-report-note" value={description} onChange={event => setDescription(event.target.value)} minLength={15} maxLength={1500} rows={4} required placeholder="Explica por qué consideras que debemos revisar este negocio..." />
            <div id="business-report-note" className="business-report-info">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>
              <small>Entre 15 y 1500 caracteres. Evita compartir documentos de identidad u otros datos sensibles.</small>
            </div>
            {error && <p className="business-report-error" role="alert">{error}</p>}
            <div className="business-report-actions">
              <button type="button" className="business-report-cancel" disabled={submitting} onClick={close}>Cancelar</button>
              <button type="submit" className="business-report-submit" disabled={submitting || description.trim().length < 15}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4L22 2Z"/><path d="M22 2 11 13"/></svg>
                {submitting ? "Enviando…" : "Enviar reporte"}
              </button>
            </div>
          </form>
        </>}
      </section>
    </div>}
  </>;
}
