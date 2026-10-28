import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useBusinessAuth } from "../services/businessAuthContext";
import { resolveBusinessNext } from "../services/businessAuthService";
import { BusinessApiError } from "../services/businessApiClient";

const messages: Record<string, string> = {
  GOOGLE_AUTH_CANCELLED: "Cancelaste el inicio de sesión con Google.",
  GOOGLE_NOT_CONFIGURED: "El inicio de sesión con Google no está disponible todavía.",
  GOOGLE_LINK_REQUIRED: "Esta cuenta ya existe. Inicia sesión con tu correo y vincula Google desde Ajustes.",
  GOOGLE_CONSENT_REQUIRED: "Acepta los términos para crear tu cuenta de Google Business.",
  GOOGLE_EMAIL_IN_USE: "El correo de Google ya pertenece a otra cuenta de WIT.",
  GOOGLE_IDENTITY_IN_USE: "Esta cuenta de Google ya está vinculada a otra cuenta de WIT.",
  GOOGLE_APPLICATION_INVALID: "La aplicación de inicio de sesión no es válida.",
};

export default function GoogleCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { refresh } = useBusinessAuth();
  const [error, setError] = useState("");
  const providerError = params.get("error");
  const next = params.get("next");

  useEffect(() => {
    let active = true;
    if (providerError) {
      setError(messages[providerError] ?? "No se pudo completar el inicio de sesión con Google.");
      return () => { active = false; };
    }
    refresh()
      .then((state) => {
        if (!active) return;
        if (state.status !== "authenticated") throw new Error("SESSION_NOT_RESTORED");
        navigate(resolveBusinessNext(next), { replace: true });
      })
      .catch((caught: unknown) => {
        if (!active) return;
        if (caught instanceof BusinessApiError) setError(caught.message);
        else setError("No se pudo completar el inicio de sesión con Google. Intenta nuevamente.");
      });
    return () => { active = false; };
  }, [navigate, next, providerError, refresh]);

  return <main className="auth-page"><section className="auth-form-card" aria-live="polite">{error ? <><h1>No pudimos iniciar sesión</h1><p className="auth-status auth-status-error" role="alert">{error}</p><Link className="auth-mode-switch" to="/login">Volver a iniciar sesión</Link></> : <><h1>Conectando con Google</h1><p className="auth-status" role="status">Estamos preparando tu sesión de XAMUKO Business…</p></>}</section></main>;
}
