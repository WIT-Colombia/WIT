import { useEffect, useState } from "react";
import { getRemoteNotifications, markRemoteNotificationRead, deleteRemoteNotification, requestBlobWithSession, respondToCollaboratorInvitation, type RemoteUserNotification } from "../services/authService";
import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";
import type { UserNotification } from "../services/userDataService";
import { PageLayout } from "../components/PageLayout";
import "./Notifications.css";

function NotificationAvatar({ notification }: { notification: UserNotification }) {
  const [imageFailed, setImageFailed] = useState(false);
  const [resolvedImage, setResolvedImage] = useState<string | null>(null);
  const imageUrl = notification.imageUrl?.trim() || null;
  const isBrand = notification.id === "welcome" || notification.imageAlt === "XAMUKO";

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    setImageFailed(false);
    setResolvedImage(null);
    if (imageUrl?.startsWith("/api/v1/")) {
      void requestBlobWithSession(imageUrl).then(blob => {
        objectUrl = URL.createObjectURL(blob);
        if (active) setResolvedImage(objectUrl);
        else URL.revokeObjectURL(objectUrl);
      }).catch(() => { if (active) setImageFailed(true); });
    } else if (imageUrl) {
      setResolvedImage(imageUrl);
    }
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [imageUrl]);

  return <span className={`notification-icon${resolvedImage && !imageFailed ? " notification-icon--profile" : ""}${isBrand ? " notification-icon--brand" : ""}`}>
    {resolvedImage && !imageFailed
      ? <img src={resolvedImage} alt={notification.imageAlt ?? ""} loading="lazy" onError={() => setImageFailed(true)} />
      : <span aria-hidden="true">✦</span>}
  </span>;
}

const invitationStateLabel: Record<string, string> = {
  ACTIVE: "Invitación aceptada",
  REJECTED: "Invitación rechazada",
  REVOKED: "Invitación cancelada",
  EXPIRED: "Invitación vencida",
  SUSPENDED: "Acceso suspendido",
};

export default function Notifications() {
  const { status, user } = useAuth();
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [apiError, setApiError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleted, setDeleted] = useState(false);
  const [visibleCount, setVisibleCount] = useState(10);
  const [pendingInvitationResponse, setPendingInvitationResponse] = useState<{ id: string; accept: boolean } | null>(null);
  const [busyInvitationId, setBusyInvitationId] = useState<string | null>(null);
  const unread = notifications.filter((item) => !item.read).length;
  useEffect(() => {
    if (!deleted) return;
    const timeout = window.setTimeout(() => setDeleted(false), 3000);
    return () => window.clearTimeout(timeout);
  }, [deleted]);
  useEffect(() => {
    let active = true;
    setNotifications([]);
    setApiError("");
    if (status !== "authenticated") return () => { active = false; };

    const refresh = async () => {
      try {
        const rows = await getRemoteNotifications();
        if (!active) return;
        const remote: UserNotification[] = rows.map((row: RemoteUserNotification) => ({
          id: row.id,
          title: row.title,
          body: row.body,
          date: new Date(row.createdAt).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" }),
          read: Boolean(row.readAt),
          imageUrl: row.imageUrl,
          imageAlt: row.imageAlt,
          source: "remote",
          invitation: row.invitation,
        }));
        setNotifications(remote);
        setApiError("");
      } catch {
        if (active) setApiError("No se pudieron cargar las notificaciones de tu cuenta.");
      }
    };
    void refresh();
    const refreshIfVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    const timer = window.setInterval(refreshIfVisible, 30_000);
    window.addEventListener("focus", refreshIfVisible);
    document.addEventListener("visibilitychange", refreshIfVisible);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshIfVisible);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [status, user?.id]);

  const visibleNotifications = notifications.slice(0, visibleCount);

  const markRead = async (item: UserNotification) => {
    setSelectedId(item.id);
    if (item.read) return;
    try {
      await markRemoteNotificationRead(item.id);
      setNotifications(current => current.map(notification => notification.id === item.id ? { ...notification, read: true } : notification));
    } catch {
      setApiError("No se pudo marcar la notificación como leída.");
    }
  };
  const markAllRead = async () => {
    const unreadRemote = notifications.filter(item => !item.read);
    if (!unreadRemote.length) return;
    try {
      await Promise.all(unreadRemote.map(item => markRemoteNotificationRead(item.id)));
      const ids = new Set(unreadRemote.map(item => item.id));
      setNotifications(current => current.map(item => ids.has(item.id) ? { ...item, read: true } : item));
    } catch {
      setApiError("No se pudieron actualizar todas las notificaciones.");
    }
  };
  const respondInvitation = async (item: UserNotification, accept: boolean) => {
    if (busyInvitationId || item.invitation?.status !== "INVITED") return;
    setBusyInvitationId(item.id);
    setApiError("");
    try {
      await respondToCollaboratorInvitation(item.invitation.membershipId, accept);
      // Legacy invitations did not store a membership link: mark this inbox
      // entry as read even though the membership action already succeeded.
      try { await markRemoteNotificationRead(item.id); } catch { /* The membership response succeeded. */ }
      setNotifications(current => current.map(notification => notification.id === item.id
        ? { ...notification, read: true, invitation: notification.invitation ? { ...notification.invitation, status: accept ? ("ACTIVE" as const) : ("REJECTED" as const) } : null }
        : notification));
      setPendingInvitationResponse(null);
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "No se pudo responder la invitación.");
    } finally {
      setBusyInvitationId(null);
    }
  };

  const removeNotification = async (item: UserNotification) => {
    try {
      await deleteRemoteNotification(item.id);
    } catch {
      setApiError("No se pudo eliminar la notificación.");
      return;
    }
    setPendingDeleteId(null);
    setSelectedId(null);
    setDeleted(true);
    setNotifications(current => current.filter(notification => notification.id !== item.id));
  };

  return <PageLayout className="notifications-page">
    <Link className="offer-detail-back" to="/profile">← Volver al perfil</Link>
    <div className="notifications-heading">
      <div className="user-page-heading">
        <span>Tu actividad en XAMUKO</span>
        <h1>Notificaciones</h1>
        <span className="notification-unread-count">{unread} {unread === 1 ? "pendiente" : "pendientes"} por leer</span>
        {deleted && <p className="notification-success" role="status">La notificación se eliminó correctamente.</p>}
      </div>
      {unread > 0 && <button type="button" onClick={() => void markAllRead()}>Marcar todas como leídas</button>}
    </div>
    {apiError && <p className="notification-page-alert" role="alert">{apiError}</p>}
    {notifications.length ? <>
      <div className="notification-list">
        {visibleNotifications.map((item) => <div className={`notification-item${item.read ? " is-read" : ""}${selectedId === item.id ? " is-selected" : ""}${item.invitation ? " has-invitation" : ""}`} key={item.id}>
          <button type="button" className="notification-main-action" onClick={() => void markRead(item)}>
            <NotificationAvatar notification={item} />
            <span className="notification-copy"><b>{item.title}</b><small>{item.body}</small><time>{item.date}</time></span>
            {!item.read && <i aria-label="Sin leer" />}
          </button>
          {item.invitation && <div className="notification-invitation-controls" role="group" aria-label="Estado y respuesta de invitación">
            {item.invitation.status === "INVITED" ? (
              pendingInvitationResponse?.id === item.id ? <>
                <span className="notification-invitation-question">{pendingInvitationResponse.accept ? "¿Aceptar esta invitación para colaborar?" : "¿Rechazar esta invitación para colaborar?"}</span>
                <button type="button" className="notification-invitation-primary" disabled={busyInvitationId !== null} onClick={() => void respondInvitation(item, pendingInvitationResponse.accept)}>{busyInvitationId === item.id ? "Procesando…" : pendingInvitationResponse.accept ? "Sí, aceptar" : "Sí, rechazar"}</button>
                <button type="button" className="notification-invitation-secondary" disabled={busyInvitationId !== null} onClick={() => setPendingInvitationResponse(null)}>Cancelar</button>
              </> : <>
                <button type="button" className="notification-invitation-primary" disabled={busyInvitationId !== null} onClick={() => setPendingInvitationResponse({ id: item.id, accept: true })}>Aceptar invitación</button>
                <button type="button" className="notification-invitation-secondary" disabled={busyInvitationId !== null} onClick={() => setPendingInvitationResponse({ id: item.id, accept: false })}>Rechazar invitación</button>
              </>
            ) : <span className="notification-invitation-status" aria-live="polite">{invitationStateLabel[item.invitation.status] ?? "Invitación procesada"}</span>}
          </div>}
          {selectedId === item.id && <span className="notification-actions">
            <button type="button" className="notification-delete" aria-label={`Eliminar ${item.title}`} onClick={(event) => { event.stopPropagation(); setPendingDeleteId(item.id); }}>×</button>
            {pendingDeleteId === item.id && <span className="notification-delete-confirm">¿Eliminarla? <button type="button" onClick={() => void removeNotification(item)}>Sí</button><button type="button" onClick={() => setPendingDeleteId(null)}>No</button></span>}
          </span>}
        </div>)}
      </div>
      {notifications.length > 10 && <div className="notifications-pagination">{visibleCount < notifications.length
        ? <button type="button" onClick={() => setVisibleCount((current) => Math.min(current + 10, notifications.length))}>Ver más notificaciones <span>→</span></button>
        : <button type="button" onClick={() => { setVisibleCount(10); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Volver arriba <span>↑</span></button>}
      </div>}
    </> : <div className="user-empty-state"><h2>No tienes notificaciones</h2><p>Cuando haya novedades, aparecerán aquí.</p><Link to="/home">Ir al inicio</Link></div>}
  </PageLayout>;
}
