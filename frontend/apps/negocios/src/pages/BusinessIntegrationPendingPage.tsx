import { useBusinessAuth } from "../services/businessAuthContext";

export function BusinessIntegrationPendingPage() {
  const { user, signOut } = useBusinessAuth();
  return <section className="empty-dashboard">
    <span className="page-eyebrow">SESIÓN CONECTADA</span>
    <h1>Hola, {user?.displayName ?? "usuario"}</h1>
    <p className="empty-dashboard-subtitle">Tu autenticación central funciona correctamente. La gestión de negocios reales se habilitará cuando estén disponibles sus endpoints de consulta y creación.</p>
    <button className="outline-button" type="button" onClick={() => void signOut()}>Cerrar sesión</button>
  </section>;
}
