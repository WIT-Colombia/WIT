import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { SiteHeader } from "../components/SiteHeader";
import { ApiError } from "../services/httpClient";
import { requestPasswordReset } from "../services/authService";
import "./Register.css";
import "./RecoverPassword.css";

export default function RecoverPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

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
      <section className="recover-story"><span>SEGURIDAD DE TU CUENTA</span><h1>Vuelve a entrar con tranquilidad.</h1><p>Te ayudaremos a recuperar el acceso a tu cuenta de WIT para que sigas encontrando lo que necesitas cerca de ti.</p><div className="recover-story-note"><b>Tu información está protegida</b><small>Escribe el correo con el que creaste tu cuenta y te indicaremos el siguiente paso.</small></div></section>
      <section className="recover-card"><div className="recover-heading"><h2>Recupera tu acceso</h2><p>Escribe el correo de tu cuenta para continuar.</p></div>{sent ? <p className="recover-status" role="status">Si el correo está registrado, recibirás las instrucciones para recuperar tu contraseña.</p> : <form onSubmit={submit} className="recover-form"><label>Correo electrónico<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" className="recover-email-input" placeholder="tu@correo.com" /></label><button type="submit" disabled={submitting}>{submitting ? "Enviando…" : "Continuar"}</button>{error && <p className="password-error" role="alert">{error}</p>}</form>}<Link className="recover-back" to="/register?mode=login">← Volver a iniciar sesión</Link></section>
    </div>
  </main>;
}
