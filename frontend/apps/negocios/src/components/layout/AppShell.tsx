import { Outlet, useLocation } from "react-router-dom";
import { MobileNavigation } from "./MobileNavigation";
import { Sidebar } from "./Sidebar";
import { useBusinessStore } from "../../services/businessStore";
export function AppShell() { const location = useLocation(); const { businesses } = useBusinessStore(); const emptyAccount = businesses.length === 0 || (location.pathname === "/perfil" && new URLSearchParams(location.search).get("empty") === "1"); return <div className="business-app"><div className="app-content"><div className="body-layout"><Sidebar empty={emptyAccount} /><main className="page-content"><Outlet /></main></div></div><MobileNavigation /></div>; }
