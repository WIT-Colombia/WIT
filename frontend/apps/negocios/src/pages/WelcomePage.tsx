import { useNavigate } from "react-router-dom";
import { BusinessHeader } from "../components/layout/BusinessHeader";

export function WelcomePage() {
  const navigate = useNavigate();
  return <main className="auth-page welcome-page"><BusinessHeader /><section className="welcome-card surface-card"><span className="welcome-icon">✓</span><span className="page-eyebrow">CUENTA CREADA</span><h1>¡Qué alegría tenerte en XAMUKO Business!</h1><p>Nos encanta que estés aquí. Este es el comienzo: cuando quieras, podrás crear tu primer negocio, compartir lo que te hace especial y conectar con más personas. ¡Estamos contigo en cada paso!</p><div className="welcome-actions"><button className="action-button" type="button" onClick={() => navigate("/mis-negocios/nuevo")}>Crear mi primer negocio</button><button className="outline-button" type="button" onClick={() => navigate("/sin-negocio")}>Hacerlo más tarde</button></div></section></main>;
}
