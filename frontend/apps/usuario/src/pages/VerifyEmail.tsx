import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { SiteHeader } from "../components/SiteHeader";
import { ApiError } from "../services/httpClient";
import { confirmEmail, requestVerification } from "../services/authService";
import { useAuth } from "../context/AuthContext";
import "./Register.css";
import "./RecoverPassword.css";

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [token] = useState(() => params.get("token")?.trim() ?? "");
  const { isAuthenticated, reloadUser } = useAuth();
  const inFlight = useRef(false);
  const [state, setState] = useState<"ready" | "loading" | "success" | "error">(token ? "ready" : "error");
  const [message, setMessage] = useState(token ? "Pulsa el botón para confirmar tu correo." : "Falta el token de verificación. Abre el enlace completo del correo.");
  const [sessionConfirmed, setSessionConfirmed] = useState(false);
  const [email, setEmail] = useState("");
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    if (token) window.history.replaceState({}, document.title, window.location.pathname);
  }, [token]);

  async function verify() {
    if (!token || inFlight.current) return;
    inFlight.current = true;
    setState("loading");
    setMessage("Confirmando tu correo…");
    try {
      await confirmEmail(token);
      setState("success");
      setMessage("Tu correo se verificó correctamente.");
      if (isAuthenticated) {
        try {
          await reloadUser();
          setSessionConfirmed(true);
          navigate("/profile", { replace: true });
        } catch { setMessage("Tu correo se verificó correctamente. Inicia sesión para continuar."); }
      }
    } catch (caught) {
      setState("error");
      setMessage(caught instanceof ApiError ? caught.message : "No pudimos conectar. Intenta confirmar de nuevo.");
    } finally { inFlight.current = false; }
  }

  async function resend(event: FormEvent) {
    event.preventDefault();
    setResending(true);
    setResent(false);
    try { await requestVerification(email.trim()); setResent(true); }
    catch (caught) { setMessage(caught instanceof ApiError ? caught.message : "No se pudo solicitar el correo."); }
    finally { setResending(false); }
  }

  return <main className="recover-page"><SiteHeader active="home" /><div className="recover-layout"><section className="recover-story"><span>SEGURIDAD DE TU CUENTA</span><h1>Confirma que tu correo es tuyo.</h1><p>La verificación ayuda a proteger tu cuenta y recuperar el acceso cuando lo necesites.</p></section><section className="recover-card"><div className="recover-heading"><h2>{state === "loading" ? "Verificando correo" : state === "success" ? "Correo verificado" : state === "ready" ? "Verifica tu correo" : "No pudimos verificarlo"}</h2><p>{message}</p></div>{token && state !== "success" && <button type="button" disabled={state === "loading"} onClick={verify}>Confirmar correo</button>}{state === "success" && (sessionConfirmed ? <Link to="/profile">Ir a mi perfil</Link> : <Link to="/register?mode=login&next=%2Fprofile">Iniciar sesión</Link>)}{state === "error" && <form onSubmit={resend} className="recover-form"><label>Correo electrónico<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" placeholder="tu@correo.com" /></label><button type="submit" disabled={resending}>{resending ? "Enviando…" : "Enviar nuevo enlace"}</button>{resent && <p className="recover-status" role="status">Si la cuenta es elegible, recibirás un nuevo enlace.</p>}</form>}<Link className="recover-back" to="/register?mode=login">← Volver a iniciar sesión</Link></section></div></main>;
}
