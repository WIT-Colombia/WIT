import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { SiteHeader } from "../components/SiteHeader";
import { ApiError } from "../services/httpClient";
import { confirmEmail, requestVerification } from "../services/authService";
import { useAuth } from "../context/AuthContext";
import "./VerifyEmail.css";

type VerificationState = "pending" | "loading" | "success" | "error";

function MailIllustration() {
  return <svg className="verify-email-artwork" viewBox="0 0 240 220" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="verify-mail-envelope" x1="31" y1="100" x2="198" y2="196" gradientUnits="userSpaceOnUse">
        <stop stopColor="#9C72FF" /><stop offset=".55" stopColor="#7B3FFB" /><stop offset="1" stopColor="#5D24D9" />
      </linearGradient>
      <linearGradient id="verify-mail-flap" x1="42" y1="93" x2="184" y2="193" gradientUnits="userSpaceOnUse">
        <stop stopColor="#B194FF" /><stop offset="1" stopColor="#7B3FFB" />
      </linearGradient>
      <linearGradient id="verify-mail-paper" x1="87" y1="82" x2="153" y2="155" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FFFFFF" /><stop offset="1" stopColor="#F7F2FF" />
      </linearGradient>
    </defs>
    <circle cx="120" cy="112" r="106" fill="#F0E8FF" />
    <path d="M44 100 111 49a15 15 0 0 1 18 0l67 51v79a14 14 0 0 1-14 14H58a14 14 0 0 1-14-14V100Z" fill="url(#verify-mail-envelope)" />
    <rect x="62" y="70" width="116" height="103" rx="12" fill="url(#verify-mail-paper)" />
    <text x="120" y="142" fill="#8952F6" fontFamily="Arial, Helvetica, sans-serif" fontSize="70" fontWeight="700" textAnchor="middle">@</text>
    <path d="m44 105 65 53c6 5 16 5 22 0l65-53v74a14 14 0 0 1-14 14H58a14 14 0 0 1-14-14v-74Z" fill="url(#verify-mail-flap)" />
    <path d="m44 185 62-48 14 12 14-12 62 48a14 14 0 0 1-14 8H58a14 14 0 0 1-14-8Z" fill="#8D57FD" />
    <path d="m196 37 4-23M211 47l15-15M215 62h18" stroke="#854CF8" strokeWidth="6" strokeLinecap="round" />
  </svg>;
}

function ClockIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9.2" /><path d="M12 6.4V12l4.1 2.5" />
  </svg>;
}

function RefreshIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 7v5h-5M4 17v-5h5" /><path d="M5.6 9A7.5 7.5 0 0 1 18 6l2 1M4 17l2 1a7.5 7.5 0 0 0 12.4-3" />
  </svg>;
}

function SmallMailIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="5" width="18" height="14" rx="2.4" /><path d="m4 7 8 6 8-6" />
  </svg>;
}

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [token] = useState(() => params.get("token")?.trim() ?? "");
  const { isAuthenticated, reloadUser, status: authStatus } = useAuth();
  const inFlight = useRef(false);
  const hasAttempted = useRef(false);
  const [state, setState] = useState<VerificationState>(token ? "loading" : "pending");
  const [message, setMessage] = useState("");
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
    setMessage("");
    try {
      await requestVerification(email.trim());
      setResent(true);
    } catch (caught) {
      setMessage(caught instanceof ApiError ? caught.message : "No se pudo solicitar el correo.");
    } finally {
      setResending(false);
    }
  }

  const heading = state === "success" ? "¡Correo verificado!"
    : state === "loading" ? "Verificando tu correo electrónico"
      : state === "error" ? "No pudimos verificar tu correo"
        : "Revisa tu correo electrónico";

  return <main className="verify-email-page">
    <SiteHeader active="home" />
    <div className="verify-email-scene">
      <article className="verify-email-card" aria-labelledby="verify-email-title">
        <div className="verify-email-hero">
          {state === "success" ? <span className="verify-email-success-illustration" aria-hidden="true">✓</span> : <MailIllustration />}
        </div>
        <h1 id="verify-email-title">{heading}</h1>
        {state === "pending" && <p className="verify-email-description">
          Enviamos un enlace de verificación a tu correo. Haz clic en el enlace para activar tu cuenta en <strong>XAMUKO</strong>.
        </p>}
        {state === "loading" && <p className="verify-email-description" role="status">
          Confirmando tu correo de forma segura…
        </p>}
        {state === "error" && <p className="verify-email-description">
          {message || "El enlace no es válido o ya expiró. Puedes solicitar uno nuevo aquí mismo."}
        </p>}
        {state === "success" && <p className="verify-email-description" role="status">
          Tu correo se verificó correctamente. Tu cuenta de <strong>XAMUKO</strong> está lista.
        </p>}

        {state === "pending" && <div className="verify-email-timer" aria-label="Tiempo de verificación previsto: 15 minutos">
          <span className="verify-email-timer-badge"><ClockIcon /><strong>15:00</strong></span>
          <p>Tienes 15 minutos para verificar tu correo.</p>
        </div>}

        {(state === "pending" || state === "error") && <form className="verify-email-resend" onSubmit={resend}>
          {!email.trim() && <label htmlFor="verify-email-address">Correo electrónico
            <input id="verify-email-address" type="email" value={email} onChange={event => setEmail(event.target.value)} required autoComplete="email" placeholder="tu@correo.com" />
          </label>}
          <button type="submit" disabled={resending || !email.trim()}>
            <RefreshIcon />{resending ? "Enviando correo…" : "Reenviar correo de verificación"}
          </button>
          {resent && <p className="verify-email-feedback is-success" role="status">Si la cuenta es elegible, recibirás un nuevo enlace de verificación.</p>}
          {message && state === "pending" && <p className="verify-email-feedback is-error" role="alert">{message}</p>}
        </form>}

        {state === "loading" && <div className="verify-email-progress" role="status" aria-label="Verificación en curso"><span /></div>}
        {state === "success" && <Link className="verify-email-primary-link" to="/register?mode=login&next=%2Fprofile">Iniciar sesión</Link>}

        {(state === "pending" || state === "error") && <div className="verify-email-help">
          <span className="verify-email-help-icon"><SmallMailIcon /></span>
          <div><strong>¿No ves el correo?</strong><p>Revisa tu carpeta de spam o correo no deseado.</p></div>
        </div>}
        <div className="verify-email-footer">
          <Link to="/register?mode=login"><span aria-hidden="true">←</span> Volver al inicio de sesión</Link>
        </div>
      </article>
    </div>
  </main>;
}
