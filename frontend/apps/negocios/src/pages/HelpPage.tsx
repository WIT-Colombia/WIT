import "./HelpPage.css";

type HelpTopic = "Mi negocio" | "Catálogo" | "Colaboradores" | "Opiniones" | "Mi cuenta" | "Notificaciones";

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

function ChevronIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>;
}

export function HelpPage() {
  return <div className="business-help-page">
    <section className="business-help-faq-panel" aria-labelledby="business-help-faq-title">
      <div className="business-help-faq-heading">
        <div>
          <span className="business-help-faq-kicker">GUÍA DE XAMUKO BUSINESS</span>
          <h1 id="business-help-faq-title">Preguntas frecuentes</h1>
          <p>Respuestas rápidas para gestionar tu cuenta y tu negocio.</p>
        </div>
        <span className="business-help-count">{faqs.length} respuestas</span>
      </div>
      <div className="business-help-faq-list">
        {faqs.map(faq => <details key={faq.question} className="business-help-faq-item">
          <summary><span className="business-help-question"><small>{faq.topic}</small><strong>{faq.question}</strong></span><span className="business-help-faq-toggle"><ChevronIcon /></span></summary>
          <p>{faq.answer}</p>
        </details>)}
      </div>
    </section>
  </div>;
}
