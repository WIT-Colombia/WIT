import { useState, type FormEvent } from "react";
import { PageHeader } from "../components/common/PageHeader";

type SupportMode = "support" | "suggestion";

const supportTopics = ["Acceso o cuenta", "Mi negocio", "Productos y servicios", "Fotos y galería", "Pagos o planes", "Otro"];
const suggestionTopics = ["Nueva funcionalidad", "Mejora de diseño", "Rendimiento", "Experiencia móvil", "Otro"];

export function SupportPage({ mode = "support" }: { mode?: SupportMode }) {
  const support = mode === "support";
  const [topic, setTopic] = useState((support ? supportTopics : suggestionTopics)[0]);
  const [subject, setSubject] = useState("");
  const [details, setDetails] = useState("");
  const [sent, setSent] = useState(false);
  const topics = support ? supportTopics : suggestionTopics;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const destination = "notificaciones@xamuko.com";
    const prefix = support ? "Soporte técnico XAMUKO Business" : "Sugerencia para XAMUKO Business";
    const body = [`Tema: ${topic}`, "", details.trim()].join("\n");
    window.location.href = `mailto:${destination}?subject=${encodeURIComponent(subject.trim() ? `${prefix}: ${subject.trim()}` : prefix)}&body=${encodeURIComponent(body)}`;
    setSent(true);
  };
  return <><PageHeader eyebrow={support ? "SOPORTE TÉCNICO" : "COMUNIDAD XAMUKO"} title={support ? "¿En qué podemos ayudarte?" : "Comparte tus ideas"} description={support ? "Cuéntanos qué ocurre y te ayudaremos a resolverlo paso a paso." : "Tus sugerencias ayudan a mejorar XAMUKO para todos los negocios."} /><div className="support-page-layout"><section className="surface-card support-hero-card"><div className={`support-hero-icon ${support ? "is-support" : "is-suggestion"}`} aria-hidden="true">{support ? "✦" : "✎"}</div><div><h2>{support ? "Estamos para ayudarte" : "Construyamos XAMUKO juntos"}</h2><p>{support ? "Describe el problema con el mayor detalle posible. Incluye la pantalla donde ocurre y qué esperabas ver." : "Cuéntanos qué cambiarías, qué te gustaría añadir o qué haría más fácil administrar tu negocio."}</p></div></section><section className="surface-card support-form-card"><div className="card-heading"><div><h2>{support ? "Crear solicitud de soporte" : "Enviar sugerencia"}</h2><p>{support ? "La aplicación abrirá tu correo con la información lista para enviar." : "Tu mensaje se abrirá en el correo del dispositivo para que puedas revisarlo antes de enviarlo."}</p></div></div><form onSubmit={submit} className="support-form"><label className="form-field"><span>{support ? "Tema del problema" : "Área de la sugerencia"}</span><select value={topic} onChange={event => setTopic(event.target.value)}>{topics.map(item => <option key={item}>{item}</option>)}</select></label><label className="form-field"><span>{support ? "Asunto (opcional)" : "Título de la idea (opcional)"}</span><input value={subject} onChange={event => setSubject(event.target.value)} maxLength={120} placeholder={support ? "Ej. No puedo actualizar mi portada" : "Ej. Vista previa de publicaciones"} /></label><label className="form-field"><span>{support ? "Cuéntanos qué ocurre" : "Describe tu idea"}</span><textarea value={details} onChange={event => setDetails(event.target.value)} required minLength={10} maxLength={2000} rows={7} placeholder={support ? "Indica los pasos que realizaste y el resultado que obtuviste." : "Explica cómo funcionaría y qué beneficio tendría para tu negocio."} /></label><div className="support-form-footer"><small>{details.length}/2000 caracteres</small><button className="action-button" type="submit" disabled={details.trim().length < 10}>{support ? "Preparar solicitud" : "Preparar sugerencia"} <span aria-hidden="true">→</span></button></div>{sent && <p className="support-form-notice" role="status">Tu correo está listo para revisar y enviar la solicitud.</p>}</form></section><section className="support-contact-card"><span aria-hidden="true">✓</span><div><strong>Antes de escribirnos</strong><p>Revisa el Centro de ayuda: muchas respuestas están disponibles allí de inmediato.</p></div></section></div></>;
}
