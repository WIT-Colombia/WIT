import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { PageMetadata } from "@wit/ui";
import { getAuthPageMetadata, metadataTags } from "@wit/utils";
import { ApiError } from "../services/httpClient";
import { validateEmail } from "../services/emailValidation";
import { getRememberedEmail, startGoogleLogin, isBusinessReferralRegistrationAvailable, validateBusinessReferralCode } from "../services/authService";
import { isValidBusinessReferralCode } from "../utils/businessReferralCode";
import { clearPendingVerificationEmail, rememberPendingVerificationEmail } from "../services/pendingVerification";
import xamukoLogo from "../assets/xamuko-wordmark.webp";
import xamukoLogo320 from "../assets/xamuko-wordmark-320.webp";
import xamukoLogo640 from "../assets/xamuko-wordmark-640.webp";
import xamukoLogo960 from "../assets/xamuko-wordmark-960.webp";
import discoveryArt from "../assets/auth-discovery-1112.webp";
import discoveryArtSmall from "../assets/auth-discovery-600.webp";
import "./Register.css";
import "./RegisterEnhancements.css";
import "./RegisterAlert.css";
import "./RegisterRedesign.css";

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
  const [message, setMessage] = useState(() => params.get("verified") === "1" ? "Correo verificado. Inicia sesión para comenzar a explorar." : "");
  const [requiresVerification, setRequiresVerification] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const invitedReferralCode = params.get("ref")?.trim().toUpperCase() ?? "";
  const [manualReferralCode, setManualReferralCode] = useState("");
  const referralCode = invitedReferralCode || manualReferralCode;
  const [submitting, setSubmitting] = useState(false);
  const [referralValidation, setReferralValidation] = useState<{ code: string; status: "valid" | "invalid" | "unavailable" } | null>(null);
  const normalizedReferral = referralCode.trim().toUpperCase();
  const referralFormatValid = isValidBusinessReferralCode(normalizedReferral);
  const referralChecking = Boolean(normalizedReferral && referralFormatValid && referralValidation?.code !== normalizedReferral);
  useEffect(() => {
    if (!normalizedReferral || !referralFormatValid) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      void validateBusinessReferralCode(normalizedReferral, controller.signal)
        .then(valid => { if (!controller.signal.aborted) setReferralValidation({ code: normalizedReferral, status: valid ? "valid" : "invalid" }); })
        .catch(() => { if (!controller.signal.aborted) setReferralValidation({ code: normalizedReferral, status: "unavailable" }); });
    }, 350);
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [normalizedReferral, referralFormatValid]);
  const returnTo = "/home";
  const passwordError = mode === "register" && (fieldErrors.password || (password.length > 0 && password.length < 8 ? "Tu contraseña debe tener al menos 8 caracteres." : ""));
  const confirmPasswordError = mode === "register" && confirmPassword.length > 0 && password !== confirmPassword ? "Las contraseñas no coinciden." : "";
  const hasPasswordErrors = Boolean(passwordError || confirmPasswordError);
  const referralError = mode === "register" && referralCode.trim() && !isValidBusinessReferralCode(referralCode)
    ? "El código debe tener el formato XMK seguido de 32 caracteres."
    : normalizedReferral && referralValidation?.code === normalizedReferral && referralValidation.status === "invalid" ? "Este código de referido no existe o no está disponible."
    : normalizedReferral && referralValidation?.code === normalizedReferral && referralValidation.status === "unavailable" ? "No pudimos comprobar el código. Intenta nuevamente."
    : fieldErrors.referralCode ?? "";

  async function submit(event: FormEvent) {
    event.preventDefault();
    const validationError = validateEmail(email);
    if (mode === "register" && !name.trim()) setNameError("Ingresa tu nombre.");
    if (validationError) setEmailError("Ingresa un correo electrónico válido.");
    if (mode === "register" && (!name.trim() || validationError)) return;
    if (mode === "register" && (hasPasswordErrors || password.length < 8 || password !== confirmPassword)) return;
    if (mode === "register" && (referralError || referralChecking)) { setMessage("Espera a que validemos el código de referido."); return; }
    if (mode === "register" && !accepted) { setMessage("Acepta los términos y la política de privacidad para continuar."); return; }
    setSubmitting(true);
    setMessage("");
    setRequiresVerification(false);
    try {
      if (mode === "register") {
        if (referralCode.trim() && !(await isBusinessReferralRegistrationAvailable())) {
          setMessage("El registro con referidos aún no está disponible en el servidor. Espera a que se active el servicio para conservar la invitación.");
          return;
        }
        const created = await register(name.trim(), email.trim(), password, referralCode.trim() || undefined);
        rememberPendingVerificationEmail(email.trim(), created.verificationExpiresAt, created.verificationEmailSent !== false);
        navigate("/verify-email?pending=1", { replace: true });
      } else {
        await login(email.trim(), password, rememberMe);
        clearPendingVerificationEmail();
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
  const seo = getAuthPageMetadata("usuario", mode);
  const submitDisabled = submitting || status === "loading" || (registration && (hasPasswordErrors || Boolean(referralError) || referralChecking));

  return <main className="register-page user-auth-page">
    <PageMetadata {...seo} tags={metadataTags(seo)} />
    <div className={`user-auth-layout${registration ? " is-register" : " is-login"}`}>
      <section className="user-auth-story" aria-label="Descubre XAMUKO">
        <div className="user-auth-brand">
          <img src={xamukoLogo} srcSet={`${xamukoLogo320} 320w, ${xamukoLogo640} 640w, ${xamukoLogo960} 960w, ${xamukoLogo} 2170w`} sizes="(max-width: 760px) 205px, (max-width: 1100px) 200px, 240px" alt="XAMUKO" width="2170" height="725" />
          <p>Lo que necesitas, está más cerca.</p>
        </div>
        <div className="user-auth-story-copy">
          <h2>Encuentra negocios,<br />productos y servicios<br /><span>cerca de ti</span></h2>
          <p>Explora tu ciudad, descubre lo que ofrecen los establecimientos y contacta directamente con ellos.</p>
          <ul className="user-auth-benefits">
            <li><span aria-hidden="true"><PinIcon /></span><div><b>Descubre negocios cercanos</b><small>Explora establecimientos en tu ubicación o en tu ciudad.</small></div></li>
            <li><span aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="4" y="7" width="16" height="14" rx="2"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/></svg></span><div><b>Encuentra productos y servicios</b><small>Utiliza la búsqueda, las categorías y los filtros para encontrar lo que necesitas.</small></div></li>
            <li><span aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M3 10h18L19 3H5l-2 7Zm2 0v11h14V10M9 21v-7h6v7M8 3l-1 7m9-7 1 7"/><path d="M3 10c0 3 4 3 4 0 0 3 5 3 5 0 0 3 5 3 5 0 0 3 4 3 4 0"/></svg></span><div><b>Conoce cada negocio</b><small>Consulta información comercial, horarios, ubicación y medios de contacto disponibles.</small></div></li>
            <li><span aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="m12 21-8.5-9a5.5 5.5 0 0 1 8.5-7 5.5 5.5 0 0 1 8.5 7L12 21Z"/></svg></span><div><b>Guarda tus favoritos</b><small>Conserva los negocios de tu interés.</small></div></li>
          </ul>
        </div>
        <picture className="user-auth-illustration" aria-hidden="true">
          <source media="(max-width: 760px)" srcSet="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=" />
          <source type="image/webp" srcSet={`${discoveryArtSmall} 600w, ${discoveryArt} 1112w`} sizes="(max-width: 1200px) 32vw, 470px" />
          <img src={discoveryArt} alt="" width="1112" height="1414" decoding="async" fetchPriority="low" />
        </picture>
        <div className="user-auth-explore-strip" aria-label="Descubre XAMUKO a tu manera">
          <span><PinIcon />Explora tu ciudad</span><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/></svg>Busca lo que necesitas</span><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m5 3 4 4-2 3a16 16 0 0 0 7 7l3-2 4 4-3 3C9 22 2 15 2 6l3-3Z"/></svg>Contacta directamente</span>
        </div>
      </section>

      <section className="user-auth-main" aria-label={registration ? "Crear cuenta" : "Iniciar sesión"}>
        <div className="user-auth-card">
          <div className="user-auth-mode-tabs" role="group" aria-label="Acceso a tu cuenta"><span className="user-auth-current-mode">{registration ? "Registrarme" : "Iniciar sesión"}</span><button className="register-mode-switch user-auth-mode-switch" type="button" aria-label={registration ? "¿Ya tienes una cuenta? Inicia sesión" : "¿No tienes una cuenta? Crear cuenta"} onClick={() => { setMode(registration ? "login" : "register"); setMessage(""); }}>{registration ? "Iniciar sesión" : "Registrarme"}</button></div>
          <div className="user-auth-heading">
            <h1>{registration ? "Crea tu cuenta en XAMUKO" : "Inicia sesión en tu cuenta"}</h1>
            <p>{registration ? "Descubre negocios, productos y servicios en tu ciudad." : "Descubre negocios, productos y servicios en tu ciudad."}</p>
          </div>
          {message && <p className="register-status" role="alert">{message}</p>}
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
            {registration && <label className={`user-auth-field user-auth-referral${referralError ? " field-invalid" : ""}`}>Código de referido (opcional)
              {invitedReferralCode ? <output className="user-auth-referral-code" aria-label="Código de referido asignado">{invitedReferralCode}</output> : <input value={manualReferralCode} onChange={(event) => { setManualReferralCode(event.target.value.toUpperCase()); setFieldErrors((errors) => ({ ...errors, referralCode: "" })); }} maxLength={40} autoCapitalize="characters" autoComplete="off" spellCheck={false} placeholder="XMK-..." aria-invalid={Boolean(referralError)} aria-describedby={referralError ? "register-referral-error" : undefined}/>}
              {referralChecking && <small className="user-auth-referral-note" role="status">Comprobando código de referido…</small>}
              {referralValidation?.code === normalizedReferral && referralValidation.status === "valid" && !referralError && <small className="user-auth-referral-note">✓ Código válido. Tu registro quedará asociado al negocio que te invitó.</small>}
              {referralError && <small id="register-referral-error" className="field-error" role="alert">{referralError}</small>}
            </label>}
            {registration && <label className="register-legal-check"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)}/><span>Acepto los <Link to="/legal/terms?from=register">Términos y condiciones</Link> y la <Link to="/legal/privacy?from=register">Política de privacidad</Link>.</span></label>}
            {!registration && <label className="register-legal-check"><input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)}/><span>Mantener mi sesión iniciada</span></label>}
            
            <button className="register-submit" type="submit" disabled={submitDisabled}>{submitting ? "Procesando…" : registration ? "Crear mi cuenta" : "Iniciar sesión"}<span aria-hidden="true">→</span></button>
          </form>
          {!registration && <Link className="register-mode-switch register-forgot-link" to="/recover-password">¿Olvidaste tu contraseña?</Link>}
          <div className="register-divider"><span>o continúa con</span></div>
          <div className="register-social-options">
            <button type="button" className="register-provider-button" onClick={async () => { if (registration && !accepted) { setMessage("Acepta los términos y la política de privacidad para continuar."); return; } if (registration && (referralError || referralChecking)) { setMessage("Espera a que validemos el código de referido."); return; } if (registration && referralCode.trim() && !(await isBusinessReferralRegistrationAvailable())) { setMessage("El registro con referidos aún no está disponible en el servidor. Puedes esperar a que lo activemos o borrar el código para crear tu cuenta sin referido."); return; } startGoogleLogin({ returnTo, consent: registration ? accepted : true, rememberMe, referralCode: registration ? referralCode.trim() || undefined : undefined }); }}>
              <GoogleIcon/><span>Continuar con Google</span>
            </button>
          </div>
          {requiresVerification && <Link className="register-mode-switch" to="/verify-email?pending=1" onClick={() => rememberPendingVerificationEmail(email.trim())}>Reenviar correo de verificación</Link>}

        </div>
      </section>
    </div>
  </main>;
}
