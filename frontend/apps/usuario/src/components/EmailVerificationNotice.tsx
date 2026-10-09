import { useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { requestVerification } from "../services/authService";
import { ApiError } from "../services/httpClient";
import "./EmailVerificationNotice.css";

function MailIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></svg>;
}

export function EmailVerificationNotice() {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState<"success" | "error" | "">("");
  const [retryAt, setRetryAt] = useState(0);
  const inFlight = useRef(false);
  if (!user || user.emailVerified || !user.emailNormalized) return null;

  const currentUser = user;
  const initialMessage = currentUser.verificationEmailSent === true
    ? "Hemos enviado un enlace de verificación. Revisa también la carpeta de Spam."
    : currentUser.verificationEmailSent === false
      ? "No pudimos enviar el enlace inicial. Puedes solicitar otro correo."
      : "Confirma tu dirección para proteger tu cuenta y recuperar el acceso cuando lo necesites.";

  async function resend() {
    if (busy || inFlight.current || !currentUser.emailNormalized) return;
    if (Date.now() < retryAt) {
      setMessage(`Espera ${Math.ceil((retryAt - Date.now()) / 1000)} segundos antes de solicitar otro enlace.`);
      setMessageKind("error");
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setMessage("");
    setMessageKind("");
    try {
      setMessage(await requestVerification(currentUser.emailNormalized));
      setMessageKind("success");
      setRetryAt(Date.now() + 60_000);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo solicitar el correo.");
      setMessageKind("error");
      if (error instanceof ApiError && error.retryAfterSeconds) setRetryAt(Date.now() + error.retryAfterSeconds * 1000);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return <aside className="email-verification-notice" aria-label="Verificación de correo">
    <span className="email-verification-notice__icon"><MailIcon /></span>
    <div className="email-verification-notice__content">
      <strong>Verifica tu correo</strong>
      <span className="email-verification-notice__recipient">{currentUser.emailNormalized}</span>
      <p>{initialMessage}</p>
      <button type="button" disabled={busy} onClick={resend}>{busy ? "Solicitando…" : "Reenviar correo"}</button>
      {message && <p className={`email-verification-notice__feedback ${messageKind}`} role="status">{message}</p>}
    </div>
  </aside>;
}
