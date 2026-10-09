import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { getProfile, saveProfile, type UserProfile } from "../services/userDataService";
import { PageLayout } from "../components/PageLayout";

export default function AccountPrivacy() {
  const [profile, setProfile] = useState<UserProfile>(getProfile);
  const [saved, setSaved] = useState(false);
  function submit(event: FormEvent) { event.preventDefault(); saveProfile(profile); setSaved(true); window.setTimeout(() => setSaved(false), 2500); }
  return <PageLayout><Link className="offer-detail-back" to="/settings">← Volver a ajustes</Link><div className="user-page-heading"><span>SEGURIDAD Y PRIVACIDAD</span><h1>Seguridad y privacidad</h1><p>Administra tu nombre, correo y los accesos de tu cuenta.</p></div><div className="settings-sections"><section className="settings-panel"><h2>Datos personales</h2><form onSubmit={submit}><label>Nombre<input value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} /></label><label>Correo electrónico<input type="email" value={profile.email} onChange={(event) => setProfile({ ...profile, email: event.target.value })} /></label><button type="submit">Guardar cambios</button>{saved && <p role="status">Tus datos se guardaron correctamente.</p>}</form><Link className="settings-action" to="/change-password">Cambiar contraseña →</Link></section><section className="settings-panel"><h2>Accesos vinculados</h2><p>Google y Facebook estarán disponibles al conectar los proveedores.</p></section><section className="settings-panel"><h2>Privacidad y documentos</h2><Link className="settings-action" to="/legal/terms?from=settings">Términos y condiciones →</Link><br/><Link className="settings-action" to="/legal/privacy?from=settings">Política de privacidad →</Link><br/><Link className="settings-action" to="/legal/security?from=settings">Política de seguridad →</Link><br/><Link className="settings-action" to="/legal/cookies?from=settings">Cookies →</Link></section></div></PageLayout>;
}
