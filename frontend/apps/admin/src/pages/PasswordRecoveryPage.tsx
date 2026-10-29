import { PASSWORD_RESET_REQUEST_MESSAGE } from "@wit/utils";
import { adminRequestPasswordReset } from "../services/adminApiClient";
import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '@wit/ui';
import { Icon } from '../components/Icon';

export function PasswordRecoveryPage() {
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const email = String(new FormData(event.currentTarget).get('email') ?? '').trim();
    setSubmitting(true); setError('');
    try { await adminRequestPasswordReset(email); setSent(true); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'No se pudo enviar la solicitud.'); }
    finally { setSubmitting(false); }
  }
  return <main className="login-page recovery-page"><section className="login-story"><div className="brand"><Logo /><span>ADMIN</span></div><div><span className="login-kicker">WIT ADMIN</span><h1>Recupera tu acceso.</h1><p>Te ayudaremos a restablecer la contraseña de tu cuenta administrativa.</p><div className="login-pill"><Icon name="shield" /> Acceso seguro al centro de control</div></div><small>Descubrimiento local. Conexiones reales.</small></section><section className="login-form-wrap"><div className="recovery-card"><div className="login-form"><span className="state-icon"><Icon name="lock" size={26} /></span><p className="eyebrow">RECUPERAR CONTRASEÑA</p><h2>Solicita un enlace</h2><p>Escribe el correo asociado a tu cuenta y te enviaremos un enlace para crear una nueva contraseña.</p>{sent ? <><p role="status" className="form-notice">{PASSWORD_RESET_REQUEST_MESSAGE}</p><Link className="primary login-submit recovery-back" to="/login">Volver al inicio de sesión</Link></> : <form onSubmit={submit}><label htmlFor="recovery-email">Correo de recuperación</label><input className="recovery-email-input" id="recovery-email" name="email" type="email" autoComplete="email" required />{error && <p role="alert">{error}</p>}<button className="primary login-submit" type="submit" disabled={submitting}>{submitting ? "Enviando…" : "Enviar enlace de recuperación"} <Icon name="arrow" size={18} /></button><p className="recovery-help"><Icon name="shield" size={15} /> Por seguridad, el enlace solo estará disponible durante un tiempo limitado.</p><Link className="text-button recovery-link" to="/login">Volver al inicio de sesión</Link></form>}</div></div></section></main>;
}
