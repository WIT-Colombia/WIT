import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BusinessHeader } from "../components/layout/BusinessHeader";
import { useBusinessStore } from "../services/businessStore";

export function RecoveryPage() {
  const { account } = useBusinessStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const emailMode = searchParams.get("mode") === "email";
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [verify, setVerify] = useState("");
  const [email, setEmail] = useState(account.email);
  const [status, setStatus] = useState<"idle" | "changed" | "sent">("idle");
  const submitChange = (event: FormEvent) => { event.preventDefault(); if (next !== verify) return; setStatus("changed"); };
  const submitRecovery = (event: FormEvent) => { event.preventDefault(); setStatus("sent"); };
  return <main className="auth-page">
    <BusinessHeader />
    <div className="auth-layout recovery-layout">
      <section className="recovery-card auth-form-card"><div className="auth-form-heading"><span className="auth-kicker">SEGURIDAD DE LA CUENTA</span><h2>{emailMode ? "Recupera tu contraseña" : "Cambia tu contraseña"}</h2><p>{emailMode ? "Enviaremos un enlace al correo asociado a tu perfil." : "Actualiza tu contraseña de forma rápida y segura."}</p></div>
        {emailMode ? status === "sent" ? <p className="auth-status" role="status">Enviamos un enlace de recuperación a <strong>{email}</strong>.</p> : <form className="auth-form" onSubmit={submitRecovery}><label>Correo electrónico<input type="email" value={email} onChange={event => setEmail(event.target.value)} required /></label><button className="action-button auth-submit" type="submit">Enviar enlace de recuperación</button></form> : status === "changed" ? <p className="auth-status" role="status">Tu contraseña se actualizó correctamente.</p> : <form className="auth-form" onSubmit={submitChange}><label>Contraseña actual<input type="password" value={current} onChange={event => setCurrent(event.target.value)} required /></label><label>Nueva contraseña<input type="password" value={next} onChange={event => setNext(event.target.value)} required minLength={8} /></label><label>Verificar nueva contraseña<input type="password" value={verify} onChange={event => setVerify(event.target.value)} required minLength={8} /></label>{next && verify && next !== verify && <small className="form-error">Las contraseñas no coinciden.</small>}<button className="action-button auth-submit" type="submit" disabled={next !== verify}>Guardar nueva contraseña</button></form>}
        <button className="recovery-switch" type="button" onClick={() => { setStatus("idle"); setSearchParams(emailMode ? {} : { mode: "email" }); }}>{emailMode ? "← Volver a cambiar contraseña" : "¿No recuerdas tu contraseña? Recupérala por correo"}</button><Link className="auth-back" to="/configuracion">Volver a configuración</Link>
      </section>
    </div>
  </main>;
}
