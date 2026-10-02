import { Link } from "react-router-dom";
import "./NoResultsState.css";

type NoResultsStateProps = {
  term?: string;
  locationName: string;
};

export function NoResultsState({ term, locationName }: NoResultsStateProps) {
  const cleanTerm = term?.trim();
  const encodedTerm = cleanTerm ? `?q=${encodeURIComponent(cleanTerm)}` : "";

  return <section className="no-results-state" aria-labelledby="no-results-title">
    <div className="no-results-art" aria-hidden="true"><span>⌕</span><i/><b>?</b></div>
    <span className="no-results-eyebrow">SIGAMOS BUSCANDO</span>
    <h2 id="no-results-title">{cleanTerm ? `Aún no encontramos “${cleanTerm}”` : "Aún no encontramos coincidencias"}</h2>
    <p>{cleanTerm ? `No encontramos negocios, productos ni servicios para “${cleanTerm}” en ${locationName}. Puedes probar con otras palabras o decirnos qué hace falta por tu zona.` : `No encontramos opciones en ${locationName}. Puedes probar otra búsqueda o ver todos los negocios disponibles.`}</p>
    <div className="no-results-actions">
      <Link to={`/search${encodedTerm}`}>Probar otra búsqueda</Link>
      <Link to={`/register-need${encodedTerm}`}>Contarnos qué necesitas</Link>
    </div>
    <Link className="no-results-nearby" to="/results">Ver todos los negocios en {locationName}</Link>
  </section>;
}
