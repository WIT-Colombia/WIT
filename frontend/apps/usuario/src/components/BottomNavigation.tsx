import { Link, useLocation } from "react-router-dom";
import { HeartIcon } from "./ActionIcons";
import "./BottomNavigation.css";

const items = [
  { to: "/home", label: "Inicio", icon: "home" },
  { to: "/favorites", label: "Favoritos", icon: "heart" },
  { to: "/profile", label: "Perfil", icon: "profile" },
];

function NavIcon({ name }: { name: string }) {
  if (name === "heart") return <HeartIcon />;
  if (name === "home") return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z"/><path d="M9 21v-6h6v6"/></svg>;
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="3.2"/><path d="M5.5 20a6.5 6.5 0 0 1 13 0"/></svg>;
}

export function BottomNavigation() {
  const { pathname } = useLocation();
  function isActive(path: string) {
    if (path === "/home") return pathname === "/home";
    if (path === "/favorites") return pathname === "/favorites";
    if (path === "/profile") return ["/profile", "/settings", "/notifications", "/reviews", "/account", "/change-password"].includes(pathname) || pathname.startsWith("/legal/");
    return false;
  }
  return <nav className="user-bottom-nav" aria-label="Navegación principal móvil">
    {items.map((item) => { const active = isActive(item.to); return <Link key={item.to} to={item.to} className={active ? "is-active" : undefined} aria-current={active ? "page" : undefined}><NavIcon name={item.icon}/>{item.label}</Link>; })}
  </nav>;
}
