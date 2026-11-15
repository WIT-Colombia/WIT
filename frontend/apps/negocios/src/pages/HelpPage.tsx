import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import "./HelpPage.css";

type HelpTopic = "Mi negocio" | "Catálogo" | "Colaboradores" | "Opiniones" | "Mi cuenta" | "Notificaciones";
type HelpIconName = "help" | "store" | "package" | "users" | "star" | "user" | "bell" | "search" | "support" | "idea" | "arrow" | "chevron";

const iconPaths: Record<HelpIconName, string> = {
  help: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM9.5 9a2.5 2.5 0 1 1 4 2c-1 .8-1.5 1.4-1.5 2.7M12 17h.01",
  store: "M3 9h18l-2-6H5L3 9Zm2 0v12h14V9M9 21v-8h6v8",
  package: "m12 2 9 5-9 5-9-5 9-5ZM3 7v10l9 5 9-5V7M12 12v10",
  users: "M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM16 7a4 4 0 0 1 0 8m2 1a4 4 0 0 1 3 4v1",
  star: "m12 2 3.1 6.3 7 .9-5.1 5 1.2 7-6.2-3.3-6.2 3.3 1.2-7-5.1-5 7-.9L12 2Z",
  user: "M20 21v-2a7 7 0 0 0-14 0v2M13 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
  bell: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 10h18c0-3-3-3-3-10ZM10 21h4",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm6-2 5 5",
  support: "M4 13v-2a8 8 0 0 1 16 0v2M4 12H2v7h5v-7H4Zm16 0h2v7h-5v-7h3ZM20 19c0 2-2 3-5 3h-3",
  idea: "M9 18h6m-5 3h4M9 15c-.1-2-3-3.4-3-7a6 6 0 0 1 12 0c0 3.6-2.9 5-3 7H9Z",
  arrow: "M5 12h14m-6-6 6 6-6 6",
  chevron: "m6 9 6 6 6-6",
};

function HelpIcon({ name, className = "" }: { name: HelpIconName; className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={iconPaths[name]} /></svg>;
}

const faqs: ReadonlyArray<{ question: string; answer: string; topic: HelpTopic }> = [
  { topic: "Mi negocio", question: "¿Cómo hago visible mi negocio?", answer: "Ve a Configuración y selecciona Hacerme visible por 40 días. Puedes extender ese plazo u ocultar tu negocio cuando quieras." },
  { topic: "Mi negocio", question: "¿Cómo actualizo la información de mi negocio?", answer: "Entra a Mi negocio y selecciona editar. Allí puedes actualizar el nombre, categoría, ubicación, descripción, datos de contacto, horarios y fotos. Guarda los cambios para que se reflejen en la ficha pública." },
  { topic: "Catálogo", question: "¿Cómo agrego productos o servicios?", answer: "Usa Productos o Servicios en el menú principal y selecciona Agregar. Podrás editar, activar, desactivar o eliminar cada elemento." },
  { topic: "Colaboradores", question: "¿Cómo invito a una persona a colaborar?", answer: "Abre Colaboradores, selecciona Invitar colaborador e introduce los datos solicitados. La persona recibirá una invitación y solo tendrá acceso a los permisos que le asignes." },
  { topic: "Colaboradores", question: "¿Cómo dejo de colaborar con un negocio?", answer: "Si eres colaborador y no propietario, abre Mi colaboración desde el menú del negocio y selecciona Dejar de colaborar. Al confirmar, perderás el acceso administrativo a ese negocio, pero tu cuenta XAMUKO seguirá activa." },
  { topic: "Opiniones", question: "¿Cómo respondo una opinión?", answer: "En Opiniones, abre el comentario y selecciona Responder. Tu respuesta aparecerá debajo de la opinión del cliente." },
  { topic: "Mi cuenta", question: "¿Cómo cambio mi foto de perfil?", answer: "Ve a Mi perfil, selecciona la foto y elige una nueva imagen. La actualización se comparte con las aplicaciones XAMUKO en las que uses la misma cuenta." },
  { topic: "Mi cuenta", question: "¿Cómo cambio mi contraseña?", answer: "En Mi perfil selecciona Cambiar contraseña. Escribe tu contraseña actual, crea una nueva y confírmala. Si no la recuerdas, utiliza el enlace de recuperación por correo." },
  { topic: "Notificaciones", question: "¿Dónde consulto mis notificaciones?", answer: "Abre Notificaciones desde el menú. Allí encontrarás avisos sobre tu negocio, colaboradores, transferencias, permisos y otras actividades de tu cuenta." },
  { topic: "Mi negocio", question: "¿Qué ocurre si elimino mi negocio?", answer: "El negocio queda oculto durante 30 días y puedes recuperarlo desde su detalle. Después de ese plazo podría eliminarse definitivamente." },
];

const topics: ReadonlyArray<{ label: HelpTopic; icon: HelpIconName }> = [
  { label: "Mi negocio", icon: "store" },
  { label: "Catálogo", icon: "package" },
  { label: "Colaboradores", icon: "users" },
  { label: "Opiniones", icon: "star" },
  { label: "Mi cuenta", icon: "user" },
  { label: "Notificaciones", icon: "bell" },
];

export function HelpPage() {
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState<HelpTopic | "Todos">("Todos");
  const normalizedQuery = query.trim().toLocaleLowerCase("es-CO");
  const filteredFaqs = useMemo(() => faqs.filter(faq =>
    (topic === "Todos" || faq.topic === topic) &&
    (faq.question + " " + faq.answer + " " + faq.topic).toLocaleLowerCase("es-CO").includes(normalizedQuery)
  ), [topic, normalizedQuery]);
  const clearFilters = () => { setQuery(""); setTopic("Todos"); };

  return <div className="business-help-page">
    <header className="business-help-heading">
      <div className="business-help-heading-copy">
        <span className="business-help-eyebrow">AYUDA Y SOPORTE</span>
        <div className="business-help-heading-main">
          <span className="business-help-heading-icon"><HelpIcon name="help" /></span>
          <div>
            <h1>Centro de ayuda</h1>
            <p>Encuentra respuestas para administrar tu negocio y aprovechar las herramientas de XAMUKO Business.</p>
          </div>
        </div>
      </div>
      <Link className="business-help-heading-action" to="/soporte"><HelpIcon name="support" /> Contactar soporte <HelpIcon name="arrow" /></Link>
    </header>

    <section className="business-help-search-panel" aria-label="Buscar respuestas">
      <div>
        <strong>¿En qué podemos ayudarte?</strong>
        <p>Busca una pregunta o explora los temas más consultados.</p>
      </div>
      <label className="business-help-search-field">
        <HelpIcon name="search" />
        <span className="sr-only">Buscar en el Centro de ayuda</span>
        <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar respuestas, por ejemplo: productos, contraseña..." />
      </label>
    </section>

    <section className="business-help-topics" aria-labelledby="business-help-topics-title">
      <div className="business-help-section-heading">
        <div><h2 id="business-help-topics-title">Explora por tema</h2><p>Selecciona el área sobre la que necesitas información.</p></div>
        {topic !== "Todos" && <button type="button" className="business-help-reset" onClick={() => setTopic("Todos")}>Ver todos los temas</button>}
      </div>
      <div className="business-help-topic-grid">
        {topics.map(item => <button key={item.label} type="button" className={"business-help-topic" + (topic === item.label ? " is-active" : "")} onClick={() => setTopic(topic === item.label ? "Todos" : item.label)} aria-pressed={topic === item.label}>
          <span className="business-help-topic-icon"><HelpIcon name={item.icon} /></span>
          <span className="business-help-topic-copy"><strong>{item.label}</strong><small>{faqs.filter(faq => faq.topic === item.label).length} {faqs.filter(faq => faq.topic === item.label).length === 1 ? "respuesta" : "respuestas"}</small></span>
          <HelpIcon name="arrow" className="business-help-topic-arrow" />
        </button>)}
      </div>
    </section>

    <div className="business-help-content">
      <section className="business-help-faq-panel" aria-labelledby="business-help-faq-title">
        <div className="business-help-faq-heading">
          <div><span className="business-help-faq-kicker">GUÍA DE XAMUKO BUSINESS</span><h2 id="business-help-faq-title">Preguntas frecuentes</h2><p>Respuestas rápidas para gestionar tu cuenta y tu negocio.</p></div>
          <span className="business-help-count">{filteredFaqs.length} {filteredFaqs.length === 1 ? "respuesta" : "respuestas"}</span>
        </div>
        {filteredFaqs.length ? <div className="business-help-faq-list">{filteredFaqs.map(faq => <details key={faq.question} className="business-help-faq-item">
          <summary><span className="business-help-question"><small>{faq.topic}</small><strong>{faq.question}</strong></span><span className="business-help-faq-toggle"><HelpIcon name="chevron" /></span></summary>
          <p>{faq.answer}</p>
        </details>)}</div> : <div className="business-help-empty" role="status">
          <span><HelpIcon name="search" /></span>
          <h3>No encontramos respuestas</h3>
          <p>Prueba con otra palabra o consulta todos los temas disponibles.</p>
          <button type="button" onClick={clearFilters}>Limpiar búsqueda y filtros</button>
        </div>}
      </section>

      <aside className="business-help-side">
        <div className="business-help-contact-card">
          <span className="business-help-contact-icon"><HelpIcon name="support" /></span>
          <h2>¿Necesitas más ayuda?</h2>
          <p>Si no encontraste la respuesta, envíanos una solicitud desde Soporte técnico.</p>
          <Link to="/soporte" className="business-help-contact-link">Ir a soporte técnico <HelpIcon name="arrow" /></Link>
        </div>
        <div className="business-help-suggestion-card">
          <span><HelpIcon name="idea" /></span>
          <div><h3>Ayúdanos a mejorar</h3><p>¿Tienes alguna propuesta para XAMUKO?</p><Link to="/sugerencias">Enviar sugerencia <HelpIcon name="arrow" /></Link></div>
        </div>
      </aside>
    </div>
  </div>;
}
