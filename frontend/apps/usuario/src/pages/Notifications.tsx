import { useEffect, useState } from "react";
import { getRemoteNotifications, markRemoteNotificationRead, deleteRemoteNotification, type RemoteUserNotification } from "../services/authService";
import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";
import { deleteNotification, getNotifications, markAllNotificationsRead, markNotificationRead, type UserNotification } from "../services/userDataService";
import { PageLayout } from "../components/PageLayout";
import "./Notifications.css";

function NotificationAvatar({ notification }: { notification: UserNotification }) {
  const [imageFailed, setImageFailed] = useState(false);
  const imageUrl = notification.imageUrl?.trim() || null;
  const isBrand = notification.id === "welcome" || notification.imageAlt === "XAMUKO";
  return <span className={`notification-icon${imageUrl && !imageFailed ? " notification-icon--profile" : ""}${isBrand ? " notification-icon--brand" : ""}`}>
    {imageUrl && !imageFailed
      ? <img src={imageUrl} alt={notification.imageAlt ?? ""} loading="lazy" onError={() => setImageFailed(true)} />
      : <span aria-hidden="true">✦</span>}
  </span>;
}

export default function Notifications() {
  const { status, user } = useAuth();
  const [notifications, setNotifications] = useState<UserNotification[]>(getNotifications);
  const [apiError, setApiError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleted, setDeleted] = useState(false);
  const [visibleCount, setVisibleCount] = useState(10);
  const unread = notifications.filter((item) => !item.read).length;
  useEffect(() => {
    if (!deleted) return;
    const timeout = window.setTimeout(() => setDeleted(false), 3000);
    return () => window.clearTimeout(timeout);
  }, [deleted]);
  useEffect(() => {
    let active = true;
    setNotifications(getNotifications());
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
        }));
        setNotifications([...remote, ...getNotifications()]);
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
    if (item.source === "remote") {
      try {
        await markRemoteNotificationRead(item.id);
        setNotifications(current => current.map(notification => notification.id === item.id ? { ...notification, read: true } : notification));
      } catch {
        setApiError("No se pudo marcar la notificación como leída.");
      }
    } else {
      const localNext = markNotificationRead(item.id);
      setNotifications(current => current.map(notification => localNext.find(next => next.id === notification.id) ?? notification));
    }
  };
  const markAllRead = async () => {
    const localNext = markAllNotificationsRead();
    setNotifications(current => current.map(notification => notification.source === "remote" ? notification : localNext.find(next => next.id === notification.id) ?? notification));
    const unreadRemote = notifications.filter(item => item.source === "remote" && !item.read);
    if (!unreadRemote.length) return;
    try {
      await Promise.all(unreadRemote.map(item => markRemoteNotificationRead(item.id)));
      const ids = new Set(unreadRemote.map(item => item.id));
      setNotifications(current => current.map(item => ids.has(item.id) ? { ...item, read: true } : item));
    } catch {
      setApiError("No se pudieron actualizar todas las notificaciones.");
    }
  };
  const removeNotification = async (item: UserNotification) => {
    if (item.source === "remote") {
      try {
        await deleteRemoteNotification(item.id);
      } catch {
        setApiError("No se pudo eliminar la notificación.");
        return;
      }
    } else {
      deleteNotification(item.id);
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
        {visibleNotifications.map((item) => <div className={`notification-item${item.read ? " is-read" : ""}${selectedId === item.id ? " is-selected" : ""}`} key={item.id}>
          <button type="button" className="notification-main-action" onClick={() => void markRead(item)}>
            <NotificationAvatar notification={item} />
            <span className="notification-copy"><b>{item.title}</b><small>{item.body}</small><time>{item.date}</time></span>
            {!item.read && <i aria-label="Sin leer" />}
          </button>
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
