import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageLayout } from "../components/PageLayout";
import { useAuth } from "../context/AuthContext";
import { refreshSession, requestBlobWithSession, requestWithSession } from "../services/authService";
import { ApiError } from "../services/httpClient";
import "./Notifications.css";

type BusinessNotification = {
  id: string; type: "COLLABORATION_INVITATION" | "COLLABORATION_UPDATE";
  title: string; message: string; createdAt: string; readAt: string | null;
  business: { id: string; name: string; profilePhoto: { url: string } | null };
  membership: { id: string; status: string; expiresAt: string | null } | null;
};
async function authenticated<T>(path: string, init?: RequestInit): Promise<T> {
  try { return await requestWithSession<T>(path, init); }
  catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;
    await refreshSession();
    return requestWithSession<T>(path, init);
  }
}
function InvitationPhoto({ url, name }: { url?: string; name: string }) {
  const [source, setSource] = useState<string | null>(null);
  useEffect(() => {
    if (!url) { setSource(null); return; }
    let active = true;
    let objectUrl: string | null = null;
    requestBlobWithSession(url).then(blob => {
      objectUrl = URL.createObjectURL(blob);
      if (active) setSource(objectUrl);
      else URL.revokeObjectURL(objectUrl);
    }).catch(() => { if (active) setSource(null); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [url]);
  return <span className="notification-icon">{source ? <img src={source} alt={`Foto de ${name}`} /> : "✦"}</span>;
}
export default function Notifications() {
  const { status } = useAuth();
  const [items, setItems] = useState<BusinessNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ id: string; action: "accept" | "reject" } | null>(null);
  const [visibleCount, setVisibleCount] = useState(10);
  const load = async () => {
    const result = await authenticated<{ notifications: BusinessNotification[] }>("/api/v1/notifications");
    setItems(result.notifications);
  };
  useEffect(() => {
    if (status === "loading") return;
    if (status !== "authenticated") { setItems([]); setLoading(false); return; }
    let active = true;
    setLoading(true);
    authenticated<{ notifications: BusinessNotification[] }>("/api/v1/notifications")
      .then(result => { if (active) setItems(result.notifications); })
      .catch(() => { if (active) setError("No fue posible consultar tus notificaciones. Intenta nuevamente."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [status]);
  const act = async (id: string, fn: () => Promise<unknown>) => {
    setBusy(id); setError("");
    try { await fn(); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "No fue posible completar la operación."); }
    finally { setBusy(null); setConfirm(null); }
  };
  const markRead = (item: BusinessNotification) => {
    if (item.readAt) return;
    void act(item.id, () => authenticated(`/api/v1/notifications/${item.id}/read`, { method: "POST" }));
  };
  const respond = (item: BusinessNotification, action: "accept" | "reject") => {
    if (!item.membership || item.membership.status !== "INVITED") return;
    void act(item.id, () => authenticated(`/api/v1/memberships/${item.membership!.id}/${action}`, { method: "POST" }));
  };
  const unread = items.filter(item => !item.readAt).length;
  return <PageLayout className="notifications-page">
    <Link className="offer-detail-back" to="/profile">← Volver al perfil</Link>
    <div className="notifications-heading"><div className="user-page-heading">
      <span>Tu actividad en XAMUKO</span><h1>Notificaciones</h1>
      <span className="notification-unread-count">{unread} {unread === 1 ? "pendiente" : "pendientes"} por leer</span>
    </div></div>
    {error && <p role="alert">{error} <button type="button" onClick={() => { setError(""); setLoading(true); void load().catch(() => setError("No se pudo actualizar.")).finally(() => setLoading(false)); }}>Reintentar</button></p>}
    {loading ? <p>Cargando notificaciones…</p> : items.length ? <>
      <div className="notification-list">{items.slice(0, visibleCount).map(item => {
        const pending = item.type === "COLLABORATION_INVITATION" && item.membership?.status === "INVITED";
        return <div className={`notification-item${item.readAt ? " is-read" : ""}${pending ? " has-invitation" : ""}`} key={item.id}>
          <button type="button" className="notification-main-action" onClick={() => markRead(item)} disabled={busy === item.id}>
            <InvitationPhoto url={item.business.profilePhoto?.url} name={item.business.name} />
            <span className="notification-copy"><b>{item.title}</b><small>{item.message || `Novedad de ${item.business.name}`}</small><time>{new Date(item.createdAt).toLocaleString("es-CO")}</time></span>
          </button>
          {pending && <div className="notification-invitation-controls">
            {confirm?.id === item.id ? <>
              <span>¿Confirmas que deseas {confirm.action === "accept" ? "aceptar" : "rechazar"} esta invitación?</span>
              <button type="button" disabled={busy === item.id} onClick={() => respond(item, confirm.action)}>Confirmar</button>
              <button type="button" disabled={busy === item.id} onClick={() => setConfirm(null)}>Cancelar</button>
            </> : <>
              <button type="button" disabled={busy === item.id} onClick={() => setConfirm({ id: item.id, action: "accept" })}>Aceptar</button>
              <button type="button" disabled={busy === item.id} onClick={() => setConfirm({ id: item.id, action: "reject" })}>Rechazar</button>
            </>}
          </div>}
          {item.type === "COLLABORATION_INVITATION" && !pending && <span className="notification-invitation-status">{item.membership?.status === "ACTIVE" ? "Aceptada" : item.membership?.status === "REJECTED" ? "Rechazada" : item.membership?.status === "EXPIRED" ? "Vencida" : "No disponible"}</span>}
          <button type="button" className="notification-delete" aria-label={`Eliminar ${item.title}`} disabled={busy === item.id} onClick={() => void act(item.id, () => authenticated(`/api/v1/notifications/${item.id}`, { method: "DELETE" }))}>×</button>
        </div>;
      })}</div>
      {items.length > visibleCount && <div className="notifications-pagination"><button type="button" onClick={() => setVisibleCount(n => n + 10)}>Ver más notificaciones →</button></div>}
    </> : <div className="user-empty-state"><h2>No tienes notificaciones</h2><p>Cuando haya novedades, aparecerán aquí.</p><Link to="/home">Ir al inicio</Link></div>}
  </PageLayout>;
}
