import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';

export function ChangePasswordPage() {
  const navigate = useNavigate();
  const [saved, setSaved] = useState(false);
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setSaved(true); }
  return <><button className="back-link back-button" onClick={() => navigate('/settings')}><Icon name="arrow" size={16} /> Volver a mi perfil</button><div className="page-heading"><div><p className="eyebrow">SEGURIDAD DE LA CUENTA</p><h1>Cambiar contraseña<span className="heading-dot">.</span></h1><p>Actualiza la contraseña de tu cuenta de administrador.</p></div></div><section className="change-password-card"><div className="change-password-icon"><Icon name="lock" size={23} /></div>{saved ? <><h2>Contraseña actualizada</h2><p>Tu contraseña se cambió correctamente. La próxima vez que inicies sesión deberás usar la nueva contraseña.</p><button className="primary" onClick={() => navigate('/settings')}>Volver a mi perfil</button></> : <form onSubmit={submit}><label htmlFor="current-password">Contraseña actual</label><input id="current-password" type="password" autoComplete="current-password" minLength={4} required /><label htmlFor="new-password">Nueva contraseña</label><input id="new-password" type="password" autoComplete="new-password" minLength={8} required /><label htmlFor="confirm-password">Confirmar nueva contraseña</label><input id="confirm-password" type="password" autoComplete="new-password" minLength={8} required /><p className="change-password-help"><Icon name="shield" size={15} /> Usa al menos 8 caracteres para proteger tu cuenta.</p><button className="primary" type="submit">Guardar nueva contraseña</button></form>}</section></>;
}
