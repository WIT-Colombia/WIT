import { useLocationContext } from "../context/LocationContext";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@wit/ui";
import { SiteHeader } from "../components/SiteHeader";
import { SiteFooter } from "../components/SiteFooter";
import "./Location.css";

type LocationState = "ready" | "loading" | "granted" | "denied" | "unavailable" | "error";

function PinIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>;
}

function CompassIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2.2 4.8-4.8 2.2 2.2-4.8 4.8-2.2Z"/></svg>;
}

export default function Location() {
  const { selection, requestAutomaticLocation, isRequesting } = useLocationContext();
  const [state, setState] = useState<LocationState>(() => selection?.mode === "automatic" ? "granted" : "ready");
  const coordinates = selection?.mode === "automatic" ? selection.coordinates : null;

  function requestLocation() {
    setState("loading");
    void requestAutomaticLocation().then(() => setState("granted")).catch((error: GeolocationPositionError | Error) => {
      setState("code" in error && error.code === error.PERMISSION_DENIED ? "denied" : error.message === "GEOLOCATION_UNAVAILABLE" ? "unavailable" : "error");
    });
  }

  const feedback = {
    granted: { kind: "success", title: "Listo, ya tenemos permiso.", body: "Tu ubicación está lista para mostrarte lugares cercanos." },
    denied: { kind: "error", title: "Autoriza tu ubicación en el navegador.", body: "Cuando aparezca el aviso, selecciona «Permitir». Si ya lo bloqueaste, habilítalo desde los ajustes del sitio y vuelve a intentarlo." },
    unavailable: { kind: "error", title: "Este navegador no ofrece ubicación.", body: "No pasa nada: puedes continuar con una zona manualmente." },
    error: { kind: "error", title: "No pudimos encontrar tu ubicación ahora.", body: "Revisa la conexión o el permiso del navegador, o elige tu zona manualmente." },
  } as const;
  const message = state in feedback ? feedback[state as keyof typeof feedback] : null;

  return <div className="location-page">
    <SiteHeader active="explore" />

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
          <Button type="button" disabled={isRequesting || state === "granted"} onClick={requestLocation}>
            {isRequesting ? "Buscando tu ubicación…" : state === "granted" ? "Ubicación permitida" : "Usar mi ubicación"}
            {state === "ready" && <span aria-hidden="true">→</span>}
          </Button>
          <Link className="location-manual-link" to={`/location${window.location.search ? window.location.search : ""}`}>Prefiero elegir mi zona</Link>
        </div>

        {message && <div className={`location-feedback location-feedback--${message.kind}`} role="status" aria-live="polite"><b>{message.title}</b><span>{message.body}</span>{state === "granted" && <Link to="/home">Explorar con mi ubicación →</Link>}</div>}

      </div>

      <aside className="location-visual location-google-map" aria-label="Mapa de tu ubicación">{coordinates ? <iframe title="Mapa de tu ubicación" src={`https://www.google.com/maps?q=${coordinates.lat},${coordinates.lng}&z=16&output=embed`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" /> : <div className="location-map-placeholder">Activa tu ubicación o elige una zona para verla en el mapa.</div>}</aside>
    </section>

    <SiteFooter />
  </div>;
}
