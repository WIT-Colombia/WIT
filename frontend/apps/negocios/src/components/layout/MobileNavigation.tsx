import { NavLink } from "react-router-dom";
const links = [["Inicio", "⌂", "/"], ["Mis negocios", "▣", "/mi-negocio"], ["Productos", "□", "/productos"], ["Más", "☰", "/mas"]];
export function MobileNavigation() { return <nav className="mobile-nav" aria-label="Navegación móvil">{links.map(([label, icon, to]) => <NavLink key={to} to={to} className={({ isActive }) => `mobile-link ${isActive ? "active" : ""}`}><span>{icon}</span>{label}</NavLink>)}</nav>; }
