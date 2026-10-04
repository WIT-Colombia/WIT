import { useState } from "react";
import { Link } from "react-router-dom";
import { getProfile, getSettings, saveProfile, saveSettings, type UserProfile, type UserSettings } from "../services/userDataService";
import { getSelectedLocation } from "../services/locationService";
import { PageLayout } from "../components/PageLayout";
import "./Settings.css";

export default function Settings() {
  const [settings, setSettings] = useState<UserSettings>(getSettings);
  const [profile, setProfile] = useState<UserProfile>(getProfile);
  const [phone, setPhone] = useState(() => localStorage.getItem("wit-phone") || "3214411013");
  const [saved, setSaved] = useState(false);
  const provider = localStorage.getItem("wit-auth-provider") ?? "email";
  const location = getSelectedLocation();
  const city = location ? `${location.name}, ${location.context}` : "Palmira, Valle del Cauca";
  function update(key: keyof UserSettings, value: boolean) { const next = { ...settings, [key]: value }; setSettings(next); saveSettings(next); }
  function saveAccount() { saveProfile(profile); localStorage.setItem("wit-phone", phone); setSaved(true); window.setTimeout(() => setSaved(false), 2200); }
  return <PageLayout className="settings-page"><Link className="settings-profile-link" to="/profile">← Volver al perfil</Link><div className="user-page-heading"><h1>Ajustes</h1><p>Controla tus preferencias en este dispositivo.</p></div><div className="settings-sections"><section className="settings-panel settings-info-panel"><div><h2>Ciudad</h2><p>{city}</p></div><Link className="settings-action" to="/location?returnTo=%2Fsettings">Cambiar ciudad →</Link></section><section className="settings-panel settings-notification-panel"><label className="settings-row"><span><b>Notificaciones</b><small>Novedades de lugares cercanos</small></span><input type="checkbox" checked={settings.nearbyUpdates} onChange={(event) => update("nearbyUpdates", event.target.checked)} aria-label="Notificaciones"/></label></section><section className="settings-panel settings-account-panel"><h2>Cuenta y privacidad</h2><div className="settings-account-fields"><label>Nombre<input value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} /></label><label>Correo electrónico <small>Es el correo de tu cuenta</small><input type="email" value={profile.email} disabled /></label><label>Teléfono <small>opcional</small><input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="300 000 0000" /></label></div><div className="settings-account-actions"><button className="settings-save-button" type="button" onClick={saveAccount}>Guardar cambios</button>{provider === "email" ? <Link className="settings-password-link" to="/change-password">Cambiar contraseña →</Link> : <span className="settings-password-disabled">La contraseña se gestiona desde {provider === "google" ? "Google" : "Facebook"}.</span>}<Link className="settings-legal-button" to="/legal/terms?from=settings">Términos y condiciones →</Link></div>{saved && <p className="settings-saved-message" role="status">Cambios guardados.</p>}</section></div></PageLayout>;
}
