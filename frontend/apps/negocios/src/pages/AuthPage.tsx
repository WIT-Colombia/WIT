import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useBusinessStore } from "../services/businessStore";
import { useBusinessAuth } from "../services/businessAuthContext";
import { BusinessApiError } from "../services/businessApiClient";
import { getRememberedEmail, resolveBusinessNext, startGoogleLogin } from "../services/businessAuthService";
import { clearPendingVerificationEmail, rememberPendingVerificationEmail } from "../services/pendingVerification";
import xamukoLogo from "../assets/XAMUKO-V1-transparent.png";
import businessIllustration from "../assets/auth-business-discovery.svg";
import "./AuthPageVisual.css";

function GoogleIcon() { return <svg aria-hidden="true" viewBox="0 0 48 48"><path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.5 9.5 0 0 1-4.1 6.2v5.1h6.6c3.9-3.6 6.1-8.9 6.1-15Z"/><path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.8l-6.6-5.1c-1.8 1.2-4.1 2-6.9 2-5.3 0-9.8-3.6-11.4-8.4H5.8V33A20 20 0 0 0 24 44Z"/><path fill="#FBBC05" d="M12.6 27.7a12 12 0 0 1 0-7.4v-5.1H5.8a20 20 0 0 0 0 17.6l6.8-5.1Z"/><path fill="#EA4335" d="M24 12c3 0 5.6 1 7.7 3l5.8-5.8A19.4 19.4 0 0 0 24 4 20 20 0 0 0 5.8 15.2l6.8 5.1C14.2 15.6 18.7 12 24 12Z"/></svg>; }
const providers = [{ name: "Google", Icon: GoogleIcon }];

function FieldIcon({ kind }: { kind: "person" | "mail" | "lock" }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
    {kind === "person" && <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>}
    {kind === "mail" && <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></>}
    {kind === "lock" && <><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3m-4 4v3"/></>}
  </svg>;
}

function EyeIcon({ hidden }: { hidden: boolean }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/>{hidden && <path d="m4 4 16 16"/>}</svg>;
}

function BenefitIcon({ kind }: { kind: "shop" | "chart" | "content" | "pin" }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    {kind === "shop" && <><path d="M3 10h18l-2-7H5l-2 7Zm2 0v11h14V10M9 21v-7h6v7M8 3l-1 7m9-7 1 7"/><path d="M3 10c0 3 4 3 4 0 0 3 5 3 5 0 0 3 5 3 5 0 0 3 4 3 4 0"/></>}
    {kind === "chart" && <><path d="M3 21h18M5 21v-7h3v7m3 0V9h3v12m3 0V3h3v18"/></>}
    {kind === "content" && <><path d="m3 9 16-5v14L3 13V9Zm4 5 2 7h4l-3-6M19 8l3-1m-3 7 3 1"/></>}
    {kind === "pin" && <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>}
  </svg>;
}

export function AuthPage({ mode }: { mode: "login" | "register" }) {
  const navigate = useNavigate();
  const { account } = useBusinessStore();
  const { signIn, signUp } = useBusinessAuth();
  const register = mode === "register";
  const [name, setName] = useState(register ? "" : account.name);
  const [email, setEmail] = useState(register ? "" : getRememberedEmail());
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [accepted, setAccepted] = useState(register);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [requiresVerification, setRequiresVerification] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (register && !accepted) { setMessage("Acepta los términos y la política de privacidad para continuar."); return; }
    if (register && password !== confirmation) { setMessage("Las contraseñas no coinciden."); return; }
    setLoading(true);
    setMessage("");
    setRequiresVerification(false);
    try {
      if (register) {
        const created = await signUp(name, email, password);
        rememberPendingVerificationEmail(email, created.verificationExpiresAt, created.verificationEmailSent !== false);
        navigate("/verify-email?pending=1", { replace: true });
      } else {
        await signIn(email, password, rememberMe);
        clearPendingVerificationEmail();
        navigate("/inicio", { replace: true });
      }
    } catch (error) {
      setRequiresVerification(error instanceof BusinessApiError && error.code === "EMAIL_NOT_VERIFIED");
      setMessage(error instanceof BusinessApiError ? error.message : "No se pudo completar la solicitud.");
    } finally {
      setLoading(false);
    }
  };
  const startGoogle = () => {
    if (register && !accepted) { setMessage("Acepta los términos y la política de privacidad para continuar."); return; }
    startGoogleLogin({ returnTo: resolveBusinessNext(new URLSearchParams(window.location.search).get("next")), consent: register ? accepted : true, rememberMe });
  };
  return <main className="auth-page business-auth-page">
    <div className={`auth-layout${register ? " is-register" : " is-login"}`}>
      <section className="auth-story" aria-label="Descubre XAMUKO Business">
        <div className="auth-panel-brand"><img src={xamukoLogo} alt="XAMUKO" width="2170" height="725" /><p>Lo que necesitas, está más cerca.</p></div>
        <div className="business-auth-story-copy">
          <h1>Haz que más personas<br />encuentren <span>tu negocio</span></h1>
          <p>Gestiona tu presencia digital, aumenta tu visibilidad y conéctate con clientes cercanos en tu ciudad.</p>
          <ul className="auth-story-benefits">
            <li><span><BenefitIcon kind="shop" /></span><div><b>Crea y gestiona tu perfil comercial</b><small>Publica la información de tu negocio, productos y servicios.</small></div></li>
            <li><span><BenefitIcon kind="chart" /></span><div><b>Consulta estadísticas de tu negocio</b><small>Conoce el rendimiento y la interacción de tus clientes.</small></div></li>
            <li><span><BenefitIcon kind="content" /></span><div><b>Gestiona contenido y opiniones</b><small>Comparte novedades, promociones y responde a tus clientes mediante las herramientas disponibles.</small></div></li>
            <li><span><BenefitIcon kind="pin" /></span><div><b>Conecta con clientes cercanos</b><small>Facilita que las personas encuentren tu negocio y se comuniquen directamente contigo.</small></div></li>
          </ul>
        </div>
        <img className="business-auth-illustration" src={businessIllustration} width="800" height="1000" alt="" aria-hidden="true" decoding="async" />
      </section>
      <section className="auth-form-card" aria-label={register ? "Crear cuenta" : "Iniciar sesión"}>
        <div className="business-auth-mode-tabs" role="group" aria-label="Acceso a tu cuenta"><span className="business-auth-current-mode">{register ? "Registrarme" : "Iniciar sesión"}</span><button className="auth-mode-switch" type="button" aria-label={register ? "¿Ya tienes una cuenta? Iniciar sesión" : "¿No tienes una cuenta? Crear cuenta"} onClick={() => navigate(register ? "/login" : "/registro")}>{register ? "Iniciar sesión" : "Registrarme"}</button></div>
        <div className="auth-form-heading"><h2>{register ? "Crea tu cuenta en XAMUKO Business" : "Inicia sesión en XAMUKO Business"}</h2><p>{register ? "Crea la cuenta del propietario y añade tus negocios después." : "Ingresa para administrar tu negocio."}</p></div>
        <form onSubmit={submit} className="auth-form">
          {register && <label>Nombre completo<span className="business-auth-input-wrap"><FieldIcon kind="person"/><input value={name} onChange={event => setName(event.target.value)} required maxLength={60} autoComplete="name" placeholder="Tu nombre completo" /></span></label>}
          <label>Correo electrónico<span className="business-auth-input-wrap"><FieldIcon kind="mail"/><input type="email" value={email} onChange={event => setEmail(event.target.value)} required autoComplete="email" placeholder="tu@correo.com" /></span></label>
          <label>Contraseña<span className="auth-password-field business-auth-input-wrap"><FieldIcon kind="lock"/><input type={showPassword ? "text" : "password"} value={password} onChange={event => setPassword(event.target.value)} required minLength={8} autoComplete={register ? "new-password" : "current-password"} placeholder="Al menos 8 caracteres" /><button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}><EyeIcon hidden={!showPassword}/></button></span></label>
          {register && <label>Confirmar contraseña<span className="auth-password-field business-auth-input-wrap"><FieldIcon kind="lock"/><input type={showPassword ? "text" : "password"} value={confirmation} onChange={event => setConfirmation(event.target.value)} required minLength={8} autoComplete="new-password" placeholder="Repite tu contraseña" /></span></label>}
          {register && <label className="auth-referral-placeholder">Código de referido (opcional)<input disabled value="" placeholder="Se habilitará próximamente" /></label>}
          {register && <label className="auth-legal-check"><input type="checkbox" checked={accepted} onChange={event => setAccepted(event.target.checked)} /><span>Acepto los <Link to="/legal/terms?from=registro">Términos y condiciones</Link> y la <Link to="/legal/privacy?from=registro">Política de privacidad</Link>.</span></label>}
          {!register && <label className="auth-legal-check"><input type="checkbox" checked={rememberMe} onChange={event => setRememberMe(event.target.checked)} /><span>Mantener mi sesión iniciada</span></label>}
          {message && <p className={`auth-status${register ? "" : " auth-status-error"}`} role="status">{message}</p>}
          <button type="submit" className="action-button auth-submit" disabled={loading}>{loading ? "Conectando…" : register ? "Crear mi cuenta" : "Iniciar sesión"}<span aria-hidden="true">→</span></button>
        </form>
        {!register && <Link className="auth-forgot" to="/recuperar?mode=email">¿Olvidaste tu contraseña?</Link>}
        {requiresVerification && <Link className="auth-forgot" to="/verify-email?pending=1" onClick={() => rememberPendingVerificationEmail(email)}>Reenviar correo de verificación</Link>}
        <div className="auth-divider"><span>o continúa con</span></div>
        <div className="auth-social-options">{providers.map(({ name: provider, Icon }) => <button key={provider} type="button" className="auth-provider-button" onClick={startGoogle}><Icon /><span>Continuar con {provider}</span></button>)}</div>
      </section>
    </div>
  </main>;
}
