import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { deleteRemoteNotification, getRemoteNotifications, markRemoteNotificationRead, requestBlobWithSession } from "../services/authService";
import { deleteNotification, getNotifications, markAllNotificationsRead, markNotificationRead, type UserNotification } from "../services/userDataService";
import { PageLayout } from "../components/PageLayout";
import "./Notifications.css";

function NotificationAvatar({ notification }: { notification: UserNotification }) {
  const [imageFailed, setImageFailed] = useState(false);
  const [resolvedImageUrl, setResolvedImageUrl] = useState<string | null>(null);
  const imageUrl = notification.imageUrl?.trim() || null;
  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    setImageFailed(false);
    setResolvedImageUrl(null);
    if (!imageUrl) return () => { active = false; };
    if (!imageUrl.startsWith("/api/v1/")) {
      setResolvedImageUrl(imageUrl);
      return () => { active = false; };
    }
    void requestBlobWithSession(imageUrl).then((blob) => {
      objectUrl = URL.createObjectURL(blob);
      if (active) setResolvedImageUrl(objectUrl);
      else URL.revokeObjectURL(objectUrl);
    }).catch(() => { if (active) setImageFailed(true); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [imageUrl]);
  return <span className={`notification-icon${resolvedImageUrl && !imageFailed ? " notification-icon--profile" : ""}`}>
    {resolvedImageUrl && !imageFailed
      ? <img src={resolvedImageUrl} alt={notification.imageAlt ?? ""} loading="lazy" onError={() => setImageFailed(true)} />
      : <span aria-hidden="true">✦</span>}
  </span>;
}

export default function Notifications() {
  const { status: authStatus } = useAuth();
  const [notifications, setNotifications] = useState<UserNotification[]>(getNotifications);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleted, setDeleted] = useState(false);
  const [error, setError] = useState("");
  const [visibleCount, setVisibleCount] = useState(10);
  const unread = notifications.filter((item) => !item.read).length;
  useEffect(() => {
    if (!deleted) return;
    const timeout = window.setTimeout(() => setDeleted(false), 3000);
    return () => window.clearTimeout(timeout);
  }, [deleted]);
  const visibleNotifications = notifications.slice(0, visibleCount);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    let active = true;
    void getRemoteNotifications().then((remote) => {
      if (!active) return;
      const remoteNotifications: UserNotification[] = remote.map((item) => ({
        id: item.id,
        title: item.title,
        body: item.body,
        date: new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.createdAt)),
        read: Boolean(item.readAt),
        imageUrl: item.imageUrl,
        imageAlt: item.imageAlt,
        source: "remote",
      }));
      setNotifications((current) => [...remoteNotifications, ...current.filter((item) => item.source !== "remote")]);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [authStatus]);

  const markRead = (item: UserNotification) => {
    setSelectedId(item.id);
    if (item.source === "remote") {
      setNotifications((current) => current.map((notification) => notification.id === item.id ? { ...notification, read: true } : notification));
      void markRemoteNotificationRead(item.id).catch(() => setError("No se pudo actualizar la notificación."));
      return;
    }
    const localNext = markNotificationRead(item.id);
    setNotifications((current) => current.map((notification) => localNext.find((next) => next.id === notification.id) ?? notification));
  };
  const markAllRead = async () => {
    const remoteUnread = notifications.filter((item) => item.source === "remote" && !item.read);
    try {
      await Promise.all(remoteUnread.map((item) => markRemoteNotificationRead(item.id)));
      const localNext = notifications.some((item) => !item.source && !item.read) ? markAllNotificationsRead() : [];
      setNotifications((current) => current.map((item) => localNext.find((next) => next.id === item.id) ?? { ...item, read: true }));
    } catch { setError("No se pudieron actualizar todas las notificaciones."); }
  };
  const removeNotification = async (item: UserNotification) => {
    try {
      if (item.source === "remote") await deleteRemoteNotification(item.id);
      else deleteNotification(item.id);
      setPendingDeleteId(null);
      setSelectedId(null);
      setDeleted(true);
      setNotifications((current) => current.filter((notification) => notification.id !== item.id));
    } catch { setError("No se pudo eliminar la notificación."); }
  };

  return <PageLayout className="notifications-page">
    <Link className="offer-detail-back" to="/profile">← Volver al perfil</Link>
    <div className="notifications-heading">
      <div className="user-page-heading">
        <span>Tu actividad en XAMUKO</span>
        <h1>Notificaciones</h1>
        <span className="notification-unread-count">{unread} {unread === 1 ? "pendiente" : "pendientes"} por leer</span>
        {error && <p className="notification-error" role="alert">{error}</p>}
        {deleted && <p className="notification-success" role="status">La notificación se eliminó correctamente.</p>}
      </div>
      {unread > 0 && <button type="button" onClick={() => void markAllRead()}>Marcar todas como leídas</button>}
    </div>
    {notifications.length ? <>
      <div className="notification-list">
        {visibleNotifications.map((item) => <div className={`notification-item${item.read ? " is-read" : ""}${selectedId === item.id ? " is-selected" : ""}`} key={item.id}>
          <button type="button" className="notification-main-action" onClick={() => markRead(item)}>
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
