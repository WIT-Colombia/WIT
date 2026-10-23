import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useBusinessStore } from "../../services/businessStore";
import { BusinessProfileThumbnail, BusinessIndicatorRow, SidebarIcon, formatSedeLabel } from "./Sidebar";

export function BusinessDesktopHeader() {
  const { businesses, business, notifications, persistentNotificationCount, setBusiness } = useBusinessStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const available = businesses.map((item, index) => ({ item, index })).filter(({ item }) => item.deletionStatus !== "DELETED");
  const selected = available.find(({ item }) => item === business || Boolean(item.id && item.id === business.id))?.item ?? available[0]?.item;
  const titles: Record<string, string> = { "mi-negocio": "Mi negocio", "mis-negocios": "Mis negocios", productos: "Productos", servicios: "Servicios", ofertas: "Ofertas y promociones", opiniones: "Opiniones", estadisticas: "Estadísticas", notificaciones: "Notificaciones", colaboradores: "Colaboradores", configuracion: "Configuración", perfil: "Mi cuenta", ayuda: "Centro de ayuda", mas: "Menú" };
  const title = new URLSearchParams(location.search).get("section") === "collaborators" ? "Colaboradores" : titles[location.pathname.split("/")[1]] ?? "Inicio";
  const unread = notifications.filter(item => !item.read).length + persistentNotificationCount;
  useEffect(() => { setOpen(false); }, [location.pathname, location.search]);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => { if (!wrapRef.current?.contains(event.target as Node)) setOpen(false); };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); triggerRef.current?.focus(); }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        const options = Array.from(wrapRef.current?.querySelectorAll<HTMLElement>(".desktop-business-option, .desktop-business-all") ?? []);
        if (!options.length) return;
        event.preventDefault();
        const index = options.indexOf(document.activeElement as HTMLElement);
        options[index < 0 ? (event.key === "ArrowDown" ? 0 : options.length - 1) : (index + (event.key === "ArrowDown" ? 1 : options.length - 1)) % options.length]?.focus();
      }
    };
    document.addEventListener("pointerdown", close);
    wrapRef.current?.addEventListener("keydown", keyboard);
    return () => { document.removeEventListener("pointerdown", close); wrapRef.current?.removeEventListener("keydown", keyboard); };
  }, [open]);
  return <header className="business-desktop-header"><nav className="business-breadcrumb" aria-label="Ruta actual"><span>{title}</span>{selected && title === "Mi negocio" && <><span aria-hidden="true">›</span><span>{selected.name}</span></>}</nav><div className="business-desktop-header-actions"><Link className="business-desktop-notifications" to="/notificaciones" aria-label={`Notificaciones${unread ? `, ${unread} sin leer` : ""}`}><SidebarIcon name="bell" />{unread > 0 && <span>{unread > 99 ? "99+" : unread}</span>}</Link><div className="desktop-business-wrap" ref={wrapRef}><button ref={triggerRef} className="desktop-business-trigger" type="button" aria-label={selected ? `Cambiar de negocio. ${selected.name}, ${selected.role}` : "Ir a Mis negocios"} aria-expanded={open} aria-controls="desktop-business-options" onClick={() => { if (!selected) navigate("/mis-negocios"); else setOpen(value => !value); }}><span className="desktop-business-avatar">{selected ? <BusinessProfileThumbnail business={selected} /> : <SidebarIcon name="store" />}</span><span className="desktop-business-copy"><strong>{selected?.name ?? "Mis negocios"}</strong><small>{selected?.role ?? "Crea tu primer negocio"}</small></span><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></button>{open && <div id="desktop-business-options" className="desktop-business-menu" aria-label="Selecciona un negocio">{available.map(({ item, index }) => <button key={item.id ?? index} type="button" className={`desktop-business-option${item === selected ? " selected" : ""}`} aria-current={item === selected ? "true" : undefined} onClick={() => { setBusiness(item); setOpen(false); navigate(item.role === "Propietario" || item.permissions?.includes("EDIT_BUSINESS") ? `/mi-negocio/detalle/${item.id ?? index}` : "/"); }}><span className="desktop-business-avatar"><BusinessProfileThumbnail business={item} /></span><span><strong>{item.name}</strong><small>{[formatSedeLabel(item.sede), item.role].filter(Boolean).join(" · ")}</small><BusinessIndicatorRow business={item} /></span><span className="desktop-business-check">{item === selected ? "✓" : ""}</span></button>)}<Link className="desktop-business-all" to="/mis-negocios" onClick={() => setOpen(false)}><SidebarIcon name="store" /><span>Mis negocios</span></Link></div>}</div></div></header>;
}
