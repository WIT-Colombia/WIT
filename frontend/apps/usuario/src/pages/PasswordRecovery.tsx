import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { changePassword, clearAccessToken, confirmPasswordReset } from "../services/authService";
import { ApiError } from "../services/httpClient";
import { PageLayout } from "../components/PageLayout";
import { useAuth } from "../context/AuthContext";
import "./PasswordRecovery.css";

function RecoveryEyeIcon({ hidden }: { hidden: boolean }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/>{hidden && <path d="m4 4 16 16"/>}</svg>;
}

type VisiblePasswordProps = { name: string; value: string; onChange: (value: string) => void; autoComplete: string; minLength?: number };

function VisiblePasswordInput({ name, value, onChange, autoComplete, minLength }: VisiblePasswordProps) {
  const [visible, setVisible] = useState(false);
  return <span className="password-field">
    <input type={visible ? "text" : "password"} value={value} onChange={event => onChange(event.target.value)} autoComplete={autoComplete} minLength={minLength} required />
    <button type="button" className="password-visibility" onClick={() => setVisible(show => !show)} aria-label={`${visible ? "Ocultar" : "Mostrar"} ${name.toLowerCase()}`} aria-pressed={visible} title={visible ? "Ocultar contraseña" : "Mostrar contraseña"}><RecoveryEyeIcon hidden={!visible} /></button>
  </span>;
}

export default function PasswordRecovery() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token")?.trim() ?? "";
  const recoveryMode = Boolean(token);
  const { isAuthenticated, reloadUser } = useAuth();
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
  return <PageLayout className="password-page"><Link className="offer-detail-back" to="/settings">← Volver a ajustes</Link><div className="user-page-heading"><span>SEGURIDAD DE LA CUENTA</span><h1>Cambia tu contraseña</h1><p>Actualiza tu contraseña de forma rápida y segura.</p></div><section className="password-card"><form onSubmit={submit}><label>Contraseña actual{recoveryMode ? <><input type="text" value="••••••••" readOnly aria-readonly="true" autoComplete="off" /><small>Verificada mediante el enlace temporal enviado a tu correo. No necesitas introducirla.</small></> : <VisiblePasswordInput name="Contraseña actual" value={current} onChange={setCurrent} autoComplete="current-password" />}</label><label>Nueva contraseña<VisiblePasswordInput name="Nueva contraseña" value={next} onChange={setNext} autoComplete="new-password" minLength={8} /><small>Mínimo 8 caracteres.</small></label><label>Verificar nueva contraseña<VisiblePasswordInput name="Verificar nueva contraseña" value={confirm} onChange={setConfirm} autoComplete="new-password" minLength={8} /></label>{passwordsMismatch && <small className="password-error" role="alert">Las contraseñas no coinciden.</small>}{visibleError && !passwordsMismatch && <p className="password-error" role="alert">{visibleError}</p>}{saved && <p className="password-success" role="status">Contraseña actualizada correctamente.</p>}<button type="submit" disabled={saving || next !== confirm}>{saving ? "Guardando…" : "Guardar nueva contraseña"}</button></form>{!recoveryMode && <Link className="password-recovery-link" to="/recover-password">¿No recuerdas tu contraseña? Recupérala por correo</Link>}<Link className="password-settings-link" to="/settings">← Volver a configuración</Link></section></PageLayout>;
}
