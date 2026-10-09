import { useState } from "react";
import { Link } from "react-router-dom";
import { Button, Logo } from "@wit/ui";
import "./Location.css";

type LocationState = "ready" | "loading" | "granted" | "denied" | "unavailable" | "error";

function PinIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>;
}

function CompassIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2.2 4.8-4.8 2.2 2.2-4.8 4.8-2.2Z"/></svg>;
}

export default function Location() {
  const [state, setState] = useState<LocationState>("ready");
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);

  function requestLocation() {
    if (!navigator.geolocation) {
      setState("unavailable");
      return;
    }

    setState("loading");
    navigator.geolocation.getCurrentPosition(
      (position) => { setCoordinates({ lat: position.coords.latitude, lng: position.coords.longitude }); setState("granted"); },
      (error) => setState(error.code === error.PERMISSION_DENIED ? "denied" : "error"),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  }

  const feedback = {
    granted: { kind: "success", title: "Listo, ya tenemos permiso.", body: "Tu ubicación está lista para mostrarte lugares cercanos." },
    denied: { kind: "error", title: "No pudimos acceder a tu ubicación.", body: "Puedes permitirla desde los ajustes del navegador o elegir una zona manualmente." },
    unavailable: { kind: "error", title: "Este navegador no ofrece ubicación.", body: "No pasa nada: puedes continuar con una zona manualmente." },
    error: { kind: "error", title: "No pudimos encontrar tu ubicación ahora.", body: "Revisa la conexión o el permiso del navegador, o elige tu zona manualmente." },
  } as const;
  const message = state in feedback ? feedback[state as keyof typeof feedback] : null;

  return <main className="location-page">
    <header className="location-header">
      <Link className="location-back" to="/welcome" aria-label="Volver a Bienvenida"><span aria-hidden="true">←</span><span>Volver</span></Link>
      <Link className="location-logo" to="/home" aria-label="WIT, inicio"><Logo /></Link>
      <span className="location-progress">PASO <b>1</b> DE 2</span>
    </header>

    <section className="location-content" aria-labelledby="location-title">
      <div className="location-copy">
        <span className="location-eyebrow"><i /> Cerca de ti</span>
        <h1 id="location-title">Primero, cuéntanos<br /><em>dónde estás.</em></h1>
        <p className="location-intro">Así podemos mostrarte lugares cerca de ti y decirte a qué distancia quedan.</p>

        <ul className="location-benefits">
          <li><span className="location-benefit-icon"><PinIcon /></span><span><b>Encuentra lugares más cerca</b><small>Descubre negocios en tu zona.</small></span></li>
          <li><span className="location-benefit-icon"><CompassIcon /></span><span><b>Mira qué tan lejos están</b><small>Compara opciones antes de salir.</small></span></li>
        </ul>

        <div className="location-actions">
          <Button type="button" disabled={state === "loading" || state === "granted"} onClick={requestLocation}>
            {state === "loading" ? "Buscando tu ubicación…" : state === "granted" ? "Ubicación permitida" : "Usar mi ubicación"}
            {state === "ready" && <span aria-hidden="true">→</span>}
          </Button>
          <Link className="location-manual-link" to={`/location/manual${window.location.search ? window.location.search : ""}`}>Prefiero elegir mi zona</Link>
        </div>

        {message && <div className={`location-feedback location-feedback--${message.kind}`} role="status" aria-live="polite"><b>{message.title}</b><span>{message.body}</span>{state === "granted" && <Link to="/home">Ver negocios en Palmira →</Link>}</div>}

      </div>

      <aside className="location-visual location-google-map" aria-label="Mapa de tu ubicación"><iframe title="Mapa de tu ubicación" src={coordinates ? `https://www.google.com/maps?q=${coordinates.lat},${coordinates.lng}&z=16&output=embed` : "https://www.google.com/maps?q=Palmira,Valle+del+Cauca&z=13&output=embed"} loading="lazy" referrerPolicy="no-referrer-when-downgrade" /></aside>
    </section>

    <footer className="location-footer"><span><Logo /> <i /> Tu ubicación, a tu manera.</span><Link to="/home">Explorar negocios</Link></footer>
  </main>;
}
