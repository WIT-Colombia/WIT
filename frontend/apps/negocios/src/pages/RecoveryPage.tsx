import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { BusinessHeader } from "../components/layout/BusinessHeader";
import { PageHeader } from "../components/common/PageHeader";
import { useBusinessStore } from "../services/businessStore";
import { changePassword, clearAccessToken, confirmPasswordReset, requestPasswordReset } from "../services/businessAuthService";
import { useBusinessAuth } from "../services/businessAuthContext";
import "./RecoveryPage.css";

export function RecoveryPage() {
  const { account } = useBusinessStore();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";
  const resetMode = Boolean(token);
  const emailMode = searchParams.get("mode") === "email" && !resetMode;
  const { state: authState, refresh: refreshAuth } = useBusinessAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [verify, setVerify] = useState("");
  const [email] = useState(account.email);
  const [status, setStatus] = useState<"idle" | "changed" | "sent">("idle");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { if (token) window.history.replaceState({}, document.title, window.location.pathname); }, [token]);
  useEffect(() => {
    if (status !== "changed") return;
    const timeout = window.setTimeout(() => navigate("/perfil"), 3000);
    return () => window.clearTimeout(timeout);
  }, [navigate, status]);
  useEffect(() => {
    if (!emailMode || status !== "sent") return;
    const timeout = window.setTimeout(() => navigate("/perfil"), 3000);
    return () => window.clearTimeout(timeout);
  }, [emailMode, navigate, status]);
  const submitChange = async (event: FormEvent) => {
    event.preventDefault();
    if (next.length < 8 || next !== verify || !current) return;
    setSubmitting(true);
    setError("");
    try {
      await changePassword(current, next);
      setCurrent(""); setNext(""); setVerify("");
      setStatus("changed");
    } catch {
      setError("No se pudo actualizar la contraseña. Verifica tu contraseña actual e inténtalo de nuevo.");
    } finally {
      setSubmitting(false);
    }
  };
  const submitRecovery = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await requestPasswordReset(email.trim());
      setStatus("sent");
    } catch {
      setError("No se pudo enviar la solicitud. Intenta de nuevo.");
    } finally {
      setSubmitting(false);
    }
  };
  const submitReset = async (event: FormEvent) => {
    event.preventDefault();
    if (!token || next.length < 8 || next !== verify) return;
    setSubmitting(true); setError("");
    const authenticated = authState.status === "authenticated";
    try {
      await confirmPasswordReset(token, next, authenticated);
      if (authenticated) await refreshAuth(); else clearAccessToken();
      setStatus("changed");
      setCurrent(""); setNext(""); setVerify("");
    } catch { setError("No se pudo actualizar la contraseña."); }
    finally { setSubmitting(false); }
  };
  useEffect(() => {
    if (status !== "changed") return;
    const authenticated = authState.status === "authenticated";
    const timeout = window.setTimeout(() => navigate(resetMode && !authenticated ? "/login" : "/perfil"), 3000);
    return () => window.clearTimeout(timeout);
  }, [authState.status, navigate, resetMode, status]);
  const signedIn = authState.status === "authenticated";
  const recoveryBody = <div className="auth-layout recovery-layout business-recovery-layout">
      {!emailMode && (signedIn
        ? <PageHeader eyebrow="SEGURIDAD DE LA CUENTA" title="Cambia tu contraseña" description="Actualiza tu contraseña de forma rápida y segura." />
        : <div className="business-recovery-intro">
          <span>SEGURIDAD DE LA CUENTA</span>
          <h1>Cambia tu contraseña</h1>
          <p>Actualiza tu contraseña de forma rápida y segura.</p>
        </div>)}
      <section className="recovery-card auth-form-card business-recovery-card">
        {emailMode && <div className="auth-form-heading"><span className="auth-kicker">SEGURIDAD DE LA CUENTA</span><h2>Recupera tu contraseña</h2><p>Enviaremos un enlace al correo asociado a tu perfil.</p></div>}
        {emailMode ? status === "sent" ? <p className="auth-status" role="status">Te enviamos un enlace de recuperación a tu correo electrónico.</p> : <form className="auth-form" onSubmit={submitRecovery}><label>Correo electrónico<input type="email" value={email} readOnly aria-readonly="true" required autoComplete="email" /></label><button className="action-button auth-submit" type="submit" disabled={submitting}>{submitting ? "Enviando…" : "Enviar enlace de recuperación"}</button>{error && <p className="form-error" role="alert">{error}</p>}</form> : resetMode ? status === "changed" ? <p className="auth-status" role="status">Tu contraseña se actualizó correctamente.</p> : <form className="auth-form" onSubmit={submitReset}><label>Contraseña actual<input type="text" value="••••••••" readOnly aria-readonly="true" /></label><label>Nueva contraseña<input type="password" value={next} onChange={event => setNext(event.target.value)} required minLength={8} /></label><label>Verificar nueva contraseña<input type="password" value={verify} onChange={event => setVerify(event.target.value)} required minLength={8} /></label>{next && verify && next !== verify && <small className="form-error">Las contraseñas no coinciden.</small>}{error && <p className="form-error" role="alert">{error}</p>}<button className="action-button auth-submit" type="submit" disabled={submitting || next.length < 8 || next !== verify}>{submitting ? "Guardando…" : "Guardar nueva contraseña"}</button></form> : status === "changed" ? <p className="auth-status" role="status">Tu contraseña se actualizó correctamente.</p> : <form className="auth-form" onSubmit={submitChange}><label>Contraseña actual<input type="password" value={current} onChange={event => setCurrent(event.target.value)} required /></label><label>Nueva contraseña<input type="password" value={next} onChange={event => setNext(event.target.value)} required minLength={8} /></label><label>Verificar nueva contraseña<input type="password" value={verify} onChange={event => setVerify(event.target.value)} required minLength={8} /></label>{next && verify && next !== verify && <small className="form-error">Las contraseñas no coinciden.</small>}{error && <p className="form-error" role="alert">{error}</p>}<button className="action-button auth-submit" type="submit" disabled={submitting || !current || next.length < 8 || next !== verify}>{submitting ? "Guardando…" : "Guardar nueva contraseña"}</button></form>}
        {emailMode ? <Link className="recovery-switch recovery-profile-link" to="/perfil">← Regresar al perfil</Link> : <button className="recovery-switch" type="button" onClick={() => { setStatus("idle"); setSearchParams({ mode: "email" }); }}>¿No recuerdas tu contraseña? Recupérala por correo</button>}
        {!emailMode && <Link className="auth-back" to="/perfil">Regresar al perfil</Link>}
      </section>
    </div>;
  const pageClass = `business-recovery-page ${emailMode ? "business-recovery-email-page" : "business-recovery-password-page"}`;
  return signedIn
    ? <div className={`${pageClass} business-recovery-workspace`}>{recoveryBody}</div>
    : <main className={`auth-page ${pageClass}`}><BusinessHeader />{recoveryBody}</main>;
}
