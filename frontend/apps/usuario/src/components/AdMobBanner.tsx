import "./AdMobBanner.css";

/** Reserved inline slot for the future AdMob unit. */
export function AdMobBanner({ slot = "home-inline" }: { slot?: string }) {
  return <aside className="admob-banner" data-admob-slot={slot} aria-label="Publicidad">
    <span className="admob-banner__label">Publicidad</span>
    <div className="admob-banner__copy">
      <strong>Descubre algo nuevo cerca de ti</strong>
      <span>Recomendaciones de negocios locales</span>
    </div>
    <span className="admob-banner__mark" aria-hidden="true">↗</span>
  </aside>;
}
