import { Link } from "react-router-dom";
import "./NoResultsState.css";

type NoResultsStateProps = {
  term?: string;
  locationName: string;
  radiusKm?: number;
  virtualOnly?: boolean;
  cityEmpty?: boolean;
};

export function CityEmptyState() {
  return <section className="no-results-state no-results-state--city" aria-labelledby="no-city-businesses-title">
    <span className="no-results-city-symbol" aria-hidden="true">⌖</span>
    <span className="no-results-city-eyebrow">HAY MUCHO POR DESCUBRIR</span>
    <h2 id="no-city-businesses-title">Aún no hay negocios registrados en tu ciudad</h2>
    <p>¡Estamos creciendo! Mientras llegan nuevas opciones a tu comunidad, puedes descubrir negocios virtuales disponibles en toda Colombia.</p>
    <Link className="no-results-city-action" to="/results?scope=virtual">Explorar negocios virtuales <span aria-hidden="true">→</span></Link>
  </section>;
}

export function NoResultsState({ term, locationName, radiusKm, virtualOnly = false }: NoResultsStateProps) {
  const cleanTerm = term?.trim();
  const encodedTerm = cleanTerm ? `?q=${encodeURIComponent(cleanTerm)}` : "";

  return <section className="no-results-state" aria-labelledby="no-results-title">
    <div className="no-results-art" aria-hidden="true"><span>⌕</span><i/><b>?</b></div>
    <span className="no-results-eyebrow">SIGAMOS BUSCANDO</span>
    <h2 id="no-results-title">{virtualOnly ? (cleanTerm ? `No encontramos resultados virtuales para “${cleanTerm}”` : "No encontramos negocios virtuales") : cleanTerm ? `Aún no encontramos “${cleanTerm}”` : "Aún no encontramos coincidencias"}</h2>
    <p>{virtualOnly
      ? "No encontramos negocios con modalidad virtual activa ni sus productos o servicios para esta búsqueda. Prueba otro término o selecciona Sin límite."
      : cleanTerm ? `No encontramos negocios, productos ni servicios para “${cleanTerm}” en ${locationName}${radiusKm ? ` dentro de ${radiusKm} km` : ""}. Puedes ampliar la búsqueda o decirnos qué hace falta por tu zona.`
        : `No encontramos opciones en ${locationName}${radiusKm ? ` dentro de ${radiusKm} km` : ""}. Puedes ampliar la búsqueda o probar otra búsqueda.`}</p>
    <div className="no-results-actions">
      <Link to={`/search${encodedTerm}`}>Probar otra búsqueda</Link>
      {!virtualOnly && <Link to={`/map${encodedTerm}`}>Ampliar búsqueda en el mapa</Link>}
      <Link to={`/register-need${encodedTerm}`}>Contarnos qué necesitas</Link>
    </div>
    <Link className="no-results-nearby" to="/results">Ver todos los negocios en {locationName}</Link>
  </section>;
}
