import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useBusinessStore } from "../services/businessStore";
import { useBusinessAuth } from "../services/businessAuthContext";
import { BusinessApiError } from "../services/businessApiClient";
import { getRememberedEmail, resolveBusinessNext, startGoogleLogin } from "../services/businessAuthService";
import { BusinessHeader } from "../components/layout/BusinessHeader";
import xamukoLogo from "../assets/XAMUKO-V1-transparent.avif";

function GoogleIcon() { return <svg aria-hidden="true" viewBox="0 0 48 48"><path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.5 9.5 0 0 1-4.1 6.2v5.1h6.6c3.9-3.6 6.1-8.9 6.1-15Z"/><path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.8l-6.6-5.1c-1.8 1.2-4.1 2-6.9 2-5.3 0-9.8-3.6-11.4-8.4H5.8V33A20 20 0 0 0 24 44Z"/><path fill="#FBBC05" d="M12.6 27.7a12 12 0 0 1 0-7.4v-5.1H5.8a20 20 0 0 0 0 17.6l6.8-5.1Z"/><path fill="#EA4335" d="M24 12c3 0 5.6 1 7.7 3l5.8-5.8A19.4 19.4 0 0 0 24 4 20 20 0 0 0 5.8 15.2l6.8 5.1C14.2 15.6 18.7 12 24 12Z"/></svg>; }
const providers = [{ name: "Google", Icon: GoogleIcon }];

function AuthIllustration({ register }: { register: boolean }) {
  return <svg className={`auth-illustration-art${register ? " is-register" : ""}`} viewBox="0 0 720 520" role="img" aria-label="Ilustración de un negocio local en una ciudad">
    <defs>
      <linearGradient id="auth-sky" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#31218a"/><stop offset="1" stopColor="#1877dd"/></linearGradient>
      <linearGradient id="auth-store" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fff"/><stop offset="1" stopColor="#dbeaff"/></linearGradient>
      <linearGradient id="auth-pin" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#9b4dff"/><stop offset="1" stopColor="#12c9ec"/></linearGradient>
    </defs>
    <path fill="url(#auth-sky)" d="M0 0h720v520H0z"/>
    <circle cx="575" cy="118" r="78" fill="#fa82dc" opacity=".2"/>
    <path fill="#4b52bc" d="m0 330 122-114 95 88 142-152 110 124 107-96 144 139v201H0z"/>
    <path fill="#292577" d="m0 385 132-98 126 101 132-125 137 101 102-78 91 72v162H0z"/>
    <g fill="#243a91" opacity=".9"><path d="M26 321h44v151H26zM83 290h52v182H83zM146 340h43v132h-43zM555 296h58v176h-58zM624 330h62v142h-62z"/></g>
    <g fill="#7be6ff" opacity=".8"><path d="M39 343h9v13h-9zm20 0h9v13h-9zm36-28h10v14H95zm21 0h10v14h-10zm-21 31h10v14H95zm21 0h10v14h-10zm450-21h10v14h-10zm21 0h10v14h-10zm-21 27h10v14h-10zm21 0h10v14h-10z"/></g>
    <path fill="url(#auth-store)" d="M155 322h372v174H155z"/>
    <path fill="#fff" d="M133 316h416l-28-60H161z"/>
    <path fill="#7b3ffb" d="m133 316 10-60h44l-7 60zm88 0 2-60h44v60zm88 0v-60h44v60zm88 0-2-60h44l8 60zm88 0-10-60h44l18 60z"/>
    <path fill="#273c9a" d="M190 358h298v17H190zM202 388h111v108H202zM330 388h133v108H330z"/>
    <path fill="#86ddff" d="M211 399h92v89h-92zm130 0h111v89H341z"/>
    <path fill="#fff" d="M343 422h107v8H343zm0 20h107v8H343z" opacity=".75"/>
    <path fill="#ffca7a" d="M212 431h91v57h-91z"/>
    <path fill="#f4a758" d="M212 451h91v37h-91z"/>
    <path fill="url(#auth-pin)" d="M574 106c-43 0-77 34-77 77 0 58 77 140 77 140s77-82 77-140c0-43-34-77-77-77Z"/>
    <circle cx="574" cy="183" r="27" fill="#fff"/>
    {register && <g transform="translate(495 335) rotate(-8)"><rect width="115" height="130" rx="15" fill="#2439a0"/><path d="m20 95 24-28 20 13 29-48" fill="none" stroke="#23d5ef" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round"/><path d="m82 31 13 1-2 13" fill="none" stroke="#23d5ef" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round"/></g>}
    <path fill="#10195b" d="M0 480q180-46 360 0t360 0v40H0z"/>
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
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (register && !accepted) { setMessage("Acepta los términos y la política de privacidad para continuar."); return; }
    if (register && password !== confirmation) { setMessage("Las contraseñas no coinciden."); return; }
    setLoading(true);
    setMessage("");
    try {
      if (register) {
        await signUp(name, email, password);
        navigate("/login?registered=1", { replace: true });
      } else {
        await signIn(email, password, rememberMe);
        const next = resolveBusinessNext(new URLSearchParams(window.location.search).get("next"));
        navigate(next, { replace: true });
      }
    } catch (error) {
      setMessage(error instanceof BusinessApiError ? error.message : "No se pudo completar la solicitud.");
    } finally {
      setLoading(false);
    }
  };
  const startGoogle = () => {
    if (register && !accepted) { setMessage("Acepta los términos y la política de privacidad para continuar."); return; }
    startGoogleLogin({ returnTo: resolveBusinessNext(new URLSearchParams(window.location.search).get("next")), consent: register ? accepted : true, rememberMe });
  };
  return <main className="auth-page">
    <BusinessHeader />
    <div className="auth-layout">
      <section className={`auth-story${register ? " is-register" : " is-login"}`}>
        <div className="auth-panel-brand"><img src={xamukoLogo} alt="XAMUKO" /><strong>Business</strong></div>
        <h1>{register ? <>Tu negocio en el mapa de <span>más personas</span></> : <>Haz crecer tu negocio con <span>XAMUKO</span></>}</h1>
        <p>{register ? "Regístrate y empieza a conectar con clientes reales en tu ciudad." : <>Conecta con <span>más personas</span> de tu ciudad y aumenta tu visibilidad.</>}</p>
        <ul className="auth-story-benefits">{(register ? ["Aumenta tu visibilidad en tu zona.", "Publica tus productos y servicios.", "Haz crecer tu comunidad."] : ["Llega a más clientes cerca de tu negocio.", "Muestra tus productos y servicios.", "Gestiona tu negocio fácilmente."]).map((item, index) => <li key={item}><span aria-hidden="true">{["✦", "★", "⚙"][index]}</span>{item}</li>)}</ul>
        <AuthIllustration register={register} />
        <div className="auth-story-tagline">Lo que necesitas,<br />está más cerca</div>
      </section>
      <section className="auth-form-card">
        <div className="auth-form-heading"><h2>{register ? "Crea tu cuenta en XAMUKO Business" : "Inicia sesión en XAMUKO Business"}</h2><p>{register ? "Crea la cuenta del propietario y añade tus negocios después." : "Ingresa para administrar tu negocio."}</p></div>
        <div className="auth-social-options">{providers.map(({ name: provider, Icon }) => <button key={provider} type="button" className="auth-provider-button" onClick={startGoogle}><Icon /><span>Continuar con {provider}</span></button>)}</div>
        <div className="auth-divider"><span>o con tu correo</span></div>
        <form onSubmit={submit} className="auth-form">
          {register && <label>Nombre completo<input value={name} onChange={event => setName(event.target.value)} required maxLength={60} autoComplete="name" placeholder="Tu nombre completo" /></label>}
          <label>Correo electrónico<input type="email" value={email} onChange={event => setEmail(event.target.value)} required autoComplete="email" placeholder="tu@correo.com" /></label>
          <label>Contraseña<span className="auth-password-field"><input type={showPassword ? "text" : "password"} value={password} onChange={event => setPassword(event.target.value)} required minLength={8} autoComplete={register ? "new-password" : "current-password"} placeholder="Al menos 8 caracteres" /><button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}>{showPassword ? "Ocultar" : "Mostrar"}</button></span></label>
          {register && <label>Confirmar contraseña<span className="auth-password-field"><input type={showPassword ? "text" : "password"} value={confirmation} onChange={event => setConfirmation(event.target.value)} required minLength={8} autoComplete="new-password" placeholder="Repite tu contraseña" /></span></label>}
          {register && <label className="auth-referral-placeholder">Código de referido (opcional)<input disabled value="" placeholder="Se habilitará próximamente" /></label>}
          {register && <label className="auth-legal-check"><input type="checkbox" checked={accepted} onChange={event => setAccepted(event.target.checked)} /><span>Acepto los <Link to="/legal/terms?from=registro">Términos y condiciones</Link> y la <Link to="/legal/privacy?from=registro">Política de privacidad</Link>.</span></label>}
          {!register && <label className="auth-legal-check"><input type="checkbox" checked={rememberMe} onChange={event => setRememberMe(event.target.checked)} /><span>Mantener mi sesión iniciada</span></label>}
          {message && <p className={`auth-status${register ? "" : " auth-status-error"}`} role="status">{message}</p>}
          <button type="submit" className="action-button auth-submit" disabled={loading}>{loading ? "Conectando…" : register ? "Crear mi cuenta" : "Iniciar sesión"}</button>
        </form>
        {!register && <Link className="auth-forgot" to="/recuperar?mode=email">¿Olvidaste tu contraseña?</Link>}
        <button className="auth-mode-switch" type="button" onClick={() => navigate(register ? "/login" : "/registro")}>{register ? "¿Ya tienes una cuenta? Iniciar sesión" : "¿No tienes una cuenta? Crear cuenta"}</button>
        <Link className="auth-preview-button" to="/preview">Entrar en vista previa demo</Link>
      </section>
    </div>
  </main>;
}
