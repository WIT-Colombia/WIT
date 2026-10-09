import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { SiteHeader } from "../components/SiteHeader";
import { ApiError } from "../services/httpClient";
import { confirmPasswordReset } from "../services/authService";
import { useAuth } from "../context/AuthContext";
import "./Register.css";
import "./RecoverPassword.css";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token")?.trim() ?? "";
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [autoLoginFailed, setAutoLoginFailed] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { reloadUser } = useAuth();

  useEffect(() => {
    if (token) window.history.replaceState({}, document.title, window.location.pathname);
  }, [token]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!token) { setError("El enlace no es válido o ya expiró."); return; }
    if (password.length < 8) { setError("La nueva contraseña debe tener al menos 8 caracteres."); return; }
    if (password !== confirmation) { setError("Las contraseñas nuevas no coinciden."); return; }
    setSubmitting(true);
    setError("");
    try {
      const result = await confirmPasswordReset(token, password);
      if (result.autoLogin) {
        try {
          await reloadUser();
          setPassword("");
          setConfirmation("");
          navigate("/home", { replace: true, state: { toast: "¡Contraseña actualizada correctamente!" } });
          return;
        } catch {
          setAutoLoginFailed(true);
        }
      } else {
        setAutoLoginFailed(true);
      }
      setCompleted(true);
      setPassword("");
      setConfirmation("");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "No se pudo actualizar la contraseña.");
    } finally {
      setSubmitting(false);
    }
  }

  return <main className="recover-page"><SiteHeader active="home" /><div className="recover-layout"><section className="recover-story"><span>SEGURIDAD DE TU CUENTA</span><h1>Recupera el control de tu cuenta.</h1><p>Elige una nueva contraseña para volver a entrar a WIT con tranquilidad.</p></section><section className="recover-card"><div className="recover-heading"><h2>Nueva contraseña</h2><p>Usa al menos 8 caracteres y confirma la contraseña antes de continuar.</p></div>{completed ? <><p className="recover-status" role="status">¡Contraseña actualizada correctamente!</p>{autoLoginFailed ? <><p className="recover-status">Puedes iniciar sesión con tu nueva contraseña.</p><Link className="recover-back" to="/register?mode=login">Iniciar sesión</Link></> : null}</> : submitting ? <p className="recover-status" role="status">{"Iniciando sesión…"}</p> : <form onSubmit={submit} className="recover-form"><label>Nueva contraseña<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={8} required /></label><label>Confirmar contraseña<input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" minLength={8} required /></label><button type="submit" disabled={submitting || !token}>{submitting ? "Guardando…" : "Guardar nueva contraseña"}</button>{error && <p className="password-error" role="alert">{error}</p>}</form>} {!completed && !submitting && <Link className="recover-back" to="/register?mode=login">← Volver a iniciar sesión</Link>}</section></div></main>;
}
