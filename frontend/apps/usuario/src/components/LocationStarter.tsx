import { useState } from "react";
import { Link } from "react-router-dom";
import { useLocationContext } from "../context/LocationContext";
import "./LocationStarter.css";

/** Device location is offered first, with an explicit manual fallback. */
export function LocationStarter() {
  const { selection, devicePermission, requestAutomaticLocation, isRequesting } = useLocationContext();
  const [error, setError] = useState(false);

  if (selection) return null;

  function useDeviceLocation() {
    setError(false);
    void requestAutomaticLocation().catch(() => setError(true));
  }

  const blocked = devicePermission === "denied";
  const unavailable = devicePermission === "unavailable";
  const detail = blocked
    ? "El permiso de ubicación está bloqueado. Puedes habilitarlo en tu navegador o elegir una ciudad."
    : unavailable
      ? "Tu navegador no puede consultar la ubicación. Elige una ciudad para comenzar."
      : error
        ? "No pudimos obtener la ubicación del dispositivo. Puedes reintentar o elegir una ciudad."
        : devicePermission === "checking"
          ? "Comprobando si podemos utilizar la ubicación del dispositivo…"
          : "Permite el acceso a tu ubicación para mostrarte negocios cercanos. Tú decides si compartirla.";

  return <section className="user-location-starter" aria-labelledby="user-location-starter-title">
    <div className="user-location-starter-copy">
      <span className="user-location-starter-eyebrow">📍 UBICACIÓN</span>
      <h2 id="user-location-starter-title">Primero, encuentra negocios cerca de ti</h2>
      <p role={blocked || error ? "status" : undefined}>{detail}</p>
    </div>
    <div className="user-location-starter-actions">
      {!unavailable && <button type="button" onClick={useDeviceLocation} disabled={isRequesting || devicePermission === "checking"}>
        {isRequesting ? "Buscando ubicación…" : blocked ? "Reintentar ubicación" : "Usar mi ubicación actual"}
      </button>}
      <Link to="/location">Elegir ciudad manualmente</Link>
    </div>
  </section>;
}
