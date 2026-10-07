import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { SidebarIcon, type SidebarIconName } from "./Sidebar";
import { useBusinessStore } from "../../services/businessStore";

type MobileLink = { label: string; icon: SidebarIconName; to: string; end?: boolean };
const primaryLinks: MobileLink[] = [
  { label: "Inicio", icon: "home", to: "/", end: true },
  { label: "Mi negocio", icon: "store", to: "/mi-negocio" },
  { label: "Productos", icon: "box", to: "/productos" },
  { label: "Opiniones", icon: "star", to: "/opiniones" },
];
const moreLinks: MobileLink[] = [
  { label: "Servicios", icon: "tag", to: "/servicios" },
  { label: "Estadísticas", icon: "chart", to: "/estadisticas" },
  { label: "Notificaciones", icon: "bell", to: "/notificaciones" },
  { label: "Configuración", icon: "settings", to: "/configuracion" },
  { label: "Mi cuenta", icon: "settings", to: "/perfil" },
];

export function MobileNavigation() {
  const { businesses, business, account, notifications, setBusiness } = useBusinessStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);
  const [businessesOpen, setBusinessesOpen] = useState(false);
  const businessWrapRef = useRef<HTMLDivElement>(null);
  const empty = businesses.length === 0;
  const unread = notifications.filter((item) => !item.read).length;
  const destination = (link: MobileLink) => empty && link.label !== "Mi cuenta" ? "/sin-negocio" : link.label === "Mi cuenta" && empty ? "/perfil?empty=1" : link.to;
  useEffect(() => setMoreOpen(false), [location.pathname]);
  useEffect(() => {
    if (!businessesOpen) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!businessWrapRef.current?.contains(event.target as Node)) setBusinessesOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePress);
  }, [businessesOpen]);
  const renderLink = (link: MobileLink, compact = false) => link.label === "Mi cuenta" ? <NavLink key={link.label} to={destination(link)} className={({ isActive }) => `mobile-link ${compact ? "mobile-more-link mobile-account-link" : ""} ${isActive ? "active" : ""}`}><span className="mobile-account-avatar">{account.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><span className="mobile-account-copy"><strong>{account.name}</strong><small>Mi cuenta</small></span></NavLink> : <NavLink key={link.label} to={destination(link)} end={link.end} className={({ isActive }) => `mobile-link ${compact ? "mobile-more-link" : ""} ${isActive ? "active" : ""}`}><span className="mobile-link-icon" aria-hidden="true"><SidebarIcon name={link.icon} />{link.label === "Notificaciones" && unread > 0 && !compact && <span className="mobile-notification-dot">{unread}</span>}</span><span className="mobile-link-label">{link.label}</span>{link.label === "Notificaciones" && unread > 0 && compact && <span className="mobile-menu-count">{unread}</span>}</NavLink>;
  const activeBusiness = empty ? undefined : (business ?? businesses[0]);
  return <>
    <header className="mobile-topbar">
      <button type="button" className="mobile-menu-button" aria-label={moreOpen ? "Cerrar menú" : "Abrir menú"} aria-expanded={moreOpen} onClick={() => { setMoreOpen((value) => !value); setBusinessesOpen(false); }}><span /><span /><span /></button>
      <div className="mobile-business-wrap" ref={businessWrapRef}>
        <button type="button" className={`mobile-business-picker${businessesOpen ? " active" : ""}`} onClick={() => { setBusinessesOpen((value) => !value); setMoreOpen(false); }} aria-expanded={businessesOpen}>
          <span className="mobile-business-avatar">{activeBusiness?.coverImage ? <img src={activeBusiness.coverImage} alt="" /> : activeBusiness?.name?.charAt(0) ?? "W"}</span>
          <span className="mobile-business-copy"><strong>{activeBusiness?.name ?? "Crea tu negocio"}</strong><small>{activeBusiness ? `${activeBusiness.category} · ${activeBusiness.city}` : "Empieza en WIT Negocios"}</small></span><span className="mobile-business-chevron">⌄</span>
        </button>
        {businessesOpen && activeBusiness && <div className="mobile-business-menu">{businesses.map((item, index) => <button type="button" key={`${item.name}-${index}`} className={`mobile-business-option${item === activeBusiness ? " selected" : ""}`} onClick={() => { setBusiness(item); setBusinessesOpen(false); navigate("/"); }}><span className="mobile-business-avatar">{item.coverImage ? <img src={item.coverImage} alt="" /> : item.name.charAt(0)}</span><span className="mobile-business-copy"><strong>{item.name}</strong><small>{item.category} · {item.city}</small></span><span>{item === activeBusiness ? "✓" : ""}</span></button>)}<button type="button" className="mobile-business-all" onClick={() => { setBusinessesOpen(false); navigate("/mis-negocios"); }}><SidebarIcon name="store" /><span>Mis negocios</span></button></div>}
      </div>
      <NavLink className="mobile-notification-button" to={empty ? "/sin-negocio" : "/notificaciones"} aria-label="Notificaciones"><SidebarIcon name="bell" />{!empty && unread > 0 && <span className="mobile-topbar-dot">{unread}</span>}</NavLink>
    </header>
    <nav className={`mobile-nav${moreOpen ? " is-open" : ""}`} aria-label="Navegación principal móvil">
      {moreOpen && <div className="mobile-more-panel"><div className="mobile-more-header"><div><strong>Menú</strong><small>Todo lo que necesitas para gestionar tu negocio</small></div><button type="button" className="mobile-more-close" aria-label="Cerrar menú" onClick={() => setMoreOpen(false)}>×</button></div><div className="mobile-more-list">{moreLinks.map((link) => renderLink(link, true))}</div></div>}
      <div className="mobile-nav-scroll">{primaryLinks.map((link) => renderLink(link))}</div>
    </nav>
  </>;
}
