import { Link, useParams, useSearchParams } from "react-router-dom";
import { PageLayout } from "../components/PageLayout";
import "./Legal.css";

const termsSections = [
  { id: "objeto", title: "1. Objeto y aceptación", paragraphs: ["Estos Términos y condiciones regulan el acceso y uso de WIT Usuarios, una plataforma para descubrir negocios, productos y servicios cerca de ti.", "Al crear una cuenta, iniciar sesión o utilizar cualquier función de WIT, aceptas estos términos y la Política de privacidad. Si no estás de acuerdo, debes dejar de usar la plataforma."] },
  { id: "servicio", title: "2. Cómo funciona WIT", paragraphs: ["WIT permite buscar y explorar negocios, productos y servicios, consultar información pública, guardar tiendas, marcar elementos con Me gusta y compartir opiniones.", "Algunas funciones pueden estar en desarrollo, funcionar como demostración o depender de servicios externos que conectaremos más adelante."] },
  { id: "cuenta", title: "3. Cuenta y seguridad", paragraphs: ["Debes proporcionar información verdadera y mantenerla actualizada. Eres responsable de cuidar tus credenciales y de la actividad que ocurra desde tu cuenta.", "No compartas tus datos de acceso ni uses la cuenta de otra persona. Avísanos si detectas un acceso no autorizado o un uso que pueda afectar a la comunidad."] },
  { id: "ubicacion", title: "4. Búsquedas y ubicación", paragraphs: ["Puedes elegir una ciudad manualmente o permitir el uso de tu ubicación para encontrar opciones cercanas. El alcance de la búsqueda depende de la información disponible en cada zona.", "La ubicación de un negocio puede ser aproximada y debe confirmarse directamente con el establecimiento antes de tomar decisiones importantes."] },
  { id: "informacion", title: "5. Información de negocios", paragraphs: ["WIT reúne información de negocios, productos y servicios para facilitar el descubrimiento local. Esa información puede cambiar, estar incompleta o haber sido proporcionada por terceros.", "Los precios, horarios, disponibilidad, condiciones de venta y características de cada oferta deben confirmarse directamente con el negocio."] },
  { id: "opiniones", title: "6. Opiniones, calificaciones y reportes", paragraphs: ["Las opiniones y calificaciones deben reflejar experiencias reales y respetuosas. No publiques contenido falso, engañoso, discriminatorio, ofensivo o que revele datos personales de otras personas.", "Podemos revisar, ocultar o retirar contenido cuando infrinja estos términos, exista una señal de fraude o sea necesario proteger a la comunidad. Puedes reportar información que consideres incorrecta."] },
  { id: "interacciones", title: "7. Contacto con negocios", paragraphs: ["Cuando llamas, escribes por WhatsApp o visitas un enlace de navegación desde WIT, la interacción ocurre directamente con el negocio o con el servicio externo elegido.", "WIT no participa en la negociación, compra, entrega, garantía o solución de conflictos entre usuarios y negocios."] },
  { id: "favoritos", title: "8. Favoritos y Me gusta", paragraphs: ["Las funciones Guardar y Me gusta son herramientas personales para organizar tus descubrimientos. Puedes retirar una tienda guardada o un Me gusta cuando quieras.", "No utilices estas funciones para manipular calificaciones, acosar, suplantar personas o generar actividad artificial."] },
  { id: "propiedad", title: "9. Propiedad intelectual", paragraphs: ["La marca WIT, su diseño, software, textos, interfaces y demás elementos de la plataforma pertenecen a WIT o se utilizan bajo licencia.", "Puedes utilizar WIT para sus fines previstos, pero no copiar, modificar, descompilar, extraer datos masivamente ni crear servicios derivados sin autorización."] },
  { id: "responsabilidad", title: "10. Disponibilidad y responsabilidad", paragraphs: ["Trabajamos para mantener WIT disponible y segura, pero no garantizamos que funcione sin interrupciones, errores o cambios. Podemos realizar mantenimientos o retirar funciones.", "En la medida permitida por la ley, WIT no responde por decisiones tomadas con base en información de terceros, disponibilidad de negocios, servicios externos o daños indirectos."] },
  { id: "datos", title: "11. Datos personales", paragraphs: ["El tratamiento de datos personales se realiza conforme a la Política de privacidad y a la normativa aplicable, incluida la Ley 1581 de 2012 y sus normas reglamentarias en Colombia.", "La Política de privacidad explica las finalidades del tratamiento, tus derechos y los canales para ejercerlos."] },
  { id: "cambios", title: "12. Cambios y ley aplicable", paragraphs: ["Podemos actualizar estos términos para reflejar cambios legales, técnicos o funcionales. Publicaremos la versión vigente en esta página e indicaremos su fecha de actualización.", "Estos términos se interpretan de acuerdo con las leyes de la República de Colombia, sin perjuicio de los derechos irrenunciables que la ley reconozca a los consumidores y titulares de datos."] },
];

const copy: Record<string, [string, string]> = {
  privacy: ["Política de privacidad", "Aquí se explicará cómo WIT Usuarios trata los datos personales y qué opciones tiene cada persona usuaria."],
  security: ["Política de seguridad", "Aquí se describirán las medidas de seguridad y los canales para reportar vulnerabilidades."],
  cookies: ["Cookies", "Esta sección documentará las tecnologías necesarias y las preferencias de navegación."],
};

export default function Legal() {
  const { page = "terms" } = useParams();
  const [params] = useSearchParams();
  const fromRegister = params.get("from") === "register";
  const returnTo = fromRegister ? "/register" : "/settings";
  const returnLabel = fromRegister ? "registro" : "ajustes";
  const isTerms = page === "terms";
  const [title, description] = isTerms ? ["Términos y condiciones", "Información clara para usar WIT con confianza."] : (copy[page] ?? copy.privacy);
  return <PageLayout className="legal-page">
    <div className="legal-layout">
      <aside className="legal-sidebar"><span className="legal-eyebrow">CENTRO LEGAL</span><h1>{title}</h1><p>{description}</p><nav aria-label="Documentos legales"><Link className={isTerms ? "active" : ""} to={`/legal/terms?from=${fromRegister ? "register" : "settings"}`}>Términos y condiciones</Link><Link className={page === "privacy" ? "active" : ""} to={`/legal/privacy?from=${fromRegister ? "register" : "settings"}`}>Política de privacidad</Link></nav></aside>
      <article className="legal-card legal-document"><div className="legal-document-heading"><span className="legal-eyebrow">WIT USUARIOS · DOCUMENTO LEGAL</span><h2>{title}</h2><p>Última actualización: 3 de octubre de 2026</p></div>
        {isTerms ? <><nav className="legal-toc" aria-label="Contenido del documento"><strong>En este documento</strong>{termsSections.map((section) => <a key={section.id} href={`#${section.id}`}>{section.title}</a>)}</nav>{termsSections.map((section) => <section className="legal-section" id={section.id} key={section.id}><h3>{section.title}</h3>{section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</section>)}</> : <><section className="legal-section"><h3>Tratamiento de datos</h3><p>{description}</p></section><section className="legal-section"><h3>Marco aplicable</h3><p>El contenido definitivo se completará antes de activar el registro y la autenticación real.</p></section></>}
        <Link className="legal-back" to={returnTo}>← Volver a {returnLabel}</Link>
      </article>
    </div>
  </PageLayout>;
}
