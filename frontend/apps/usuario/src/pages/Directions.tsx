import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { Business } from "../data/mockData";
import { PageLayout } from "../components/PageLayout";
import { BusinessStaticMap } from "../components/BusinessStaticMap";
import { useLocationContext } from "../context/LocationContext";
import { getPublicBusiness } from "../services/publicBusinessApi";
import type { LocationSelection } from "../services/locationService";
import { getBusinessCoordinates, getBusinessDirectionsUrl, getBusinessWazeUrl, getCoordinateDestination } from "../utils/coordinates";
import "./Directions.css";

function GoogleMapsLogo() { return <svg className="directions-app-logo directions-google-logo" viewBox="0 0 32 32" aria-hidden="true"><defs><clipPath id="maps-pin-clip"><path d="M16 2.5C9.5 2.5 4.3 7.7 4.3 14.1c0 8.3 8.5 13.4 10.8 15.1.5.4 1.2.4 1.8 0 2.3-1.7 10.8-6.8 10.8-15.1C27.7 7.7 22.5 2.5 16 2.5Z" /></clipPath></defs><path fill="#34A853" d="M16 2.5C9.5 2.5 4.3 7.7 4.3 14.1c0 8.3 8.5 13.4 10.8 15.1.5.4 1.2.4 1.8 0 2.3-1.7 10.8-6.8 10.8-15.1C27.7 7.7 22.5 2.5 16 2.5Z" /><g clipPath="url(#maps-pin-clip)"><path fill="#4285F4" d="M2 2h28v12H2z" /><path fill="#EA4335" d="M2 4 14 15 5 25H2z" /><path fill="#FBBC04" d="M2 25 14 15l8 9-8 10H2z" /><path fill="#4285F4" d="m14 15 10-13h6v12l-8 10z" /></g><circle cx="16" cy="14" r="5" fill="#fff" /></svg>; }
function WazeLogo() { return <svg className="directions-app-logo directions-waze-logo" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="15" fill="#55a9d8" /><path d="M8.2 17.3C8.2 10.4 11.5 6.5 17.2 6.5c6.2 0 9.8 4.5 8.4 10.9-1.1 5.1-4.7 7.9-9.7 7.9h-3.3c-3.1 0-5.7-1.5-7.1-4.2-.5-1 .2-1.5 2.7-3.8Z" fill="#fff" stroke="#241d1d" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.4" /><circle cx="14.2" cy="13.3" r="1.35" fill="#241d1d" /><circle cx="20.9" cy="13.3" r="1.35" fill="#241d1d" /><path d="M13.2 17.2c.8 1.7 2.4 2.7 4.3 2.7 1.9 0 3.5-1 4.3-2.7" fill="none" stroke="#241d1d" strokeLinecap="round" strokeWidth="1.25" /><circle cx="10.8" cy="24.1" r="3.5" fill="#241d1d" /><circle cx="20.6" cy="24.1" r="3.5" fill="#241d1d" /><circle cx="10.8" cy="24.1" r="1.35" fill="#fff" /></svg>; }

function getSelectedLocationOrigin(selection: LocationSelection | null): string | null {
  return getCoordinateDestination(selection?.coordinates);
}

export default function Directions() {
  const [params] = useSearchParams();
  const { selection } = useLocationContext();
  const businessId = params.get("businessId")?.trim() ?? "";
  const [business, setBusiness] = useState<Business | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "not-found" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    if (!businessId) { setState("not-found"); return () => { cancelled = true; }; }
    setState("loading");
    getPublicBusiness(businessId).then((result) => {
      if (cancelled) return;
      setBusiness(result?.business ?? null);
      setState(result ? "ready" : "not-found");
    }).catch(() => { if (!cancelled) { setBusiness(null); setState("error"); } });
    return () => { cancelled = true; };
  }, [businessId]);

  if (state === "loading") return <PageLayout><div className="business-not-found"><h1>Cargando destino…</h1><p>Estamos consultando la información pública.</p></div></PageLayout>;
  if (state === "error") return <PageLayout><div className="business-not-found"><h1>No se pudo cargar este destino</h1><p>Revisa tu conexión e inténtalo nuevamente.</p><Link to="/home">Volver a explorar</Link></div></PageLayout>;
  if (state === "not-found" || !business) return <PageLayout><div className="user-empty-state"><h2>Elige un lugar para ver su dirección</h2><Link to="/home">Explorar lugares</Link></div></PageLayout>;

  const point = getBusinessCoordinates(business);
  const google = getBusinessDirectionsUrl(business, getSelectedLocationOrigin(selection));
  const waze = getBusinessWazeUrl(business);
  const mapEnabled = Boolean(point && import.meta.env.VITE_GOOGLE_MAPS_STATIC_API_KEY?.trim());
  const address = [business.address, business.city, business.regionName].filter(Boolean).join(", ");

  return <PageLayout className="directions-page">
    <Link className="directions-back" to={`/business/${encodeURIComponent(business.id)}`}>← Volver a {business.name}</Link>
    <div className="user-page-heading"><h1>Cómo llegar</h1></div>
    <section className="directions-card">
      <div className="directions-info">
        <div className="directions-destination"><span>DESTINO</span><b>{business.name}</b><small>{address || "Dirección no disponible"}</small></div>
        <div className="directions-apps" aria-label="Elegir aplicación de mapas"><span className="directions-apps__label">¿Con qué aplicación quieres llegar?</span>{google ? <><a href={google} target="_blank" rel="noopener noreferrer"><GoogleMapsLogo /> Google Maps <span>↗</span></a>{waze && <div className="directions-waze-option"><a href={waze} target="_blank" rel="noopener noreferrer"><WazeLogo /> Waze <span>↗</span></a><p className="directions-waze-note">Waze utiliza tu ubicación actual como punto de partida.</p></div>}{!waze && <p className="directions-waze-note">Waze requiere coordenadas públicas del establecimiento.</p>}</> : <p className="directions-waze-note">Ubicación no disponible.</p>}</div>
      </div>
      <div className="directions-map-shell">{mapEnabled ? <BusinessStaticMap business={business} /> : <div className="directions-map-unavailable" role="status"><b>Vista previa no disponible</b><span>El destino se puede consultar desde la dirección registrada.</span></div>}</div>
    </section>
  </PageLayout>;
}
