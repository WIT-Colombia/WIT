import { Link } from "react-router-dom";
import xamukoLogo from "../assets/XAMUKO-V1-transparent.png";
import "./SiteFooter.css";

const navigationGroups = [
  {
    title: "Explora",
    links: [
      { label: "Negocios", to: "/map" },
      { label: "Categorías", to: "/home#explorar" },
      { label: "Ofertas", to: "/home#special-offers-title" },
    ],
  },
  {
    title: "XAMUKO",
    links: [{ label: "Conoce XAMUKO", to: "https://xamuko.com" }],
  },
  {
    title: "Ayuda",
    links: [
      { label: "Preguntas frecuentes", to: "/ayuda/preguntas-frecuentes" },
      { label: "Cuéntanos qué necesitas", to: "/register-need" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Términos y condiciones", to: "/legal/terms" },
      { label: "Política de privacidad", to: "/legal/privacy" },
    ],
  },
] as const;

function FooterWaves() {
  return (
    <svg className="site-footer__waves" viewBox="0 0 1440 180" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="footer-violet-wave" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#a33dff" />
          <stop offset=".48" stopColor="#6f36f5" />
          <stop offset="1" stopColor="#a33dff" />
        </linearGradient>
        <linearGradient id="footer-blue-wave" x1="0" y1="0" x2="1" y2="0">
          <stop stopColor="#713cff" />
          <stop offset=".48" stopColor="#2563eb" />
          <stop offset=".72" stopColor="#22d3ee" />
          <stop offset="1" stopColor="#713cff" />
        </linearGradient>
        <linearGradient id="footer-deep-wave" x1="0" y1="0" x2="1" y2=".15">
          <stop stopColor="#241078" />
          <stop offset=".52" stopColor="#201078" />
          <stop offset="1" stopColor="#3510a7" />
        </linearGradient>
      </defs>
      <path fill="#faf9fc" d="M0 0h1440v62c-98 43-158 40-245 12-105-34-179-28-302 1-130 31-178 30-294-1-111-30-171-23-290 0C191 98 113 67 0 27V0Z" />
      <path fill="url(#footer-violet-wave)" d="M0 24c103 28 170 84 270 61 100-23 160-54 275-22 116 32 193 71 309 40 112-30 188-69 302-53 104 14 159 54 284 0v94H0V24Z" />
      <path fill="url(#footer-blue-wave)" d="M0 78c109-38 205 11 307 13 116 2 181-41 294-32 102 8 189 61 297 52 126-10 215-64 351-46 84 11 124 42 191 27v62H0V78Z" />
      <path fill="url(#footer-deep-wave)" d="M0 122c112-54 207-38 309-29 118 10 190 13 299 15 120 1 214-24 336-11 115 13 210 18 328 7 72-7 116-5 168 12v64H0v-58Z" />
    </svg>
  );
}

function LocationIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path d="M19 10c0 5-7 12-7 12S5 15 5 10a7 7 0 1 1 14 0Z" />
      <circle cx="12" cy="10" r="2.25" />
    </svg>
  );
}

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <FooterWaves />
      <div className="site-footer__content">
        <div className="site-footer__main">
          <div className="site-footer__brand-block">
            <a className="site-footer__brand-link" href="/home" aria-label="XAMUKO, ir al inicio">
              <img src={xamukoLogo} alt="XAMUKO. Descubre, apoya y disfruta." />
            </a>
          </div>

          <nav className="site-footer__navigation" aria-label="Enlaces del pie de página">
            {navigationGroups.map((group) => (
              <section className="site-footer__group" key={group.title} aria-labelledby={`site-footer-${group.title.toLowerCase()}`}>
                <h2 id={`site-footer-${group.title.toLowerCase()}`}>{group.title}</h2>
                <ul>
                  {group.links.map((link) => (
                    <li key={link.label}>{link.to === "/ayuda/preguntas-frecuentes" ? <Link to={link.to}>{link.label}</Link> : <a href={link.to}>{link.label}</a>}</li>
                  ))}
                </ul>
              </section>
            ))}
          </nav>
        </div>

        <div className="site-footer__bottom">
          <small>© {year} XAMUKO. Todos los derechos reservados.</small>
          <span className="site-footer__bottom-divider" aria-hidden="true" />
          <span className="site-footer__location"><LocationIcon />Palmira, Colombia</span>
        </div>
      </div>
    </footer>
  );
}
