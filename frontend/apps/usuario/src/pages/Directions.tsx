import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { businesses } from "../data/mockData";
import { GoogleMapEmbed } from "../components/GoogleMapEmbed";
import { PageLayout } from "../components/PageLayout";
import "./Directions.css";

function buildDestination(name: string, address: string): string {
  return [name, address, "Palmira, Valle del Cauca, Colombia"].filter(Boolean).join(", ");
}

function getGoogleMapsDirectionsUrl(destination: string): string {
  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1");
  url.searchParams.set("destination", destination);
  return url.toString();
}

function getAppleMapsDirectionsUrl(destination: string): string {
  const url = new URL("https://maps.apple.com/");
  url.searchParams.set("daddr", destination);
  url.searchParams.set("dirflg", "d");
  return url.toString();
}

function getWazeSearchUrl(destination: string): string {
  const url = new URL("https://waze.com/ul");
  url.searchParams.set("q", destination);
  url.searchParams.set("utm_source", "wit");
  return url.toString();
}

export default function Directions() {
  const [params] = useSearchParams();
  const [mapExpanded, setMapExpanded] = useState(false);
  const business = businesses.find((item) => item.id === params.get("businessId"));

  useEffect(() => {
    if (!mapExpanded) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMapExpanded(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mapExpanded]);

  if (!business) return <PageLayout><div className="user-empty-state"><span>⌖</span><h2>Elige un lugar para ver su dirección</h2><p>Encuentra un negocio y desde su ficha podrás consultar cómo llegar.</p><Link to="/home">Explorar lugares</Link></div></PageLayout>;

  const destination = buildDestination(business.name, business.address);

  return <PageLayout className="directions-page">
    <Link className="directions-back" to={`/business/${business.id}`}>← Volver a {business.name}</Link>
    <div className="user-page-heading">
      <span>CÓMO LLEGAR</span>
      <h1>Encuentra el camino</h1>
      <p>Elige cómo quieres llegar a {business.name}. El mapa de la zona está debajo.</p>
    </div>

    <section className="directions-card" aria-label={`Ubicación de ${business.name}`}>
      <div className="directions-info">
        <div className="directions-destination">
          <span>DESTINO</span>
          <b>{business.name}</b>
          <small>{business.address} · Palmira, Valle del Cauca</small>
        </div>
        <p>La dirección mostrada es de ejemplo. Confirma la ubicación con el establecimiento antes de salir.</p>
        <div className="directions-apps" aria-label="Elegir aplicación de mapas">
          <span className="directions-apps__label">¿Con qué aplicación quieres llegar?</span>
          <a href={getGoogleMapsDirectionsUrl(destination)} target="_blank" rel="noreferrer">Google Maps <span aria-hidden="true">↗</span></a>
          <a href={getAppleMapsDirectionsUrl(destination)} target="_blank" rel="noreferrer">Maps de Apple <span aria-hidden="true">↗</span></a>
          <a href={getWazeSearchUrl(destination)} target="_blank" rel="noreferrer">Waze <span aria-hidden="true">↗</span></a>
        </div>
        <small className="directions-waze-note">En Waze, confirma la dirección encontrada para iniciar la navegación.</small>
      </div>
      <div className="directions-map-shell">
        <div className="directions-map-toolbar"><b>Mapa de la ubicación</b><button type="button" onClick={() => setMapExpanded(true)} aria-haspopup="dialog">⛶ <span>Ampliar mapa</span></button></div>
        <GoogleMapEmbed query={destination} title={`Ubicación de ${business.name} en Google Maps`} className="directions-map" />
      </div>
    </section>
    {mapExpanded && <div className="directions-map-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setMapExpanded(false); }}>
      <section className="directions-map-dialog" role="dialog" aria-modal="true" aria-label={`Mapa ampliado de ${business.name}`}>
        <div className="directions-map-toolbar"><b>Mapa de {business.name}</b><button type="button" onClick={() => setMapExpanded(false)} aria-label="Cerrar mapa ampliado">✕ <span>Cerrar</span></button></div>
        <GoogleMapEmbed query={destination} title={`Mapa ampliado de ${business.name} en Google Maps`} className="directions-map-expanded" />
      </section>
    </div>}
  </PageLayout>;
}
