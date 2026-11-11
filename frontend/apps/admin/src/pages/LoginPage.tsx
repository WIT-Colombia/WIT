import { Navigate, useNavigate } from 'react-router-dom';
import { useState, type FormEvent } from 'react';
import xamukoLogo from '../assets/xamuko-logo.png';
import adminIllustration from '../assets/auth-admin-dashboard.svg';
import { Icon } from '../components/Icon';
import { authenticateWithPassword, getSession } from '../services/adminService';
import './LoginPageVisual.css';

function FieldIcon({ kind }: { kind: 'mail' | 'lock' }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
    {kind === 'mail' ? <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></> : <><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3m-4 4v3"/></>}
  </svg>;
}

function EyeIcon({ hidden }: { hidden: boolean }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/>{hidden && <path d="m4 4 16 16"/>}</svg>;
}

export function LoginPage() {
  const navigate = useNavigate();
  const [loginBusy, setLoginBusy] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  if (getSession()) return <Navigate to="/dashboard" replace />;

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loginBusy) return;
    setLoginBusy(true);
    setError('');
    try {
      await authenticateWithPassword(email, password, rememberMe);
      navigate('/dashboard', { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No pudimos verificar el acceso administrativo.');
    } finally {
      setLoginBusy(false);
    }
  }

  return <main className="login-page admin-login admin-access-page">
    <div className="admin-access-layout">
    <section className="admin-access-story" aria-labelledby="admin-access-title">
      <div className="admin-access-brand">
        <img src={xamukoLogo} alt="XAMUKO" width="2170" height="725" />
        <p>Lo que necesitas, está más cerca.</p>
      </div>
      <div className="admin-access-copy">
        <h1 id="admin-access-title">Administración y control<br className="admin-access-title-break"/> de la plataforma</h1>
        <p>Gestiona, supervisa y asegura el correcto funcionamiento de todo el ecosistema.</p>
        <ul className="admin-access-benefits">
          <li><span><Icon name="users" size={26}/></span><div><strong>Gestión de usuarios</strong><small>Consulta usuarios y negocios.</small></div></li>
          <li><span><Icon name="chart" size={26}/></span><div><strong>Monitoreo y reportes</strong><small>Consulta estadísticas y desempeño.</small></div></li>
          <li><span><Icon name="settings" size={26}/></span><div><strong>Configuración del sistema</strong><small>Consulta el catálogo y sus categorías.</small></div></li>
          <li><span><Icon name="shield" size={26}/></span><div><strong>Seguridad y control</strong><small>Consulta accesos y permisos administrativos.</small></div></li>
        </ul>
      </div>
      <img className="admin-access-illustration" src={adminIllustration} width="1000" height="820" alt="" aria-hidden="true" decoding="async"/>
    </section>
    <section className="admin-login-form-wrap">
      <div className="admin-login-form">
        <header>
          <h2>Inicia sesión en tu cuenta</h2>
          <p>Accede a la administración de la plataforma.</p>
        </header>
        <form onSubmit={login} aria-label="Inicio de sesión administrativo">
          <label htmlFor="admin-email">Correo electrónico</label>
          <div className="admin-login-input">
            <FieldIcon kind="mail"/>
            <input id="admin-email" name="email" type="email" autoComplete="username" required
              value={email} onChange={event => setEmail(event.target.value)} disabled={loginBusy} placeholder="tu@correo.com" />
          </div>
          <label htmlFor="admin-password">Contraseña</label>
          <div className="admin-login-input admin-login-password">
            <FieldIcon kind="lock"/>
            <input id="admin-password" name="password" type={showPassword ? 'text' : 'password'}
              autoComplete="current-password" required minLength={8} value={password}
              onChange={event => setPassword(event.target.value)} disabled={loginBusy} placeholder="Tu contraseña" />
            <button type="button" onClick={() => setShowPassword(value => !value)}
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
              <EyeIcon hidden={!showPassword}/>
            </button>
          </div>
          <label className="admin-login-remember"><input type="checkbox" checked={rememberMe} onChange={event => setRememberMe(event.target.checked)} /> Mantener sesión iniciada</label>
          <button className="admin-login-submit" type="submit" disabled={loginBusy}>
            {loginBusy ? 'Iniciando sesión…' : 'Iniciar sesión'}
            <span aria-hidden="true">→</span>
          </button>
        </form>
        {error && <p role="alert" className="admin-login-error">{error}</p>}
        <p className="admin-login-access">Solo las cuentas con rol SUPER_ADMIN autorizado pueden acceder a este panel.</p>
      </div>
    </section>
    </div>
  </main>;
}
