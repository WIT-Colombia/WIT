import { PASSWORD_RESET_REQUEST_MESSAGE } from "@wit/utils";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { BusinessHeader } from "../components/layout/BusinessHeader";
import { changePassword, confirmPasswordReset, getRememberedEmail, requestPasswordReset } from "../services/businessAuthService";
import { useBusinessAuth } from "../services/businessAuthContext";

export function RecoveryPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [token, setToken] = useState(() => searchParams.get("token")?.trim() ?? "");
  const resetMode = searchParams.has("token") || Boolean(token);
  const emailMode = searchParams.get("mode") === "email" && !resetMode;
  const { state: authState, refresh: refreshAuth, clearSession } = useBusinessAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [verify, setVerify] = useState("");
  const [email, setEmail] = useState(getRememberedEmail);
  const [status, setStatus] = useState<"idle" | "changed" | "sent">("idle");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { if (token) window.history.replaceState({}, document.title, window.location.pathname); }, [token]);
  const submitChange = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting || next !== verify) return;
    setSubmitting(true); setError("");
    try {
      await changePassword(current, next);
      setStatus("changed"); setCurrent(""); setNext(""); setVerify("");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo actualizar la contraseña."); }
    finally { setSubmitting(false); }
  };
  const submitRecovery = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await requestPasswordReset(email.trim());
      setStatus("sent");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo enviar la solicitud. Intenta de nuevo.");
    } finally {
      setSubmitting(false);
    }
  };
  const submitReset = async (event: FormEvent) => {
    event.preventDefault();
    if (!token || next.length < 8 || next !== verify) return;
    setSubmitting(true); setError("");
    try {
      const result = await confirmPasswordReset(token, next, false);
      if (result.autoLogin) {
        try { const restored = await refreshAuth(); if (restored.status !== "authenticated") clearSession(); }
        catch { clearSession(); }
      } else clearSession();
      setStatus("changed");
      setCurrent(""); setNext(""); setVerify("");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo actualizar la contraseña."); }
    finally { setSubmitting(false); }
  };
  useEffect(() => {
    if (status !== "changed") return;
    const authenticated = authState.status === "authenticated";
    const timeout = window.setTimeout(() => navigate(resetMode && !authenticated ? "/login" : "/perfil"), 3000);
    return () => window.clearTimeout(timeout);
  }, [authState.status, navigate, resetMode, status]);
  return <main className="auth-page">
    <BusinessHeader />
    <div className="auth-layout recovery-layout">
      <section className="recovery-card auth-form-card"><div className="auth-form-heading"><span className="auth-kicker">SEGURIDAD DE LA CUENTA</span><h2>{emailMode ? "Recupera tu contraseña" : "Cambia tu contraseña"}</h2><p>{emailMode ? "Enviaremos un enlace al correo asociado a tu perfil." : "Actualiza tu contraseña de forma rápida y segura."}</p></div>
        {emailMode ? status === "sent" ? <p className="auth-status" role="status">{PASSWORD_RESET_REQUEST_MESSAGE}</p> : <form className="auth-form" onSubmit={submitRecovery}><label>Correo electrónico<input type="email" value={email} onChange={event => setEmail(event.target.value)} required autoComplete="email" /></label><button className="action-button auth-submit" type="submit" disabled={submitting}>{submitting ? "Enviando…" : "Enviar enlace de recuperación"}</button>{error && <p className="form-error" role="alert">{error}</p>}</form> : resetMode ? status === "changed" ? <p className="auth-status" role="status">Tu contraseña se actualizó correctamente.</p> : <form className="auth-form" onSubmit={submitReset}><label>Contraseña actual<input type="text" value="••••••••" readOnly aria-readonly="true" /></label><label>Nueva contraseña<input type="password" value={next} onChange={event => setNext(event.target.value)} required minLength={8} /></label><label>Verificar nueva contraseña<input type="password" value={verify} onChange={event => setVerify(event.target.value)} required minLength={8} /></label>{next && verify && next !== verify && <small className="form-error">Las contraseñas no coinciden.</small>}{error && <p className="form-error" role="alert">{error}</p>}<button className="action-button auth-submit" type="submit" disabled={submitting || !token || next.length < 8 || next !== verify}>{submitting ? "Guardando…" : "Guardar nueva contraseña"}</button></form> : status === "changed" ? <p className="auth-status" role="status">Tu contraseña se actualizó correctamente.</p> : <form className="auth-form" onSubmit={submitChange}><label>Contraseña actual<input type="password" value={current} onChange={event => setCurrent(event.target.value)} required /></label><label>Nueva contraseña<input type="password" value={next} onChange={event => setNext(event.target.value)} required minLength={8} /></label><label>Verificar nueva contraseña<input type="password" value={verify} onChange={event => setVerify(event.target.value)} required minLength={8} /></label>{next && verify && next !== verify && <small className="form-error">Las contraseñas no coinciden.</small>}<button className="action-button auth-submit" type="submit" disabled={submitting || next !== verify}>{submitting ? "Guardando…" : "Guardar nueva contraseña"}</button></form>}
        {emailMode ? <Link className="recovery-switch recovery-profile-link" to="/perfil">← Regresar al perfil</Link> : <button className="recovery-switch" type="button" onClick={() => { setStatus("idle"); setError(""); setToken(""); setSearchParams({ mode: "email" }); }}>¿No recuerdas tu contraseña? Recupérala por correo</button>}
        {!emailMode && !resetMode && error && <p className="form-error" role="alert">{error}</p>}
        {resetMode && !token && <p role="alert">Falta el token de recuperación. Solicita un enlace nuevo.</p>}
        {!emailMode && <Link className="auth-back" to="/perfil">Regresar al perfil</Link>}
      </section>
    </div>
  </main>;
}
