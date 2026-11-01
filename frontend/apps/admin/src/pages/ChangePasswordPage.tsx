import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { changeAdminPassword } from '../services/adminApiClient';

export function ChangePasswordPage() {
  const navigate = useNavigate();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const current = String(form.get('current'));
    const next = String(form.get('next'));
    const confirm = String(form.get('confirm'));
    if (next !== confirm) { setError('Las contraseñas no coinciden.'); return; }
    setBusy(true);
    setError('');
    try {
      await changeAdminPassword(current, next);
      setSaved(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No fue posible cambiar la contraseña.');
    } finally {
      setBusy(false);
    }
  }
  return <>
    <button className="back-link back-button" onClick={() => navigate('/settings')}><Icon name="arrow" size={16} /> Volver a mi perfil</button>
    <div className="page-heading"><div><p className="eyebrow">SEGURIDAD DE LA CUENTA</p><h1>Cambiar contraseña<span className="heading-dot">.</span></h1><p>Actualiza la contraseña de tu cuenta de administrador.</p></div></div>
    <section className="change-password-card"><div className="change-password-icon"><Icon name="lock" size={23} /></div>
      {saved ? <><h2>Contraseña actualizada</h2><p>Tu contraseña se cambió correctamente. La próxima vez que inicies sesión deberás usar la nueva contraseña.</p><button className="primary" onClick={() => navigate('/settings')}>Volver a mi perfil</button></>
        : <form onSubmit={submit}>
          <label htmlFor="current-password">Contraseña actual</label><input id="current-password" name="current" type="password" autoComplete="current-password" minLength={8} required />
          <label htmlFor="new-password">Nueva contraseña</label><input id="new-password" name="next" type="password" autoComplete="new-password" minLength={8} required />
          <label htmlFor="confirm-password">Confirmar nueva contraseña</label><input id="confirm-password" name="confirm" type="password" autoComplete="new-password" minLength={8} required />
          {error && <p className="form-error" role="alert">{error}</p>}
          <p className="change-password-help"><Icon name="shield" size={15} /> Usa al menos 8 caracteres para proteger tu cuenta.</p>
          <button className="primary" type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Guardar nueva contraseña'}</button>
        </form>}
    </section>
  </>;
}
