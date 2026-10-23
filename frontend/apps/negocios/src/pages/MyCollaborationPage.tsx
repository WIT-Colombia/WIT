import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { businessApi } from "../services/businessApiClient";
import { useBusinessStore } from "../services/businessStore";
import { toBusinessDetails } from "../services/realBusinessAdapter";
import "./MyCollaborationPage.css";

export function MyCollaborationPage() {
  const { business, setBusiness, setBusinesses } = useBusinessStore();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  if (business.source !== "real" || business.role !== "Colaborador" || !business.id) return <Navigate to="/" replace />;
  const businessId = business.id;

  const leave = async () => {
    setBusy(true); setError(""); setMessage("");
    try {
      await businessApi.leaveBusiness(businessId);
      const fresh = (await businessApi.list()).businesses;
      const nextBusinesses = fresh.map(toBusinessDetails);
      setBusinesses(nextBusinesses);
      setMessage("Has dejado de colaborar en este negocio.");
      if (nextBusinesses.length) setBusiness(nextBusinesses[0]);
      else { navigate("/sin-negocio", { replace: true }); return; }
      navigate("/", { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo completar la salida del negocio.");
      setConfirming(false);
    } finally { setBusy(false); }
  };
  return <main className="my-collaboration-page"><header className="my-collaboration-heading"><span className="my-collaboration-icon">↔</span><div><span className="page-eyebrow">MI COLABORACIÓN</span><h1>{business.name}</h1><p>Consulta tu acceso y abandona este negocio cuando lo necesites.</p></div></header>{message && <div className="my-collaboration-alert success" role="status">{message}</div>}{error && <div className="my-collaboration-alert error" role="alert">{error}</div>}<section className="my-collaboration-card"><div className="my-collaboration-status"><span className="status-dot" /> Membresía activa</div><h2>Colaborador</h2><p>Tienes acceso administrativo a este negocio según los permisos asignados por su propietario.</p><div className="my-collaboration-leave"><div><h3>Dejar de colaborar</h3><p>Perderás el acceso a su administración. Tu cuenta XAMUKO seguirá activa.</p></div>{confirming ? <div className="my-collaboration-confirm"><strong>¿Quieres dejar de colaborar con este negocio? Perderás el acceso a su administración. Tu cuenta XAMUKO seguirá activa</strong><div><button type="button" className="outline-button" onClick={() => setConfirming(false)} disabled={busy}>Cancelar</button><button type="button" className="danger-button" onClick={() => void leave()} disabled={busy}>{busy ? "Procesando…" : "Sí, dejar de colaborar"}</button></div></div> : <button type="button" className="danger-button" onClick={() => setConfirming(true)}>Dejar de colaborar</button>}</div></section></main>;
}
