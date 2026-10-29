import { adminChangePassword } from "../services/adminApiClient";
import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';

export function ChangePasswordPage() {
  const navigate = useNavigate();
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const form = new FormData(event.currentTarget);
    const currentPassword = String(form.get('currentPassword') ?? '');
    const newPassword = String(form.get('newPassword') ?? '');
    if (newPassword !== form.get('confirmation')) { setError('Las contraseñas no coinciden.'); return; }
    setSubmitting(true); setError('');
    try { await adminChangePassword(currentPassword, newPassword); setSaved(true); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'No se pudo actualizar la contraseña.'); }
    finally { setSubmitting(false); }
  }
  return <><button className="back-link back-button" onClick={() => navigate('/settings')}><Icon name="arrow" size={16} /> Volver a mi perfil</button><div className="page-heading"><div><p className="eyebrow">SEGURIDAD DE LA CUENTA</p><h1>Cambiar contraseña<span className="heading-dot">.</span></h1><p>Actualiza la contraseña de tu cuenta de administrador.</p></div></div><section className="change-password-card"><div className="change-password-icon"><Icon name="lock" size={23} /></div>{saved ? <><h2>Contraseña actualizada</h2><p>Tu contraseña se cambió correctamente. La próxima vez que inicies sesión deberás usar la nueva contraseña.</p><button className="primary" onClick={() => navigate('/settings')}>Volver a mi perfil</button></> : <form onSubmit={submit}><label htmlFor="current-password">Contraseña actual</label><input id="current-password" name="currentPassword" type="password" autoComplete="current-password" minLength={8} required /><label htmlFor="new-password">Nueva contraseña</label><input id="new-password" name="newPassword" type="password" autoComplete="new-password" minLength={8} required /><label htmlFor="confirm-password">Confirmar nueva contraseña</label><input id="confirm-password" name="confirmation" type="password" autoComplete="new-password" minLength={8} required /><p className="change-password-help"><Icon name="shield" size={15} /> Usa al menos 8 caracteres para proteger tu cuenta.</p>{error && <p role="alert">{error}</p>}<button className="primary" type="submit" disabled={submitting}>{submitting ? "Guardando…" : "Guardar nueva contraseña"}</button></form>}</section></>;
}
