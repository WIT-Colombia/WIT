import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { SiteHeader } from "../components/SiteHeader";
import { ApiError } from "../services/httpClient";
import { getRememberedEmail, requestPasswordReset } from "../services/authService";
import { useAuth } from "../context/AuthContext";
import "./Register.css";
import "./RecoverPassword.css";

export default function RecoverPassword() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [email, setEmail] = useState(() => getRememberedEmail());
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user?.emailNormalized) setEmail(user.emailNormalized);
  }, [user?.emailNormalized]);

  useEffect(() => {
    if (!sent) return;
    const timeout = window.setTimeout(() => navigate("/settings"), 3000);
    return () => window.clearTimeout(timeout);
  }, [navigate, sent]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "No se pudo enviar la solicitud. Intenta de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  return <main className="recover-page">
    <SiteHeader active="home" />
    <div className="recover-layout">
      <section className="recover-card auth-form-card">
        <div className="auth-form-heading">
          <span className="auth-kicker">SEGURIDAD DE LA CUENTA</span>
          <h1>Recupera tu contraseña</h1>
          <p>Enviaremos un enlace al correo asociado a tu perfil.</p>
        </div>
        {sent ? <p className="recover-status auth-status" role="status">Te enviamos un enlace de recuperación a tu correo electrónico.</p> : <form onSubmit={submit} className="recover-form auth-form">
          <label>Correo electrónico<input type="email" value={email} readOnly aria-readonly="true" required autoComplete="email" className="recover-email-input" /></label>
          <button className="action-button auth-submit" type="submit" disabled={submitting}>{submitting ? "Enviando…" : "Enviar enlace de recuperación"}</button>
          {error && <p className="password-error form-error" role="alert">{error}</p>}
        </form>}
        <Link className="recover-back recovery-switch" to="/settings">← Volver a ajustes</Link>
      </section>
    </div>
  </main>;
}
