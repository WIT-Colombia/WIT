import { Link } from "react-router-dom";
import { Logo } from "@wit/ui";
import { getSelectedLocation } from "../services/locationService";
import { useAuth } from "../context/AuthContext";
import "./SiteHeader.css";

export type SiteSection = "home" | "explore";

function PinIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>;
}

function UserIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="3.25"/><path d="M5.5 20a6.5 6.5 0 0 1 13 0"/></svg>;
}

export function SiteHeader({ active, onProfile }: { active?: SiteSection; onProfile?: () => void }) {
  const location = getSelectedLocation();
  const { user, isAuthenticated } = useAuth();
  const profileInitial = user?.displayName.trim().charAt(0).toLocaleUpperCase("es-CO") || "D";
  const profileTarget = isAuthenticated ? "/profile" : "/register?mode=login";
  const profileContent = isAuthenticated
    ? user?.avatarUrl ? <img src={user.avatarUrl} alt="" /> : profileInitial
    : <UserIcon />;

  return <header className="site-header">
    <Link className="brand" to="/home" aria-label="WIT, inicio"><Logo /><span>Encuentra cerca de ti</span></Link>
    <nav className="desktop-nav" aria-label="Navegación principal">
      <Link className={active === "home" ? "active" : undefined} to="/home">Inicio</Link>
      <Link className={active === "explore" ? "active" : undefined} to="/search">Buscar</Link>
    </nav>
    <Link className="location-pill" to="/location"><PinIcon /><span><small>Buscando en</small>{location?.name ?? "Palmira, Valle"}</span><span className="chevron">⌄</span></Link>
    {onProfile ? <button className="profile-button" type="button" aria-label={isAuthenticated ? "Perfil" : "Iniciar sesión"} onClick={onProfile}>{profileContent}</button> : <Link className="profile-button" to={profileTarget} aria-label={isAuthenticated ? "Perfil" : "Iniciar sesión"}>{profileContent}</Link>}
  </header>;
}
