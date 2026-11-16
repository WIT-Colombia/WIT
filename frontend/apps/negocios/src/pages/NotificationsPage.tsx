import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./NotificationsPage.css";
import { useBusinessStore } from "../services/businessStore";
import { businessApi, type PersistedBusinessNotification } from "../services/businessApiClient";
import { toBusinessDetails } from "../services/realBusinessAdapter";
import { useBusinessAuth } from "../services/businessAuthContext";
import { announceBusinessAccountWelcomeUpdate } from "../services/businessWelcomeStatus";

const icons = { review: "☆", interest: "↗", profile: "▣", wit: "✦", admin: "✉", offer: "✦", security: "✓", collaboration: "♙" };
const destination = { review: "/opiniones", interest: "/productos", profile: "/mis-negocios/editar", wit: "/mi-negocio", admin: "/configuracion", offer: "/estadisticas", security: "/perfil" } as const;
const permissionLabels: Record<string, string> = {
  MANAGE_CATALOG: "Productos y servicios",
  MANAGE_PROMOTIONS: "Promociones",
  READ_ANALYTICS: "Estadísticas",
  EDIT_BUSINESS: "Información del negocio",
};

function NotificationArtwork({ item }: { item: PersistedBusinessNotification }) {
  const photoUrl = item.business.profilePhoto?.url;
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
  return <span className={`notification-artwork ${variant}`} role="img" aria-label={`Notificación de ${item.business.name}`}>
    <span className="notification-artwork-glyph" aria-hidden="true">{glyph}</span>
    {image && <img src={image} alt="" onError={event => { URL.revokeObjectURL(image); setImage(null); event.currentTarget.remove(); }} />}
  </span>;
}

export function NotificationsPage() {
  const { notifications, setNotifications, businesses, business, setBusinesses, setBusiness } = useBusinessStore();
  const auth = useBusinessAuth();
  const accountId = auth.state.status === "authenticated" ? auth.user?.id ?? "" : "";
  const accountRef = useRef(accountId);
  accountRef.current = accountId;
  const navigate = useNavigate();
  const businessIndex = Math.max(0, businesses.findIndex(item => item.id === business.id));
  const selectedBusinessId = business.id ?? "";
  const selectedBusinessRef = useRef(selectedBusinessId);
  selectedBusinessRef.current = selectedBusinessId;
  const [filter, setFilter] = useState<"Todas" | "No leídas" | "Leídas">("Todas");
  const [confirmingInvitation, setConfirmingInvitation] = useState<{ id: string; accepted: boolean } | null>(null);
  const [persisted, setPersisted] = useState<PersistedBusinessNotification[]>([]);
  const [persistedScope, setPersistedScope] = useState({ userId: "", businessId: "" });
  const [scopedUnread, setScopedUnread] = useState<{ userId: string; businessId: string; count: number }>({ userId: "", businessId: "", count: 0 });
  const [markingAll, setMarkingAll] = useState(false);
  const [apiError, setApiError] = useState("");
  const [busyInvitation, setBusyInvitation] = useState<string | null>(null);
  const [transfers, setTransfers] = useState<Array<{ id: string; status: string; expiresAt: string | null; requestedAt: string; business: { id: string; name: string }; fromUser: { displayName: string; nickname: string | null } }>>([]);
  const [busyTransfer, setBusyTransfer] = useState<string | null>(null);
  const [confirmingTransfer, setConfirmingTransfer] = useState<{ id: string; accepted: boolean } | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [busyDelete, setBusyDelete] = useState<string | null>(null);
  const [confirmingLocalDelete, setConfirmingLocalDelete] = useState<string | null>(null);
  // Before the first business exists, the welcome belongs to the Business account.
  // Once a business is selected, its own welcome is isolated by business and account.
  const hasSelectedBusiness = business.source === "real" && Boolean(selectedBusinessId) && businesses.some(item => item.id === selectedBusinessId);
  const welcomeKey = accountId
    ? hasSelectedBusiness
      ? `xamuko-business-welcome:${accountId}:${selectedBusinessId}`
      : `xamuko-business-account-welcome:${accountId}`
    : "";
  const [welcomeState, setWelcomeState] = useState<{ key: string; read: boolean; dismissed: boolean }>({ key: "", read: false, dismissed: false });
  useEffect(() => {
    if (!welcomeKey) { setWelcomeState({ key: "", read: false, dismissed: false }); return; }
    try {
      const saved = localStorage.getItem(welcomeKey);
      const parsed = saved ? JSON.parse(saved) as { read?: boolean; dismissed?: boolean } : {};
      setWelcomeState({ key: welcomeKey, read: Boolean(parsed.read), dismissed: Boolean(parsed.dismissed) });
    } catch { setWelcomeState({ key: welcomeKey, read: false, dismissed: false }); }
  }, [welcomeKey]);
  const changeWelcome = (read: boolean, dismissed: boolean) => {
    if (!welcomeKey) return;
    const next = { key: welcomeKey, read, dismissed };
    setWelcomeState(next);
    try { localStorage.setItem(welcomeKey, JSON.stringify({ read, dismissed })); } catch { /* Browser storage may be disabled. */ }
    if (!hasSelectedBusiness && accountId) announceBusinessAccountWelcomeUpdate(accountId);
  };
  const showWelcome = Boolean(welcomeKey) && welcomeState.key === welcomeKey && !welcomeState.dismissed;


  const reloadPersisted = useCallback(async () => {
    const id = selectedBusinessId;
    const uid = accountId;
    if (!id || !uid) { setPersisted([]); return; }
    try {
      const { notifications: rows, unread } = await businessApi.listBusinessNotifications(id);
      if (selectedBusinessRef.current !== id || accountRef.current !== uid) return;
      setPersisted(rows);
      setPersistedScope({ userId: uid, businessId: id });
      setScopedUnread({ userId: uid, businessId: id, count: unread });
      setApiError("");
      window.dispatchEvent(new CustomEvent("xamuko-notifications-updated", {
        detail: { businessId: id, count: unread },
      }));
    } catch {
      if (selectedBusinessRef.current === id && accountRef.current === uid)
        setApiError("No fue posible consultar las notificaciones de este negocio.");
    }
  }, [selectedBusinessId, accountId]);
  useEffect(() => {
    setPersisted([]);
    setPersistedScope({ userId: "", businessId: "" });
    setScopedUnread({ userId: "", businessId: "", count: 0 });
    setConfirmingInvitation(null);
    setConfirmingTransfer(null);
    setConfirmingDelete(null);
    setConfirmingLocalDelete(null);
    setApiError("");
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
  const removePersisted = async (id: string) => {
    const requestedBusinessId = selectedBusinessId;
    const requestedUserId = accountId;
    if (!requestedBusinessId || !requestedUserId || busyDelete) return;
    setBusyDelete(id); setApiError("");
    try {
      await businessApi.deleteBusinessNotification(id, requestedBusinessId);
      if (selectedBusinessRef.current === requestedBusinessId && accountRef.current === requestedUserId) {
        setConfirmingDelete(null);
        await reloadPersisted();
      }
    } catch (cause) {
      if (selectedBusinessRef.current === requestedBusinessId && accountRef.current === requestedUserId)
        setApiError(cause instanceof Error ? cause.message : "No se pudo descartar el aviso.");
    } finally { setBusyDelete(null); }
  };

  const reloadTransfers = useCallback(async () => { try { const result = await businessApi.listReceivedOwnershipTransfers(); setTransfers(result.transfers); } catch { /* La bandeja principal sigue disponible. */ } }, []);
  useEffect(() => { void reloadTransfers(); }, [reloadTransfers]);

  const notificationTime = (item: typeof notifications[number]) => {
    if (item.createdAt) return Date.parse(item.createdAt);
    if (item.date.startsWith("Ahora")) return item.read ? 0 : Date.now();
    if (item.date.startsWith("Hoy")) return Date.now() - 60 * 60 * 1000;
    if (item.date.startsWith("Ayer")) return Date.now() - 24 * 60 * 60 * 1000;
    return 0;
  };
  const currentLocal = notifications.filter(item =>
    item.id === "welcome" && business.source !== "real" ? true :
    item.businessId ? item.businessId === selectedBusinessId :
      business.source !== "real" && Boolean(item.businessName) && item.businessName === business.name);
  const visible = currentLocal.filter(item => filter === "Todas" || (filter === "No leídas" ? !item.read : item.read))
    .sort((left, right) => notificationTime(right) - notificationTime(left));
  const visiblePersisted = useMemo(() => persisted.filter(item =>
    persistedScope.userId === accountId && persistedScope.businessId === selectedBusinessId &&
    item.businessId === selectedBusinessId && (filter === "Todas" || (filter === "No leídas" ? !item.readAt : Boolean(item.readAt)))),
    [filter, persisted, persistedScope, selectedBusinessId, accountId]);
  const totalUnread = currentLocal.filter(item => !item.read).length + (showWelcome && !welcomeState.read ? 1 : 0) +
    (scopedUnread.userId === accountId && scopedUnread.businessId === selectedBusinessId ? scopedUnread.count : 0);

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
    if (markingAll) return;
    setMarkingAll(true);
    if (showWelcome && !welcomeState.read) changeWelcome(true, false);
    const id = selectedBusinessId;
    setNotifications(notifications.map(item =>
      currentLocal.some(current => current.id === item.id) ? { ...item, read: true } : item));
    try {
      if (id && accountId && scopedUnread.userId === accountId && scopedUnread.businessId === id && scopedUnread.count > 0)
        await businessApi.markAllBusinessNotificationsRead(id);
      if (selectedBusinessRef.current === id && accountRef.current === accountId) await reloadPersisted();
    } catch { if (selectedBusinessRef.current === id && accountRef.current === accountId) setApiError("No se pudieron actualizar todas las notificaciones."); }
    finally { setMarkingAll(false); }
  };
  const respondTransfer = async (id: string, accept: boolean) => { setBusyTransfer(id); setApiError(""); try { await businessApi.respondOwnershipTransfer(id, accept); const fresh = (await businessApi.list()).businesses.map(toBusinessDetails); setBusinesses(fresh); const selected = fresh.find(value => value.id === business.id) ?? fresh[0]; if (selected) setBusiness(selected); await reloadTransfers(); await reloadPersisted(); setConfirmingTransfer(null); } catch (cause) { setApiError(cause instanceof Error ? cause.message : "No se pudo responder la transferencia."); } finally { setBusyTransfer(null); } };


  const deletePending = Boolean(confirmingDelete || confirmingLocalDelete);
  const executeDelete = () => {
    if (confirmingDelete) { void removePersisted(confirmingDelete); return; }
    if (!confirmingLocalDelete) return;
    if (confirmingLocalDelete === "business-welcome") changeWelcome(welcomeState.read, true);
    else setNotifications(notifications.filter(item => item.id !== confirmingLocalDelete));
    setConfirmingLocalDelete(null);
  };
  return <div className="business-notifications-page">
    <header className="business-notifications-heading">
      <div className="business-notifications-heading-main">
        <span className="business-notifications-heading-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>
        </span>
        <div>
          <span className="business-notifications-eyebrow">{hasSelectedBusiness ? "ACTIVIDAD DE TU NEGOCIO" : "TU ESPACIO EN XAMUKO BUSINESS"}</span>
          <h1>Notificaciones</h1>
          <p>{hasSelectedBusiness ? "Avisos y decisiones relacionados con " + business.name + "." : "Aquí encontrarás tus novedades. Comienza registrando tu primer negocio."}</p>
          <span className="business-notifications-count" aria-live="polite">{totalUnread} {totalUnread === 1 ? "pendiente" : "pendientes"} por leer</span>
        </div>
      </div>
      {totalUnread > 0 && <button type="button" className="business-notifications-mark-all" disabled={markingAll} onClick={() => void markAllRead()}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>
        {markingAll ? "Actualizando…" : "Marcar todas como leídas"}
      </button>}
    </header>
    {apiError && <div className="notification-page-alert" role="alert">{apiError}</div>}
    <section className="surface-card notifications-card">
      <div className="notification-tabs" role="group" aria-label="Filtrar notificaciones"><button type="button" onClick={() => setFilter("Todas")} className={filter === "Todas" ? "active" : ""} aria-pressed={filter === "Todas"}>Todas</button><button type="button" onClick={() => setFilter("No leídas")} className={filter === "No leídas" ? "active" : ""} aria-pressed={filter === "No leídas"}>No leídas <span>{totalUnread}</span></button><button type="button" onClick={() => setFilter("Leídas")} className={filter === "Leídas" ? "active" : ""} aria-pressed={filter === "Leídas"}>Leídas</button></div>
      {showWelcome && (filter === "Todas" || (filter === "No leídas" ? !welcomeState.read : welcomeState.read)) && <article className={`notification-row notification-welcome-row ${welcomeState.read ? "" : "unread"}`} onClick={() => { if (!welcomeState.read) changeWelcome(true, false); }} aria-label="Bienvenida de XAMUKO">
        <span className="notification-icon wit notification-welcome-brand" aria-hidden="true"><img src="/brand/xamuko-symbol.jpg" alt=""/></span>
        <div><div className="notification-title"><h2>{hasSelectedBusiness ? "¡Qué alegría acompañar a tu negocio!" : "¡Qué alegría tenerte en XAMUKO Business!"}</h2>{!welcomeState.read && <span aria-label="Sin leer"/>}</div><p>{hasSelectedBusiness ? "Detrás de cada negocio hay esfuerzo, sueños e historias por compartir. Gracias por permitirnos acompañarte a darlo a conocer y conectar con más personas. ¡Cuenta con nosotros en este camino!" : "Nos encanta que estés aquí. Este es el comienzo: crea tu primer negocio, comparte lo que te hace especial y descubre nuevas oportunidades para conectar con más personas. ¡Estamos contigo en cada paso!"}</p><small>Equipo XAMUKO · Mensaje de bienvenida</small>{!hasSelectedBusiness && <Link className="business-notifications-start-cta" to="/mis-negocios/nuevo" onClick={event => event.stopPropagation()}>Crear mi primer negocio <span aria-hidden="true">→</span></Link>}</div>

        <div className="notification-actions" onClick={event => event.stopPropagation()}>
          <button type="button" className="notification-delete" title="Eliminar notificación" aria-label="Eliminar bienvenida" onClick={() => setConfirmingLocalDelete("business-welcome")}>
            <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M10 4h4M6 7l1 13h10l1-13M10 11v5M14 11v5"/></svg>
          </button>
        </div>
      </article>}
      {visiblePersisted.map(item => {
        const pending = item.type === "COLLABORATION_INVITATION" && item.membership?.status === "INVITED";
        const permissionText = item.membership?.permissions.filter(permission => permission.allowed).map(permission => permissionLabels[permission.permission] ?? permission.permission).join(", ");
        const ownerName = item.business.memberships[0]?.user.displayName;
        const transfer = item.type === "COLLABORATION_UPDATE" && item.title.toLocaleLowerCase("es-CO").includes("transferencia de propiedad")
          ? transfers.filter(candidate => candidate.business.id === item.businessId).sort((left, right) => Math.abs(Date.parse(left.requestedAt) - Date.parse(item.createdAt)) - Math.abs(Date.parse(right.requestedAt) - Date.parse(item.createdAt)))[0]
          : undefined;
        const status = item.type === "COLLABORATION_INVITATION" ? item.membership?.status === "ACTIVE" ? "Invitación aceptada" : item.membership?.status === "REJECTED" ? "Invitación rechazada" : item.membership?.status === "REVOKED" ? "Invitación cancelada" : item.membership?.status === "EXPIRED" ? "Invitación vencida" : null : null;
        return <article className={`notification-row ${item.readAt ? "" : "unread"}${transfer ? " is-transfer-notification" : ""}`} key={item.id} onClick={() => { if (!item.readAt && selectedBusinessId) void businessApi.markBusinessNotificationRead(item.id, selectedBusinessId).then(reloadPersisted).catch(() => setApiError("No se pudo marcar como leída.")); }}>
          <NotificationArtwork item={item}/>
          <div><div className="notification-title"><h2>{item.title}</h2>{transfer && <span className={`transfer-state ${transfer.status.toLowerCase()}`}>{transfer.status === "PENDING" ? "Pendiente" : transfer.status === "ACCEPTED" ? "Aceptada" : transfer.status === "REJECTED" ? "Rechazada" : transfer.status === "CANCELLED" ? "Cancelada" : transfer.status === "EXPIRED" ? "Vencida" : transfer.status}</span>}{!item.readAt && <span aria-label="Sin leer"/>}</div><p>{item.message}</p>{transfer && <><small>Solicitud enviada por {transfer.fromUser.displayName}{transfer.fromUser.nickname ? ` (${transfer.fromUser.nickname})` : ""}.</small><small>Solicitada {new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(transfer.requestedAt))}{transfer.expiresAt ? ` · Vence ${new Intl.DateTimeFormat("es-CO", { dateStyle: "medium" }).format(new Date(transfer.expiresAt))}` : ""}</small></>}{ownerName && item.type === "COLLABORATION_INVITATION" && <small>Propietario: {ownerName}</small>}{permissionText && item.type === "COLLABORATION_INVITATION" && <small>Permisos: {permissionText}</small>}{!transfer && <small>{new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.createdAt))}{item.membership?.expiresAt ? ` · Vence ${new Intl.DateTimeFormat("es-CO", { dateStyle: "medium" }).format(new Date(item.membership.expiresAt))}` : ""}</small>}
            {transfer?.status === "PENDING" ? <div className="notification-invitation-actions" onClick={event => event.stopPropagation()}>{confirmingTransfer?.id === transfer.id ? <div className="notification-inline-confirm" role="group" aria-label="Confirmar respuesta a transferencia"><span>{confirmingTransfer.accepted ? `Al aceptar, asumirás la propiedad administrativa de ${transfer.business.name}.` : `¿Rechazar la transferencia de ${transfer.business.name}?`}</span><button className={confirmingTransfer.accepted ? "action-button" : "danger-button"} disabled={busyTransfer === transfer.id} onClick={() => void respondTransfer(transfer.id, confirmingTransfer.accepted)}>{busyTransfer === transfer.id ? "Procesando…" : confirmingTransfer.accepted ? "Confirmar aceptación" : "Confirmar rechazo"}</button><button className="subtle-button" disabled={busyTransfer === transfer.id} onClick={() => setConfirmingTransfer(null)}>Volver</button></div> : <><button className="action-button" disabled={busyTransfer === transfer.id} onClick={() => setConfirmingTransfer({ id: transfer.id, accepted: true })}>Aceptar transferencia</button><button className="outline-button" disabled={busyTransfer === transfer.id} onClick={() => setConfirmingTransfer({ id: transfer.id, accepted: false })}>Rechazar</button></>}</div> : pending ? <div className="notification-invitation-actions" onClick={event => event.stopPropagation()}>{confirmingInvitation?.id === item.id ? <div className="notification-inline-confirm"><span>{confirmingInvitation.accepted ? "¿Aceptar esta invitación?" : "¿Rechazar esta invitación?"}</span><button className="action-button" disabled={busyInvitation === item.id} onClick={() => void respondPersisted(item, confirmingInvitation.accepted)}>{busyInvitation === item.id ? "Procesando…" : confirmingInvitation.accepted ? "Sí, aceptar" : "Sí, rechazar"}</button><button className="subtle-button" onClick={() => setConfirmingInvitation(null)}>Cancelar</button></div> : <><button className="action-button" onClick={() => setConfirmingInvitation({ id: item.id, accepted: true })}>Aceptar invitación</button><button className="outline-button" onClick={() => setConfirmingInvitation({ id: item.id, accepted: false })}>Rechazar</button></>}</div> : status && <small>{status}</small>}
          </div>
          <div className="notification-actions" onClick={event => event.stopPropagation()}>
            {!item.readAt && !pending && <button type="button" className="subtle-button" onClick={() => void businessApi.markBusinessNotificationRead(item.id, selectedBusinessId).then(reloadPersisted).catch(() => setApiError("No se pudo actualizar la notificación."))}>Marcar leída</button>}

            <button type="button" className="notification-delete" disabled={Boolean(busyDelete)} title="Eliminar notificación" aria-label={'Eliminar ' + item.title}
              onClick={() => setConfirmingDelete(item.id)}>
              <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M10 4h4M6 7l1 13h10l1-13M10 11v5M14 11v5"/></svg>
            </button>
          </div>
        </article>;
      })}
      {visible.map(item => { const to = item.id.startsWith("visibility-reminder-") ? "/configuracion" : item.type === "profile" ? `${destination.profile}/${businessIndex}` : item.type === "collaboration" ? "/notificaciones" : destination[item.type]; return <article className={`notification-row ${item.read ? "" : "unread"}${item.id.startsWith("visibility-reminder-") ? " is-actionable" : ""}`} key={item.id} onClick={() => { if (!item.read) setNotifications(notifications.map(current => current.id === item.id ? { ...current, read: true } : current)); if (item.id.startsWith("visibility-reminder-")) navigate("/configuracion"); }}><span className={`notification-icon ${item.type}`}>{icons[item.type]}</span><div><div className="notification-title"><h2>{item.title}</h2>{!item.read && <span aria-label="Sin leer"/>}</div><p>{item.description}</p><small>{item.date}</small><Link className="notification-link" to={to}>Ver detalle →</Link></div><div className="notification-actions" onClick={event => event.stopPropagation()}>{!item.read && <button className="subtle-button" onClick={event => { event.stopPropagation(); setNotifications(notifications.map(current => current.id === item.id ? { ...current, read: true } : current)); }}>Marcar leída</button>}
            <button type="button" className="notification-delete" title="Eliminar notificación" aria-label={'Eliminar ' + item.title} onClick={() => setConfirmingLocalDelete(item.id)}>
              <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M10 4h4M6 7l1 13h10l1-13M10 11v5M14 11v5"/></svg>
            </button>
</div></article>; })}
      {!visiblePersisted.length && !visible.length && !(showWelcome && (filter === "Todas" || (filter === "No leídas" ? !welcomeState.read : welcomeState.read))) && <div className="empty-state"><span>✓</span><h2>Todo al día</h2><p>No hay notificaciones para el filtro seleccionado.</p></div>}

    </section>
    {deletePending && <div className="business-notification-confirm-backdrop" role="presentation"
      onClick={() => { if (!busyDelete) { setConfirmingDelete(null); setConfirmingLocalDelete(null); } }}>
      <div className="business-notification-confirm-dialog" role="alertdialog" aria-modal="true"
        aria-labelledby="business-delete-title" aria-describedby="business-delete-description"
        onClick={event => event.stopPropagation()}
        onKeyDown={event => { if (event.key === 'Escape' && !busyDelete) { setConfirmingDelete(null); setConfirmingLocalDelete(null); } }}>
        <span className="business-notification-confirm-symbol" aria-hidden="true">!</span>
        <h2 id="business-delete-title">¿Eliminar notificación?</h2>
        <p id="business-delete-description">Este aviso desaparecerá de la bandeja de {business.name}. Las solicitudes y tareas asociadas seguirán pendientes hasta que se resuelvan.</p>
        <div className="business-notification-confirm-actions">
          <button type="button" disabled={Boolean(busyDelete)} onClick={() => { setConfirmingDelete(null); setConfirmingLocalDelete(null); }}>Cancelar</button>
          <button type="button" className="business-notification-confirm-danger" disabled={Boolean(busyDelete)} onClick={executeDelete}>{busyDelete ? "Eliminando…" : "Eliminar"}</button>
        </div>
      </div>
    </div>}
  </div>;
}
