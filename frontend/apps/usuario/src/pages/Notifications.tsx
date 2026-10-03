import { useState } from "react";
import { Link } from "react-router-dom";
import { deleteNotification, getNotifications, markAllNotificationsRead, markNotificationRead, type UserNotification } from "../services/userDataService";
import { PageLayout } from "../components/PageLayout";
import "./Notifications.css";

export default function Notifications() {
  const [notifications, setNotifications] = useState<UserNotification[]>(getNotifications);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const unread = notifications.filter((item) => !item.read).length;
  return <PageLayout className="notifications-page"><Link className="offer-detail-back" to="/profile">← Volver al perfil</Link><div className="notifications-heading"><div className="user-page-heading"><h1>Notificaciones</h1><span className="notification-unread-count">{unread} {unread === 1 ? "pendiente" : "pendientes"} por leer</span></div>{unread > 0 && <button type="button" onClick={() => setNotifications(markAllNotificationsRead())}>Marcar todas como leídas</button>}</div>{notifications.length ? <div className="notification-list">{notifications.map((item) => <div className={`notification-item${item.read ? " is-read" : ""}${selectedId === item.id ? " is-selected" : ""}`} key={item.id}><button type="button" className="notification-main-action" onClick={() => { setSelectedId(item.id); setNotifications(markNotificationRead(item.id)); }}><span className="notification-icon">✦</span><span className="notification-copy"><b>{item.title}</b><small>{item.body}</small><time>{item.date}</time></span>{!item.read && <i aria-label="Sin leer"/>}</button>{selectedId === item.id && <button type="button" className="notification-delete" aria-label={`Eliminar ${item.title}`} onClick={(event) => { event.stopPropagation(); setSelectedId(null); deleteNotification(item.id); setNotifications((current) => current.filter((notification) => notification.id !== item.id)); }}>×</button>}</div>)}</div> : <div className="user-empty-state"><h2>No tienes notificaciones</h2><p>Cuando haya novedades, aparecerán aquí.</p><Link to="/home">Ir al inicio</Link></div>}</PageLayout>;
}
