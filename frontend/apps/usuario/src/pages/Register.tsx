import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../services/httpClient";
import { validateEmail } from "../services/emailValidation";
import { getRememberedEmail, startGoogleLogin } from "../services/authService";
import xamukoLogo from "../assets/XAMUKO-V1-transparent.png";
import authReference from "../assets/auth-reference-users2.avif";
import "./Register.css";
import "./RegisterEnhancements.css";
import "./RegisterAlert.css";
import "./RegisterRedesign.css";

function safeReturn(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") && !value.startsWith("/register") ? value : "/profile";
}

function GoogleIcon() {
  return <svg aria-hidden="true" viewBox="0 0 48 48"><path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.5 9.5 0 0 1-4.1 6.2v5.1h6.6c3.9-3.6 6.1-8.9 6.1-15Z"/><path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.8l-6.6-5.1c-1.8 1.2-4.1 2-6.9 2-5.3 0-9.8-3.6-11.4-8.4H5.8V33A20 20 0 0 0 24 44Z"/><path fill="#FBBC05" d="M12.6 27.7a12 12 0 0 1 0-7.4v-5.1H5.8a20 20 0 0 0 0 17.6l6.8-5.1Z"/><path fill="#EA4335" d="M24 12c3 0 5.6 1 7.7 3l5.8-5.8A19.4 19.4 0 0 0 24 4 20 20 0 0 0 5.8 15.2l6.8 5.1C14.2 15.6 18.7 12 24 12Z"/></svg>;
}

function EyeIcon({ hidden }: { hidden: boolean }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/>{hidden && <path d="m4 4 16 16"/>}</svg>;
}

function MailIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></svg>;
}

function LockIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3m-4 4v3"/></svg>;
}

function PersonIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>;
}

function PinIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>;
}

export default function Register() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { login, register, status } = useAuth();
  const [mode, setMode] = useState<"register" | "login">(params.get("mode") === "login" ? "login" : "register");
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState("");
  const [email, setEmail] = useState(() => getRememberedEmail());
  const [emailError, setEmailError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [message, setMessage] = useState(() => params.get("verified") === "1" ? "Correo verificado. Inicia sesión para continuar a tu perfil." : "");
  const [requiresVerification, setRequiresVerification] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const returnTo = safeReturn(params.get("next"));
  const passwordError = mode === "register" && (fieldErrors.password || (password.length > 0 && password.length < 8 ? "Tu contraseña debe tener al menos 8 caracteres." : ""));
  const confirmPasswordError = mode === "register" && confirmPassword.length > 0 && password !== confirmPassword ? "Las contraseñas no coinciden." : "";
  const hasPasswordErrors = Boolean(passwordError || confirmPasswordError);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const validationError = validateEmail(email);
    if (mode === "register" && !name.trim()) setNameError("Ingresa tu nombre.");
    if (validationError) setEmailError("Ingresa un correo electrónico válido.");
    if (mode === "register" && (!name.trim() || validationError)) return;
    if (mode === "register" && (hasPasswordErrors || password.length < 8 || password !== confirmPassword)) return;
    if (mode === "register" && !accepted) { setMessage("Acepta los términos y la política de privacidad para continuar."); return; }
    setSubmitting(true);
    setMessage("");
    setRequiresVerification(false);
    try {
      if (mode === "register") {
        await register(name.trim(), email.trim(), password);
        navigate(`/verify-email?pending=1&email=${encodeURIComponent(email.trim())}`, { replace: true });
      } else {
        await login(email.trim(), password, rememberMe);
        navigate(returnTo, { replace: true });
      }
    } catch (error) {
      setRequiresVerification(error instanceof ApiError && error.code === "EMAIL_NOT_VERIFIED");
      if (error instanceof ApiError) {
        setFieldErrors(error.fields);
        setMessage(Object.keys(error.fields).length ? "" : error.message);
      } else setMessage(error instanceof Error ? error.message : "No se pudo completar la solicitud.");
    } finally {
      setSubmitting(false);
    }
  }

  const registration = mode === "register";
  const submitDisabled = submitting || status === "loading" || (registration && hasPasswordErrors);

  return <main className="register-page user-auth-page">
    <div className={`user-auth-layout${registration ? " is-register" : " is-login"}`}>
      <section className="user-auth-story" aria-label="Descubre XAMUKO">
        <div className="user-auth-reference-art" aria-hidden="true" style={{ backgroundImage: `url(${authReference})` }} />
        <div className="user-auth-brand"><img src={xamukoLogo} alt="XAMUKO" /></div>
        <div className="user-auth-story-copy">
          <h1>{registration ? <>Tu ciudad<br/>tiene <span>más</span><br/><span>de lo que imaginas.</span></> : <>Encuentra<br/>lo que necesitas,<br/><span>más cerca.</span></>}</h1>
          <p>{registration ? "Crea tu cuenta y empieza a descubrir todo lo que tienes cerca." : "Descubre negocios, productos y servicios en tu ciudad."}</p>
          <ul className="user-auth-benefits">
            {(registration ? ["Explora negocios en tu zona.", "Guarda tus favoritos y recibe recomendaciones.", "Comparte tu experiencia y apoya lo local."] : ["Explora negocios cerca de ti.", "Guarda tus favoritos y comparte.", "Apoya los negocios locales de tu ciudad."]).map((item, index) => <li key={item}><span aria-hidden="true">{[<PinIcon key="pin"/>, "♥", "★"][index]}</span><small>{item}</small></li>)}
          </ul>
        </div>
        <div className="user-auth-tagline">{registration ? <><span className="user-auth-tagline-default">Descubre · Apoya · Disfruta</span></> : <></>}</div>
      </section>

      <section className="user-auth-main" aria-label={registration ? "Crear cuenta" : "Iniciar sesión"}>
        <div className="user-auth-card">
          <div className="user-auth-mobile-brand"><img src={xamukoLogo} alt="XAMUKO" /></div>
          <div className="user-auth-heading">
            <h2>{registration ? "Crea tu cuenta en XAMUKO" : "Inicia sesión en XAMUKO"}</h2>
            <p>{registration ? "Descubre negocios, productos y servicios en tu ciudad." : "Descubre negocios, productos y servicios en tu ciudad."}</p>
          </div>
          <div className="register-social-options">
            <button type="button" className="register-provider-button" onClick={() => { if (registration && !accepted) { setMessage("Acepta los términos y la política de privacidad para continuar."); return; } startGoogleLogin({ returnTo, consent: registration ? accepted : true, rememberMe }); }}>
              <GoogleIcon/><span>Continuar con Google</span>
            </button>
          </div>
          <div className="register-divider"><span>o con tu correo</span></div>
          <form className="user-auth-form" onSubmit={submit} noValidate>
            {registration && <label className={`user-auth-field${nameError || fieldErrors.name ? " field-invalid" : ""}`}>
              Nombre completo
              <span className="user-auth-input-wrap"><PersonIcon/><input value={name} onChange={(event) => { setName(event.target.value); setNameError(""); setFieldErrors((errors) => ({ ...errors, name: "" })); }} aria-invalid={Boolean(nameError || fieldErrors.name)} aria-describedby={nameError || fieldErrors.name ? "register-name-error" : undefined} autoComplete="name" required maxLength={60} placeholder="Tu nombre y apellido"/></span>
              {(nameError || fieldErrors.name) && <small id="register-name-error" className="field-error" role="alert">{nameError || fieldErrors.name}</small>}
            </label>}
            <label className={`user-auth-field${emailError || fieldErrors.email ? " field-invalid" : ""}`}>
              Correo electrónico
              <span className="user-auth-input-wrap"><MailIcon/><input value={email} onChange={(event) => { const value = event.target.value; setEmail(value); setEmailError(validateEmail(value)); setFieldErrors((errors) => ({ ...errors, email: "" })); }} aria-invalid={Boolean(emailError || fieldErrors.email)} aria-describedby={emailError || fieldErrors.email ? "register-email-error" : undefined} type="email" autoComplete="email" required placeholder="tu@correo.com"/></span>
              {(emailError || fieldErrors.email) && <small id="register-email-error" className="field-error" role="alert">{emailError || fieldErrors.email}</small>}
            </label>
            <label className={`user-auth-field${passwordError ? " field-invalid" : ""}`}>
              Contraseña
              <span className="user-auth-input-wrap"><LockIcon/><input type={showPassword ? "text" : "password"} value={password} onChange={(event) => { setPassword(event.target.value); setFieldErrors((errors) => ({ ...errors, password: "" })); }} autoComplete={registration ? "new-password" : "current-password"} minLength={8} required placeholder={registration ? "Crea una contraseña" : "Tu contraseña"} aria-invalid={Boolean(passwordError)} aria-describedby={passwordError ? "register-password-error" : undefined}/><button type="button" className="password-visibility" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}><EyeIcon hidden={!showPassword}/></button></span>
              {passwordError && <small id="register-password-error" className="field-error" role="alert">{passwordError}</small>}
            </label>
            {registration && <label className={`user-auth-field${confirmPasswordError ? " field-invalid" : ""}`}>
              Confirmar contraseña
              <span className="user-auth-input-wrap"><LockIcon/><input type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" minLength={8} required placeholder="Repite tu contraseña" aria-invalid={Boolean(confirmPasswordError)} aria-describedby={confirmPasswordError ? "register-confirm-password-error" : undefined}/><button type="button" className="password-visibility" onClick={() => setShowConfirmPassword((visible) => !visible)} aria-label={showConfirmPassword ? "Ocultar confirmación de contraseña" : "Mostrar confirmación de contraseña"}><EyeIcon hidden={!showConfirmPassword}/></button></span>
              {confirmPasswordError && <small id="register-confirm-password-error" className="field-error" role="alert">{confirmPasswordError}</small>}
            </label>}
            {registration && <label className="user-auth-field user-auth-referral">Código de referido (opcional)<input disabled value="" placeholder="Ingresa un código de referido"/></label>}
            {registration && <label className="register-legal-check"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)}/><span>Acepto los <Link to="/legal/terms?from=register">Términos y condiciones</Link> y la <Link to="/legal/privacy?from=register">Política de privacidad</Link>.</span></label>}
            {!registration && <label className="register-legal-check"><input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)}/><span>Mantener mi sesión iniciada</span></label>}
            {message && <p className="register-status" role="status">{message}</p>}
            <button className="register-submit" type="submit" disabled={submitDisabled}>{submitting ? "Procesando…" : registration ? "Crear mi cuenta" : "Iniciar sesión"}<span aria-hidden="true">→</span></button>
          </form>
          {!registration && <Link className="register-mode-switch register-forgot-link" to="/recover-password">¿Olvidaste tu contraseña?</Link>}
          {requiresVerification && <Link className="register-mode-switch" to={`/verify-email?pending=1&email=${encodeURIComponent(email.trim())}`}>Reenviar correo de verificación</Link>}
          <button className="register-mode-switch user-auth-mode-switch" type="button" onClick={() => { setMode(registration ? "login" : "register"); setMessage(""); }}>{registration ? "¿Ya tienes una cuenta? Inicia sesión" : "¿No tienes una cuenta? Crear cuenta"}</button>
        </div>
      </section>
    </div>
  </main>;
}
