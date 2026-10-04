import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sidebar } from "../components/layout/Sidebar";
import { useBusinessStore } from "../services/businessStore";

export function NoBusinessPage() {
  const navigate = useNavigate();
  const { account, setBusinesses, setItems } = useBusinessStore();
  const firstName = account.name.split(" ")[0] || "nuevo usuario";
  useEffect(() => { setBusinesses([]); setItems([]); }, [setBusinesses, setItems]);
  return <div className="business-app no-business-shell"><div className="app-content"><div className="body-layout"><Sidebar empty /><main className="page-content"><section className="empty-dashboard"><h1>Buenos días, {firstName} <span aria-hidden="true">👋</span></h1><p className="empty-dashboard-subtitle">Aquí aparecerá el resumen de tu negocio cuando crees tu primera tienda.</p><section className="welcome-card surface-card"><span className="page-eyebrow">PRIMERA TIENDA</span><h2>Aún no tienes negocios creados</h2><p>Configura tu primera tienda para comenzar a mostrar tus productos, servicios y opiniones en WIT.</p><button className="action-button" type="button" onClick={() => navigate("/mis-negocios/nuevo")}>＋ Crear mi primera tienda</button></section></section></main></div></div></div>;
}
