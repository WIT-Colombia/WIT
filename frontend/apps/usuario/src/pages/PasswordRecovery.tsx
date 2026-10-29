import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { changePassword, confirmPasswordReset } from "../services/authService";
import { PageLayout } from "../components/PageLayout";
import { useAuth } from "../context/AuthContext";
import "./PasswordRecovery.css";

export default function PasswordRecovery() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [token] = useState(() => params.get("token")?.trim() ?? "");
  const recoveryMode = window.location.pathname === "/reset-password";
  const { reloadUser, clearSession } = useAuth();
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
  const visibleError = error || (recoveryMode && !token ? "Falta el token de recuperación. Solicita un enlace nuevo." : "");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    if (next.length < 8) { setError("La nueva contraseña debe tener al menos 8 caracteres."); return; }
    if (next !== confirm) { setError("Las contraseñas no coinciden."); return; }
    if (!recoveryMode && !current) { setError("Escribe tu contraseña actual para continuar."); return; }
    if (recoveryMode && !token) { setError("El enlace no es válido o ya expiró."); return; }
    setSaving(true); setError("");
    try {
      let destination = "/settings";
      if (recoveryMode) {
        const result = await confirmPasswordReset(token, next, false);
        destination = "/register?mode=login";
        if (result.autoLogin) {
          try { await reloadUser(); destination = "/settings"; }
          catch { clearSession(); }
        } else clearSession();
      } else await changePassword(current, next);
      setSaved(true);
      setCurrent(""); setNext(""); setConfirm("");
      window.setTimeout(() => navigate(destination), 3000);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo actualizar la contraseña.");
    } finally { setSaving(false); }
  }
  return <PageLayout className="password-page"><Link className="offer-detail-back" to="/settings">← Volver a ajustes</Link><div className="user-page-heading"><span>SEGURIDAD DE LA CUENTA</span><h1>Cambia tu contraseña</h1><p>Actualiza tu contraseña de forma rápida y segura.</p></div><section className="password-card"><form onSubmit={submit}><label>Contraseña actual<input type={recoveryMode ? "text" : "password"} value={recoveryMode ? "••••••••" : current} onChange={recoveryMode ? undefined : (event) => setCurrent(event.target.value)} readOnly={recoveryMode} aria-readonly={recoveryMode} autoComplete="current-password" required /></label><label>Nueva contraseña<input type="password" value={next} onChange={(event) => setNext(event.target.value)} autoComplete="new-password" minLength={8} required /><small>Mínimo 8 caracteres.</small></label><label>Verificar nueva contraseña<input type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="new-password" minLength={8} required /></label>{passwordsMismatch && <small className="password-error" role="alert">Las contraseñas no coinciden.</small>}{visibleError && !passwordsMismatch && <p className="password-error" role="alert">{visibleError}</p>}{saved && <p className="password-success" role="status">Contraseña actualizada correctamente.</p>}<button type="submit" disabled={saving || saved || (recoveryMode && !token) || next !== confirm}>{saving ? "Guardando…" : "Guardar nueva contraseña"}</button></form><Link className="password-recovery-link" to="/recover-password">Solicitar un enlace de recuperación</Link><Link className="password-settings-link" to="/settings">← Volver a configuración</Link></section></PageLayout>;
}
