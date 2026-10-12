import { Link } from "react-router-dom";
import type { Locality } from "../data/locations";
import "./LocationAvailabilityNotice.css";

export function LocationAvailabilityNotice({ location, query = "" }: { location: Locality | null; query?: string }) {
  const city = location?.name ?? "tu zona";
  const department = location?.context ?? "la ubicación seleccionada";
  const registerNeedPath = `/register-need${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ""}`;

  return <section className="location-availability-notice" aria-labelledby="location-availability-title">
    <span className="location-availability-notice__icon" aria-hidden="true">⌖</span>
    <div className="location-availability-notice__copy">
      <span>BUSCANDO EN {city.toLocaleUpperCase("es-CO")}</span>
      <h2 id="location-availability-title">Aún no encontramos negocios en {city}.</h2>
      <p>Cuéntanos qué necesitas en {city}, {department}. Así podremos tenerlo en cuenta para esta zona.</p>
      <div className="location-availability-notice__actions">
        <Link className="location-availability-notice__primary" to={registerNeedPath}>Registrar lo que necesito <span aria-hidden="true">→</span></Link>
        <Link className="location-availability-notice__secondary" to="/location">Elegir otra ciudad</Link>
      </div>
    </div>
  </section>;
}
