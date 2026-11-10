const logo = "/assets/xamuko-logo.png";
const reference = "/assets/xamuko-reference.png";

import { publicUrls } from "./config/publicUrls";

const destinations = {
  businessLogin: `${publicUrls.business}/login`,
  businessRegister: `${publicUrls.business}/registro`,
  userLogin: `${publicUrls.usuario}/register?mode=login`,
  userRegister: `${publicUrls.usuario}/register`,
  explore: `${publicUrls.usuario}/home`,
} as const;

function CardPhoto({ viewBox, className = '' }: { viewBox: string; className?: string }) {
  return <svg className={`responsive-card-photo ${className}`} viewBox={viewBox} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <image href={reference} width="1536" height="1024" />
  </svg>;
}

function LocationLabel({ className }: { className: string }) {
  return <span className={className}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 10c0 5-7 12-7 12S5 15 5 10a7 7 0 1 1 14 0Z" />
    </svg>
    <span>Colombia</span>
  </span>;
}

function BenefitIcon({ kind }: { kind: "pin" | "community" | "heart" | "shield" }) {
  const paths = {
    pin: <><path d="M19 10c0 5-7 12-7 12S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
    community: <><circle cx="12" cy="8" r="3"/><path d="M5 20a7 7 0 0 1 14 0M4 11a3 3 0 0 1 3-3M20 11a3 3 0 0 0-3-3"/></>,
    heart: <path d="M20.8 8.7c0 5.2-8.8 10.5-8.8 10.5S3.2 13.9 3.2 8.7A4.7 4.7 0 0 1 12 6.3a4.7 4.7 0 0 1 8.8 2.4Z"/>,
    shield: <><path d="M12 21s7-3.6 7-10V5l-7-3-7 3v6c0 6.4 7 10 7 10Z"/><path d="m9 12 2 2 4-4"/></>,
  };
  return <svg className="benefit-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[kind]}</svg>;
}

const businessBenefits = [
  ["▥", "Publicación fácil y rápida"],
  ["♧", "Más clientes en tu zona"],
  ["⚙", "Estadísticas de visitas y contactos"],
  ["◀", "Destaca tus productos y servicios"],
];

const userCategories = [
  ["🍴", "Restaurantes"],
  ["▣", "Tiendas"],
  ["✿", "Belleza y bienestar"],
  ["♥", "Salud y deporte"],
  ["⌂", "Hogar"],
  ["●", "Servicios y más"],
];

export function App() {
  return <main className="landing" aria-label="Página principal de XAMUKO">
    <div className="responsive-landing">
      <header className="responsive-hero">
        <LocationLabel className="responsive-location" />
        <a className="responsive-brand" href={destinations.explore} aria-label="XAMUKO, ir a explorar">
          <img src={logo} alt="XAMUKO" />
        </a>
        <p className="responsive-slogan">Lo que necesitas, está más cerca.</p>
        <p className="responsive-motto">Descubre · Apoya · Disfruta</p>
      </header>

      <div className="responsive-content">
        <div className="responsive-cards">
          <section className="responsive-card responsive-business" aria-labelledby="business-title">
            <CardPhoto viewBox="500 193 260 462" className="mobile-photo" />
            <CardPhoto viewBox="560 193 200 462" className="desktop-photo" />
            <div className="responsive-card-copy">
              <span className="responsive-card-badge">XAMUKO Business</span>
              <h1 id="business-title">Haz que más personas descubran <span>tu negocio</span></h1>
              <p>Publica tus productos y servicios, recibe más clientes y haz crecer tu negocio.</p>
              <ul className="responsive-list business-list">
                {businessBenefits.map(([icon, label]) => <li key={label}><span aria-hidden="true">{icon}</span>{label}</li>)}
              </ul>
            </div>
            <div className="responsive-actions">
              <a className="responsive-button business-primary" href={destinations.businessLogin}>Iniciar sesión <span aria-hidden="true">→</span></a>
              <a className="responsive-button business-secondary" href={destinations.businessRegister}>Registrar mi negocio <span aria-hidden="true">→</span></a>
            </div>
          </section>

          <section className="responsive-card responsive-user" aria-labelledby="user-title">
            <CardPhoto viewBox="1120 193 273 462" className="mobile-photo" />
            <CardPhoto viewBox="1200 193 193 462" className="desktop-photo" />
            <div className="responsive-card-copy">
              <span className="responsive-card-badge">XAMUKO</span>
              <h2 id="user-title">Descubre los mejores negocios de <span>tu ciudad</span></h2>
              <p>Restaurantes, tiendas, servicios y mucho más, todo en un solo lugar.</p>
              <ul className="responsive-list user-list">
                {userCategories.map(([icon, label]) => <li key={label}><span aria-hidden="true">{icon}</span>{label}</li>)}
              </ul>
            </div>
            <div className="responsive-actions">
              <a className="responsive-button user-primary" href={destinations.userLogin}>Iniciar sesión <span aria-hidden="true">→</span></a>
              <a className="responsive-button user-secondary" href={destinations.userRegister}>Registrarme <span aria-hidden="true">→</span></a>
              <a className="responsive-explore" href={destinations.explore}>Explorar sin registrarme</a>
            </div>
          </section>
        </div>

        <div className="responsive-benefits" aria-label="Beneficios de XAMUKO">
          <div><span className="benefit-icon purple"><BenefitIcon kind="pin" /></span><strong>Negocios locales</strong><span>Conecta con tu comunidad</span></div>
          <div><span className="benefit-icon blue"><BenefitIcon kind="community" /></span><strong>Apoya lo nuestro</strong><span>Impulsa el comercio local</span></div>
          <div><span className="benefit-icon pink"><BenefitIcon kind="heart" /></span><strong>Todo en un solo lugar</strong><span>Productos, servicios y más</span></div>
          <div><span className="benefit-icon green"><BenefitIcon kind="shield" /></span><strong>Simple y seguro</strong><span>Tu información protegida</span></div>
        </div>
      </div>
    </div>
  </main>;
}
