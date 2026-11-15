import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useBusinessStore } from "../services/businessStore";
import { changePassword, clearAccessToken, confirmPasswordReset, requestPasswordReset } from "../services/businessAuthService";
import { useBusinessAuth } from "../services/businessAuthContext";
import { BusinessApiError } from "../services/businessApiClient";
import "./RecoveryPage.css";

type RecoveryMode = "change" | "email" | "reset";
type RecoveryIcon = "lock" | "mail" | "shield" | "arrow" | "check" | "alert" | "eye" | "eye-off" | "key";

function SecurityIcon({ name }: { name: RecoveryIcon }) {
  const paths: Record<RecoveryIcon, string> = {
    lock: "M5 11h14v10H5V11Zm3 0V8a4 4 0 1 1 8 0v3",
    mail: "M3 5h18v14H3V5Zm0 2 9 7 9-7",
    shield: "M12 2 4 5v6c0 5 3.5 8.5 8 11 4.5-2.5 8-6 8-11V5l-8-3Zm-4 9 3 3 5-5",
    arrow: "M5 12h14m-6-6 6 6-6 6",
    check: "M20 6 9 17l-5-5M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20",
    alert: "M12 3 2 21h20L12 3Zm0 6v5m0 3h.01",
    eye: "M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Zm9.5 2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
    "eye-off": "M4 4 20 20M10.4 6.1A10 10 0 0 1 12 6c6 0 9.5 6 9.5 6a18 18 0 0 1-3 3.4M6.1 8.1A18 18 0 0 0 2.5 12s3.5 6 9.5 6c.9 0 1.8-.1 2.6-.4",
    key: "M14 7a5 5 0 1 1-4.6 7L3 20v1h5l2-2v-2l2-2A5 5 0 0 1 14 7Z",
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]} /></svg>;
}

function PasswordField({ id, label, value, onChange, autoComplete }: {
  id: string; label: string; value: string;
  onChange: (value: string) => void; autoComplete: "current-password" | "new-password";
}) {
  const [visible, setVisible] = useState(false);
  return <label className="business-recovery-field" htmlFor={id}>
    <span>{label}</span>
    <span className="business-recovery-password-control">
      <input id={id} name={id} type={visible ? "text" : "password"} value={value} onChange={event => onChange(event.target.value)} autoComplete={autoComplete} required minLength={autoComplete === "new-password" ? 8 : undefined} />
      <button type="button" className="business-recovery-visibility" aria-label={visible ? "Ocultar " + label.toLowerCase() : "Mostrar " + label.toLowerCase()} aria-pressed={visible} onClick={() => setVisible(current => !current)}><SecurityIcon name={visible ? "eye-off" : "eye"} /></button>
    </span>
  </label>;
}

function describeError(cause: unknown, mode: RecoveryMode): string {
  if (cause instanceof BusinessApiError) {
    if (cause.status === 0) return "No pudimos conectarnos con XAMUKO. Comprueba tu conexión e inténtalo de nuevo.";
    if (cause.status === 429) return "Se han realizado demasiados intentos. Espera un momento antes de volver a intentarlo.";
    if (mode === "change" && (cause.status === 400 || cause.status === 401)) return "No pudimos verificar la contraseña actual. Revísala e inténtalo de nuevo.";
    if (mode === "reset" && (cause.status === 404 || cause.status === 410 || /TOKEN|EXPIRE|RESET_LINK/i.test(cause.code))) {
      return "El enlace de recuperación ya no es válido o ha vencido. Solicita uno nuevo.";
    }
  }
  return mode === "email"
    ? "No fue posible procesar la solicitud. Inténtalo de nuevo más tarde."
    : "No pudimos actualizar tu contraseña. Revisa los datos e inténtalo de nuevo.";
}

export function RecoveryPage() {
  const { account } = useBusinessStore();
  const { state: authState, refresh: refreshAuth } = useBusinessAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";
  const signedIn = authState.status === "authenticated";
  const mode: RecoveryMode = token ? "reset" : searchParams.get("mode") === "email" || !signedIn ? "email" : "change";
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [verify, setVerify] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "changed" | "sent">("idle");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const recoveryEmail = signedIn ? account.email : email;
  const backPath = signedIn ? "/perfil" : "/login";
  const passwordTooShort = next.length > 0 && next.length < 8;
  const mismatch = verify.length > 0 && next !== verify;
  const reusedPassword = mode === "change" && current.length > 0 && next.length > 0 && current === next;
  const validNewPassword = next.length >= 8 && next === verify && !reusedPassword;
  const title = mode === "email" ? "Recupera tu contraseña" : mode === "reset" ? "Crea una nueva contraseña" : "Cambiar contraseña";
  const description = mode === "email"
    ? "Solicita un enlace de recuperación en el correo asociado a tu cuenta."
    : mode === "reset"
      ? "Establece una contraseña nueva para proteger tu cuenta."
      : "Actualiza la contraseña que utilizas para acceder a XAMUKO Business.";

  // Keep the one-time token out of the visible URL without invalidating the form.
  useEffect(() => {
    if (!token) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("token");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  }, [token]);
  useEffect(() => {
    setStatus("idle");
    setError("");
    setCurrent(""); setNext(""); setVerify("");
  }, [mode]);

  const updateSecret = (setter: (value: string) => void) => (value: string) => {
    setter(value); setError("");
  };

  const submitChange = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting || !current || !validNewPassword) return;
    setSubmitting(true); setError("");
    try {
      await changePassword(current, next);
      setCurrent(""); setNext(""); setVerify("");
      setStatus("changed");
    } catch (cause) {
      setError(describeError(cause, "change"));
    } finally {
      setSubmitting(false);
    }
  };

  const submitRecovery = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting || !recoveryEmail.trim()) return;
    setSubmitting(true); setError("");
    try {
      await requestPasswordReset(recoveryEmail.trim());
      // Do not disclose whether an email address is registered.
      setStatus("sent");
    } catch (cause) {
      setError(describeError(cause, "email"));
    } finally {
      setSubmitting(false);
    }
  };

  const submitReset = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting || !token || !validNewPassword) return;
    setSubmitting(true); setError("");
    try {
      await confirmPasswordReset(token, next, signedIn);
      if (signedIn) {
        // A successful password reset must not be shown as failed if session refresh fails.
        try { await refreshAuth(); } catch { /* The password reset was already confirmed. */ }
      } else {
        clearAccessToken();
      }
      setCurrent(""); setNext(""); setVerify("");
      setStatus("changed");
    } catch (cause) {
      setError(describeError(cause, "reset"));
    } finally {
      setSubmitting(false);
    }
  };

  const switchToEmail = () => {
    setCurrent(""); setNext(""); setVerify(""); setError(""); setStatus("idle");
    setSearchParams({ mode: "email" });
  };

  return <div className={"business-recovery-page" + (signedIn ? " business-recovery-workspace" : " business-recovery-guest")}>
    <div className="business-recovery-layout">
      <Link className="business-recovery-top-back" to={backPath}>← {signedIn ? "Volver a Mi perfil" : "Volver a iniciar sesión"}</Link>
      <header className="business-recovery-heading">
        <span className="business-recovery-eyebrow">SEGURIDAD DE LA CUENTA</span>
        <div className="business-recovery-heading-main">
          <span className="business-recovery-heading-icon"><SecurityIcon name={mode === "email" ? "mail" : mode === "reset" ? "key" : "lock"} /></span>
          <div><h1>{title}</h1><p>{description}</p></div>
        </div>
      </header>
      <div className="business-recovery-content">
        <section className="business-recovery-card" aria-labelledby="business-recovery-form-title">
          <div className="business-recovery-card-heading">
            <span className="business-recovery-card-icon"><SecurityIcon name={mode === "email" ? "mail" : "shield"} /></span>
            <div>
              <span className="business-recovery-card-eyebrow">{mode === "email" ? "RECUPERACIÓN DE ACCESO" : "PROTECCIÓN DE TU CUENTA"}</span>
              <h2 id="business-recovery-form-title">{mode === "email" ? "Recibir enlace de recuperación" : mode === "reset" ? "Restablecer contraseña" : "Actualiza tu clave de acceso"}</h2>
              <p>{mode === "email" ? "Comprueba que el correo esté bien escrito antes de continuar." : "Utiliza una contraseña nueva que puedas recordar y no compartas con otras personas."}</p>
            </div>
          </div>
          {status === "sent" && mode === "email" ? <div className="business-recovery-feedback is-success" role="status">
            <SecurityIcon name="check" />
            <div><h3>Solicitud recibida</h3><p>Si existe una cuenta asociada a <strong>{recoveryEmail.trim()}</strong>, recibirás un enlace para restablecer tu contraseña. Revisa también la carpeta de correo no deseado.</p>
              <Link to={backPath}>Volver {signedIn ? "a Mi perfil" : "al inicio de sesión"} <SecurityIcon name="arrow" /></Link>
            </div>
          </div> : status === "changed" ? <div className="business-recovery-feedback is-success" role="status">
            <SecurityIcon name="check" />
            <div><h3>Contraseña actualizada</h3><p>La nueva contraseña se guardó correctamente. {signedIn ? "Puedes continuar utilizando tu cuenta." : "Ya puedes iniciar sesión con tu nueva contraseña."}</p>
              <Link to={backPath}>{signedIn ? "Regresar a Mi perfil" : "Ir a iniciar sesión"} <SecurityIcon name="arrow" /></Link>
            </div>
          </div> : <>
            <form className="business-recovery-form" onSubmit={mode === "email" ? submitRecovery : mode === "reset" ? submitReset : submitChange}>
              {mode === "email" ? <label className="business-recovery-field" htmlFor="recovery-email">
                <span>Correo electrónico</span>
                <input id="recovery-email" name="email" type="email" autoComplete="email" value={recoveryEmail} onChange={signedIn ? undefined : event => {setEmail(event.target.value);setError("");}} readOnly={signedIn} aria-readonly={signedIn} required placeholder="correo@ejemplo.com" />
              </label> : <>
                {mode === "change" && <PasswordField id="current-password" label="Contraseña actual" value={current} onChange={updateSecret(setCurrent)} autoComplete="current-password" />}
                <PasswordField id="new-password" label="Nueva contraseña" value={next} onChange={updateSecret(setNext)} autoComplete="new-password" />
                <div className={"business-recovery-rule" + (next.length >= 8 ? " is-valid" : "")}><SecurityIcon name={next.length >= 8 ? "check" : "shield"} />La contraseña debe tener al menos 8 caracteres.</div>
                <PasswordField id="verify-password" label="Confirmar nueva contraseña" value={verify} onChange={updateSecret(setVerify)} autoComplete="new-password" />
                {passwordTooShort && <p className="business-recovery-inline-error">Añade al menos 8 caracteres a la nueva contraseña.</p>}
                {mismatch && <p className="business-recovery-inline-error">Las contraseñas no coinciden. Compruébalas antes de guardar.</p>}
                {reusedPassword && <p className="business-recovery-inline-error">Elige una contraseña distinta de la actual.</p>}
              </>}
              {error && <div className="business-recovery-feedback is-error" role="alert"><SecurityIcon name="alert" /><p>{error}</p></div>}
              <div className="business-recovery-form-footer">
                <button className="business-recovery-submit" type="submit" disabled={submitting || (mode === "email" ? !recoveryEmail.trim() : mode === "change" ? !current || !validNewPassword : !validNewPassword)}>
                  <SecurityIcon name={mode === "email" ? "mail" : "shield"} />
                  {submitting ? (mode === "email" ? "Enviando solicitud…" : "Actualizando contraseña…") : mode === "email" ? "Enviar enlace de recuperación" : "Guardar nueva contraseña"}
                </button>
              </div>
            </form>
            {mode === "change" && <button className="business-recovery-switch" type="button" onClick={switchToEmail}>¿No recuerdas tu contraseña? Recupérala por correo <SecurityIcon name="arrow" /></button>}
            {mode === "reset" && <Link className="business-recovery-switch" to="/recuperar?mode=email">¿El enlace ha vencido? Solicita otro <SecurityIcon name="arrow" /></Link>}
          </>}
        </section>

        <aside className="business-recovery-aside" aria-label="Recomendaciones de seguridad">
          <div className="business-recovery-tips">
            <span className="business-recovery-tips-icon"><SecurityIcon name="shield" /></span>
            <h2>Protege tu cuenta</h2>
            <p>Recomendaciones para mantener seguro tu acceso a XAMUKO.</p>
            <ul>
              <li>Utiliza una contraseña distinta de la que usas en otros servicios.</li>
              <li>No compartas contraseñas ni códigos de recuperación.</li>
              <li>Desconfía de mensajes que soliciten tus credenciales.</li>
            </ul>
          </div>
          <p className="business-recovery-side-note"><SecurityIcon name="lock" /> Tu contraseña nunca se muestra en esta página una vez guardada.</p>
        </aside>
      </div>
    </div>
  </div>;
}
