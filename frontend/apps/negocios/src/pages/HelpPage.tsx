import { PageHeader } from "../components/common/PageHeader";

const faqs = [
  ["¿Cómo hago visible mi negocio?", "Ve a Configuración y selecciona Hacerme visible por 40 días. Puedes extender ese plazo u ocultar tu negocio cuando quieras."],
  ["¿Cómo actualizo la información de mi negocio?", "Entra a Mi negocio y selecciona editar. Allí puedes actualizar el nombre, categoría, ubicación, descripción, datos de contacto, horarios y fotos. Guarda los cambios para que se reflejen en la ficha pública."],
  ["¿Cómo agrego productos o servicios?", "Usa Productos o Servicios en el menú principal y selecciona Agregar. Podrás editar, activar, desactivar o eliminar cada elemento."],
  ["¿Cómo invito a una persona a colaborar?", "Abre Colaboradores, selecciona Invitar colaborador e introduce los datos solicitados. La persona recibirá una invitación y solo tendrá acceso a los permisos que le asignes."],
  ["¿Cómo dejo de colaborar con un negocio?", "Si eres colaborador y no propietario, abre Mi colaboración desde el menú del negocio y selecciona Dejar de colaborar. Al confirmar, perderás el acceso administrativo a ese negocio, pero tu cuenta XAMUKO seguirá activa."],
  ["¿Cómo respondo una opinión?", "En Opiniones, abre el comentario y selecciona Responder. Tu respuesta aparecerá debajo de la opinión del cliente."],
  ["¿Cómo cambio mi foto de perfil?", "Ve a Mi perfil, selecciona la foto y elige una nueva imagen. La actualización se comparte con las aplicaciones XAMUKO en las que uses la misma cuenta."],
  ["¿Cómo cambio mi contraseña?", "En Mi perfil selecciona Cambiar contraseña. Escribe tu contraseña actual, crea una nueva y confírmala. Si no la recuerdas, utiliza el enlace de recuperación por correo."],
  ["¿Dónde consulto mis notificaciones?", "Abre Notificaciones desde el menú. Allí encontrarás avisos sobre tu negocio, colaboradores, transferencias, permisos y otras actividades de tu cuenta."],
  ["¿Qué ocurre si elimino mi negocio?", "El negocio queda oculto durante 30 días y puedes recuperarlo desde su detalle. Después de ese plazo podría eliminarse definitivamente."],
];

export function HelpPage() {
  return <><PageHeader eyebrow="SOPORTE" title="Centro de ayuda" description="Encuentra respuestas y gestiona tus dudas sobre XAMUKO Business." /><div className="help-layout"><section className="surface-card help-faq-card"><div className="card-heading"><div><h2>Preguntas frecuentes</h2><p>Respuestas rápidas para administrar tu negocio.</p></div></div><div className="help-faq-list">{faqs.map(([question, answer]) => <details key={question}><summary>{question}<span>＋</span></summary><p>{answer}</p></details>)}</div></section></div></>;
}
