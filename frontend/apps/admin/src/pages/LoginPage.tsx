import { Navigate, useNavigate } from 'react-router-dom';
import { useEffect, useState, type FormEvent } from 'react';
import xamukoLogo from '../assets/xamuko-logo.png';
import { authenticateWithPassword, authenticateWithPasskey, startGoogleLogin, getSession } from '../services/adminService';
import { beginAdminPasskeyActivation, finishAdminPasskeyActivation } from '../services/adminApiClient';

export function LoginPage() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [loginBusy, setLoginBusy] = useState(false);
  const [activationBusy, setActivationBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [activationCode, setActivationCode] = useState('');
  const [error, setError] = useState('');
  const [activationMessage, setActivationMessage] = useState('');

  if (getSession()) return <Navigate to="/dashboard" replace />;

  async function passkey() {
    setBusy(true); setError('');
    try { await authenticateWithPasskey(); navigate('/dashboard', { replace: true }); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No pudimos verificar la passkey.'); }
    finally { setBusy(false); }
  }

  async function login(event: FormEvent) {
    event.preventDefault(); setLoginBusy(true); setError('');
    try {
      await authenticateWithPassword(email, password);
      navigate('/dashboard', { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Correo o contraseña incorrectos.');
    } finally { setLoginBusy(false); }
  }

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
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo registrar la passkey.'); }
    finally { setActivationBusy(false); }
  }

  useEffect(() => { void passkey(); }, []);

  return <main className="login-page admin-login"><section className="admin-login-form-wrap"><div className="admin-login-form">
    <div className="admin-login-form-brand"><img src={xamukoLogo} alt="XAMUKO" /><span>ADMIN</span></div>
    <header><h2>Acceso seguro a XAMUKO Admin</h2><p>Inicia sesión con tu cuenta administrativa autorizada.</p></header>
    <form onSubmit={login} aria-label="Inicio de sesión administrativo">
      <label htmlFor="admin-email">Correo electrónico</label>
      <input id="admin-email" name="email" type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} disabled={loginBusy} />
      <label htmlFor="admin-password">Contraseña</label>
      <div className="admin-password-field">
        <input id="admin-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required minLength={8} value={password} onChange={event => setPassword(event.target.value)} disabled={loginBusy} />
        <button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>{showPassword ? 'Ocultar' : 'Mostrar'}</button>
      </div>
      <button className="admin-login-submit" type="submit" disabled={loginBusy}>{loginBusy ? 'Iniciando sesión…' : 'Iniciar sesión'}</button>
    </form>
    <button className="admin-login-submit" type="button" onClick={() => { startGoogleLogin(); }} disabled={busy || loginBusy}>Continuar con Google</button>
    <button className="admin-login-submit" type="button" onClick={() => void passkey()} disabled={busy || loginBusy}>{busy ? 'Verificando passkey…' : 'Verificar passkey'}</button>
    <form onSubmit={activate} aria-label="Activación inicial de passkey">
      <label htmlFor="activation-code">Código de activación inicial</label>
      <input id="activation-code" type="password" autoComplete="one-time-code" value={activationCode} onChange={event => setActivationCode(event.target.value)} disabled={activationBusy} />
      <button className="admin-login-submit" type="submit" disabled={activationBusy}>{activationBusy ? 'Registrando passkey…' : 'Registrar primera passkey'}</button>
    </form>
    {error && <p role="alert" className="admin-login-error">{error}</p>}
    {activationMessage && <p role="status">{activationMessage}</p>}
    <p className="admin-login-access">Solo las cuentas con rol administrativo autorizado pueden acceder al panel.</p>
  </div></section></main>;
}
