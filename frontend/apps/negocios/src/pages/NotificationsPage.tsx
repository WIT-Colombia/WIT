import { useEffect, useState } from "react";
import { PageHeader } from "../components/common/PageHeader";
import { initialNotifications } from "../data/business.mock";
import { Link } from "react-router-dom";
import { useBusinessStore } from "../services/businessStore";

const icons = { review: "☆", interest: "↗", profile: "▣", wit: "✦", admin: "✉", offer: "✦", security: "✓" };
const destination = { review: "/opiniones", interest: "/productos", profile: "/mis-negocios/editar", wit: "/mi-negocio", admin: "/configuracion", offer: "/estadisticas", security: "/perfil" } as const;
export function NotificationsPage() {
  const { notifications, setNotifications, businesses, business } = useBusinessStore();
  const businessIndex = Math.max(0, businesses.findIndex(item => item.name === business.name));
  const [filter, setFilter] = useState<"Todas" | "No leídas">("Todas");
  useEffect(() => {
    const missing = initialNotifications.filter(seed => !notifications.some(item => item.id === seed.id));
    if (missing.length) setNotifications([...notifications, ...missing]);
  }, []);
  const unread = notifications.filter(item => !item.read).length;
  const visible = notifications.filter(item => filter === "Todas" || !item.read);
  return <><PageHeader eyebrow="AL DÍA" title="Notificaciones" description="Entérate de lo que ocurre con tu presencia en WIT." action={unread > 0 && <button type="button" className="outline-button" onClick={() => setNotifications(notifications.map(item => ({...item, read: true})))}>Marcar todas como leídas</button>} /><section className="surface-card notifications-card"><div className="notification-tabs" role="group" aria-label="Filtrar notificaciones"><button type="button" onClick={() => setFilter("Todas")} className={filter === "Todas" ? "active" : ""} aria-pressed={filter === "Todas"}>Todas</button><button type="button" onClick={() => setFilter("No leídas")} className={filter === "No leídas" ? "active" : ""} aria-pressed={filter === "No leídas"}>No leídas <span>{unread}</span></button></div>{visible.length ? visible.map(item => { const to = item.type === "profile" ? `${destination.profile}/${businessIndex}` : destination[item.type]; return <article className={`notification-row ${item.read ? "" : "unread"}`} key={item.id} onClick={() => !item.read && setNotifications(notifications.map(current => current.id === item.id ? {...current, read: true} : current))}><span className={`notification-icon ${item.type}`}>{icons[item.type]}</span><div><div className="notification-title"><h2>{item.title}</h2>{!item.read && <span aria-label="Sin leer" />}</div><p>{item.description}</p><small>{item.date}</small><Link className="notification-link" to={to}>Ver detalle →</Link></div><div className="notification-actions">{!item.read && <button type="button" className="subtle-button" onClick={() => setNotifications(notifications.map(current => current.id === item.id ? {...current, read: true} : current))}>Marcar leída</button>}<button type="button" className="notification-delete" aria-label={`Eliminar ${item.title}`} onClick={() => setNotifications(notifications.filter(current => current.id !== item.id))}>Eliminar</button></div></article>; }) : <div className="empty-state"><span>✓</span><h2>Todo al día</h2><p>No tienes notificaciones en tu bandeja.</p></div>}</section></>;
}
