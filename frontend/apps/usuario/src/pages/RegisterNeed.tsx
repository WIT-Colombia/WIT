import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { categories } from "../data/mockData";
import { useLocationContext } from "../context/LocationContext";
import { requestWithSession } from "../services/authService";
import { PageLayout } from "../components/PageLayout";
import "../components/BusinessReportDialog.css";
import "./Report.css";
import "./RegisterNeed.css";

export default function RegisterNeed() {
  const [params] = useSearchParams();
  const [title, setTitle] = useState(params.get("q") ?? "");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState("");
  const { selection } = useLocationContext();
  const location = selection?.locality ?? null;
  const locationLabel = location
    ? [location.name, location.context].filter(Boolean).join(", ")
    : selection?.mode === "automatic" ? "Ubicación actual" : "Zona no seleccionada";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim() || !category || saving) return;
    setSaving(true); setError("");
    try {
      const response = await requestWithSession<{ request: { id: string } }>("/api/v1/public/needs", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(), category, description: description.trim(),
          locationName: location?.name ?? (selection?.mode === "automatic" ? "Ubicación actual" : "Zona no seleccionada"),
          locationContext: location?.context ?? null,
        }),
      });
      setReceipt(response.request.id);
      setSubmitted(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pudimos registrar tu necesidad. Intenta nuevamente.");
    } finally { setSaving(false); }
  }

  return <PageLayout className="register-need-page report-page">
    <div className="report-panel-wrap">
      <section className="business-report-dialog report-form-panel" aria-labelledby="need-form-title" aria-describedby="need-form-intro">
        <svg className="business-report-decor" viewBox="0 0 640 210" fill="none" aria-hidden="true" focusable="false">
          <defs>
            <linearGradient id="need-wave-violet" x1="160" y1="0" x2="640" y2="165" gradientUnits="userSpaceOnUse">
              <stop stopColor="#7B3FFB"/><stop offset=".56" stopColor="#904BF5"/><stop offset="1" stopColor="#3A8EFF"/>
            </linearGradient>
            <linearGradient id="need-wave-pale" x1="200" y1="30" x2="580" y2="200" gradientUnits="userSpaceOnUse">
              <stop stopColor="#F4EBFF"/><stop offset="1" stopColor="#DDEBFF"/>
            </linearGradient>
          </defs>
          <path d="M145 0H640V210C521 187 444 153 368 104 287 52 230 27 145 0Z" fill="url(#need-wave-pale)" opacity=".65"/>
          <path d="M240 0H640V173C556 158 506 134 450 93 396 54 353 31 240 0Z" fill="url(#need-wave-violet)" opacity=".93"/>
          <path d="M371 0H640V128C578 124 526 95 493 63 461 32 427 14 371 0Z" fill="#B898FF" opacity=".48"/>
          <path d="M516 0H640V134C597 125 579 106 559 79 540 52 538 20 516 0Z" fill="#5AC5FF" opacity=".38"/>
        </svg>
        <Link to="/home" className="business-report-close" aria-label="Cerrar formulario" title="Cerrar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" aria-hidden="true" focusable="false">
            <path d="M5 5l14 14M19 5 5 19"/>
          </svg>
        </Link>
        <div className="business-report-heading">
          <span className="business-report-shield" aria-hidden="true">
            {submitted ? (
              <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="3.3" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="24" cy="24" r="18"/><path d="m15 24 6 6 12-13"/>
              </svg>
            ) : (
              <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="3.3" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="21" cy="21" r="12"/><path d="m30 30 12 12"/>
              </svg>
            )}
          </span>
          <h1 id="need-form-title">{submitted ? "Necesidad registrada" : "Cuéntanos lo que necesitas"}</h1>
        </div>
        {submitted ? <>
          <p id="need-form-intro" className="business-report-intro">
            Gracias por contarnos qué estás buscando. Tu necesidad quedó registrada para revisión en XAMUKO.
          </p>
          <div className="business-report-info report-local-notice" role="status">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>
            </svg>
            <small>Radicado: {receipt}. Estado: pendiente de revisión.</small>
          </div>
          <div className="business-report-actions">
            <Link className="business-report-submit" to="/home">Volver al inicio</Link>
          </div>
        </> : <>
          <p id="need-form-intro" className="business-report-intro">
            ¿Qué necesitas encontrar? Cuéntanos un poco para ayudarnos a conocer lo que estás buscando.
          </p>
          <form className="need-form" onSubmit={submit}>
            <label htmlFor="need-title" className="business-report-label">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>
              </svg>
              ¿Qué estás buscando?
            </label>
            <input id="need-title" value={title} onChange={(event) => setTitle(event.target.value)}
              placeholder="Ej. un lugar para desayunar" maxLength={90} required />
            <label htmlFor="need-category" className="business-report-label">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M11 3H5a2 2 0 0 0-2 2v6l9 9a2 2 0 0 0 3 0l6-6a2 2 0 0 0 0-3l-9-9Z"/><circle cx="7.5" cy="7.5" r="1"/>
              </svg>
              ¿En qué categoría?
            </label>
            <select id="need-category" value={category} onChange={(event) => setCategory(event.target.value)} required>
              <option value="">Elige una categoría</option>
              {categories.map(item => <option key={item.name} value={item.name}>{item.name}</option>)}
            </select>
            <label htmlFor="need-description" className="business-report-label">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 9 9 0 0 1-4-.9L3 21l1.9-5.4A8.5 8.5 0 1 1 21 11.5Z"/>
              </svg>
              Cuéntanos un poco más <span className="report-optional">(opcional)</span>
            </label>
            <textarea id="need-description" value={description} onChange={(event) => setDescription(event.target.value)}
              placeholder="Algún detalle que nos ayude a entender mejor…" maxLength={320} rows={4} />
            <div className="business-report-info need-location-note">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>
              </svg>
              <small>Zona seleccionada: <strong>{locationLabel}</strong></small>
            </div>
            {error && <p className="business-report-error" role="alert">{error}</p>}
            <div className="business-report-actions">
              <Link className="business-report-cancel" to="/home" aria-disabled={saving}
                onClick={(event) => { if (saving) event.preventDefault(); }}>Cancelar</Link>
              <button className="business-report-submit" type="submit" disabled={saving || !title.trim() || !category}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m22 2-7 20-4-9-9-4L22 2Z"/><path d="M22 2 11 13"/>
                </svg>
                {saving ? "Enviando…" : "Enviar mi necesidad"}
              </button>
            </div>
          </form>
        </>}
      </section>
    </div>
  </PageLayout>;
}
