import { Navigate, useNavigate } from 'react-router-dom';
import { useEffect, useState, type FormEvent } from 'react';
import xamukoLogo from '../assets/xamuko-logo.png';
import { authenticateWithPasskey, startGoogleLogin } from '../services/adminService';
import { beginAdminPasskeyActivation, finishAdminPasskeyActivation } from '../services/adminApiClient';
import { getSession } from '../services/adminService';

export function LoginPage() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [activationBusy, setActivationBusy] = useState(false);
  const [activationCode, setActivationCode] = useState('');
  const [error, setError] = useState('');
  const [activationMessage, setActivationMessage] = useState('');
  if (getSession()) return <Navigate to="/dashboard" replace />;
  async function passkey() { setBusy(true); setError(''); try { await authenticateWithPasskey(); navigate('/dashboard', { replace: true }); } catch (reason) { setError(reason instanceof Error ? reason.message : 'No pudimos verificar la passkey.'); } finally { setBusy(false); } }
  async function activate(event: FormEvent) {
    event.preventDefault(); setActivationBusy(true); setError(''); setActivationMessage('');
    try {
      if (!activationCode) throw new Error('Escribe el código de activación.');
      const options = await beginAdminPasskeyActivation(activationCode);
      const credential = await navigator.credentials.create({ publicKey: options }) as PublicKeyCredential | null;
      if (!credential) throw new Error('El registro de passkey fue cancelado.');
      await finishAdminPasskeyActivation(activationCode, credential);
      setActivationMessage('Passkey registrada. Ya puedes verificarla para acceder.');
      setActivationCode('');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo registrar la passkey.'); } finally { setActivationBusy(false); }
  }
  useEffect(() => { void passkey(); }, []);
  return <main className="login-page admin-login"><section className="admin-login-form-wrap"><div className="admin-login-form">
    <div className="admin-login-form-brand"><img src={xamukoLogo} alt="XAMUKO" /><span>ADMIN</span></div>
    <header><h2>Acceso seguro a XAMUKO Admin</h2><p>Primero autoriza Google y después confirma Face ID, Touch ID o tu llave de seguridad.</p></header>
    <button className="admin-login-submit" type="button" onClick={() => { startGoogleLogin(); }} disabled={busy}>Continuar con Google</button>
    <button className="admin-login-submit" type="button" onClick={() => void passkey()} disabled={busy}>{busy ? 'Verificando passkey…' : 'Verificar passkey'}</button>
    <form onSubmit={activate} aria-label="Activación inicial de passkey">
      <label htmlFor="activation-code">Código de activación inicial</label>
      <input id="activation-code" type="password" autoComplete="one-time-code" value={activationCode} onChange={event => setActivationCode(event.target.value)} disabled={activationBusy} />
      <button className="admin-login-submit" type="submit" disabled={activationBusy}>{activationBusy ? 'Registrando passkey…' : 'Registrar primera passkey'}</button>
    </form>
    {error && <p role="alert" className="admin-login-error">{error}</p>}
    {activationMessage && <p role="status">{activationMessage}</p>}
    <p className="admin-login-access">La activación sólo funciona después de Google autorizado y una vez. El código nunca se almacena ni se envía en la URL.</p>
  </div></section></main>;
}
