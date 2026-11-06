import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BusinessHeader } from "../components/layout/BusinessHeader";
import { BusinessBusinessApiError } from "../services/businessApiClient";
import { confirmEmail, requestVerification } from "../services/businessAuthService";

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get("token")?.trim() ?? "";
  const pending = params.get("pending") === "1";
  const [state, setState] = useState<"loading" | "success" | "error">(token ? "loading" : "error");
  const [message, setMessage] = useState(token ? "Confirmando tu correo de forma segura…" : pending ? "Revisa tu correo para verificar tu cuenta." : "Falta el token de verificación. Abre el enlace completo del correo.");
  const [email, setEmail] = useState(() => params.get("email")?.trim() ?? "");
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const attempted = useRef(false);

  useEffect(() => {
    if (!token || attempted.current) return;
    attempted.current = true;
    window.history.replaceState({}, document.title, window.location.pathname);
    confirmEmail(token)
      .then(() => {
        setState("success");
        setMessage("Tu correo se verificó correctamente.");
      })
      .catch((caught: unknown) => {
        setState("error");
        setMessage(caught instanceof BusinessBusinessApiError ? caught.message : "No pudimos verificar tu correo. Intenta abrir el enlace de nuevo.");
      });
  }, [token]);

  async function resend(event: FormEvent) {
    event.preventDefault();
    setResending(true);
    setResent(false);
    try {
      await requestVerification(email.trim());
      setResent(true);
    } catch (caught) {
      setMessage(caught instanceof BusinessApiError ? caught.message : "No se pudo solicitar el correo.");
    } finally {
      setResending(false);
    }
  }

  return <main className="auth-page">
    <BusinessHeader />
    <div className="auth-layout recovery-layout">
      <section className="recovery-card auth-form-card">
        <div className="auth-form-heading">
          <span className="auth-kicker">{state === "success" ? "BUSINESS ESTÁ CONTIGO" : "VERIFICACIÓN DE CORREO"}</span>
          <h2>{state === "loading" ? "Verificando tu correo" : state === "success" ? "¡Correo verificado!" : "Completa la verificación"}</h2>
          <p>{message}</p>
        </div>
        {state === "success" ? <div className="auth-status" role="status">Tu cuenta de Business ya está lista.</div> : <form className="auth-form" onSubmit={resend}>
          <label>Correo electrónico<input type="email" value={email} onChange={event => setEmail(event.target.value)} required autoComplete="email" placeholder="tu@correo.com" /></label>
          <button className="action-button auth-submit" type="submit" disabled={resending}>{resending ? "Enviando…" : "Enviar nuevo enlace"}</button>
          {resent && <p className="auth-status" role="status">Si la cuenta es elegible, recibirás un nuevo enlace.</p>}
        </form>}
        <Link className="auth-back" to="/login">← Volver al inicio de sesión</Link>
      </section>
    </div>
  </main>;
}
