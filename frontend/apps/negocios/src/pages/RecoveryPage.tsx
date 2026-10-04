import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { BusinessHeader } from "../components/layout/BusinessHeader";

export function RecoveryPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const submit = (event: FormEvent) => { event.preventDefault(); setSent(true); };
  return <main className="auth-page">
    <BusinessHeader />
    <div className="auth-layout recovery-layout">
      <section className="recovery-card auth-form-card"><div className="auth-form-heading"><span className="auth-kicker">RECUPERAR ACCESO</span><h2>Recupera tu acceso</h2><p>Escribe el correo electrónico asociado a tu cuenta.</p></div>{sent ? <p className="auth-status" role="status">Si el correo existe, recibirás un enlace de recuperación.</p> : <form className="auth-form" onSubmit={submit}><label>Correo electrónico<input type="email" value={email} onChange={event => setEmail(event.target.value)} required placeholder="tu@correo.com" /></label><button className="action-button auth-submit" type="submit">Enviar enlace de recuperación</button></form>}<Link className="auth-back" to="/login">Volver a iniciar sesión</Link></section>
    </div>
  </main>;
}
