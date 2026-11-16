import { useEffect } from 'react';
import './NotFoundPage.css';

type NotFoundVariant = 'usuario' | 'business' | 'admin' | 'landing';
type Props = {
  variant: NotFoundVariant;
  homeHref: string;
  homeLabel: string;
};

/**
 * XAMUKO 404: the logo is the existing official brand file and the artwork
 * is genuine vector (resolution-independent, including 4K displays).
 * All user-facing copy and controls are HTML, not rasterized text.
 */
function LostMapArtwork() {
  return <svg className="x404-artwork" viewBox="0 0 600 315" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Ilustración de un mapa con un punto de ubicación y un signo de pregunta">
    <defs>
      <linearGradient id="x404-map-left" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0" stopColor="#fff"/><stop offset="1" stopColor="var(--x404-map-soft)"/>
      </linearGradient>
      <linearGradient id="x404-map-mid" x1="0" x2="0.8" y1="0" y2="1">
        <stop offset="0" stopColor="var(--x404-map-light)"/><stop offset="1" stopColor="var(--x404-map-dark)"/>
      </linearGradient>
      <linearGradient id="x404-pin" x1="0" x2="0.95" y1="0" y2="1">
        <stop offset="0" stopColor="var(--x404-pin-light)"/><stop offset=".6" stopColor="var(--x404-main)"/><stop offset="1" stopColor="var(--x404-main-dark)"/>
      </linearGradient>
      <filter id="x404-shadow" x="-50%" y="-60%" width="200%" height="230%">
        <feGaussianBlur stdDeviation="10"/>
      </filter>
    </defs>

    {/* Soft illustration clouds and exploratory dashed paths. */}
    <g fill="var(--x404-cloud)">
      <path d="M81 98c-9-20 4-34 20-34 15 0 21 10 24 19 15-6 29 6 29 19 0 10-9 14-20 14H78c-14 0-17-15-8-23 3-2 6-3 11-3z"/>
      <path d="M429 82c0-15 10-25 25-25 11 0 20 7 22 17 18-4 27 11 24 22h-83c-11-6-5-19 12-14z"/>
    </g>
    <g fill="none" stroke="var(--x404-ink)" strokeWidth="2.5" strokeLinecap="round" opacity=".6">
      <path d="M29 176c12 40 74 45 87 13 12-30-19-37-32-22-20 24 14 47 49 47" strokeDasharray="5 8"/>
      <path d="M446 195c28-45 101-43 114-6" strokeDasharray="5 8"/>
      <path d="M519 208c2-15 18-20 29-16" strokeDasharray="5 8"/>
    </g>
    <circle cx="518" cy="119" r="6.5" fill="#22d3ee" opacity=".85"/>
    <circle cx="165" cy="145" r="3.5" fill="var(--x404-main)" opacity=".45"/>
    <path d="M373 70l10-21m10 36 20-12m-43 21-6 18" stroke="var(--x404-main)" strokeLinecap="round" strokeWidth="5" opacity=".85"/>

    <ellipse cx="295" cy="272" rx="186" ry="24" fill="var(--x404-main)" opacity=".13" filter="url(#x404-shadow)"/>
    {/* Folded map paper, front-facing angle and panel folds. */}
    <path d="M118 239 211 202 303 232 399 204l99 36-93 46-102-26-100 26z" fill="var(--x404-map-dark)" opacity=".6"/>
    <path d="m117 223 93-51 93 30 96-30 98 51-97 40-97-31-99 33z" fill="url(#x404-map-left)" stroke="var(--x404-map-stroke)" strokeWidth="3" strokeLinejoin="round"/>
    <path d="m210 172 93 30v30l-99 33z" fill="url(#x404-map-mid)" opacity=".9"/>
    <path d="m303 202 96-30 1 91-97-31z" fill="url(#x404-map-left)" opacity=".95"/>
    <path d="m399 172 98 51-97 40z" fill="var(--x404-map-light)" opacity=".85"/>
    <path d="m210 172-93 51 87 42z" fill="var(--x404-map-soft)" opacity=".85"/>
    <g stroke="#fff" strokeWidth="2.3" opacity=".7" fill="none" strokeLinecap="round">
      <path d="m174 192 79 50m-96-29 73 41m-14-68 91 29m-23-18-95 40m129-42 83 35m-67-49 79 38m-44-42 28 76m39-68-66 67m84-49-92 32"/>
      <path d="m239 181-16 74m135-65 6 55m59-58 1 64"/>
    </g>
    <path d="m117 223 87 42 99-33 97 31 97-40" stroke="var(--x404-map-stroke)" strokeWidth="2.5" fill="none" opacity=".8"/>
    <path d="m210 172-6 93m99-63v30m96-60 1 91" stroke="var(--x404-map-stroke)" strokeWidth="2" fill="none" opacity=".6"/>

    {/* Leaves offer visual warmth while keeping illustration separate from copy. */}
    <g transform="translate(135 225)">
      <path d="M0 34V-26" stroke="#33824a" strokeWidth="5" strokeLinecap="round"/>
      <path d="M0 12C-31 10-40-13-40-25-14-23-3-8 0 12Z" fill="#56b85f"/>
      <path d="M0-2C19-13 33-24 33-47 9-42 1-24 0-2Z" fill="#389e50"/>
      <path d="M0-14C-25-22-32-39-30-56-9-52 0-36 0-14Z" fill="#75d375"/>
    </g>
    <g transform="translate(458 235) scale(.65)">
      <path d="M0 29V-30" stroke="#32794a" strokeWidth="5" strokeLinecap="round"/>
      <path d="M0 14C-30 5-31-14-31-31-8-25-1-12 0 14Z" fill="#69c96b"/>
      <path d="M0-8C17-20 25-37 22-49 4-42 0-29 0-8Z" fill="#3fa758"/>
    </g>

    {/* Vector location marker and vector question mark. */}
    <ellipse cx="302" cy="204" rx="39" ry="10" fill="var(--x404-ink)" opacity=".19" filter="url(#x404-shadow)"/>
    <path d="M301 37c-43 0-75 30-75 72 0 56 75 120 75 120s76-64 76-120c0-42-33-72-76-72Z"
      fill="url(#x404-pin)" stroke="var(--x404-main-dark)" strokeOpacity=".3" strokeWidth="2.5"/>
    <path d="M255 75c9-19 25-28 44-28" stroke="#fff" strokeWidth="7" opacity=".42" strokeLinecap="round" fill="none"/>
    <path d="M279 97c2-17 14-27 32-27 19 0 33 12 33 29 0 17-12 24-24 33-7 6-10 12-10 21"
      fill="none" stroke="white" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="310" cy="176" r="7" fill="#fff"/>
  </svg>;
}

function HomeIcon() {
  return <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 10 9-7 9 7"/><path d="M5 9v12h14V9M9 21v-7h6v7"/></svg>;
}
function BackIcon() {
  return <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m14 6-6 6 6 6"/><path d="M8 12h13"/></svg>;
}

export function NotFoundPage({ variant, homeHref, homeLabel }: Props) {
  useEffect(() => {
    document.title = '404 · Página no encontrada | XAMUKO';
  }, []);

  function goBack() {
    if (typeof window === 'undefined') return;
    // Avoid sending visitors to an unrelated site when opening a 404 directly.
    try {
      if (document.referrer && new URL(document.referrer).origin === window.location.origin && window.history.length > 1) {
        window.history.back();
        return;
      }
    } catch { /* Unreadable referrer: use the safe app home. */ }
    window.location.assign(homeHref);
  }

  return <section className="xamuko-not-found" data-variant={variant} aria-labelledby="xamuko-not-found-title">
    <div className="x404-ambient x404-ambient-top" aria-hidden="true"/>
    <div className="x404-ambient x404-ambient-left" aria-hidden="true"/>
    <div className="x404-ambient x404-ambient-right" aria-hidden="true"/>
    <div className="x404-wave x404-wave-back" aria-hidden="true"/>
    <div className="x404-wave x404-wave-front" aria-hidden="true"/>
    <div className="x404-content">
      <div className="x404-brand">
        <img src="/brand/xamuko-lockup.png" alt="XAMUKO" width={2170} height={725} decoding="async"/>
        <span className="x404-brand-badge">{variant === 'business' ? 'Business' : variant === 'admin' ? 'Admin' : variant === 'usuario' ? 'Usuarios' : 'Explora XAMUKO'}</span>
      </div>
      <LostMapArtwork/>
      <p className="x404-error-code" aria-hidden="true">404</p>
      <h1 id="xamuko-not-found-title">Página no encontrada</h1>
      <p className="x404-description">Parece que la página que buscas no existe o ya no está disponible.</p>
      <div className="x404-actions">
        <a className="x404-primary" href={homeHref}><HomeIcon/><span>{homeLabel}</span></a>
        <button className="x404-back" type="button" onClick={goBack}><BackIcon/><span>Regresar</span></button>
      </div>
    </div>
  </section>;
}
