import { Link, useNavigate } from "react-router-dom";
import { Button, Logo } from "@wit/ui";
import { businesses } from "../data/mockData";
import { HeartIcon } from "../components/ActionIcons";
import { getSelectedLocation } from "../services/locationService";
import "./Welcome.css";

function SearchIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/></svg>;
}

function PinIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>;
}

export default function Welcome() {
  const navigate = useNavigate();
  const featured = businesses[0];
  const selectedLocation = getSelectedLocation();

  return <main className="welcome-page">
    <header className="welcome-header">
      <Link className="welcome-brand" to="/home" aria-label="WIT, inicio"><Logo /><span>Encuentra cerca de ti</span></Link>
      <a className="welcome-skip" href="/home">Entrar a explorar <span aria-hidden="true">↗</span></a>
    </header>

    <section className="welcome-hero" aria-labelledby="welcome-title">
      <div className="welcome-copy">
        <span className="welcome-eyebrow"><i /> HAY MUCHO POR DESCUBRIR</span>
        <h1 id="welcome-title">¿Qué estás<br /><em>buscando hoy?</em></h1>
        <p>Explora negocios, productos y servicios de tu zona. Cuando encuentres lo que buscas, contacta directamente al negocio.</p>
        <div className="welcome-actions">
          <Button type="button" onClick={() => navigate("/location")}>Vamos a empezar <span aria-hidden="true">→</span></Button>
          <button className="welcome-text-action" type="button" onClick={() => navigate("/home")}>Explorar ahora</button>
        </div>
        <Link className="welcome-trust" to="/location/manual" aria-label={`Cambiar zona${selectedLocation ? ` actual: ${selectedLocation.name}` : " de búsqueda"}`}>
          <span className="welcome-trust__icon"><PinIcon /></span>
          <span className="welcome-trust__copy"><b>Tu zona, tu punto de partida</b><small>{selectedLocation ? `Ahora: ${selectedLocation.name}, ${selectedLocation.context}` : "Elige dónde quieres buscar y empecemos."}</small></span>
          <span className="welcome-trust__edit">{selectedLocation ? "Cambiar" : "Elegir zona"}<span aria-hidden="true">↗</span></span>
        </Link>
      </div>

      <div className="welcome-visual" aria-label="Ejemplo de un negocio que puedes descubrir en WIT">
        <div className="welcome-visual__orb" />
        <div className="welcome-search-card"><span><SearchIcon /></span><span>¿Qué estás buscando?</span><i /></div>
        <div className="welcome-result-card">
          <img src={featured.image} alt="Comida local de La Arepería de Majo" />
          <div className="welcome-result-card__details"><span>RESTAURANTE · PALMIRA</span><b>La Arepería de Majo</b><small><span className="welcome-star">★</span> 4.8 <i /> A 0.4 km</small></div>
          <span className="welcome-result-card__heart" aria-hidden="true"><HeartIcon/></span>
        </div>
        <div className="welcome-nearby-card"><span className="welcome-nearby-card__pin"><PinIcon /></span><span><b>Algo bueno</b><small>te espera cerca</small></span><span className="welcome-nearby-card__dot" /></div>
        <div className="welcome-visual__caption"><span>W</span><span>BUSCA <i /> DESCUBRE <i /> CONECTA</span></div>
      </div>
    </section>

    <footer className="welcome-footer"><span>WIT <i /> Encuentra lo que necesitas cerca de ti.</span><span>PALMIRA · VALLE DEL CAUCA</span></footer>
  </main>;
}
