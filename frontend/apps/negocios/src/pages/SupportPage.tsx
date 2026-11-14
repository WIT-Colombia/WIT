import { useState, type FormEvent } from "react";
import { PageHeader } from "../components/common/PageHeader";
import { requestJson } from "../services/businessApiClient";
import { useBusinessStore } from "../services/businessStore";

type SupportMode = "support" | "suggestion";

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
  return <><PageHeader eyebrow={support ? "SOPORTE TÉCNICO" : "COMUNIDAD XAMUKO"} title={support ? "¿En qué podemos ayudarte?" : "Comparte tus ideas"} description={support ? "Cuéntanos qué ocurre y te ayudaremos a resolverlo paso a paso." : "Tus sugerencias ayudan a mejorar XAMUKO para todos los negocios."} /><div className="support-page-layout"><section className="surface-card support-hero-card"><div className={`support-hero-icon ${support ? "is-support" : "is-suggestion"}`} aria-hidden="true">{support ? "✦" : "✎"}</div><div><h2>{support ? "Estamos para ayudarte" : "Construyamos XAMUKO juntos"}</h2><p>{support ? "Describe el problema con el mayor detalle posible. Incluye la pantalla donde ocurre y qué esperabas ver." : "Cuéntanos qué cambiarías, qué te gustaría añadir o qué haría más fácil administrar tu negocio."}</p></div></section><section className="surface-card support-form-card"><div className="card-heading"><div><h2>{support ? "Crear solicitud de soporte" : "Enviar sugerencia"}</h2><p>{support ? "Tu solicitud se registrará directamente en XAMUKO Admin." : "Tu sugerencia llegará directamente a XAMUKO Admin."}</p></div></div><form onSubmit={submit} className="support-form"><label className="form-field"><span>{support ? "Tema del problema" : "Área de la sugerencia"}</span><select value={topic} onChange={event => setTopic(event.target.value)}>{topics.map(item => <option key={item}>{item}</option>)}</select></label><label className="form-field"><span>{support ? "Asunto (opcional)" : "Título de la idea (opcional)"}</span><input value={subject} onChange={event => setSubject(event.target.value)} maxLength={120} placeholder={support ? "Ej. No puedo actualizar mi portada" : "Ej. Vista previa de publicaciones"} /></label><label className="form-field"><span>{support ? "Cuéntanos qué ocurre" : "Describe tu idea"}</span><textarea value={details} onChange={event => setDetails(event.target.value)} required minLength={10} maxLength={2000} rows={7} placeholder={support ? "Indica los pasos que realizaste y el resultado que obtuviste." : "Explica cómo funcionaría y qué beneficio tendría para tu negocio."} /></label><div className="support-form-footer"><small>{details.length}/2000 caracteres</small><button className="action-button" type="submit" disabled={sending || details.trim().length < 10}>{sending ? "Enviando…" : support ? "Enviar solicitud" : "Enviar sugerencia"} <span aria-hidden="true">→</span></button></div>{sendError && <p className="support-form-notice" role="alert">{sendError}</p>}{sent && <p className="support-form-notice" role="status">Solicitud recibida en XAMUKO Admin. Radicado: {receipt}</p>}</form></section><section className="support-contact-card"><span aria-hidden="true">✓</span><div><strong>Antes de escribirnos</strong><p>Revisa el Centro de ayuda: muchas respuestas están disponibles allí de inmediato.</p></div></section></div></>;
}
