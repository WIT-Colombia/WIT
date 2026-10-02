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
  return <nav className="user-bottom-nav" aria-label="Navegación principal móvil">
    {items.map((item) => <Link key={item.to} to={item.to} className={pathname === item.to ? "is-active" : ""} aria-current={pathname === item.to ? "page" : undefined}>{item.icon === "heart" ? <HeartIcon/> : <span aria-hidden="true">{item.icon}</span>}{item.label}</Link>)}
  </nav>;
}
