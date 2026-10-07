import { Link } from "react-router-dom";
import { PageHeader } from "../components/common/PageHeader";

const faqs = [
  ["¿Cómo hago visible mi negocio?", "Ve a Configuración y selecciona Hacerme visible por 40 días. Puedes extender ese plazo o ocultar tu negocio cuando quieras."],
  ["¿Cómo agrego productos o servicios?", "Usa Productos o Servicios en el menú principal y selecciona el botón Agregar. Podrás editar, activar o eliminar cada elemento."],
  ["¿Cómo respondo una opinión?", "En Opiniones, abre el comentario y selecciona Responder. Tu respuesta aparecerá debajo de la opinión del cliente."],
  ["¿Qué ocurre si elimino mi negocio?", "El negocio queda oculto durante 10 días y puedes recuperarlo desde su detalle. Después de ese plazo podría eliminarse definitivamente."],
];

export function HelpPage() {
  return <><PageHeader eyebrow="SOPORTE" title="Centro de ayuda" description="Encuentra respuestas y gestiona tus dudas sobre WIT Negocios." /><div className="help-layout"><section className="surface-card help-faq-card"><div className="card-heading"><div><h2>Preguntas frecuentes</h2><p>Respuestas rápidas para administrar tu negocio.</p></div></div><div className="help-faq-list">{faqs.map(([question, answer]) => <details key={question}><summary>{question}<span>＋</span></summary><p>{answer}</p></details>)}</div></section><aside className="content-stack"><section className="surface-card side-panel help-contact-card"><span className="panel-icon blue">?</span><h2>¿No encontraste lo que buscas?</h2><p>Cuéntanos qué ocurrió y el equipo de WIT te ayudará.</p><a className="action-button inline-button" href="mailto:soporte@wit.example?subject=Ayuda%20WIT%20Negocios">Contactar soporte</a><Link className="text-link help-report-link" to="/notificaciones">Ver notificaciones →</Link></section></aside></div></>;
}
