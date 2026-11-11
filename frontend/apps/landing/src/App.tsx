import { useEffect, useRef, useState, type MouseEvent } from "react";
import { destinations } from "./config/destinations";
import { Icon, type IconName } from "./Icons";

const artwork = "/assets/definitiva/reference-art-4k.webp";
const navigation = [["inicio", "Inicio"], ["como-funciona", "Cómo funciona"], ["usuarios", "Usuarios"], ["negocios", "Negocios"], ["planes", "Planes"], ["preguntas", "Preguntas"]] as const;
const userBenefits = ["Descubre negocios cercanos", "Busca por categoría y ubicación", "Consulta información y horarios", "Guarda tus favoritos y valora"];
const businessBenefits = ["Crea y gestiona tu perfil comercial", "Consulta estadísticas de tu negocio", "Gestiona contenido y opiniones", "Accede a planes gratuitos y PRO"];
const benefits: [IconName, string][] = [["rocket", "Más visibilidad para tu negocio"], ["users", "Conexión directa con clientes"], ["growth", "Impulso al comercio local"], ["shield", "Plataforma segura y confiable"], ["devices", "Experiencia rápida y sencilla"]];
type FaqAudience = "usuarios" | "negocios";
const faqs: Record<FaqAudience, [string, string][]> = {
  usuarios: [
    ["¿Qué es XAMUKO y cómo funciona?", "XAMUKO es una plataforma que te ayuda a descubrir negocios, productos y servicios cerca de ti. Puedes explorar establecimientos, consultar su información, conocer sus productos y servicios y comunicarte directamente con ellos. XAMUKO conecta personas con negocios locales."],
    ["¿Necesito registrarme para explorar XAMUKO?", "No. Puedes explorar negocios, productos y servicios sin crear una cuenta. Sin embargo, para acceder a funciones personalizadas, como guardar favoritos o publicar opiniones, necesitas registrarte e iniciar sesión."],
    ["¿Cómo encuentro negocios, productos o servicios cerca de mí?", "Ingresa a XAMUKO y utiliza el buscador o las categorías disponibles. Puedes explorar establecimientos según tu ubicación y consultar sus perfiles para conocer direcciones, horarios, productos, servicios y medios de contacto."],
    ["¿Cómo puedo contactar un negocio?", "Abre el perfil del establecimiento y consulta los medios de contacto que tenga publicados, como teléfono o WhatsApp. También puedes revisar su ubicación para saber cómo llegar. La comunicación se realiza directamente con el negocio."],
    ["¿Cómo guardo favoritos y comparto mis opiniones?", "Inicia sesión en tu cuenta, abre el perfil de un negocio y utiliza la opción de favoritos para guardarlo. También puedes utilizar las funciones de valoración y opinión disponibles para compartir tu experiencia y ayudar a otros usuarios."],
    ["¿Cómo recupero mi contraseña o actualizo mis datos?", "Si olvidaste tu contraseña, selecciona «¿Olvidaste tu contraseña?» en el inicio de sesión y sigue las instrucciones enviadas a tu correo. Para actualizar tu información personal, ingresa a tu cuenta y utiliza las opciones de configuración de perfil."],
    ["¿Cómo protejo mi información o elimino mi cuenta?", "XAMUKO dispone de mecanismos para administrar tu cuenta y proteger tus datos personales. Puedes consultar la Política de Privacidad para conocer cómo se trata tu información y los canales disponibles para ejercer tus derechos, incluida la solicitud de supresión de datos cuando legalmente proceda."],
  ],
  negocios: [
    ["¿Qué es XAMUKO Business y qué beneficios ofrece?", "XAMUKO Business permite que los negocios tengan presencia en la plataforma para que las personas puedan descubrirlos. Puedes presentar información comercial, productos y servicios, gestionar tu perfil y facilitar el contacto directo con posibles clientes."],
    ["¿Cómo registro y publico mi negocio en XAMUKO?", "Selecciona «Registrar mi negocio», crea tu cuenta Business y completa los datos de tu establecimiento. Agrega la información comercial solicitada y sigue el proceso de publicación disponible en la plataforma. Procura mantener los datos completos y actualizados."],
    ["¿Cómo actualizo mi negocio y publico productos o servicios?", "Inicia sesión en XAMUKO Business y accede a las herramientas de administración de tu negocio. Desde allí puedes actualizar la información comercial y gestionar los productos y servicios que deseas mostrar a los usuarios."],
    ["¿Cómo pueden encontrarme y contactarme los clientes?", "Los usuarios pueden descubrir tu establecimiento mediante las herramientas de exploración y búsqueda de XAMUKO. Al consultar tu perfil, podrán acceder a la información y a los medios de contacto que hayas publicado. Mantener una ficha completa facilita que conozcan tu negocio."],
    ["¿Cómo gestiono las opiniones y los colaboradores?", "Desde las herramientas de Business puedes consultar y gestionar las opiniones relacionadas con tu establecimiento. También puedes administrar colaboradores mediante las opciones y permisos disponibles para tu negocio."],
    ["¿Qué diferencias existen entre el plan Gratis y Business PRO?", "XAMUKO contempla herramientas y beneficios según el plan habilitado para cada negocio. Las funciones disponibles y sus límites deben consultarse en Business. La contratación de PRO no está habilitada desde la Landing en la versión actual."],
    ["¿Cómo recupero el acceso o elimino mi negocio?", "Si olvidaste tu contraseña, utiliza la opción de recuperación disponible en el inicio de sesión de Business. Para eliminar un negocio, consulta las opciones de administración correspondientes y revisa las consecuencias de la eliminación antes de confirmarla."],
  ],
};

// Crop only illustration regions; page copy, navigation, cards and controls are DOM.
function Artwork({ viewBox, className = "" }: { viewBox: string; className?: string }) {
  const isDevices = !className;
  return <svg className={className} viewBox={viewBox} preserveAspectRatio={className === "portrait" ? "xMidYMax slice" : "xMidYMid meet"} aria-hidden="true" focusable="false">
    {isDevices && <defs><clipPath id="devices-artwork-crop"><path d="M534 55h635v393H598L534 85Z"/></clipPath></defs>}
    <image href={artwork} width="1169" height="1280" clipPath={isDevices ? "url(#devices-artwork-crop)" : undefined}/>
  </svg>;
}
function Brand({ footer = false }: { footer?: boolean }) {
  return <a className={`brand${footer ? " brand-light" : ""}`} href="#inicio" aria-label="XAMUKO, inicio">
    <svg className="brand-mark" viewBox="40 80 390 510" aria-hidden="true"><image href="/assets/definitiva/official-logo.png" width="2048" height="680"/></svg>
    <span><strong>XAMUKO</strong><small>Lo que necesitas, está más cerca.</small></span>
  </a>;
}

export function App() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [faqAudience, setFaqAudience] = useState<FaqAudience>("usuarios");
  const [selector, setSelector] = useState<"login" | "register" | null>(null);
  const [hash, setHash] = useState(() => (typeof window !== "undefined" ? window.location.hash : "") || "#inicio");
  const [extraSection, setExtraSection] = useState(() => typeof window !== "undefined" && ["#planes", "#preguntas"].includes(window.location.hash) ? window.location.hash.slice(1) : "");
  const loginButton = useRef<HTMLButtonElement>(null);
  const registerButton = useRef<HTMLButtonElement>(null);
  const mobileButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onHash = () => { setHash(window.location.hash || "#inicio"); if (["#planes", "#preguntas"].includes(window.location.hash)) setExtraSection(window.location.hash.slice(1)); };
    const onOutside = (event: PointerEvent) => { if (!(event.target instanceof Element) || !event.target.closest("[data-account-selector]")) setSelector(null); };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (selector) { (selector === "login" ? loginButton : registerButton).current?.focus(); setSelector(null); }
      else if (mobileOpen) { setMobileOpen(false); mobileButton.current?.focus(); }
    };
    window.addEventListener("hashchange", onHash);
    document.addEventListener("pointerdown", onOutside);
    document.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("hashchange", onHash); document.removeEventListener("pointerdown", onOutside); document.removeEventListener("keydown", onKey); };
  }, [selector, mobileOpen]);
  useEffect(() => {
    if (extraSection && hash === `#${extraSection}`) document.getElementById(extraSection)?.scrollIntoView({ block: "start", behavior: "instant" });
  }, [extraSection, hash]);

  function navigate(event: MouseEvent<HTMLAnchorElement>, id: string) {
    setMobileOpen(false); setSelector(null);
    if (id === "planes" || id === "preguntas") {
      event.preventDefault(); window.history.pushState(null, "", `#${id}`); setHash(`#${id}`); setExtraSection(id);
      requestAnimationFrame(() => {
        const section = document.getElementById(id);
        section?.setAttribute("tabindex", "-1");
        section?.scrollIntoView({ block: "start" });
        section?.focus({ preventScroll: true });
      });
    }
  }
  function accountSelector(kind: "login" | "register") {
    const isLogin = kind === "login";
    return <div className="account-selector" data-account-selector>
      <button ref={isLogin ? loginButton : registerButton} className={`account-trigger ${isLogin ? "outline" : "primary"}`} aria-expanded={selector === kind} aria-controls={`${kind}-choices`} onClick={() => setSelector(selector === kind ? null : kind)}>
        <Icon name={isLogin ? "user" : "users"}/>{isLogin ? "Iniciar sesión" : "Registrarse"}<Icon name="chevron"/>
      </button>
      <div id={`${kind}-choices`} className="account-choices" hidden={selector !== kind}>
        <span>{isLogin ? "¿Cómo quieres ingresar?" : "Elige tu experiencia"}</span>
        <a href={isLogin ? destinations.userLogin : destinations.userRegister}><Icon name="user"/><span><strong>Usuarios</strong><small>Descubre lo mejor de tu ciudad</small></span><Icon name="arrow"/></a>
        <a href={isLogin ? destinations.businessLogin : destinations.businessRegister}><Icon name="shop"/><span><strong>Negocios</strong><small>Haz crecer tu negocio</small></span><Icon name="arrow"/></a>
      </div>
    </div>;
  }

  return <>
    <a className="skip-link" href="#contenido">Saltar al contenido</a>
    <header className="site-header"><div className="header-inner">
      <Brand/>
      <button ref={mobileButton} className="mobile-toggle" aria-label={mobileOpen ? "Cerrar menú" : "Abrir menú"} aria-expanded={mobileOpen} aria-controls="header-navigation" onClick={() => { setMobileOpen(!mobileOpen); setSelector(null); }}><Icon name={mobileOpen ? "close" : "menu"}/></button>
      <div id="header-navigation" className={`header-navigation${mobileOpen ? " is-open" : ""}`}>
        <nav aria-label="Navegación principal">{navigation.map(([id, label]) => <a key={id} className={hash === `#${id}` ? "active" : ""} href={`#${id}`} onClick={event => navigate(event, id)}>{label}</a>)}</nav>
        <div className="header-actions">{accountSelector("login")}{accountSelector("register")}</div>
      </div>
    </div></header>
    <main id="contenido" tabIndex={-1}>
      <section className="hero" id="inicio" aria-labelledby="hero-title">
        <div className="hero-city" aria-hidden="true"/><div className="hero-wave wave-back" aria-hidden="true"/><div className="hero-wave wave-front" aria-hidden="true"/>
        <div className="hero-inner"><div className="hero-copy">
          <p className="hero-badge"><Icon name="pin"/>La plataforma de negocios de tu ciudad</p>
          <h1 id="hero-title">Todo lo que necesitas,<br/><span>más cerca de ti.</span></h1>
          <p className="hero-description">Descubre negocios, productos y servicios.<br/>Conecta con tu ciudad y encuentra nuevas oportunidades en XAMUKO.</p>
          <div className="hero-actions"><a className="button primary" href={destinations.explore}><Icon name="search"/>Explorar negocios<Icon name="arrow"/></a><a className="button outline" href={destinations.businessRegister}><Icon name="shop"/>Registrar mi negocio</a></div>
          <ul className="hero-trust"><li><Icon name="pin"/><span>Negocios locales<br/>de tu ciudad</span></li><li><Icon name="shield"/><span>Confiable<br/>y segura</span></li><li><Icon name="devices"/><span>Desde cualquier<br/>dispositivo</span></li></ul>
        </div><figure className="hero-visual"><Artwork viewBox="534 55 635 393"/><figcaption>Ilustración de las aplicaciones. Las cifras son ejemplos.</figcaption></figure></div>
      </section>
      <div className="page-width">
        <div className="audience-grid">
          <section className="audience-card user-card" id="usuarios" aria-labelledby="users-title">
            <Artwork className="portrait" viewBox="40 454 247 242"/>
            <div className="audience-content"><span className="audience-icon"><Icon name="user"/></span><h2 id="users-title">Para <span>usuarios</span></h2><p>Encuentra y accede fácilmente<br className="desktop-break"/> a los negocios de tu ciudad.</p><ul>{userBenefits.map(text => <li key={text}><Icon name="check"/>{text}</li>)}</ul><a className="button primary audience-button" href={destinations.userRegister}>Soy usuario<Icon name="arrow"/></a></div>
          </section>
          <section className="audience-card business-card" id="negocios" aria-labelledby="business-title">
            <svg className="portrait" viewBox="0 0 246 242" preserveAspectRatio="xMidYMax slice" aria-hidden="true"><defs><clipPath id="merchant-crop"><path d="M0 0h208v80l38 20v142H0Z"/></clipPath></defs><g clipPath="url(#merchant-crop)"><image href={artwork} x="-595" y="-454" width="1169" height="1280"/></g></svg>
            <div className="audience-content"><span className="audience-icon"><Icon name="shop"/></span><h2 id="business-title">Para <span>negocios</span></h2><p>Da visibilidad a tu negocio,<br className="desktop-break"/> atrae más clientes y hazlo crecer.</p><ul>{businessBenefits.map(text => <li key={text}><Icon name="check"/>{text}</li>)}</ul><a className="button blue audience-button" href={destinations.businessRegister}>Soy un negocio<Icon name="arrow"/></a></div>
          </section>
        </div>
        <section className="benefits-section" aria-labelledby="benefits-title" id="beneficios"><h2 className="section-title ruled" id="benefits-title">¿Por qué elegir <span>XAMUKO?</span></h2><ul className="benefits-strip">{benefits.map(([icon, label]) => <li key={label}><Icon name={icon}/><strong>{label}</strong></li>)}</ul></section>
        <section className="how-section" id="como-funciona" aria-labelledby="how-title"><h2 className="section-title" id="how-title">Así funciona <span>XAMUKO</span></h2><ol className="steps"><li><span className="step-number">1</span><Icon name="search"/><div><h3>Descubre</h3><p>Explora negocios,<br/>productos y servicios.</p></div></li><li><span className="step-number">2</span><Icon name="shop"/><div><h3>Conéctate</h3><p>Consulta, compara<br/>y contacta.</p></div></li><li><span className="step-number">3</span><Icon name="growth"/><div><h3>Crece</h3><p>Encuentra lo que necesitas<br/>o haz que tu negocio llegue a más clientes.</p></div></li></ol></section>

        <section className="extra-section plans-section" id="planes" hidden={extraSection !== "planes"} aria-labelledby="plans-title"><h2 className="section-title" id="plans-title">Herramientas para tu <span>negocio</span></h2><p className="section-intro">Conoce las opciones de XAMUKO Business.</p><div className="plan-grid"><article><span className="plan-label">GRATIS</span><h3>Empieza con el plan Básico</h3><p>Crea tu perfil comercial y gestiona la información, productos y servicios de tu negocio con los límites disponibles para tu cuenta.</p><a className="button primary" href={destinations.businessRegister}>Registrar mi negocio<Icon name="arrow"/></a></article><article><span className="plan-label">BUSINESS PRO</span><h3>Más herramientas para crecer</h3><p>El acceso a funciones PRO depende del plan habilitado en Business. La contratación de PRO no está disponible en esta versión.</p><a className="button outline" href={destinations.businessLogin}>Consultar mi cuenta<Icon name="arrow"/></a></article></div></section>
        <section className="extra-section faq-section" id="preguntas" hidden={extraSection !== "preguntas"} aria-labelledby="faq-title"><h2 className="section-title" id="faq-title">Preguntas <span>frecuentes</span></h2><p className="section-intro">Encuentra respuestas según tu tipo de cuenta.</p><div className="faq-tabs" role="group" aria-label="Tipo de ayuda"><button type="button" className={faqAudience === "usuarios" ? "active" : ""} aria-pressed={faqAudience === "usuarios"} onClick={() => setFaqAudience("usuarios")}>Usuarios</button><button type="button" className={faqAudience === "negocios" ? "active" : ""} aria-pressed={faqAudience === "negocios"} onClick={() => setFaqAudience("negocios")}>Negocios</button></div><div className="faq-list" key={faqAudience}>{faqs[faqAudience].map(([question, answer]) => <details key={question}><summary>{question}<Icon name="chevron"/></summary><p>{answer}</p></details>)}</div>{faqAudience === "negocios" && <a className="text-link" href={destinations.businessHelp}>Centro de ayuda de Business<Icon name="arrow"/></a>}</section>

        <section className="community-banner" aria-labelledby="community-title"><div className="banner-wave" aria-hidden="true"/><div><h2 id="community-title">Únete hoy a la comunidad XAMUKO</h2><p>Descubre, conecta y haz crecer tu ciudad.</p></div><div className="community-actions"><a className="button white" href={destinations.userRegister}><Icon name="users"/>Crear cuenta de usuario</a><a className="button white" href={destinations.businessRegister}><Icon name="shop"/>Registrar mi negocio</a></div></section>
      </div>
    </main>
    <footer className="site-footer"><div className="footer-inner"><div className="footer-top"><Brand footer/>
      <nav aria-label="Explorar"><h2>Explorar</h2>{navigation.slice(0,4).map(([id,label]) => <a href={`#${id}`} key={id} onClick={event => navigate(event,id)}>{label}</a>)}</nav>
      <nav aria-label="Planes"><h2>Planes</h2><a href="#planes" onClick={event => navigate(event,"planes")}>Gratis</a><a href="#planes" onClick={event => navigate(event,"planes")}>PRO</a><a href="#beneficios">Beneficios</a></nav>
      <nav aria-label="Soporte"><h2>Soporte</h2><a href="#preguntas" onClick={event => navigate(event,"preguntas")}>Preguntas frecuentes</a><a href="#preguntas" onClick={event => navigate(event,"preguntas")}>Centro de ayuda</a><a href={destinations.businessSupport}>Contacto</a></nav>
      <nav aria-label="Legal"><h2>Legal</h2><a href={destinations.terms}>Términos y condiciones</a><a href={destinations.privacy}>Política de privacidad</a></nav>
      <div className="footer-join"><h2>Sé parte de XAMUKO</h2><p>Descubre lo que tu ciudad tiene para ti.</p><a href={destinations.explore}>Explorar negocios<Icon name="arrow"/></a></div>
    </div><div className="footer-bottom"><p>© {new Date().getFullYear()} XAMUKO. Todos los derechos reservados.</p><span className="country"><span className="colombia-flag" aria-hidden="true"/>Colombia<Icon name="chevron"/></span></div></div></footer>
  </>;
}
