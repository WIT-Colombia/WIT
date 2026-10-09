import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { SiteHeader } from "../components/SiteHeader";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../services/httpClient";
import { completeGoogleCallback } from "../services/googleCallbackFlow";
import "./Register.css";

const messages: Record<string, string> = {
  GOOGLE_AUTH_CANCELLED: "Cancelaste el inicio de sesión con Google.",
  GOOGLE_NOT_CONFIGURED: "El inicio de sesión con Google no está disponible todavía.",
  GOOGLE_LINK_REQUIRED: "Esta cuenta ya existe. Inicia sesión con tu correo y vincula Google desde Ajustes.",
  GOOGLE_CONSENT_REQUIRED: "Acepta los términos para crear tu cuenta con Google.",
  GOOGLE_EMAIL_IN_USE: "El correo de Google ya pertenece a otra cuenta de WIT.",
  GOOGLE_IDENTITY_IN_USE: "Esta cuenta de Google ya está vinculada a otra cuenta de WIT.",
};

export default function GoogleCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { restoreSession } = useAuth();
  const [error, setError] = useState("");
  const providerError = params.get("error");
  const next = params.get("next");

  useEffect(() => {
    let active = true;
    if (providerError) {
      setError(messages[providerError] ?? "No se pudo completar el inicio de sesión con Google.");
      return () => { active = false; };
    }
    completeGoogleCallback(restoreSession, next)
      .then((destination) => { if (active) navigate(destination, { replace: true }); })
      .catch((caught: unknown) => { if (active) setError(caught instanceof ApiError ? caught.message : "No se pudo completar el inicio de sesión con Google. Intenta nuevamente."); })
    return () => { active = false; };
  }, []);

  return <main className="register-page"><SiteHeader active="home" /><section className="register-panel" aria-live="polite">{error ? <><h1>No pudimos iniciar sesión</h1><p className="register-status" role="alert">{error}</p><Link className="register-mode-switch" to="/register?mode=login">Volver a iniciar sesión</Link></> : <><h1>Conectando con WIT</h1><p className="register-status" role="status">Estamos preparando tu sesión…</p></>}</section></main>;
}
