import { useState } from "react";
import { Link } from "react-router-dom";
import { getSettings, saveSettings, type UserSettings } from "../services/userDataService";
import { updateProfile } from "../services/authService";
import { useAuth } from "../context/AuthContext";
import { PageLayout } from "../components/PageLayout";
import { ApiError } from "../services/httpClient";
import "./Settings.css";

export default function Settings() {
  const { user, reloadUser } = useAuth();
  const [settings, setSettings] = useState<UserSettings>(getSettings);
  const [name, setName] = useState(user?.displayName ?? "");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const hasWitPassword = user?.authProviders.includes("EMAIL") ?? false;
  function update(key: keyof UserSettings, value: boolean) { const next = { ...settings, [key]: value }; setSettings(next); saveSettings(next); }
  async function saveAccount() {
    if (saving) return;
    setSaving(true); setFeedback(null);
    try {
      await updateProfile({ name: name.trim() });
      await reloadUser();
      setFeedback({ kind: "success", text: "Tus datos personales se actualizaron correctamente." });
    } catch (error) {
      setFeedback({ kind: "error", text: error instanceof ApiError ? error.message : "No se pudieron guardar tus datos." });
    } finally { setSaving(false); }
  }
  return <PageLayout className="settings-page"><Link className="settings-profile-link" to="/profile">← Volver al perfil</Link><div className="user-page-heading"><h1>Ajustes</h1><p>Controla tus preferencias y los datos de tu cuenta.</p></div><div className="settings-sections"><section className="settings-panel settings-account-panel"><h2>Cuenta y privacidad</h2><div className="settings-account-fields"><label>Nombre<input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} required /></label><label>Correo electrónico <small>Este correo está asociado a tu cuenta y no puede modificarse</small><input type="email" value={user?.emailNormalized ?? ""} readOnly aria-readonly="true" /></label></div><div className="settings-account-actions"><button className="settings-save-button" type="button" onClick={saveAccount} disabled={saving}>{saving ? "Guardando…" : "Guardar cambios"}</button>{hasWitPassword && <Link className="settings-password-link" to="/change-password">Cambiar contraseña →</Link>}<Link className="settings-legal-button" to="/legal/terms?from=settings">Términos y condiciones →</Link></div>{feedback && <p className={feedback.kind === "success" ? "settings-saved-message" : "password-error"} role="status">{feedback.text}</p>}</section><section className="settings-panel settings-notification-panel"><label className="settings-row"><span><b>Notificaciones</b><small>Novedades de lugares cercanos</small></span><input type="checkbox" checked={settings.nearbyUpdates} onChange={(event) => update("nearbyUpdates", event.target.checked)} aria-label="Notificaciones"/></label></section></div></PageLayout>;
}
