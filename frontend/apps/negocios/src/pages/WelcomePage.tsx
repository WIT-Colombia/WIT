import { useNavigate } from "react-router-dom";
import { BusinessHeader } from "../components/layout/BusinessHeader";

export function WelcomePage() {
  const navigate = useNavigate();
  return <main className="auth-page welcome-page"><BusinessHeader /><section className="welcome-card surface-card"><span className="welcome-icon">✓</span><span className="page-eyebrow">CUENTA CREADA</span><h1>¡Bienvenido a WIT Negocios!</h1><p>Tu cuenta está lista. Ahora puedes crear tu primera tienda y comenzar a mostrar tus productos y servicios.</p><div className="welcome-actions"><button className="action-button" type="button" onClick={() => navigate("/mis-negocios/nuevo")}>＋ Crear mi primera tienda</button><button className="outline-button" type="button" onClick={() => navigate("/sin-negocio")}>Hacerlo más tarde</button></div></section></main>;
}
