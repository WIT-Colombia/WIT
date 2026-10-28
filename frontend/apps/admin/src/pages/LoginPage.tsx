import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import xamukoLogo from '../assets/xamuko-logo.png';
import { getSession, login } from '../services/adminService';
import { Icon } from '../components/Icon';

const benefits = [
  { icon: 'chart', title: 'Información en tiempo real', detail: 'Toma decisiones con datos confiables.' },
  { icon: 'store', title: 'Gestión empresarial', detail: 'Acompaña negocios, contenido y operación.' },
  { icon: 'settings', title: 'Control total de la plataforma', detail: 'Gestiona los espacios administrativos de XAMUKO.' },
  { icon: 'up', title: 'Crecimiento sin límites', detail: 'Impulsa el crecimiento de la plataforma.' },
];

export function LoginPage() {
  const navigate = useNavigate();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (getSession()) return <Navigate to="/dashboard" replace />;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      await login(String(form.get('email')), String(form.get('password')), form.get('remember') === 'on');
      navigate('/dashboard', { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No pudimos iniciar la sesión. Intenta nuevamente.');
    } finally {
      setBusy(false);
    }
  }

  return <main className="login-page admin-login">
    <section className="admin-login-story" aria-label="XAMUKO Admin">
      <div className="admin-login-city" aria-hidden="true"><span /></div>
      <div className="admin-login-story-content">
        <div className="admin-login-brand"><img src={xamukoLogo} alt="XAMUKO — Descubre · Apoya · Disfruta" /><span>ADMIN</span></div>
        <div className="admin-login-copy">
          <p className="admin-login-kicker">GESTIÓN&nbsp;&nbsp;·&nbsp;&nbsp;CONTROL&nbsp;&nbsp;·&nbsp;&nbsp;CRECIMIENTO</p>
          <h1>Todo XAMUKO,<br /><em>en un solo lugar</em></h1>
          <p>Administra la plataforma y acompaña su crecimiento desde un solo espacio.</p>
          <ul className="admin-login-benefits">{benefits.map(benefit => <li key={benefit.title}><span><Icon name={benefit.icon} size={21} /></span><div><strong>{benefit.title}</strong><small>{benefit.detail}</small></div></li>)}</ul>
        </div>
        <p className="admin-login-footer"><i /> Lo que necesitas, está <b>más cerca.</b></p>
      </div>
    </section>

    <section className="admin-login-form-wrap">
      <form className="admin-login-form" onSubmit={submit}>
        <div className="admin-login-form-brand"><img src={xamukoLogo} alt="XAMUKO" /><span>ADMIN</span></div>
        <header><h2>Bienvenido de nuevo</h2><p>Accede al panel administrativo de XAMUKO.</p></header>
        <label htmlFor="email">Correo electrónico</label>
        <div className="admin-login-input"><span aria-hidden="true">@</span><input id="email" name="email" type="email" autoComplete="username" placeholder="tu@xamuko.com" required /></div>
        <div className="admin-login-password-heading"><label htmlFor="password">Contraseña</label><button type="button" onClick={() => navigate('/recover-password')}>¿Olvidaste tu contraseña?</button></div>
        <div className="admin-login-input admin-login-password"><span aria-hidden="true"><Icon name="lock" size={17} /></span><input id="password" name="password" type={show ? 'text' : 'password'} autoComplete="current-password" minLength={8} required placeholder="Tu contraseña" /><button type="button" aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={show} onClick={() => setShow(value => !value)}><Icon name="eye" size={18} /></button></div>
        <label className="admin-login-remember"><input type="checkbox" name="remember" defaultChecked /> <span>Recordar sesión</span></label>
        {error && <p role="alert" className="admin-login-error">{error}</p>}
        <button className="admin-login-submit" disabled={busy}>{busy ? 'Iniciando sesión…' : 'Iniciar sesión'} <Icon name="arrow" size={19} /></button>
        <p className="admin-login-access"><Icon name="shield" size={17} /> El acceso requiere una cuenta con rol administrativo activo.</p>
      </form>
    </section>
  </main>;
}
