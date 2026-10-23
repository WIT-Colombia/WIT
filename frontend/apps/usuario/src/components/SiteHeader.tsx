import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useLocationContext } from "../context/LocationContext";
import { useAuth } from "../context/AuthContext";
import { useAccountAvatar } from "../hooks/useAccountAvatar";
import { getNotifications, getProfile } from "../services/userDataService";
import xamukoLogo from "../assets/XAMUKO-V1-transparent.png";
import { SearchBar } from "./SearchBar";
import "./SiteHeader.css";

export type SiteSection = "home" | "explore";

function PinIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" fill="currentColor"/><circle cx="12" cy="10" r="3" fill="white"/></svg>;
}

function HeaderBellIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" fill="currentColor"/><path d="M10 21h4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>;
}

function UserIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="3.25"/><path d="M5.5 20a6.5 6.5 0 0 1 13 0"/></svg>;
}

export function SiteHeader({ active, onProfile, onSearchChange }: { active?: SiteSection; onProfile?: () => void; onSearchChange?: (value: string) => void }) {
  const routeLocation = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { selection } = useLocationContext();
  const location = selection?.locality ?? null;
  const { user, isAuthenticated } = useAuth();
  const profile = getProfile(user?.id);
  const accountAvatar = useAccountAvatar(user?.avatarUrl);
  const profileName = user?.displayName.trim() || profile.name.trim() || "";
  const profileInitial = profileName.charAt(0).toLocaleUpperCase("es-CO") || "D";
  const profilePhoto = (accountAvatar ?? profile.photo) || "";
  const profileTarget = isAuthenticated ? "/profile" : "/register?mode=login";
  const unreadNotifications = getNotifications().filter((item) => !item.read).length;
  const profileContent = isAuthenticated
    ? profilePhoto ? <img src={profilePhoto} alt={`Foto de ${profileName}`} /> : profileInitial
    : <UserIcon />;
  const isResultsPage = routeLocation.pathname === "/results";
  const resultsQuery = searchParams.get("q") ?? "";

  function handleSearchChange(value: string) {
    if (!isResultsPage) {
      onSearchChange?.(value);
      return;
    }
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("category");
      if (value.trim()) next.set("q", value.trim());
      else next.delete("q");
      return next;
    });
  }

  function submitSearch(value: string) {
    if (!isResultsPage) navigate(`/results${value.trim() ? `?q=${encodeURIComponent(value.trim())}` : ""}`);
  }

  return <header className="site-header">
    <Link className="brand" to="/home" aria-label="XAMUKO, inicio"><img className="brand-logo" src={xamukoLogo} alt="XAMUKO · Descubre · Apoya · Disfruta" /></Link>
    <div className="site-header-search"><SearchBar inputId={isResultsPage ? "results-header-search" : "site-header-search"} hideSubmit initialValue={isResultsPage ? resultsQuery : ""} onSearch={handleSearchChange} onSubmitSearch={submitSearch} /></div>
    <nav className="desktop-nav" aria-label="Navegación principal">
      <Link className={active === "home" ? "active" : undefined} to="/home">Inicio</Link>
    </nav>
    <Link className="location-pill" to="/location"><PinIcon /><span><b>{location?.name ?? (selection?.mode === "automatic" ? "Tu ubicación actual" : "Elige una zona")}</b>{location?.context && <small>{location.context}</small>}</span><span className="chevron" aria-hidden="true">⌄</span></Link>
    {isAuthenticated && <Link className="notification-button" to="/notifications" aria-label={unreadNotifications ? `Notificaciones, ${unreadNotifications} pendientes` : "Notificaciones"}><HeaderBellIcon />{unreadNotifications > 0 && <span className="notification-badge" aria-label={`${unreadNotifications} pendientes`}>{unreadNotifications > 9 ? "9+" : unreadNotifications}</span>}</Link>}
    {onProfile ? <button className="profile-button" type="button" aria-label={isAuthenticated ? "Perfil" : "Iniciar sesión"} onClick={onProfile}>{profileContent}</button> : <Link className="profile-button" to={profileTarget} aria-label={isAuthenticated ? "Perfil" : "Iniciar sesión"}>{profileContent}</Link>}
  </header>;
}
