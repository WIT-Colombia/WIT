import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { BusinessProfileThumbnail, BusinessIndicatorRow, Sidebar, SidebarIcon, formatSedeLabel, type SidebarIconName } from "./Sidebar";
import { useBusinessStore } from "../../services/businessStore";
import { formatCategoryName } from "../../services/realBusinessAdapter";

type MobileLink = { label: string; icon: SidebarIconName; to: string; end?: boolean };
const primaryLinks: MobileLink[] = [
  { label: "Inicio", icon: "home", to: "/", end: true },
  { label: "Mi negocio", icon: "store", to: "/mi-negocio" },
  { label: "Productos", icon: "box", to: "/productos" },
  { label: "Opiniones", icon: "star", to: "/opiniones" },
];
export function MobileNavigation() {
  const { businesses, business, notifications, setBusiness } = useBusinessStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);
  const [businessesOpen, setBusinessesOpen] = useState(false);
  const businessWrapRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!moreOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    drawerRef.current?.querySelector<HTMLButtonElement>(".business-mobile-close")?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (document.querySelector(".business-shell-notice")) return;
      if (event.key === "Escape") { setMoreOpen(false); menuTriggerRef.current?.focus(); }
      if (event.key === "Tab") {
        const options = Array.from(drawerRef.current?.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), summary") ?? []);
        const first = options[0]; const last = options[options.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener("keydown", keyboard);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", keyboard); };
  }, [moreOpen]);
  const selectableBusinesses = businesses.map((item, index) => ({ item, index })).filter(({ item }) => item.deletionStatus !== "DELETED");
  const empty = selectableBusinesses.length === 0;
  const unread = notifications.filter((item) => !item.read).length;
  const destination = (link: MobileLink) => link.label === "Mi cuenta" && empty ? "/perfil?empty=1" : link.to;
  const mobileBusinessMeta = (item: { sede?: string; category: string; city: string }) => formatSedeLabel(item.sede) ? `${formatSedeLabel(item.sede)} · ${item.city}` : `${formatCategoryName(item.category)} · ${item.city}`;
  useEffect(() => setMoreOpen(false), [location.pathname]);
  useEffect(() => {
    if (!businessesOpen) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!businessWrapRef.current?.contains(event.target as Node)) setBusinessesOpen(false);
    };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setBusinessesOpen(false); businessWrapRef.current?.querySelector<HTMLButtonElement>(".mobile-business-picker")?.focus(); }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        const options = Array.from(businessWrapRef.current?.querySelectorAll<HTMLButtonElement>(".mobile-business-option, .mobile-business-all") ?? []);
        if (!options.length) return;
        event.preventDefault();
        const current = options.indexOf(document.activeElement as HTMLButtonElement);
        const next = current < 0 ? (event.key === "ArrowDown" ? 0 : options.length - 1) : (current + (event.key === "ArrowDown" ? 1 : options.length - 1)) % options.length;
        options[next]?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    const wrap = businessWrapRef.current;
    wrap?.addEventListener("keydown", keyboard);
    return () => { document.removeEventListener("pointerdown", closeOnOutsidePress); wrap?.removeEventListener("keydown", keyboard); };
  }, [businessesOpen]);
  const renderLink = (link: MobileLink) => <NavLink key={link.label} to={destination(link)} end={link.end} className={({ isActive }) => `mobile-link ${isActive ? "active" : ""}`}><span className="mobile-link-icon" aria-hidden="true"><SidebarIcon name={link.icon} /></span><span className="mobile-link-label">{link.label}</span></NavLink>;
  const activeBusiness = empty ? undefined : ((business?.deletionStatus !== "DELETED" ? business : undefined) ?? selectableBusinesses[0]?.item);
  return <>
    <header className="mobile-topbar">
      <button ref={menuTriggerRef} type="button" className="mobile-menu-button" aria-label={moreOpen ? "Cerrar menú" : "Abrir menú"} aria-expanded={moreOpen} aria-controls="business-mobile-menu" onClick={() => { setMoreOpen((value) => !value); setBusinessesOpen(false); }}><span /><span /><span /></button>
      <div className="mobile-business-wrap" ref={businessWrapRef}>
        <button type="button" className={`mobile-business-picker${businessesOpen ? " active" : ""}`} onClick={() => { if (empty) { navigate("/mis-negocios"); return; } setBusinessesOpen((value) => !value); setMoreOpen(false); }} aria-expanded={businessesOpen} aria-label={empty ? "Ir a Mis negocios" : `Cambiar de negocio${activeBusiness?.deletionStatus === "RECOVERY" ? ". Eliminación pendiente" : ""}`}>
          <span className="mobile-business-avatar">{activeBusiness ? <BusinessProfileThumbnail business={activeBusiness} /> : "W"}</span>
          <span className="mobile-business-copy"><strong>{activeBusiness?.name ?? "Crea tu negocio"}</strong><small>{activeBusiness ? activeBusiness.role : "Empieza en XAMUKO Business"}</small>{activeBusiness && <BusinessIndicatorRow business={activeBusiness} />}</span><span className="mobile-business-chevron">⌄</span>
        </button>
        {businessesOpen && activeBusiness && <div className="mobile-business-menu">{selectableBusinesses.map(({ item, index }) => <button type="button" key={`${item.name}-${index}`} className={`mobile-business-option${item === activeBusiness ? " selected" : ""}`} onClick={() => { setBusiness(item); setBusinessesOpen(false); navigate(`/mi-negocio/detalle/${index}`); }}><span className="mobile-business-avatar"><BusinessProfileThumbnail business={item} /></span><span className="mobile-business-copy"><strong>{item.name}</strong><small>{[mobileBusinessMeta(item), item.role].filter(Boolean).join(" · ")}</small><BusinessIndicatorRow business={item} /></span><span>{item === activeBusiness ? "✓" : ""}</span></button>)}<button type="button" className="mobile-business-all" onClick={() => { setBusinessesOpen(false); navigate("/mis-negocios"); }}><SidebarIcon name="store" /><span>Mis negocios</span></button></div>}
      </div>
      <NavLink className="mobile-notification-button" to="/notificaciones" aria-label="Notificaciones"><SidebarIcon name="bell" />{unread > 0 && <span className="mobile-topbar-dot">{unread}</span>}</NavLink>
    </header>
    {moreOpen && <div className="business-mobile-menu-layer"><button className="business-mobile-scrim" type="button" tabIndex={-1} aria-label="Cerrar menú" onClick={() => setMoreOpen(false)} /><div ref={drawerRef} id="business-mobile-menu" className="business-mobile-drawer" role="dialog" aria-modal="true" aria-label="Menú principal"><div className="business-mobile-drawer-heading"><strong>Menú</strong><button type="button" className="business-mobile-close" aria-label="Cerrar menú" onClick={() => { setMoreOpen(false); menuTriggerRef.current?.focus(); }}><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button></div><Sidebar empty={empty} onNavigate={() => setMoreOpen(false)} /></div></div>}
    <nav className="mobile-nav" aria-label="Navegación principal móvil">
      <div className="mobile-nav-scroll">{primaryLinks.map((link) => renderLink(link))}</div>
    </nav>
  </>;
}
