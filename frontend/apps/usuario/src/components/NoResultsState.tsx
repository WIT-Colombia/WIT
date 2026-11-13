import { Link } from "react-router-dom";
import cityEmptyIllustration from "../assets/city-empty-storefront.svg";
import nearbyEmptyIllustration from "../assets/nearby-empty-map-4k.webp";
import nearbyEmptyIllustration480 from "../assets/nearby-empty-map-480.webp";
import nearbyEmptyIllustration960 from "../assets/nearby-empty-map-960.webp";
import "./NoResultsState.css";
import "./NearbyEmptyState.css";

type NoResultsStateProps = {
  term?: string;
  locationName: string;
  radiusKm?: number;
  virtualOnly?: boolean;
  cityEmpty?: boolean;
  appearance?: "default" | "nearby";
};

export function CityEmptyState() {
  return <section className="no-results-state no-results-state--city" aria-labelledby="no-city-businesses-title">
    <div className="no-results-city-illustration">
      <img src={cityEmptyIllustration} alt="" aria-hidden="true" />
    </div>
    <div className="no-results-city-content">
      <h3 id="no-city-businesses-title">Aún no hay negocios registrados en tu ciudad.</h3>
      <p>Prueba con negocios en modalidad virtual y descubre opciones disponibles para ti.</p>
      <Link className="no-results-city-action" to="/results?scope=virtual" aria-label="Ver negocios virtuales disponibles en toda Colombia">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4.75h18v12.5H3zM8 21h8M12 17.25V21M2 20h20" /></svg>
        <span>Ver negocios virtuales</span>
        <svg className="no-results-city-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6" /></svg>
      </Link>
    </div>
  </section>;
}

function NearbyActionIcon({ name }: { name: "pin" | "map" | "message" }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {name === "pin" ? <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>
      : name === "map" ? <><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z"/><path d="M9 3v15m6-12v15"/></>
        : <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 10 10 0 0 1-4-.8L3 21l1.8-5.5a10 10 0 0 1-.8-4 8.5 8.5 0 0 1 17 0Z"/>}
  </svg>;
}

export function NoResultsState({ term, locationName, radiusKm, virtualOnly = false, appearance = "default" }: NoResultsStateProps) {
  const cleanTerm = term?.trim();
  const encodedTerm = cleanTerm ? `?q=${encodeURIComponent(cleanTerm)}` : "";
  const nearby = appearance === "nearby";
  const locationSelector = `/location?returnTo=${encodeURIComponent(nearby ? "/home" : `/results${encodedTerm}`)}`;

  return <section className={`no-results-state${nearby ? " no-results-state--nearby" : ""}`} aria-labelledby="no-results-title">
    {nearby ? <div className="nearby-empty-illustration" aria-hidden="true"><img src={nearbyEmptyIllustration} srcSet={`${nearbyEmptyIllustration480} 480w, ${nearbyEmptyIllustration960} 960w, ${nearbyEmptyIllustration} 3840w`} sizes="(max-width: 600px) 176px, (max-width: 1023px) 210px, 340px" width="3840" height="2880" alt="" loading="lazy" decoding="async" /></div>
      : <div className="no-results-art" aria-hidden="true"><span>⌕</span><i/><b>?</b></div>}
    <div className={nearby ? "nearby-empty-copy" : "no-results-default-copy"}>
    <span className="no-results-eyebrow">{nearby ? "SIGAMOS EXPLORANDO" : "SIGAMOS BUSCANDO"}</span>
    <h2 id="no-results-title">{virtualOnly ? (cleanTerm ? `No encontramos resultados virtuales para “${cleanTerm}”` : "No encontramos negocios virtuales") : cleanTerm ? `Aún no encontramos “${cleanTerm}”` : "Aún no encontramos coincidencias"}</h2>
    <p>{virtualOnly
      ? "No encontramos negocios con modalidad virtual activa ni sus productos o servicios para esta búsqueda. Prueba otro término o selecciona Sin límite."
      : cleanTerm ? `No encontramos negocios, productos ni servicios para “${cleanTerm}” en ${locationName}${radiusKm ? ` dentro de ${radiusKm} km` : ""}. Puedes ampliar la búsqueda o decirnos qué hace falta por tu zona.`
        : nearby ? `Por ahora no hay opciones en ${locationName}. Puedes probar otras formas de continuar con tu búsqueda.`
          : `No encontramos opciones en ${locationName}${radiusKm ? ` dentro de ${radiusKm} km` : ""}. Puedes ampliar la búsqueda o probar otra búsqueda.`}</p>
    <div className="no-results-actions">
      {virtualOnly
        ? <Link to="/results?scope=virtual">Cambiar búsqueda</Link>
        : <Link to={locationSelector}>{nearby && <NearbyActionIcon name="pin"/>}Elegir otra ubicación</Link>}
      {!virtualOnly && <Link to={`/map${encodedTerm}`}>{nearby && <NearbyActionIcon name="map"/>}Ampliar búsqueda en el mapa</Link>}
      <Link to={`/register-need${encodedTerm}`}>{nearby && <NearbyActionIcon name="message"/>}Contarnos qué necesitas</Link>
    </div>
    </div>
  </section>;
}
