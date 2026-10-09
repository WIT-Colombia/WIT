import { useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { requestVerification } from "../services/authService";
import { ApiError } from "../services/httpClient";

export function EmailVerificationNotice() {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [retryAt, setRetryAt] = useState(0);
  const inFlight = useRef(false);
  if (!user || user.emailVerified || !user.emailNormalized) return null;
  const notice = user.verificationEmailSent === true
    ? "Hemos enviado un correo de verificación a tu dirección de correo electrónico. Revisa también la carpeta de Spam."
    : user.verificationEmailSent === false
      ? "No pudimos enviar el enlace inicial. Solicita otro correo de verificación."
      : "Tu correo está pendiente de verificación. Revisa tu correo y Spam para confirmar tu dirección.";
  async function resend() {
    if (busy || inFlight.current) return;
    if (Date.now() < retryAt) { setMessage("Espera un minuto antes de solicitar otro enlace."); return; }
    inFlight.current = true;
    setBusy(true);
    try {
      setMessage(await requestVerification(user!.emailNormalized!));
      setRetryAt(Date.now() + 60_000);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo solicitar el correo.");
      if (error instanceof ApiError && error.retryAfterSeconds) setRetryAt(Date.now() + error.retryAfterSeconds * 1000);
    } finally { inFlight.current = false; setBusy(false); }
  }
  return <aside className="email-verification-notice" aria-label="Verificación de correo"><strong>Correo pendiente de verificación</strong><p>Tu cuenta está creada y puedes seguir explorando WIT. {notice}</p><button type="button" disabled={busy} onClick={resend}>{busy ? "Solicitando…" : "Reenviar correo"}</button>{message && <p role="status">{message}</p>}</aside>;
}
