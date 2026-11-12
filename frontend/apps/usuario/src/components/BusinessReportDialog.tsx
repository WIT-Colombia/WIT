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
        <button type="button" className="business-report-close" onClick={close} disabled={submitting} aria-label="Cerrar">×</button>
        {submitted ? <>
          <h2 id="business-report-title">Reporte recibido</h2>
          <p id="business-report-intro">Gracias por ayudarnos a cuidar XAMUKO. Revisaremos la información de forma confidencial.</p>
          <button type="button" className="business-report-submit" onClick={close}>Cerrar</button>
        </> : <>
          <h2 id="business-report-title">Reportar negocio</h2>
          <p id="business-report-intro">Cuéntanos qué ocurre con <strong>{businessName}</strong>. Tu reporte será revisado por XAMUKO y no aparecerá públicamente.</p>
          <form onSubmit={submit}>
            <label htmlFor="business-report-reason">Motivo</label>
            <select ref={selectRef} id="business-report-reason" value={reason} onChange={event => setReason(event.target.value as BusinessReportReason)} required>
              {reasons.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
            <label htmlFor="business-report-description">Describe lo sucedido</label>
            <textarea id="business-report-description" value={description} onChange={event => setDescription(event.target.value)} minLength={15} maxLength={1500} rows={4} required placeholder="Explica por qué consideras que debemos revisar este negocio..." />
            <small>Entre 15 y 1500 caracteres. Evita compartir documentos de identidad u otros datos sensibles.</small>
            {error && <p className="business-report-error" role="alert">{error}</p>}
            <div className="business-report-actions">
              <button type="button" className="business-report-cancel" disabled={submitting} onClick={close}>Cancelar</button>
              <button type="submit" className="business-report-submit" disabled={submitting || description.trim().length < 15}>{submitting ? "Enviando…" : "Enviar reporte"}</button>
            </div>
          </form>
        </>}
      </section>
    </div>}
  </>;
}
