import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { changePassword, clearAccessToken, confirmPasswordReset } from "../services/authService";
import { ApiError } from "../services/httpClient";
import { PageLayout } from "../components/PageLayout";
import { useAuth } from "../context/AuthContext";
import "./PasswordRecovery.css";

export default function PasswordRecovery() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token")?.trim() ?? "";
  const recoveryMode = Boolean(token);
  const { isAuthenticated, reloadUser, user } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (token) window.history.replaceState({}, document.title, window.location.pathname);
  }, [token]);
  const passwordsMismatch = Boolean(next && confirm && next !== confirm);
  const visibleError = error.includes("Autenticación requerida") ? "" : error;
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    if (next.length < 8) { setError("La nueva contraseña debe tener al menos 8 caracteres."); return; }
    if (next !== confirm) { setError("Las contraseñas no coinciden."); return; }
    if (!recoveryMode && !current) { setError("Escribe tu contraseña actual para continuar."); return; }
    if (recoveryMode && !token) { setError("El enlace no es válido o ya expiró."); return; }
    setSaving(true); setError("");
    try {
      if (recoveryMode) {
        await confirmPasswordReset(token, next, isAuthenticated);
        if (isAuthenticated) await reloadUser();
        else clearAccessToken();
      } else await changePassword(current, next);
      setSaved(true);
      setCurrent(""); setNext(""); setConfirm("");
      window.setTimeout(() => navigate(recoveryMode && !isAuthenticated ? "/register?mode=login" : "/settings"), 3000);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "No se pudo actualizar la contraseña.");
    } finally { setSaving(false); }
  }
  // A Google/Apple-only account has no local password to change. Do not
  // show a form that would inevitably fail with PASSWORD_NOT_AVAILABLE.
  if (!recoveryMode && user && !user.authProviders.includes("EMAIL")) {
    const isGoogleAccount = user.authProviders.includes("GOOGLE");
    const isAppleAccount = user.authProviders.includes("APPLE");
    return <PageLayout className="password-page">
      <Link className="offer-detail-back" to="/settings">← Volver a ajustes</Link>
      <div className="user-page-heading"><span>SEGURIDAD DE LA CUENTA</span><h1>Cambiar contraseña</h1></div>
      <section className="password-card">
        <p>Esta cuenta inicia sesión con {isGoogleAccount ? "Google" : isAppleAccount ? "Apple" : "un proveedor externo"} y no tiene una contraseña de XAMUKO configurada.</p>
        <p>Para cambiar la contraseña de acceso, utiliza la configuración de seguridad del proveedor con el que inicias sesión.</p>
        {isGoogleAccount && <p><a className="password-recovery-link" href="https://myaccount.google.com/security" target="_blank" rel="noopener noreferrer">Administrar seguridad de Google →</a></p>}
        {isAppleAccount && <p><a className="password-recovery-link" href="https://account.apple.com/" target="_blank" rel="noopener noreferrer">Administrar seguridad de Apple →</a></p>}
        <Link className="password-settings-link" to="/settings">← Volver a configuración</Link>
      </section>
    </PageLayout>;
  }

  return <PageLayout className="password-page"><Link className="offer-detail-back" to="/settings">← Volver a ajustes</Link><div className="user-page-heading"><span>SEGURIDAD DE LA CUENTA</span><h1>Cambia tu contraseña</h1><p>Actualiza tu contraseña de forma rápida y segura.</p></div><section className="password-card"><form onSubmit={submit}><label>Contraseña actual<input type={recoveryMode ? "text" : "password"} value={recoveryMode ? "••••••••" : current} onChange={recoveryMode ? undefined : (event) => setCurrent(event.target.value)} readOnly={recoveryMode} aria-readonly={recoveryMode} autoComplete="current-password" required /></label><label>Nueva contraseña<input type="password" value={next} onChange={(event) => setNext(event.target.value)} autoComplete="new-password" minLength={8} required /><small>Mínimo 8 caracteres.</small></label><label>Verificar nueva contraseña<input type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="new-password" minLength={8} required /></label>{passwordsMismatch && <small className="password-error" role="alert">Las contraseñas no coinciden.</small>}{visibleError && !passwordsMismatch && <p className="password-error" role="alert">{visibleError}</p>}{saved && <p className="password-success" role="status">Contraseña actualizada correctamente.</p>}<button type="submit" disabled={saving || next !== confirm}>{saving ? "Guardando…" : "Guardar nueva contraseña"}</button></form>{!recoveryMode && <Link className="password-recovery-link" to="/recover-password">¿No recuerdas tu contraseña? Recupérala por correo</Link>}<Link className="password-settings-link" to="/settings">← Volver a configuración</Link></section></PageLayout>;
}
