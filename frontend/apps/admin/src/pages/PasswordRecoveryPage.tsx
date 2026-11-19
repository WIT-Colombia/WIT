import { type FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '@wit/ui';
import { buildApiUrl } from '@wit/utils';
import { Icon } from '../components/Icon';

export function PasswordRecoveryPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !email.trim()) return;
    setBusy(true); setError('');
    try {
      const response = await fetch(buildApiUrl('/auth/password-reset/request'), {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email: email.trim().toLocaleLowerCase('en-US') }),
      });
      if (!response.ok) throw new Error(response.status === 429
        ? 'Se alcanzó el límite de solicitudes. Intenta nuevamente más tarde.'
        : 'No fue posible registrar la solicitud. Intenta nuevamente.');
      setSubmitted(true);
      setEmail('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo conectar con el servicio.');
    } finally { setBusy(false); }
  }

  return <main className="login-page recovery-page">
    <section className="login-story"><div className="brand"><Logo/><span>ADMIN</span></div>
      <div><span className="login-kicker">XAMUKO ADMIN</span><h1>Recupera tu acceso.</h1>
        <p>Solicita la recuperación de la contraseña asociada a tu cuenta.</p>
        <div className="login-pill"><Icon name="shield"/> Solicitud enviada al servicio real de autenticación</div></div>
      <small>Administración segura de Xamuko</small>
    </section>
    <section className="login-form-wrap"><div className="recovery-card"><div className="login-form">
      <span className="state-icon"><Icon name="lock" size={26}/></span>
      <p className="eyebrow">RECUPERACIÓN DE ACCESO</p><h2>Restablecer contraseña</h2>
      <p>Utiliza el correo de tu cuenta. El enlace de recuperación se procesa mediante el sistema de autenticación de Xamuko.</p>
      {submitted ? <><p role="status" className="form-notice">El servicio recibió la solicitud. Si existe una cuenta vinculada a ese correo y el envío está disponible, recibirás instrucciones. Revisa también tu carpeta de correo no deseado.</p>
        <Link className="primary login-submit recovery-back" to="/login">Volver al inicio de sesión</Link></>
        : <form onSubmit={event => { void submit(event); }}>
          <label htmlFor="recovery-email">Correo de recuperación</label>
          <input className="recovery-email-input" id="recovery-email" name="email" type="email" autoComplete="email" required
            value={email} disabled={busy} onChange={event => setEmail(event.target.value)} placeholder="correo@ejemplo.com"/>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary login-submit" type="submit" disabled={busy}>{busy ? 'Enviando solicitud…' : 'Solicitar recuperación'} <Icon name="arrow" size={18}/></button>
          <p className="recovery-help"><Icon name="shield" size={15}/> Por seguridad no se revela si existe una cuenta asociada a este correo.</p>
          <Link className="text-button recovery-link" to="/login">Volver al inicio de sesión</Link>
        </form>}
    </div></div></section>
  </main>;
}
