import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "../components/common/PageHeader";
import { useBusinessStore } from "../services/businessStore";
import { businessApi, type PersistedBusinessNotification } from "../services/businessApiClient";
import { toBusinessDetails } from "../services/realBusinessAdapter";
import { useBusinessAuth } from "../services/businessAuthContext";
import { rememberBusinessNotificationDismissal } from "../services/notificationDismissal";
import xamukoLogo from "../assets/XAMUKO-V1-transparent.avif";

const icons = { review: "☆", interest: "↗", profile: "▣", wit: "✦", admin: "✉", offer: "✦", security: "✓", collaboration: "♙" };
const permissionLabels: Record<string, string> = {
  MANAGE_CATALOG: "Productos y servicios",
  MANAGE_PROMOTIONS: "Promociones",
  READ_ANALYTICS: "Estadísticas",
  EDIT_BUSINESS: "Información del negocio",
};

function NotificationArtwork({ item }: { item: PersistedBusinessNotification }) {
  const photoUrl = item.imageUrl ?? item.business.profilePhoto?.url;
  const [image, setImage] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    setImage(null);
    if (photoUrl) {
      void businessApi.photoBlob(photoUrl).then(blob => {
        objectUrl = URL.createObjectURL(blob);
        if (active) setImage(objectUrl);
        else URL.revokeObjectURL(objectUrl);
      }).catch(() => { if (active) setImage(null); });
    }
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [photoUrl]);

  const title = item.title.toLocaleLowerCase("es-CO");
  const variant = title.includes("permiso") ? "permissions" : title.includes("suspend") || title.includes("revoc") ? "access" : title.includes("reactiv") || title.includes("aceptad") ? "success" : "invitation";
  const glyph = variant === "permissions" ? "☷" : variant === "access" ? "⌑" : variant === "success" ? "✓" : "✉";
  return <span className={`notification-artwork ${variant}`} role="img" aria-label={item.imageAlt ?? `Notificación de ${item.business.name}`}>
    <span className="notification-artwork-glyph" aria-hidden="true">{glyph}</span>
    {image && <img src={image} alt="" onError={event => { URL.revokeObjectURL(image); setImage(null); event.currentTarget.remove(); }} />}
  </span>;
}


type DeleteTarget = { source: "persisted" | "local"; id: string };

function NotificationDeleteAction({ title, confirming, busy, pendingRequest, onRequest, onConfirm, onCancel }: {
  title: string;
  confirming: boolean;
  busy: boolean;
  pendingRequest?: boolean;
  onRequest: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return <div className="notification-delete-control" onClick={event => event.stopPropagation()}>
    <button type="button" className="notification-delete notification-delete-icon" aria-label={`Eliminar ${title}`} title="Eliminar notificación" onClick={onRequest} disabled={busy}>×</button>
    {confirming && <div className="notification-delete-confirm" role="group" aria-label={`Confirmar eliminación de ${title}`}>
      <span>{pendingRequest ? "¿Quitar aviso? La solicitud seguirá pendiente." : "¿Eliminarla?"}</span>
      <button type="button" className="notification-delete-yes" onClick={onConfirm} disabled={busy}>{busy ? "Eliminando…" : "Sí"}</button>
      <button type="button" onClick={onCancel} disabled={busy}>No</button>
    </div>}
  </div>;
}

export function NotificationsPage() {
  const { notifications, setNotifications, business, setBusinesses, setBusiness } = useBusinessStore();
  const [filter, setFilter] = useState<"Todas" | "No leídas">("Todas");
  const [confirmingInvitation, setConfirmingInvitation] = useState<{ id: string; accepted: boolean } | null>(null);
  const [persisted, setPersisted] = useState<PersistedBusinessNotification[]>([]);
  const [apiError, setApiError] = useState("");
  const [busyInvitation, setBusyInvitation] = useState<string | null>(null);
  const [transfers, setTransfers] = useState<Array<{ id: string; status: string; expiresAt: string | null; requestedAt: string; business: { id: string; name: string }; fromUser: { displayName: string; nickname: string | null } }>>([]);
  const [busyTransfer, setBusyTransfer] = useState<string | null>(null);
  const [confirmingTransfer, setConfirmingTransfer] = useState<{ id: string; accepted: boolean } | null>(null);
  const { user } = useBusinessAuth();
  const [pendingDelete, setPendingDelete] = useState<DeleteTarget | null>(null);
  const [busyDelete, setBusyDelete] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState(false);
  useEffect(() => {
    if (!deleteSuccess) return;
    const timeout = window.setTimeout(() => setDeleteSuccess(false), 3000);
    return () => window.clearTimeout(timeout);
  }, [deleteSuccess]);


  const reloadPersisted = useCallback(async () => {
    setPersisted([]);
    setApiError("");
    window.dispatchEvent(new CustomEvent("xamuko-notifications-updated", { detail: 0 }));
  }, []);
  useEffect(() => {
    void reloadPersisted();
    const refreshIfVisible = () => { if (document.visibilityState === "visible") void reloadPersisted(); };
    const intervalId = window.setInterval(refreshIfVisible, 30_000);
    document.addEventListener("visibilitychange", refreshIfVisible);
    window.addEventListener("focus", refreshIfVisible);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refreshIfVisible);
      window.removeEventListener("focus", refreshIfVisible);
    };
  }, [reloadPersisted]);
  const reloadTransfers = useCallback(async () => { try { const result = await businessApi.listReceivedOwnershipTransfers(); setTransfers(result.transfers); } catch { /* La bandeja principal sigue disponible. */ } }, []);
  useEffect(() => { void reloadTransfers(); }, [reloadTransfers]);

  const notificationTime = (item: typeof notifications[number]) => {
    if (item.createdAt) return Date.parse(item.createdAt);
    if (item.date.startsWith("Ahora")) return item.read ? 0 : Date.now();
    if (item.date.startsWith("Hoy")) return Date.now() - 60 * 60 * 1000;
    if (item.date.startsWith("Ayer")) return Date.now() - 24 * 60 * 60 * 1000;
    return 0;
  };
  const visible = notifications.filter(item => filter === "Todas" || !item.read).sort((left, right) => notificationTime(right) - notificationTime(left));
  const visiblePersisted = useMemo(() => persisted.filter(item => filter === "Todas" || !item.readAt), [filter, persisted]);
  const totalUnread = notifications.filter(item => !item.read).length + persisted.filter(item => !item.readAt).length;

  const respondPersisted = async (item: PersistedBusinessNotification, accept: boolean) => {
    if (!item.membershipId) return;
    setBusyInvitation(item.id); setApiError("");
    try {
      await businessApi.respondCollaboratorInvitation(item.membershipId, accept);
      const fresh = (await businessApi.list()).businesses.map(toBusinessDetails);
      setBusinesses(fresh);
      const selected = fresh.find(value => value.id === business.id) ?? fresh[0];
      if (selected) setBusiness(selected);
      await reloadPersisted();
      setConfirmingInvitation(null);
    } catch (cause) { setApiError(cause instanceof Error ? cause.message : "No se pudo responder la invitación."); }
    finally { setBusyInvitation(null); }
  };
  const markAllRead = async () => {
    setNotifications(notifications.map(item => ({ ...item, read: true })));
    const unreadPersisted = persisted.filter(item => !item.readAt);
    if (!unreadPersisted.length) return;
    try { await Promise.all(unreadPersisted.map(item => businessApi.markBusinessNotificationRead(item.id))); await reloadPersisted(); }
    catch { setApiError("No se pudieron actualizar todas las notificaciones."); }
  };
  const respondTransfer = async (id: string, accept: boolean) => { setBusyTransfer(id); setApiError(""); try { await businessApi.respondOwnershipTransfer(id, accept); const fresh = (await businessApi.list()).businesses.map(toBusinessDetails); setBusinesses(fresh); const selected = fresh.find(value => value.id === business.id) ?? fresh[0]; if (selected) setBusiness(selected); await reloadTransfers(); await reloadPersisted(); setConfirmingTransfer(null); } catch (cause) { setApiError(cause instanceof Error ? cause.message : "No se pudo responder la transferencia."); } finally { setBusyTransfer(null); } };

  const deleting = (source: DeleteTarget["source"], id: string) => busyDelete === `${source}:${id}`;
  const confirmingDelete = (source: DeleteTarget["source"], id: string) => pendingDelete?.source === source && pendingDelete.id === id;
  const confirmDelete = async (target: DeleteTarget) => {
    if (busyDelete) return;
    const key = `${target.source}:${target.id}`;
    setBusyDelete(key);
    setApiError("");
    try {
      if (target.source === "persisted") {
        await businessApi.deleteBusinessNotification(target.id);
        setPersisted(current => current.filter(item => item.id !== target.id));
        await reloadPersisted();
      } else {
        rememberBusinessNotificationDismissal(user?.publicId ?? "preview", target.id);
        setNotifications(notifications.filter(item => item.id !== target.id));
      }
      setPendingDelete(null);
      setDeleteSuccess(true);
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "No se pudo eliminar la notificación.");
    } finally {
      setBusyDelete(null);
    }
  };

  return <>
    <PageHeader eyebrow="AL DÍA" title="Notificaciones" description="Entérate de lo que ocurre con tu presencia en XAMUKO." action={totalUnread > 0 && <button type="button" className="outline-button" onClick={() => void markAllRead()}>Marcar todas como leídas</button>} />
    {apiError && <div className="notification-page-alert" role="alert">{apiError}</div>}
    {deleteSuccess && <p className="notification-delete-success" role="status">La notificación se eliminó correctamente.</p>}
    <section className="surface-card notifications-card">
      <div className="notification-tabs" role="group" aria-label="Filtrar notificaciones"><button type="button" onClick={() => setFilter("Todas")} className={filter === "Todas" ? "active" : ""} aria-pressed={filter === "Todas"}>Todas</button><button type="button" onClick={() => setFilter("No leídas")} className={filter === "No leídas" ? "active" : ""} aria-pressed={filter === "No leídas"}>No leídas <span>{totalUnread}</span></button></div>
      {visiblePersisted.map(item => {
        const pending = item.type === "COLLABORATION_INVITATION" && item.membership?.status === "INVITED";
        const permissionText = item.membership?.permissions.filter(permission => permission.allowed).map(permission => permissionLabels[permission.permission] ?? permission.permission).join(", ");
        const ownerName = item.business.memberships[0]?.user.displayName;
        const transfer = item.type === "COLLABORATION_UPDATE" && item.title.toLocaleLowerCase("es-CO").includes("transferencia de propiedad")
          ? transfers.filter(candidate => candidate.business.id === item.businessId).sort((left, right) => Math.abs(Date.parse(left.requestedAt) - Date.parse(item.createdAt)) - Math.abs(Date.parse(right.requestedAt) - Date.parse(item.createdAt)))[0]
          : undefined;
        const status = item.type === "COLLABORATION_INVITATION" ? item.membership?.status === "ACTIVE" ? "Invitación aceptada" : item.membership?.status === "REJECTED" ? "Invitación rechazada" : item.membership?.status === "REVOKED" ? "Invitación cancelada" : item.membership?.status === "EXPIRED" ? "Invitación vencida" : null : null;
        return <article className={`notification-row ${item.readAt ? "" : "unread"}${transfer ? " is-transfer-notification" : ""}`} key={item.id}>
          <NotificationArtwork item={item}/>
          <div><div className="notification-title"><h2>{item.title}</h2>{transfer && <span className={`transfer-state ${transfer.status.toLowerCase()}`}>{transfer.status === "PENDING" ? "Pendiente" : transfer.status === "ACCEPTED" ? "Aceptada" : transfer.status === "REJECTED" ? "Rechazada" : transfer.status === "CANCELLED" ? "Cancelada" : transfer.status === "EXPIRED" ? "Vencida" : transfer.status}</span>}</div><p>{item.message}</p>{transfer && <><small>Solicitud enviada por {transfer.fromUser.displayName}{transfer.fromUser.nickname ? ` (${transfer.fromUser.nickname})` : ""}.</small><small>Solicitada {new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(transfer.requestedAt))}{transfer.expiresAt ? ` · Vence ${new Intl.DateTimeFormat("es-CO", { dateStyle: "medium" }).format(new Date(transfer.expiresAt))}` : ""}</small></>}{ownerName && item.type === "COLLABORATION_INVITATION" && <small>Propietario: {ownerName}</small>}{permissionText && item.type === "COLLABORATION_INVITATION" && <small>Permisos: {permissionText}</small>}{!transfer && <small>{new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.createdAt))}{item.membership?.expiresAt ? ` · Vence ${new Intl.DateTimeFormat("es-CO", { dateStyle: "medium" }).format(new Date(item.membership.expiresAt))}` : ""}</small>}
            {transfer?.status === "PENDING" ? <div className="notification-invitation-actions">{confirmingTransfer?.id === transfer.id ? <div className="notification-inline-confirm" role="group" aria-label="Confirmar respuesta a transferencia"><span>{confirmingTransfer.accepted ? `Al aceptar, asumirás la propiedad administrativa de ${transfer.business.name}.` : `¿Rechazar la transferencia de ${transfer.business.name}?`}</span><button className={confirmingTransfer.accepted ? "action-button" : "danger-button"} disabled={busyTransfer === transfer.id} onClick={() => void respondTransfer(transfer.id, confirmingTransfer.accepted)}>{busyTransfer === transfer.id ? "Procesando…" : confirmingTransfer.accepted ? "Confirmar aceptación" : "Confirmar rechazo"}</button><button className="subtle-button" disabled={busyTransfer === transfer.id} onClick={() => setConfirmingTransfer(null)}>Volver</button></div> : <><button className="action-button" disabled={busyTransfer === transfer.id} onClick={() => setConfirmingTransfer({ id: transfer.id, accepted: true })}>Aceptar transferencia</button><button className="outline-button" disabled={busyTransfer === transfer.id} onClick={() => setConfirmingTransfer({ id: transfer.id, accepted: false })}>Rechazar</button></>}</div> : pending && !item.readAt ? <div className="notification-invitation-actions">{confirmingInvitation?.id === item.id ? <div className="notification-inline-confirm"><span>{confirmingInvitation.accepted ? "¿Aceptar esta invitación?" : "¿Rechazar esta invitación?"}</span><button className="action-button" disabled={busyInvitation === item.id} onClick={() => void respondPersisted(item, confirmingInvitation.accepted)}>{busyInvitation === item.id ? "Procesando…" : confirmingInvitation.accepted ? "Sí, aceptar" : "Sí, rechazar"}</button><button className="subtle-button" onClick={() => setConfirmingInvitation(null)}>Cancelar</button></div> : <><button className="action-button" onClick={() => setConfirmingInvitation({ id: item.id, accepted: true })}>Aceptar invitación</button><button className="outline-button" onClick={() => setConfirmingInvitation({ id: item.id, accepted: false })}>Rechazar</button></>}</div> : status && <small>{status}</small>}
          </div>
          <div className="notification-actions">
            <NotificationDeleteAction title={item.title} confirming={confirmingDelete("persisted", item.id)} busy={deleting("persisted", item.id)} pendingRequest={pending || transfer?.status === "PENDING"} onRequest={() => setPendingDelete({ source: "persisted", id: item.id })} onConfirm={() => void confirmDelete({ source: "persisted", id: item.id })} onCancel={() => setPendingDelete(null)}/>
          </div>
        </article>;
      })}
      {visible.map(item => <article className={`notification-row ${item.read ? "" : "unread"}`} key={item.id} onMouseEnter={() => { if (!item.read) setNotifications(notifications.map(current => current.id === item.id ? { ...current, read: true } : current)); }} onClick={() => { if (!item.read) setNotifications(notifications.map(current => current.id === item.id ? { ...item, read: true } : current)); }}><span className={`notification-icon ${item.type}${item.id === "welcome" ? " notification-brand-logo" : ""}`}>{item.id === "welcome" ? <img src={xamukoLogo} alt="XAMUKO" /> : icons[item.type]}</span><div><div className="notification-title"><h2>{item.title}</h2></div><p>{item.description}</p><small>{item.date}</small></div><div className="notification-actions"><NotificationDeleteAction title={item.title} confirming={confirmingDelete("local", item.id)} busy={deleting("local", item.id)} onRequest={() => setPendingDelete({ source: "local", id: item.id })} onConfirm={() => void confirmDelete({ source: "local", id: item.id })} onCancel={() => setPendingDelete(null)}/></div></article>)}
      {!visiblePersisted.length && !visible.length && <div className="empty-state"><span>✓</span><h2>Todo al día</h2><p>No tienes notificaciones en tu bandeja.</p></div>}
    </section>
  </>;
}
