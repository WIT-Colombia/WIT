import { useState } from "react";
import { Link } from "react-router-dom";
import { getNotifications, markAllNotificationsRead, markNotificationRead, type UserNotification } from "../services/userDataService";
import { PageLayout } from "../components/PageLayout";
import "./Notifications.css";

export default function Notifications() {
  const [notifications, setNotifications] = useState<UserNotification[]>(getNotifications);
  const unread = notifications.filter((item) => !item.read).length;
  return <PageLayout className="notifications-page"><div className="notifications-heading"><div className="user-page-heading"><span>LO QUE PASA EN WIT</span><h1>Notificaciones</h1><p>Un resumen de novedades para tener a mano.</p></div>{unread > 0 && <button type="button" onClick={() => setNotifications(markAllNotificationsRead())}>Marcar todas como leídas</button>}</div>{notifications.length ? <div className="notification-list">{notifications.map((item) => <button type="button" key={item.id} className={`notification-item${item.read ? " is-read" : ""}`} onClick={() => setNotifications(markNotificationRead(item.id))}><span className="notification-icon">✦</span><span className="notification-copy"><b>{item.title}</b><small>{item.body}</small><time>{item.date}</time></span>{!item.read && <i aria-label="Sin leer"/>}</button>)}</div> : <div className="user-empty-state"><h2>No tienes notificaciones</h2><p>Cuando haya novedades, aparecerán aquí.</p><Link to="/home">Ir al inicio</Link></div>}<p className="notifications-note">Estas notificaciones son de muestra y se guardan únicamente en este dispositivo.</p></PageLayout>;
}
