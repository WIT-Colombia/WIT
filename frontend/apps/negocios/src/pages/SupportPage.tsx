import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import "./SupportPage.css";
import { PageHeader } from "../components/common/PageHeader";
import { requestJson } from "../services/businessApiClient";
import { useBusinessStore } from "../services/businessStore";

type SupportMode = "support" | "suggestion";

type TechnicalIconName = "headset" | "message" | "document" | "send" | "check" | "help" | "arrow" | "shield";

function TechnicalIcon({ name }: { name: TechnicalIconName }) {
  const paths: Record<TechnicalIconName, string> = {
    headset: "M3 14v-3a9 9 0 0 1 18 0v3M3 13H2v6h5v-6H3Zm18 0h1v6h-5v-6h4ZM21 19c0 2-2 3-5 3h-3",
    message: "M4 4h16a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H9l-5 3v-3a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm3 6h10M7 14h7",
    document: "M6 3h8l5 5v13H6V3Zm8 0v6h5M9 13h7M9 17h7",
    send: "m22 2-7 20-4-9-9-4 20-7ZM11 13 22 2",
    check: "M20 6 9 17l-5-5M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20",
    help: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM9.5 9a2.5 2.5 0 1 1 4 2c-1 .8-1.5 1.4-1.5 2.7M12 17h.01",
    arrow: "M5 12h14m-6-6 6 6-6 6",
    shield: "M12 2 4 5v6c0 5 3.5 8.5 8 11 4.5-2.5 8-6 8-11V5l-8-3Zm-4 9 3 3 5-5",
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}


const supportTopics = ["Acceso o cuenta", "Mi negocio", "Productos y servicios", "Fotos y galería", "Pagos o planes", "Otro"];
const suggestionTopics = ["Nueva funcionalidad", "Mejora de diseño", "Rendimiento", "Experiencia móvil", "Otro"];

export function SupportPage({ mode = "support" }: { mode?: SupportMode }) {
  const support = mode === "support";
  const [topic, setTopic] = useState((support ? supportTopics : suggestionTopics)[0]);
  const [subject, setSubject] = useState("");
  const [details, setDetails] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [receipt, setReceipt] = useState("");
  const { business } = useBusinessStore();
  const topics = support ? supportTopics : suggestionTopics;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (sending || details.trim().length < 10) return;
    setSending(true); setSendError(""); setSent(false);
    try {
      const result = await requestJson<{ request: { id: string } }>("/business/support-requests", {
        method: "POST",
        body: JSON.stringify({
          kind: support ? "SUPPORT" : "SUGGESTION",
          category: topic,
          title: subject.trim() || (support ? "Solicitud de soporte" : "Sugerencia"),
          description: details.trim(),
          businessId: business.source === "real" ? business.id : null,
        }),
      });
      setReceipt(result.request.id); setSent(true);
      setDetails(""); setSubject("");
    } catch (cause) {
      setSendError(cause instanceof Error ? cause.message : "No se pudo enviar tu solicitud. Intenta nuevamente.");
    } finally { setSending(false); }
  };
  if (support) return <div className="business-support-technical">
    <header className="technical-support-heading">
      <span className="technical-support-eyebrow">AYUDA Y SOPORTE</span>
      <div className="technical-support-heading-main">
        <span className="technical-support-heading-icon"><TechnicalIcon name="headset" /></span>
        <div><h1>Soporte técnico</h1><p>Cuéntanos qué sucede y envía tu solicitud al equipo de XAMUKO Business.</p></div>
      </div>
    </header>

    <div className="technical-support-grid">
      <section className="surface-card technical-support-form-card" aria-labelledby="technical-support-form-title">
        <div className="technical-support-card-heading">
          <span className="technical-support-card-icon"><TechnicalIcon name="message" /></span>
          <div><span className="technical-support-card-eyebrow">SOLICITUD DE AYUDA</span><h2 id="technical-support-form-title">¿En qué podemos ayudarte?</h2><p>Describe tu dificultad. Tu solicitud se registrará directamente en XAMUKO Admin.</p></div>
        </div>
        <form onSubmit={submit} className="technical-support-form">
          <div className="technical-support-fields-row">
            <label className="form-field"><span>Tema del problema <b aria-hidden="true">*</b></span><select value={topic} onChange={event => setTopic(event.target.value)} required>{topics.map(item => <option key={item} value={item}>{item}</option>)}</select></label>
            <label className="form-field"><span>Asunto (opcional)</span><input value={subject} onChange={event => setSubject(event.target.value)} maxLength={120} placeholder="Ej. No puedo actualizar mi portada" /></label>
          </div>
          <label className="form-field technical-support-description"><span>Cuéntanos qué ocurre <b aria-hidden="true">*</b></span><textarea value={details} onChange={event => setDetails(event.target.value)} required minLength={10} maxLength={2000} rows={7} placeholder="Indica en qué pantalla ocurre el problema, qué pasos realizaste y qué resultado obtuviste." /><small>Incluye los pasos para reproducir el problema. No compartas contraseñas ni datos sensibles.</small></label>
          <div className="technical-support-form-bottom"><span className="technical-support-character-count">{details.length}/2000 caracteres</span><button className="technical-support-submit" type="submit" disabled={sending || details.trim().length < 10}><TechnicalIcon name="send" />{sending ? "Enviando solicitud…" : "Enviar solicitud"}</button></div>
          {sendError && <p className="technical-support-notice is-error" role="alert">{sendError}</p>}
          {sent && <div className="technical-support-notice is-success" role="status"><TechnicalIcon name="check" /><span><strong>Solicitud recibida en XAMUKO Admin.</strong> Radicado: {receipt}</span></div>}
        </form>
      </section>

      <aside className="technical-support-aside" aria-label="Orientación para solicitar ayuda">
        <section className="technical-support-guidance">
          <span className="technical-support-guidance-icon"><TechnicalIcon name="document" /></span>
          <h2>Para ayudarte mejor</h2>
          <p>Una descripción clara permite comprender el inconveniente.</p>
          <ol>
            <li><strong>Indica dónde sucede</strong><span>Señala la pestaña o función de Business.</span></li>
            <li><strong>Explica qué hiciste</strong><span>Describe los pasos previos al problema.</span></li>
            <li><strong>Cuenta qué ocurrió</strong><span>Indica el resultado obtenido y el esperado.</span></li>
          </ol>
        </section>
        <section className="technical-support-help-card">
          <span className="technical-support-help-icon"><TechnicalIcon name="help" /></span>
          <h2>Centro de ayuda</h2>
          <p>Encuentra respuestas a las preguntas más frecuentes sobre tu negocio.</p>
          <Link to="/ayuda">Consultar preguntas frecuentes <TechnicalIcon name="arrow" /></Link>
        </section>
        <p className="technical-support-security-note"><TechnicalIcon name="shield" /><span>Protege tu cuenta: nunca envíes contraseñas ni códigos de acceso.</span></p>
      </aside>
    </div>
  </div>;
  return <><PageHeader eyebrow={support ? "SOPORTE TÉCNICO" : "COMUNIDAD XAMUKO"} title={support ? "¿En qué podemos ayudarte?" : "Comparte tus ideas"} description={support ? "Cuéntanos qué ocurre y te ayudaremos a resolverlo paso a paso." : "Tus sugerencias ayudan a mejorar XAMUKO para todos los negocios."} /><div className="support-page-layout"><section className="surface-card support-hero-card"><div className={`support-hero-icon ${support ? "is-support" : "is-suggestion"}`} aria-hidden="true">{support ? "✦" : "✎"}</div><div><h2>{support ? "Estamos para ayudarte" : "Construyamos XAMUKO juntos"}</h2><p>{support ? "Describe el problema con el mayor detalle posible. Incluye la pantalla donde ocurre y qué esperabas ver." : "Cuéntanos qué cambiarías, qué te gustaría añadir o qué haría más fácil administrar tu negocio."}</p></div></section><section className="surface-card support-form-card"><div className="card-heading"><div><h2>{support ? "Crear solicitud de soporte" : "Enviar sugerencia"}</h2><p>{support ? "Tu solicitud se registrará directamente en XAMUKO Admin." : "Tu sugerencia llegará directamente a XAMUKO Admin."}</p></div></div><form onSubmit={submit} className="support-form"><label className="form-field"><span>{support ? "Tema del problema" : "Área de la sugerencia"}</span><select value={topic} onChange={event => setTopic(event.target.value)}>{topics.map(item => <option key={item}>{item}</option>)}</select></label><label className="form-field"><span>{support ? "Asunto (opcional)" : "Título de la idea (opcional)"}</span><input value={subject} onChange={event => setSubject(event.target.value)} maxLength={120} placeholder={support ? "Ej. No puedo actualizar mi portada" : "Ej. Vista previa de publicaciones"} /></label><label className="form-field"><span>{support ? "Cuéntanos qué ocurre" : "Describe tu idea"}</span><textarea value={details} onChange={event => setDetails(event.target.value)} required minLength={10} maxLength={2000} rows={7} placeholder={support ? "Indica los pasos que realizaste y el resultado que obtuviste." : "Explica cómo funcionaría y qué beneficio tendría para tu negocio."} /></label><div className="support-form-footer"><small>{details.length}/2000 caracteres</small><button className="action-button" type="submit" disabled={sending || details.trim().length < 10}>{sending ? "Enviando…" : support ? "Enviar solicitud" : "Enviar sugerencia"} <span aria-hidden="true">→</span></button></div>{sendError && <p className="support-form-notice" role="alert">{sendError}</p>}{sent && <p className="support-form-notice" role="status">Solicitud recibida en XAMUKO Admin. Radicado: {receipt}</p>}</form></section><section className="support-contact-card"><span aria-hidden="true">✓</span><div><strong>Antes de escribirnos</strong><p>Revisa el Centro de ayuda: muchas respuestas están disponibles allí de inmediato.</p></div></section></div></>;
}
