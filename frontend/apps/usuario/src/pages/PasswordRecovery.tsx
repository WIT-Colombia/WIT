import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { changePassword } from "../services/authService";
import { ApiError } from "../services/httpClient";
import { PageLayout } from "../components/PageLayout";
import "./PasswordRecovery.css";

export default function PasswordRecovery() {
  const navigate = useNavigate();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    if (next.length < 8) { setError("La nueva contraseña debe tener al menos 8 caracteres."); return; }
    if (next !== confirm) { setError("Las contraseñas nuevas no coinciden."); return; }
    if (!current) { setError("Escribe tu contraseña actual para continuar."); return; }
    setSaving(true); setError("");
    try {
      await changePassword(current, next);
      setSaved(true);
      setCurrent(""); setNext(""); setConfirm("");
      window.setTimeout(() => navigate("/settings"), 1000);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "No se pudo actualizar la contraseña.");
    } finally { setSaving(false); }
  }
  return <PageLayout className="password-page"><Link className="offer-detail-back" to="/settings">← Volver a ajustes</Link><div className="user-page-heading"><span>SEGURIDAD</span><h1>Cambiar contraseña</h1><p>Actualiza la contraseña de tu cuenta para mantenerla protegida.</p></div><section className="password-card"><form onSubmit={submit}><label>Contraseña actual<input type="password" value={current} onChange={(event) => setCurrent(event.target.value)} autoComplete="current-password" required /></label><label>Nueva contraseña<input type="password" value={next} onChange={(event) => setNext(event.target.value)} autoComplete="new-password" minLength={8} required /><small>Mínimo 8 caracteres.</small></label><label>Confirmar nueva contraseña<input type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="new-password" minLength={8} required /></label>{error && <p className="password-error" role="alert">{error}</p>}{saved && <p className="password-success" role="status">Contraseña actualizada correctamente. Las demás sesiones se cerraron.</p>}<button type="submit" disabled={saving}>{saving ? "Guardando…" : "Guardar nueva contraseña"}</button></form></section></PageLayout>;
}
