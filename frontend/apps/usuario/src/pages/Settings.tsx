import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getSettings, saveSettings, type UserSettings } from "../services/userDataService";
import { updateAdultContentPreference, updateProfile } from "../services/authService";
import { useAuth } from "../context/AuthContext";
import { PageLayout } from "../components/PageLayout";
import { ApiError } from "../services/httpClient";
import "./Settings.css";

export default function Settings() {
  const { user, reloadUser } = useAuth();
  const [settings, setSettings] = useState<UserSettings>(getSettings);
  const [name, setName] = useState(user?.displayName ?? "");
  const [nameDirty, setNameDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [adultSaving, setAdultSaving] = useState(false);
  const [adultConsentOpen, setAdultConsentOpen] = useState(false);
  const [adultFeedback, setAdultFeedback] = useState<string | null>(null);
  const [nicknameCopied, setNicknameCopied] = useState(false);
  const hasWitPassword = user?.authProviders.includes("EMAIL") ?? false;
  useEffect(() => {
    if (!nameDirty) setName(user?.displayName ?? "");
  }, [nameDirty, user?.displayName]);
  useEffect(() => { if (feedback?.kind !== "success") return; const timeout = window.setTimeout(() => setFeedback(null), 3000); return () => window.clearTimeout(timeout); }, [feedback]);
  function update(key: keyof UserSettings, value: boolean) { const next = { ...settings, [key]: value }; setSettings(next); saveSettings(next); }
  async function copyNickname() {
    if (!user?.nickname) return;
    try {
      await navigator.clipboard.writeText(user.nickname);
      setNicknameCopied(true);
      window.setTimeout(() => setNicknameCopied(false), 1800);
    } catch { setNicknameCopied(false); }
  }
  async function saveAccount() {
    if (saving) return;
    setSaving(true); setFeedback(null);
    try {
      await updateProfile({ name: name.trim() });
      await reloadUser();
      setNameDirty(false);
      setFeedback({ kind: "success", text: "Tus datos personales se actualizaron correctamente." });
    } catch (error) {
      setFeedback({ kind: "error", text: error instanceof ApiError ? error.message : "No se pudieron guardar tus datos." });
    } finally { setSaving(false); }
  }
  const adultEnabled = Boolean(user?.adultContentPreference?.enabled);
  async function setAdultContent(enabled: boolean) {
    if (!user || adultSaving) return;
    setAdultSaving(true);
    setAdultFeedback(null);
    try {
      await updateAdultContentPreference(enabled);
      await reloadUser();
      if (!enabled) window.dispatchEvent(new Event("xamuko:adult-content-revoked"));
      setAdultConsentOpen(false);
      setAdultFeedback(enabled ? "Preferencia guardada." : "El contenido +18 quedó oculto.");
    } catch (error) {
      setAdultFeedback(error instanceof ApiError ? error.message : "No se pudo actualizar esta preferencia.");
    } finally {
      setAdultSaving(false);
    }
  }
  return <PageLayout className="settings-page"><Link className="settings-profile-link" to="/profile">← Volver al perfil</Link><div className="user-page-heading"><span>Tu experiencia en XAMUKO</span><h1>Ajustes</h1></div><div className="settings-sections"><section className="settings-panel settings-account-panel"><h2>Cuenta y privacidad</h2><div className="settings-account-fields"><label><span>Nombre completo <b>*</b></span><input value={name} onChange={(event) => { setName(event.target.value); setNameDirty(true); }} maxLength={120} required disabled={!user} /></label><label><span>Nickname único</span><div className="settings-nickname-field"><input value={user?.nickname ?? "Sin registrar"} readOnly aria-readonly="true" /><button type="button" className="settings-nickname-copy" onClick={() => void copyNickname()} disabled={!user?.nickname}>{nicknameCopied ? "Copiado" : "Copiar"}</button></div><small>Este nickname es único y no puede repetirse.</small></label><label><span>Correo electrónico</span><input type="email" value={user?.emailNormalized ?? ""} readOnly aria-readonly="true" /><small>El correo de acceso no se puede modificar desde aquí.</small></label></div><div className="settings-account-actions"><button className="settings-save-button" type="button" onClick={saveAccount} disabled={!user || saving}>{saving ? "Guardando…" : "Guardar cambios"}</button>{hasWitPassword && <Link className="settings-password-link" to="/change-password">Cambiar contraseña →</Link>}<Link className="settings-legal-button" to="/legal/terms?from=settings">Términos y condiciones →</Link></div>{feedback && <p className={feedback.kind === "success" ? "settings-saved-message" : "password-error"} role="status">{feedback.text}</p>}</section><section className="settings-panel settings-adult-content-panel" aria-labelledby="adult-content-title"><div className="settings-adult-content-heading"><div><h2 id="adult-content-title">Contenido para mayores de 18 años</h2><p>Puedes elegir si deseas visualizar establecimientos, productos y servicios clasificados como exclusivos para adultos.</p></div><button type="button" className={`settings-adult-switch${adultEnabled ? " is-enabled" : ""}`} role="switch" aria-checked={adultEnabled} aria-label="Mostrar contenido +18" disabled={!user || adultSaving} onClick={() => adultEnabled ? setAdultContent(false) : setAdultConsentOpen(true)}><span aria-hidden="true" /></button></div>{!user && <p className="settings-adult-login-note">Inicia sesión para gestionar esta preferencia.</p>}{adultConsentOpen && !adultEnabled && <div className="settings-adult-consent" role="group" aria-labelledby="adult-consent-title"><h3 id="adult-consent-title">Confirmación necesaria</h3><label><input type="checkbox" onChange={(event) => { if (event.target.checked) void setAdultContent(true); }} disabled={adultSaving} /> <span>Declaro que tengo 18 años o más y deseo visualizar establecimientos, productos y servicios clasificados como +18.</span></label><p>Puedes desactivar esta opción cuando quieras. Algunos contenidos pueden requerir controles adicionales de verificación de edad.</p></div>}{adultFeedback && <p className="settings-adult-feedback" role="status">{adultFeedback}</p>}</section><section className="settings-panel settings-notification-panel"><label className="settings-row"><span><b>Notificaciones</b><small>Novedades de lugares cercanos</small></span><input type="checkbox" checked={settings.nearbyUpdates} onChange={(event) => update("nearbyUpdates", event.target.checked)} aria-label="Notificaciones"/></label></section></div></PageLayout>;
}
