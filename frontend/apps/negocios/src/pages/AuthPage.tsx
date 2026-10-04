import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useBusinessStore } from "../services/businessStore";
import { BusinessHeader } from "../components/layout/BusinessHeader";

function GoogleIcon() { return <svg aria-hidden="true" viewBox="0 0 48 48"><path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.5 9.5 0 0 1-4.1 6.2v5.1h6.6c3.9-3.6 6.1-8.9 6.1-15Z"/><path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.8l-6.6-5.1c-1.8 1.2-4.1 2-6.9 2-5.3 0-9.8-3.6-11.4-8.4H5.8V33A20 20 0 0 0 24 44Z"/><path fill="#FBBC05" d="M12.6 27.7a12 12 0 0 1 0-7.4v-5.1H5.8a20 20 0 0 0 0 17.6l6.8-5.1Z"/><path fill="#EA4335" d="M24 12c3 0 5.6 1 7.7 3l5.8-5.8A19.4 19.4 0 0 0 24 4 20 20 0 0 0 5.8 15.2l6.8 5.1C14.2 15.6 18.7 12 24 12Z"/></svg>; }
function FacebookIcon() { return <svg aria-hidden="true" viewBox="0 0 24 24"><path fill="#1877F2" d="M24 12a12 12 0 1 0-13.9 11.9v-8.4H7.1V12h3V9.3c0-3 1.8-4.7 4.5-4.7 1.3 0 2.6.2 2.6.2v2.9h-1.5c-1.5 0-2 .9-2 1.9V12h3.3l-.5 3.5h-2.8v8.4A12 12 0 0 0 24 12Z"/></svg>; }
const providers = [{ name: "Google", Icon: GoogleIcon }, { name: "Facebook", Icon: FacebookIcon }];
const userPreviewUrl = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
  ? `${window.location.protocol}//${window.location.hostname}:5174/`
  : "/";

export function AuthPage({ mode }: { mode: "login" | "register" }) {
  const navigate = useNavigate();
  const { account, setAccount, setBusinesses } = useBusinessStore();
  const register = mode === "register";
  const [name, setName] = useState(register ? "Mariana Castillo" : account.name);
  const [email, setEmail] = useState(register ? "mariana.castillo@ejemplo.com" : account.email);
  const [password, setPassword] = useState(register ? "WitDemo2026!" : "");
  const [confirmation, setConfirmation] = useState(register ? "WitDemo2026!" : "");
  const [showPassword, setShowPassword] = useState(false);
  const [accepted, setAccepted] = useState(register);
  const [message, setMessage] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (register && !accepted) { setMessage("Acepta los términos y la política de privacidad para continuar."); return; }
    if (register && password !== confirmation) { setMessage("Las contraseñas no coinciden."); return; }
    if (register) { setAccount({ ...account, name, email }); setBusinesses([]); }
    setMessage(register ? "Tu cuenta está lista para continuar." : "Sesión iniciada.");
    window.setTimeout(() => navigate(register ? "/sin-negocio" : "/"), 650);
  };
  const providerMessage = (provider: string) => setMessage(`El acceso con ${provider} estará disponible cuando conectemos la autenticación.`);
  return <main className="auth-page">
    <BusinessHeader />
    <div className="auth-layout">
      <section className="auth-story"><div className="auth-panel-brand"><strong>WIT</strong><span>Negocios</span></div><h1>Tu negocio más cerca de las personas que te buscan.</h1><div className="auth-panel-illustration" aria-hidden="true"><span>⌂</span><i /><b /></div></section>
      <section className="auth-form-card">
        <div className="auth-form-heading"><h2>{register ? "Crea tu cuenta en WIT Negocios" : "Inicia sesión en WIT Negocios"}</h2><p>{register ? "Crea la cuenta del propietario y añade tus negocios después." : "Ingresa para administrar tu negocio."}</p></div>
        <div className="auth-social-options">{providers.map(({ name: provider, Icon }) => <button key={provider} type="button" className="auth-provider-button" onClick={() => providerMessage(provider)}><Icon /><span>Continuar con {provider}</span></button>)}</div>
        <div className="auth-divider"><span>o con tu correo</span></div>
        <form onSubmit={submit} className="auth-form">
          {register && <label>Nombre completo<input value={name} onChange={event => setName(event.target.value)} required maxLength={60} autoComplete="name" placeholder="Tu nombre completo" /></label>}
          <label>Correo electrónico<input type="email" value={email} onChange={event => setEmail(event.target.value)} required autoComplete="email" placeholder="tu@correo.com" /></label>
          <label>Contraseña<span className="auth-password-field"><input type={showPassword ? "text" : "password"} value={password} onChange={event => setPassword(event.target.value)} required minLength={8} autoComplete={register ? "new-password" : "current-password"} placeholder="Al menos 8 caracteres" /><button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}>{showPassword ? "Ocultar" : "Mostrar"}</button></span></label>
          {register && <label>Confirmar contraseña<span className="auth-password-field"><input type={showPassword ? "text" : "password"} value={confirmation} onChange={event => setConfirmation(event.target.value)} required minLength={8} autoComplete="new-password" placeholder="Repite tu contraseña" /></span></label>}
          {register && <label className="auth-legal-check"><input type="checkbox" checked={accepted} onChange={event => setAccepted(event.target.checked)} /><span>Acepto los <Link to="/legal/terms?from=registro">Términos y condiciones</Link> y la <Link to="/legal/privacy?from=registro">Política de privacidad</Link>.</span></label>}
          {message && <p className="auth-status" role="status">{message}</p>}
          <button type="submit" className="action-button auth-submit">{register ? "Crear mi cuenta" : "Iniciar sesión"}</button>
        </form>
        {!register && <Link className="auth-forgot" to="/recuperar">¿Olvidaste tu contraseña?</Link>}
        <button className="auth-mode-switch" type="button" onClick={() => navigate(register ? "/login" : "/registro")}>{register ? "¿Ya tienes una cuenta? Iniciar sesión" : "¿No tienes una cuenta? Crear cuenta"}</button>
        <a className="auth-preview-button" href={userPreviewUrl}>Entrar en vista previa como usuario registrado</a>
      </section>
    </div>
  </main>;
}
