import { Navigate } from 'react-router-dom';
import xamukoLogo from '../assets/xamuko-logo.png';
import { getSession, startGoogleLogin } from '../services/adminService';

export function LoginPage() {
  if (getSession()) return <Navigate to="/dashboard" replace />;
  return <main className="login-page admin-login"><section className="admin-login-form-wrap"><div className="admin-login-form">
    <div className="admin-login-form-brand"><img src={xamukoLogo} alt="XAMUKO" /><span>ADMIN</span></div>
    <header><h2>Acceso seguro a XAMUKO Admin</h2><p>Usa tu cuenta Google autorizada y completa el segundo factor.</p></header>
    <button className="admin-login-submit" type="button" onClick={startGoogleLogin}>Continuar con Google</button>
    <p className="admin-login-access">El acceso administrativo requiere una identidad Google incluida explícitamente en la lista de acceso y una passkey WebAuthn registrada.</p>
  </div></section></main>;
}
