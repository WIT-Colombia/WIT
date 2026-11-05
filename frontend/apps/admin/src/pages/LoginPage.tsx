import { Navigate, useNavigate } from 'react-router-dom';
import { useState, type FormEvent } from 'react';
import xamukoLogo from '../assets/xamuko-logo.png';
import { authenticateWithPassword, getSession } from '../services/adminService';

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

  return <main className="login-page admin-login">
    <section className="admin-login-form-wrap">
      <div className="admin-login-form">
        <div className="admin-login-form-brand"><img src={xamukoLogo} alt="XAMUKO" /><span>ADMIN</span></div>
        <header>
          <h2>Ingresa a XAMUKO Admin</h2>
          <p>Utiliza el correo y la contraseña de tu cuenta XAMUKO. No necesitas Google ni un código de activación.</p>
        </header>
        <form onSubmit={login} aria-label="Inicio de sesión administrativo">
          <label htmlFor="admin-email">Correo electrónico</label>
          <div className="admin-login-input">
            <input id="admin-email" name="email" type="email" autoComplete="username" required
              value={email} onChange={event => setEmail(event.target.value)} disabled={loginBusy} />
          </div>
          <label htmlFor="admin-password">Contraseña</label>
          <div className="admin-login-input admin-login-password">
            <input id="admin-password" name="password" type={showPassword ? 'text' : 'password'}
              autoComplete="current-password" required minLength={8} value={password}
              onChange={event => setPassword(event.target.value)} disabled={loginBusy} />
            <button type="button" onClick={() => setShowPassword(value => !value)}
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
              {showPassword ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>
          <label className="admin-login-remember"><input type="checkbox" checked={rememberMe} onChange={event => setRememberMe(event.target.checked)} /> Mantener sesión iniciada</label>
          <button className="admin-login-submit" type="submit" disabled={loginBusy}>
            {loginBusy ? 'Iniciando sesión…' : 'Iniciar sesión'}
          </button>
        </form>
        {error && <p role="alert" className="admin-login-error">{error}</p>}
        <p className="admin-login-access">Solo las cuentas con rol SUPER_ADMIN autorizado pueden acceder a este panel.</p>
      </div>
    </section>
  </main>;
}
