import { Link } from "react-router-dom";
import cityEmptyArtwork from "../assets/no-businesses-city-4k.jpg";
import "./NoResultsState.css";

type NoResultsStateProps = {
  term?: string;
  locationName: string;
  radiusKm?: number;
  virtualOnly?: boolean;
  cityEmpty?: boolean;
};

function CityEmptyState() {
  return <section className="no-results-state no-results-state--city" aria-labelledby="no-city-businesses-title">
    <img src={cityEmptyArtwork} alt="Aún no hay negocios registrados en tu ciudad. Prueba con negocios en modalidad virtual y descubre opciones disponibles para ti." />
    <Link className="no-results-city-action" to="/results?scope=virtual" aria-label="Ver negocios virtuales disponibles en toda Colombia">Ver negocios virtuales</Link>
  </section>;
}

export function NoResultsState({ term, locationName, radiusKm, virtualOnly = false, cityEmpty = false }: NoResultsStateProps) {
  if (cityEmpty) return <CityEmptyState />;
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
