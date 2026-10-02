import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Logo } from "@wit/ui";
import { startPreviewUserSession } from "../services/userDataService";
import "./Register.css";

type AuthMode = "register" | "login";

function safeReturnPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/register")) return "/profile";
  return value;
}

function GoogleIcon() {
  return <svg aria-hidden="true" viewBox="0 0 48 48"><path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.5 9.5 0 0 1-4.1 6.2v5.1h6.6c3.9-3.6 6.1-8.9 6.1-15Z"/><path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.8l-6.6-5.1c-1.8 1.2-4.1 2-6.9 2-5.3 0-9.8-3.6-11.4-8.4H5.8V33A20 20 0 0 0 24 44Z"/><path fill="#FBBC05" d="M12.6 27.7a12 12 0 0 1 0-7.4v-5.1H5.8a20 20 0 0 0 0 17.6l6.8-5.1Z"/><path fill="#EA4335" d="M24 12c3 0 5.6 1 7.7 3l5.8-5.8A19.4 19.4 0 0 0 24 4 20 20 0 0 0 5.8 15.2l6.8 5.1C14.2 15.6 18.7 12 24 12Z"/></svg>;
}

function AppleIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor"><path d="M16.37 12.3c.02 2.3 2.02 3.06 2.04 3.07-.02.06-.32 1.1-1.05 2.17-.63.92-1.28 1.83-2.3 1.85-1 .02-1.33-.6-2.48-.6-1.14 0-1.5.58-2.44.62-.98.04-1.73-.99-2.37-1.9-1.3-1.87-2.3-5.3-.96-7.62a3.65 3.65 0 0 1 3.08-1.88c.96-.02 1.87.66 2.47.66.59 0 1.7-.82 2.87-.7.49.02 1.86.2 2.74 1.52-.07.04-1.64.96-1.62 2.81ZM14.48 5.9a3.6 3.6 0 0 0 .82-2.58 3.65 3.65 0 0 0-2.35 1.2 3.36 3.36 0 0 0-.84 2.49 3.02 3.02 0 0 0 2.37-1.11Z"/></svg>;
}

export default function Register() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<AuthMode>("register");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const returnTo = safeReturnPath(params.get("next"));

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mode === "register" && password.length < 8) {
      setMessage("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (mode === "register" && password !== confirmPassword) {
      setMessage("Las contraseñas no coinciden.");
      return;
    }
    setMessage("El formulario está listo. Conectaremos el servicio de cuentas en la siguiente etapa.");
  }

  function selectProvider(provider: "Apple" | "Google") {
    setMessage(`El acceso con ${provider} estará disponible cuando conectemos la autenticación.`);
  }

  function enterPreview() {
    startPreviewUserSession();
    navigate(returnTo, { replace: true });
  }

  return <main className="register-page"><header className="register-header"><Link to="/home" aria-label="WIT, inicio"><Logo/></Link><Link to="/home">Seguir explorando</Link></header><section className="register-panel"><span className="register-eyebrow">TU ESPACIO EN WIT</span><h1>{mode === "register" ? "Crea tu cuenta" : "Inicia sesión"}</h1><p>{mode === "register" ? "Guarda las tiendas que te interesan, marca productos y servicios, y comparte tu opinión." : "Entra para continuar con tus tiendas y servicios guardados."}</p>
    <div className="register-social-options"><button type="button" className="register-provider-button" onClick={() => selectProvider("Apple")}><AppleIcon/>Continuar con Apple</button><button type="button" className="register-provider-button" onClick={() => selectProvider("Google")}><GoogleIcon/>Continuar con Google</button></div>
    <div className="register-divider"><span>o con tu correo</span></div>
    <form onSubmit={submit}>{mode === "register" && <label>¿Cómo te llamas?<input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" placeholder="Tu nombre" maxLength={60} required/></label>}<label>Correo electrónico<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="tu@correo.com" required/></label><label>Contraseña<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "register" ? "new-password" : "current-password"} placeholder={mode === "register" ? "Al menos 8 caracteres" : "Tu contraseña"} minLength={mode === "register" ? 8 : undefined} required/></label>{mode === "register" && <label>Confirma tu contraseña<input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" placeholder="Repite tu contraseña" minLength={8} required/></label>}<button className="register-submit" type="submit">{mode === "register" ? "Crear cuenta" : "Iniciar sesión"}</button></form>
    {message && <p className="register-status" role="status">{message}</p>}
    <button className="register-mode-switch" type="button" onClick={() => { setMode(mode === "register" ? "login" : "register"); setMessage(""); }}>{mode === "register" ? "¿Ya tienes una cuenta? Inicia sesión" : "¿Aún no tienes cuenta? Regístrate"}</button>
    <button className="register-preview-button" type="button" onClick={enterPreview}>Entrar en vista previa como usuario registrado</button>
    <small className="register-disclaimer">El registro y los accesos con Apple y Google son una maqueta visual por ahora. Tus datos no se envían ni se guardan.</small><span className="register-return-note">Después de conectar las cuentas, volverás a: {returnTo === "/profile" ? "tu perfil" : "la página que estabas viendo"}.</span>
  </section></main>;
}
