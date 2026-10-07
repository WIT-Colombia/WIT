import { Link, useLocation } from "react-router-dom";
import { HeartIcon } from "./ActionIcons";
import "./BottomNavigation.css";

const items = [
  { to: "/home", label: "Inicio", icon: "⌂" },
  { to: "/search", label: "Buscar", icon: "⌕" },
  { to: "/map", label: "Mapa", icon: "⌖" },
  { to: "/favorites", label: "Guardadas", icon: "heart" },
  { to: "/profile", label: "Perfil", icon: "◉" },
];

export function BottomNavigation() {
  const { pathname } = useLocation();
  function isActive(path: string) {
    if (path === "/home") return pathname === "/home";
    if (path === "/search") return ["/search", "/results"].includes(pathname) || pathname.startsWith("/business/") || pathname.startsWith("/product/") || pathname.startsWith("/service/") || pathname === "/directions";
    if (path === "/map") return pathname === "/map";
    if (path === "/favorites") return pathname === "/favorites";
    if (path === "/profile") return ["/profile", "/settings", "/notifications", "/reviews", "/account", "/change-password"].includes(pathname) || pathname.startsWith("/legal/");
    return false;
  }
  return <nav className="user-bottom-nav" aria-label="Navegación principal móvil">
    {items.map((item) => { const active = isActive(item.to); return <Link key={item.to} to={item.to} className={active ? "is-active" : undefined} aria-current={active ? "page" : undefined}>{item.icon === "heart" ? <HeartIcon/> : <span aria-hidden="true">{item.icon}</span>}{item.label}</Link>; })}
  </nav>;
}
