import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '@wit/ui';
import { Icon } from '../components/Icon';
import { requestAdminPasswordReset } from '../services/adminApiClient';

export function PasswordRecoveryPage() {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      await requestAdminPasswordReset(String(form.get('email')).trim());
      setSent(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No fue posible solicitar la recuperación. Intenta nuevamente.');
    } finally {
      setBusy(false);
    }
  }
  return <main className="login-page recovery-page">
    <section className="login-story">
      <div className="brand"><Logo /><span>ADMIN</span></div>
      <div><span className="login-kicker">XAMUKO ADMIN</span><h1>Recupera tu acceso.</h1><p>Restablece la contraseña de tu cuenta administrativa.</p><div className="login-pill"><Icon name="shield" /> Acceso seguro al centro de control</div></div>
      <small>Lo que necesitas, está más cerca.</small>
    </section>
    <section className="login-form-wrap"><div className="recovery-card"><div className="login-form">
      <span className="state-icon"><Icon name="lock" size={26} /></span><p className="eyebrow">RECUPERAR CONTRASEÑA</p>
      <h2>Solicita un enlace</h2><p>Escribe el correo asociado a tu cuenta y te enviaremos un enlace de recuperación, si la cuenta reúne los requisitos.</p>
      {sent ? <><p role="status" className="form-notice">Si tu correo corresponde a una cuenta habilitada, recibirás las instrucciones para recuperar el acceso.</p><Link className="primary login-submit recovery-back" to="/login">Volver al inicio de sesión</Link></>
        : <form onSubmit={submit}>
          <label htmlFor="recovery-email">Correo electrónico</label>
          <input className="recovery-email-input" id="recovery-email" name="email" type="email" placeholder="tu@xamuko.com" autoComplete="email" required />
          {error && <p role="alert" className="form-error">{error}</p>}
          <button className="primary login-submit" type="submit" disabled={busy}>{busy ? 'Solicitando…' : 'Enviar enlace de recuperación'} <Icon name="arrow" size={18} /></button>
          <p className="recovery-help"><Icon name="shield" size={15} /> El enlace de recuperación vence en 30 minutos y solo puede utilizarse una vez.</p>
          <Link className="text-button recovery-link" to="/login">Volver al inicio de sesión</Link>
        </form>}
    </div></div></section>
  </main>;
}
