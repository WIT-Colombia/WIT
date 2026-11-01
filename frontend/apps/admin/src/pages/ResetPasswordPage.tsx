import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { confirmAdminPasswordReset } from '../services/adminApiClient';

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token')?.trim() ?? '';
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (token) window.history.replaceState({}, document.title, window.location.pathname);
  }, [token]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const password = String(form.get('password'));
    const confirmation = String(form.get('confirmation'));
    if (!token) { setError('El enlace no es válido o ya expiró.'); return; }
    if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); return; }
    if (password !== confirmation) { setError('Las contraseñas no coinciden.'); return; }
    setBusy(true);
    setError('');
    try {
      await confirmAdminPasswordReset(token, password);
      setSaved(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pudimos restablecer tu contraseña.');
    } finally {
      setBusy(false);
    }
  }

  return <main className="login-page recovery-page">
    <section className="login-story"><div className="brand"><span>XAMUKO</span><span>ADMIN</span></div>
      <div><span className="login-kicker">SEGURIDAD DE LA CUENTA</span><h1>Nueva contraseña.</h1><p>Restablece tu acceso al centro de control de XAMUKO.</p></div>
    </section>
    <section className="login-form-wrap"><div className="recovery-card"><div className="login-form">
      <span className="state-icon"><Icon name="lock" size={26} /></span>
      <h2>Restablecer contraseña</h2>
      {saved ? <><p role="status" className="form-notice">Tu contraseña se actualizó correctamente. Ya puedes ingresar con tu correo y tu nueva contraseña.</p><Link className="primary login-submit recovery-back" to="/login">Ir a iniciar sesión</Link></> : token
        ? <form onSubmit={submit}>
          <label htmlFor="new-password">Nueva contraseña</label><input id="new-password" className="recovery-email-input" type="password" name="password" autoComplete="new-password" minLength={8} required />
          <label htmlFor="confirm-password">Confirmar contraseña</label><input id="confirm-password" className="recovery-email-input" type="password" name="confirmation" autoComplete="new-password" minLength={8} required />
          {error && <p role="alert" className="form-error">{error}</p>}
          <button className="primary login-submit" type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Guardar nueva contraseña'}</button>
        </form>
        : <><p role="alert" className="form-error">El enlace no es válido. Solicita uno nuevo.</p><Link className="primary login-submit recovery-back" to="/recover-password">Solicitar enlace</Link></>}
    </div></div></section>
  </main>;
}
