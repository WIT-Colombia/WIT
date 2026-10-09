import { useEffect, useState } from "react";
import { PageHeader } from "../components/common/PageHeader";
import { initialNotifications } from "../data/business.mock";
import { Link, useNavigate } from "react-router-dom";
import { useBusinessStore } from "../services/businessStore";

const icons = { review: "☆", interest: "↗", profile: "▣", wit: "✦", admin: "✉", offer: "✦", security: "✓", collaboration: "♙" };
const destination = { review: "/opiniones", interest: "/productos", profile: "/mis-negocios/editar", wit: "/mi-negocio", admin: "/configuracion", offer: "/estadisticas", security: "/perfil" } as const;
export function NotificationsPage() {
  const { notifications, setNotifications, businesses, business, account, setBusinesses, setBusiness } = useBusinessStore();
  const navigate = useNavigate();
  const businessIndex = Math.max(0, businesses.findIndex(item => item.name === business.name));
  const [filter, setFilter] = useState<"Todas" | "No leídas">("Todas");
  const [confirmingInvitation, setConfirmingInvitation] = useState<{ id: string; accepted: boolean } | null>(null);
  useEffect(() => {
    const missing = initialNotifications.filter(seed => !notifications.some(item => item.id === seed.id));
    if (missing.length) setNotifications([...notifications, ...missing]);
  }, []);
  const inbox = notifications.filter(item => (!item.recipientNickname && !item.recipientEmail) || item.recipientNickname === account.nickname || item.recipientEmail === account.email.toLowerCase());
  const unread = inbox.filter(item => !item.read).length;
  const notificationTime = (item: typeof inbox[number]) => {
    if (item.createdAt) return Date.parse(item.createdAt);
    if (item.date.startsWith("Ahora")) return item.read ? 0 : Date.now();
    if (item.date.startsWith("Hoy")) return Date.now() - 60 * 60 * 1000;
    if (item.date.startsWith("Ayer")) return Date.now() - 24 * 60 * 60 * 1000;
    return 0;
  };
  const visible = inbox.filter(item => filter === "Todas" || !item.read).sort((a, b) => notificationTime(b) - notificationTime(a));
  const respondToInvitation = (id: string, accepted: boolean) => {
    const invitation = notifications.find(item => item.id === id);
    if (!invitation?.businessName || !invitation.invitationId) return;
    const nextBusinesses = businesses.map(item => item.name === invitation.businessName
      ? { ...item, ownerNickname: accepted && item.ownerNickname === account.nickname ? "@otro.propietario" : item.ownerNickname, role: accepted ? "Colaborador" as const : item.role, collaborators: accepted ? (item.collaborators ?? []).map(collaborator => collaborator.id === invitation.invitationId ? { ...collaborator, active: true } : collaborator) : (item.collaborators ?? []).filter(collaborator => collaborator.id !== invitation.invitationId) }
      : item);
    setBusinesses(nextBusinesses);
    const selected = nextBusinesses.find(item => item.name === business.name);
    if (selected) setBusiness(selected);
    setNotifications(notifications.map(item => item.id === id ? { ...item, read: true, description: accepted ? `Aceptaste la invitación para colaborar en ${invitation.businessName}.` : `Rechazaste la invitación para colaborar en ${invitation.businessName}.` } : item));
    setConfirmingInvitation(null);
  };
  return <><PageHeader eyebrow="AL DÍA" title="Notificaciones" description="Entérate de lo que ocurre con tu presencia en WIT." action={unread > 0 && <button type="button" className="outline-button" onClick={() => setNotifications(notifications.map(item => ({...item, read: true})))}>Marcar todas como leídas</button>} /><section className="surface-card notifications-card"><div className="notification-tabs" role="group" aria-label="Filtrar notificaciones"><button type="button" onClick={() => setFilter("Todas")} className={filter === "Todas" ? "active" : ""} aria-pressed={filter === "Todas"}>Todas</button><button type="button" onClick={() => setFilter("No leídas")} className={filter === "No leídas" ? "active" : ""} aria-pressed={filter === "No leídas"}>No leídas <span>{unread}</span></button></div>{visible.length ? visible.map(item => { const to = item.id.startsWith("visibility-reminder-") ? "/configuracion" : item.type === "profile" ? `${destination.profile}/${businessIndex}` : item.type === "collaboration" ? "/notificaciones" : destination[item.type]; return <article className={`notification-row ${item.read ? "" : "unread"}${item.id.startsWith("visibility-reminder-") ? " is-actionable" : ""}`} key={item.id} onClick={() => { if (!item.read) setNotifications(notifications.map(current => current.id === item.id ? {...current, read: true} : current)); if (item.id.startsWith("visibility-reminder-")) navigate("/configuracion"); }}><span className={`notification-icon ${item.type}`}>{icons[item.type]}</span><div><div className="notification-title"><h2>{item.title}</h2>{!item.read && <span aria-label="Sin leer" />}</div><p>{item.description}</p><small>{item.date}</small>{item.type === "collaboration" && !item.read ? <div className="notification-invitation-actions">{confirmingInvitation?.id === item.id ? <div className="notification-inline-confirm"><span>{confirmingInvitation.accepted ? "¿Aceptar esta invitación?" : "¿Rechazar esta invitación?"}</span><button type="button" className="action-button" onClick={event => { event.stopPropagation(); respondToInvitation(item.id, confirmingInvitation.accepted); }}>{confirmingInvitation.accepted ? "Sí, aceptar" : "Sí, rechazar"}</button><button type="button" className="subtle-button" onClick={event => { event.stopPropagation(); setConfirmingInvitation(null); }}>Cancelar</button></div> : <><button type="button" className="action-button" onClick={event => { event.stopPropagation(); setConfirmingInvitation({ id: item.id, accepted: true }); }}>Aceptar invitación</button><button type="button" className="outline-button" onClick={event => { event.stopPropagation(); setConfirmingInvitation({ id: item.id, accepted: false }); }}>Rechazar</button></>}</div> : <Link className="notification-link" to={to}>Ver detalle →</Link>}</div><div className="notification-actions">{!item.read && <button type="button" className="subtle-button" onClick={event => { event.stopPropagation(); setNotifications(notifications.map(current => current.id === item.id ? {...current, read: true} : current)); }}>Marcar leída</button>}<button type="button" className="notification-delete" aria-label={`Eliminar ${item.title}`} onClick={event => { event.stopPropagation(); setNotifications(notifications.filter(current => current.id !== item.id)); }}>Eliminar</button></div></article>; }) : <div className="empty-state"><span>✓</span><h2>Todo al día</h2><p>No tienes notificaciones en tu bandeja.</p></div>}</section></>;
}
