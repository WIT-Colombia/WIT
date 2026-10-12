import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { SiteHeader } from "../components/SiteHeader";
import { ApiError } from "../services/httpClient";
import { confirmEmail, requestVerification } from "../services/authService";
import { useAuth } from "../context/AuthContext";
import "./Register.css";
import "./RecoverPassword.css";
import "./VerifyEmail.css";

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [token] = useState(() => params.get("token")?.trim() ?? "");
  const pending = params.get("pending") === "1";
  const { isAuthenticated, reloadUser, status: authStatus } = useAuth();
  const inFlight = useRef(false);
  const hasAttempted = useRef(false);
  const [state, setState] = useState<"loading" | "success" | "error">(token ? "loading" : "error");
  const [message, setMessage] = useState(token ? "Confirmando tu correo de forma segura…" : pending ? "Hemos creado tu cuenta. Revisa tu correo para verificarla antes de iniciar sesión." : "Falta el token de verificación. Abre el enlace completo del correo.");
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [email, setEmail] = useState(() => params.get("email")?.trim() ?? "");

  useEffect(() => {
    if (!token || authStatus === "loading" || hasAttempted.current) return;
    hasAttempted.current = true;
    window.history.replaceState({}, document.title, window.location.pathname);
    if (inFlight.current) return;
    inFlight.current = true;
    confirmEmail(token)
      .then(async (result) => {
        setState("success");
        setMessage("Tu correo se verificó correctamente.");
        if (result.autoLogin || isAuthenticated) {
          try {
            await reloadUser();
            navigate("/profile", { replace: true });
          } catch {
            navigate("/register?mode=login&next=%2Fprofile&verified=1", { replace: true });
          }
        }
      })
      .catch((caught: unknown) => {
        setState("error");
        setMessage(caught instanceof ApiError ? caught.message : "No pudimos conectar. Intenta abrir el enlace de nuevo.");
      })
      .finally(() => { inFlight.current = false; });
  }, [authStatus, isAuthenticated, navigate, reloadUser, token]);

  async function resend(event: FormEvent) {
    event.preventDefault();
    setResending(true);
    setResent(false);
    try { await requestVerification(email.trim()); setResent(true); }
    catch (caught) { setMessage(caught instanceof ApiError ? caught.message : "No se pudo solicitar el correo."); }
    finally { setResending(false); }
  }

  const story = state === "success"
    ? { eyebrow: "XAMUKO ESTÁ CONTIGO", title: "¡Todo listo para descubrir!", body: "Tu correo electrónico ha sido verificado correctamente. Ahora puedes iniciar sesión en XAMUKO y descubrir negocios, productos y servicios cerca de ti." }
    : state === "loading"
      ? { eyebrow: "UN MOMENTO", title: "Estamos verificando tu correo.", body: "En breve podrás continuar descubriendo todo lo que XAMUKO tiene para ti." }
      : { eyebrow: "ACTIVA TU CUENTA", title: "Completemos la verificación.", body: "Solicita un nuevo enlace para confirmar tu correo y comenzar a usar XAMUKO." };

  return <main className="recover-page"><SiteHeader active="home" /><div className="recover-layout"><section className="recover-story"><span>{story.eyebrow}</span><h1>{story.title}</h1><p>{story.body}</p></section><section className="recover-card"><div className="recover-heading"><h2>{state === "loading" ? "Verificando correo" : state === "success" ? "¡Tu correo está verificado!" : pending ? "Verifica tu correo electrónico" : "No pudimos verificarlo"}</h2>{state !== "success" && <p>{message}</p>}</div>{state === "success" && <div className="verification-success" role="status"><span className="verification-success__icon" aria-hidden="true">✓</span><h3>¡Correo verificado correctamente!</h3><p>Tu cuenta de XAMUKO está lista para comenzar.</p><Link to="/register?mode=login&next=%2Fprofile">Iniciar sesión</Link></div>}{state === "error" && <form onSubmit={resend} className="recover-form"><label>Correo electrónico<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" placeholder="tu@correo.com" /></label><button type="submit" disabled={resending}>{resending ? "Enviando…" : "Enviar nuevo enlace"}</button>{resent && <p className="recover-status" role="status">Si la cuenta es elegible, recibirás un nuevo enlace.</p>}</form>}<Link className="recover-back" to="/register?mode=login">← Volver al inicio de sesión</Link></section></div></main>;
}
