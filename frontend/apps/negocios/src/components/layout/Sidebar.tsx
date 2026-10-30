import xamukoLogo from "../../assets/XAMUKO-V1-transparent.avif";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useBusinessAuth } from "../../services/businessAuthContext";
import { useBusinessStore } from "../../services/businessStore";
import { formatCategoryName, visibleBusinessStatus } from "../../services/realBusinessAdapter";
import type { BusinessDetails } from "../../types/business";
import { PersistedPhoto } from "../common/PersistedPhoto";
import { BusinessProBenefitsDialog } from "../business/BusinessProBenefitsDialog";
import { businessApi } from "../../services/businessApiClient";
import { getAvatarBlob } from "../../services/businessAuthService";
export type SidebarIconName = "home" | "store" | "box" | "tag" | "star" | "chart" | "bell" | "settings" | "logout" | "offers" | "users" | "help" | "support" | "message" | "crown" | "handshake";
const iconPaths: any = { crown: "M3 6 7 10l5-6 5 6 4-4-3 13H6L3 6ZM7 22h10", offers: "M3 8 8 3h6l7 7-11 11-7-7V8ZM8 8h.01M12 4l8 8M5 15l4 4", users: "M16 21v-2a6 6 0 0 0-12 0v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM17 4a4 4 0 0 1 0 8M18 15a5 5 0 0 1 3 5", help: "M12 17h.01M9 9a3 3 0 1 1 5 2c-1 1-2 1-2 3M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z", support: "M4 14v-3a8 8 0 0 1 16 0v3M4 12H2v7h5v-7H4Zm16 0h2v7h-5v-7h3ZM20 19c0 3-4 3-7 3", message: "M4 3h16v14H9l-5 4V3Zm4 8 3-4 3 6 3-4", home: "M3 10.5 12 3l9 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 19.5v-9Zm5.5 10v-6h7v6", store: "M4 9h16l-1.2-5H5.2L4 9Zm1 0v10h14V9M8 13h8M3 9h18", box: "m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Zm0 0v9m8-4.5-8 4.5m-8-4.5 8 4.5", tag: "m20.5 13.5-7 7a2 2 0 0 1-2.8 0l-8.2-8.2V4h8.3l8.2 8.2a2 2 0 0 1 0 1.3ZM7.5 7.5h.01", star: "m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z", chart: "M4 20V10m5 10V6m5 14v-8m5 8V3M2 20h20", bell: "M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4", settings: "M12 3.5 13.4 5a7.8 7.8 0 0 1 2.1.9l2-.5 1.8 1.8-.5 2a7.8 7.8 0 0 1 .9 2.1l1.5 1.4v2.6l-1.5 1.4a7.8 7.8 0 0 1-.9 2.1l.5 2-1.8 1.8-2-.5a7.8 7.8 0 0 1-2.1.9L12 23l-2.4-1.4a7.8 7.8 0 0 1-2.1-.9l-2 .5-1.8-1.8.5-2a7.8 7.8 0 0 1-.9-2.1L1.8 14v-2.6l1.5-1.4a7.8 7.8 0 0 1 .9-2.1l-.5-2 1.8-1.8 2 .5a7.8 7.8 0 0 1 2.1-.9L12 3.5Zm0 5.2a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z", logout: "M10 17l5-5-5-5m5 5H3m9-9h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7" };
export function SidebarIcon({ name }: { name: SidebarIconName }) { const path = name === "handshake" ? "M7 11 4 8l3-3 5 4 5-4 3 3-3 3m-10 0-3 3 4 4 3-3m6-4 3 3-4 4-3-3m-1 3 2 2 3-3" : iconPaths[name]; return <svg className="sidebar-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={path} /></svg>; }
export const formatSedeLabel = (sede?: string | null) => { const value = sede?.trim() ?? ""; return value ? (/^sede\b/i.test(value) ? value : `Sede ${value}`) : ""; };
export const businessSelectorMeta = (item: { sede?: string | null; category: string; city: string }) => [formatSedeLabel(item.sede), formatCategoryName(item.category), item.city].filter(Boolean).join(" · ");
export function BusinessCoverThumbnail({ business }: { business: Pick<BusinessDetails, "name" | "coverImage"> }) {
  return <><span className="business-selector-cover-fallback" aria-hidden="true">{business.name.charAt(0)}</span>{business.coverImage && <PersistedPhoto src={business.coverImage} alt="" className="business-selector-cover-photo" />}</>;
}
export function BusinessProfileThumbnail({ business }: { business: Pick<BusinessDetails, "name" | "profileImage"> }) {
  return business.profileImage ? <PersistedPhoto src={business.profileImage} alt="" className="business-selector-profile-photo" /> : <span className="business-selector-cover-fallback" aria-hidden="true">{business.name.charAt(0)}</span>;
}
export function BusinessIndicatorRow({ business }: { business: Pick<BusinessDetails, "adultOnly" | "deletionStatus" | "verificationStatus" | "status"> }) { const status = visibleBusinessStatus(business); if (!status && business.adultOnly !== true) return null; return <span className="business-indicator-row" aria-label="Estados del establecimiento">{status === "Eliminado" ? <em className="business-state-badge deleted">Eliminado</em> : status === "Verificado" ? <em className="business-state-badge verified">✓ Verificado</em> : null}{status !== "Eliminado" && business.adultOnly === true && <em className="business-adult-indicator">+18</em>}</span>; }
export function Sidebar({ empty = false, onNavigate }: { empty?: boolean; onNavigate?: () => void }) {
  const { business, notifications, persistentNotificationCount, account } = useBusinessStore();
  const { user } = useBusinessAuth();
  const location = useLocation();
  const demoPro = new URLSearchParams(location.search).get("demoPro") === "1";
  const [notice, setNotice] = useState<"pro" | null>(null);
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);
  const [isPro, setIsPro] = useState(false);
  const unread = notifications.filter(item => !item.read).length + persistentNotificationCount;
  useEffect(() => {
    let active = true;
    if (business.source !== "real" || !business.id) { setIsPro(false); return () => { active = false; }; }
    businessApi.getCatalogLimits(business.id).then(limits => { if (active) setIsPro(demoPro || limits.plan === "PRO"); }).catch(() => { if (active) setIsPro(false); });
    return () => { active = false; };
  }, [business.id, business.source, demoPro]);
  useEffect(() => { let objectUrl: string | null = null; if (!user?.avatarUrl) { setAvatarSrc(null); return; } if (!user.avatarUrl.startsWith("/api/v1/auth/me/avatar")) { setAvatarSrc(user.avatarUrl); return; } void getAvatarBlob(user.avatarUrl).then(blob => { objectUrl = URL.createObjectURL(blob); setAvatarSrc(objectUrl); }).catch(() => setAvatarSrc(null)); return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); }; }, [user?.avatarUrl]);
  const displayName = user?.displayName || (business.source === "real" ? "" : account.name);
  const initials = displayName.split(" ").map(part => part[0]).slice(0, 2).join("");
  const collaborators = location.pathname === "/colaboradores" || new URLSearchParams(location.search).get("section") === "collaborators";
  const collaboratorsPath = empty ? "/mis-negocios" : "/colaboradores";
  const isCollaborator = business.source === "real" && business.role === "Colaborador";
  const entries: Array<{ label: string; icon: SidebarIconName; to: string; permission?: string; ownerOnly?: boolean }> = [
    { label: "Inicio", icon: "home", to: "/" },
    { label: "Mi negocio", icon: "store", to: "/mi-negocio", permission: "EDIT_BUSINESS" },
    { label: "Productos", icon: "box", to: "/productos", permission: "MANAGE_CATALOG" },
    { label: "Servicios", icon: "tag", to: "/servicios", permission: "MANAGE_CATALOG" },
    { label: "Ofertas y promociones", icon: "offers", to: "/ofertas", permission: "MANAGE_PROMOTIONS" },
    { label: "Opiniones", icon: "star", to: "/opiniones", ownerOnly: true },
    { label: "Estadísticas", icon: "chart", to: "/estadisticas", permission: "READ_ANALYTICS" },
    { label: "Colaboradores", icon: "users", to: collaboratorsPath, ownerOnly: true },
    { label: "Mi colaboración", icon: "handshake", to: "/mi-colaboracion" },
    { label: "Configuración", icon: "settings", to: "/configuracion", ownerOnly: true },
  ];
  const visibleEntries = entries.filter(entry => entry.label === "Mi colaboración" ? isCollaborator : business.role === "Propietario" || (!entry.ownerOnly && (!entry.permission || business.permissions?.includes(entry.permission))));
  return <aside className="sidebar business-shell-sidebar">
    <Link className="sidebar-brand" to="/" aria-label="XAMUKO Business, inicio" onClick={onNavigate}><span className="sidebar-brand-artwork"><img src={xamukoLogo} alt="XAMUKO" /><img className="sidebar-brand-wordmark" src={xamukoLogo} alt="" aria-hidden="true" /></span><span>BUSINESS{isPro && <em className="business-pro-badge">PRO</em>}</span></Link>
    <nav aria-label="Navegación principal" className="sidebar-nav">{visibleEntries.map(entry => <NavLink key={entry.label} to={entry.to} end={entry.to === "/"} onClick={onNavigate} className={({ isActive }) => `nav-link${(entry.label === "Colaboradores" ? collaborators && !empty : entry.label === "Mi negocio" ? !collaborators && location.pathname.startsWith("/mi-negocio") : isActive) ? " active" : ""}`}><SidebarIcon name={entry.icon} /><span>{entry.label}</span>{entry.label === "Notificaciones" && unread > 0 && <span className="notification-dot">{unread}</span>}</NavLink>)}</nav>
    {!isPro && <section className="sidebar-pro-card"><div><span className="sidebar-pro-icon" aria-hidden="true"><SidebarIcon name="crown" /></span><strong><em>XAMUKO</em>Business Pro</strong></div><p>Haz crecer tu negocio con herramientas exclusivas.</p><button type="button" onClick={() => setNotice("pro")}>Conocer beneficios</button></section>}
    <nav aria-label="Ayuda y soporte" className="sidebar-support"><Link to="/ayuda" onClick={onNavigate}><SidebarIcon name="help" />Centro de ayuda</Link><Link to="/ayuda" onClick={onNavigate}><SidebarIcon name="support" />Soporte técnico</Link><Link to="/ayuda" onClick={onNavigate}><SidebarIcon name="message" />Sugerencias</Link></nav>
    <Link className="sidebar-account-link" to={empty ? "/perfil?empty=1" : "/perfil"} onClick={onNavigate}><span className="sidebar-account-avatar">{avatarSrc ? <img src={avatarSrc} alt="" /> : initials}</span><span><strong>{displayName}</strong><small>Mi cuenta</small></span><span className="sidebar-account-arrow">›</span></Link>
    {notice === "pro" && <BusinessProBenefitsDialog onClose={() => setNotice(null)} />}
  </aside>;
}

export function BusinessAvailabilityDialog({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null; closeRef.current?.focus(); const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { event.stopImmediatePropagation(); onClose(); } if (event.key === "Tab") { event.preventDefault(); closeRef.current?.focus(); } }; document.addEventListener("keydown", escape); return () => { document.removeEventListener("keydown", escape); previous?.focus(); }; }, [onClose]);
  return <div className="business-shell-notice-overlay" onClick={event => { if (event.target === event.currentTarget) onClose(); }}><section className="business-shell-notice" role="dialog" aria-modal="true" aria-label={title}><span>PRÓXIMAMENTE</span><h2>{title}</h2><p>{children}</p><button ref={closeRef} className="action-button" type="button" onClick={onClose}>Entendido</button></section></div>;
}
