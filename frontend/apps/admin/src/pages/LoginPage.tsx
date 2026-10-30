import { Navigate, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import xamukoLogo from '../assets/xamuko-logo.png';
import { authenticateWithPasskey, getSession, startGoogleLogin } from '../services/adminService';

export function LoginPage() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (getSession()) return <Navigate to="/dashboard" replace />;
  async function passkey() { setBusy(true); setError(''); try { await authenticateWithPasskey(); navigate('/dashboard', { replace: true }); } catch (reason) { setError(reason instanceof Error ? reason.message : 'No pudimos verificar la passkey.'); } finally { setBusy(false); } }
  useEffect(() => { void passkey(); }, []);
  return <main className="login-page admin-login"><section className="admin-login-form-wrap"><div className="admin-login-form">
    <div className="admin-login-form-brand"><img src={xamukoLogo} alt="XAMUKO" /><span>ADMIN</span></div>
    <header><h2>Acceso seguro a XAMUKO Admin</h2><p>Primero autoriza Google y después confirma Face ID, Touch ID o tu llave de seguridad.</p></header>
    <button className="admin-login-submit" type="button" onClick={startGoogleLogin} disabled={busy}>Continuar con Google</button>
    <button className="admin-login-submit" type="button" onClick={() => void passkey()} disabled={busy}>{busy ? 'Verificando passkey…' : 'Verificar passkey'}</button>
    {error && <p role="alert" className="admin-login-error">{error}</p>}
    <p className="admin-login-access">Solo la identidad Google autorizada y una passkey registrada pueden acceder.</p>
  </div></section></main>;
}
