import { Navigate, Outlet, useLocation } from "react-router-dom";
import { MobileNavigation } from "./MobileNavigation";
import { Sidebar } from "./Sidebar";
import { BusinessDesktopHeader } from "./BusinessDesktopHeader";
import "./BusinessShell.css";
import { useBusinessStore } from "../../services/businessStore";
import { useBusinessAuth } from "../../services/businessAuthContext";
import { BusinessApiError } from "../../services/businessApiClient";
import type { ReactNode } from "react";

export function AppShell({ demoMode = false }: { demoMode?: boolean }) {
  const location = useLocation();
  const { businesses, businessesReady } = useBusinessStore();
  const auth = useBusinessAuth();
  const emptyAccount = businesses.length === 0 || (location.pathname === "/perfil" && new URLSearchParams(location.search).get("empty") === "1");
  const renderLayout = (content: ReactNode) => <div className="business-app"><div className="app-content"><div className="body-layout"><Sidebar empty={emptyAccount} /><div className="business-shell-workspace"><BusinessDesktopHeader /><main className="page-content">{content}</main><footer className="business-institutional-footer"><div><strong>XAMUKO</strong><span>Lo que necesitas, está más cerca.</span></div><small>© 2026 XAMUKO · Palmira, Colombia</small></footer></div></div></div><MobileNavigation /></div>;
  if (demoMode) return renderLayout(<Outlet />);
  if (auth.state.status === "unchecked") return <main className="auth-page"><p className="auth-status">Comprobando tu sesión…</p></main>;
  if (auth.state.status === "unauthenticated") return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  if (auth.state.status === "error") {
    const problem = auth.state.error;
    const rateLimited = problem instanceof BusinessApiError && problem.status === 429;
    const waitSeconds = rateLimited ? problem.retryAfterSeconds : undefined;
    return <main className="auth-page"><section className="auth-status-card" role="alert">
      <strong>{rateLimited ? "La renovación de sesión está temporalmente limitada." : "No pudimos conectar con XAMUKO."}</strong>
      <p>{rateLimited
        ? `Tu sesión podría seguir activa. ${waitSeconds ? `Espera aproximadamente ${Math.ceil(waitSeconds / 60)} minuto(s)` : "Espera unos minutos"} antes de reintentar. No necesitas volver a ingresar tu contraseña.`
        : problem instanceof BusinessApiError && problem.status === 403 ? "La solicitud de sesión fue rechazada. Comprueba la configuración del dominio de acceso." : "Comprueba tu conexión e intenta nuevamente."}</p>
      <button className="action-button" type="button" onClick={() => void auth.refresh()}>Reintentar</button>
    </section></main>;
  }
  if (!businessesReady) return renderLayout(<main className="auth-status" aria-live="polite">Cargando tus negocios…</main>);
  if (location.pathname === "/") return <Navigate to="/mis-negocios" replace />;
  if (businesses.length === 0 && (location.pathname === "/mi-negocio" || location.pathname.startsWith("/mi-negocio/"))) return <Navigate to="/mis-negocios" replace />;
  // Todas las rutas privadas declaradas en App.tsx comparten este layout.
  // Antes se filtraban aquí las rutas que no pertenecían al flujo de negocios
  // y se mostraba una pantalla de integración que ofrecía cerrar sesión. Eso
  // hacía que navegar desde el sidebar pareciera un logout y ocultaba las
  // páginas existentes de catálogo, opiniones, estadísticas y configuración.
  return renderLayout(<Outlet />);
}
