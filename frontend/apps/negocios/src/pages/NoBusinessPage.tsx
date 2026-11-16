import { Link, Navigate } from "react-router-dom";
import { Sidebar } from "../components/layout/Sidebar";
import { useBusinessStore } from "../services/businessStore";

export function NoBusinessPage() {
  const { account, businesses, businessesReady } = useBusinessStore();
  // This screen never clears application state: account data may already exist.
  if (businessesReady && businesses.length > 0) return <Navigate to="/inicio" replace />;
  const firstName = account.name.trim().split(" ")[0] || "";
  return <div className="business-app no-business-shell">
    <div className="app-content"><div className="body-layout"><Sidebar empty />
      <main className="page-content">
        <section className="empty-dashboard">
          <h1>¡Qué alegría tenerte en XAMUKO Business{firstName ? `, ${firstName}` : ""}!</h1>
          <p className="empty-dashboard-subtitle">Estamos aquí para acompañarte desde el primer paso.</p>
          <section className="welcome-card surface-card">
            <span className="page-eyebrow">TU PRIMER PASO</span>
            <h2>Tu historia en XAMUKO comienza aquí</h2>
            <p>Cuando quieras, registra tu primer negocio, comparte lo que lo hace especial y empieza a conectar con más personas. ¡Nos alegra acompañarte!</p>
            <div className="welcome-actions">
              <Link className="action-button" to="/mis-negocios/nuevo">Crear mi primer negocio</Link>
              <Link className="outline-button" to="/notificaciones">Ver mis notificaciones</Link>
            </div>
          </section>
        </section>
      </main>
    </div></div>
  </div>;
}
