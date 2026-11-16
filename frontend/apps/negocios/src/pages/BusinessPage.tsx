import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../components/common/PageHeader";
import { useBusinessStore } from "../services/businessStore";
import type { BusinessDetails } from "../types/business";
import { businessApi, BusinessApiError, type PersistedBusinessNotification } from "../services/businessApiClient";
import { formatCategoryName, toBusinessDetails } from "../services/realBusinessAdapter";
import { BusinessIndicatorRow } from "../components/layout/Sidebar";
import { useBusinessAuth } from "../services/businessAuthContext";
import { PersistedPhoto } from "../components/common/PersistedPhoto";
import { PioneerBadge } from "../components/PioneerBadge";

export function BusinessPage() {
  const navigate = useNavigate();
  const { business, businesses, setBusiness, setBusinesses } = useBusinessStore();
  const auth = useBusinessAuth();
  const { state: authState, refresh } = auth;
  const accountId = authState.status === "authenticated" ? auth.user?.id ?? "" : "";
  const accountRef = useRef(accountId);
  accountRef.current = accountId;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [transfers, setTransfers] = useState<Awaited<ReturnType<typeof businessApi.listReceivedOwnershipTransfers>>["transfers"]>([]);
  const [transfersAccount, setTransfersAccount] = useState("");
  const [transferChoice, setTransferChoice] = useState<{ id: string; accept: boolean } | null>(null);
  const [transferBusy, setTransferBusy] = useState(false);
  const [transferError, setTransferError] = useState("");
  useEffect(() => {
    setTransfers([]);
    setTransfersAccount("");
    setTransferChoice(null);
    setTransferError("");
    if (!accountId) return;
    let active = true;
    void businessApi.listReceivedOwnershipTransfers().then(({ transfers: incoming }) => {
      if (active && accountRef.current === accountId) {
        setTransfers(incoming.filter(item => item.status === "PENDING"));
        setTransfersAccount(accountId);
      }
    }).catch(() => { if (active && accountRef.current === accountId)
      setTransferError("No se pudieron consultar las transferencias de propiedad."); });
    return () => { active = false; };
  }, [accountId]);
  const respondTransfer = async (id: string, accept: boolean) => {
    if (transferBusy || !accountId || transfersAccount !== accountId) return;
    const requestedAccountId = accountId;
    setTransferBusy(true); setTransferError("");
    try {
      await businessApi.respondOwnershipTransfer(id, accept);
      const next = (await businessApi.list()).businesses.map(toBusinessDetails);
      if (accountRef.current !== requestedAccountId) return;
      setBusinesses(next);
      if (!business.id && next[0]) setBusiness(next[0]);
      setTransfers(current => current.filter(item => item.id !== id));
      setTransferChoice(null);
    } catch (cause) {
      if (accountRef.current === requestedAccountId)
        setTransferError(cause instanceof Error ? cause.message : "No fue posible responder la transferencia.");
    } finally { setTransferBusy(false); }
  };
  const [invitations, setInvitations] = useState<PersistedBusinessNotification[]>([]);
  const [invitationsAccount, setInvitationsAccount] = useState("");
  const [invitationChoice, setInvitationChoice] = useState<{ id: string; accept: boolean } | null>(null);
  const [invitationBusy, setInvitationBusy] = useState(false);
  const [invitationError, setInvitationError] = useState("");
  useEffect(() => {
    setInvitations([]);
    setInvitationsAccount("");
    setInvitationChoice(null);
    setInvitationError("");
    if (!accountId) return;
    let active = true;
    void businessApi.listAllBusinessInvitations().then(({ notifications }) => {
      if (active && accountRef.current === accountId) {
        setInvitations(notifications.filter(item =>
          item.type === "COLLABORATION_INVITATION" && item.membership?.status === "INVITED"));
        setInvitationsAccount(accountId);
      }
    }).catch(() => { if (active && accountRef.current === accountId)
      setInvitationError("No se pudieron consultar las invitaciones pendientes."); });
    return () => { active = false; };
  }, [accountId]);
  const respondInvitation = async (item: PersistedBusinessNotification, accept: boolean) => {
    if (!item.membershipId || invitationBusy || !accountId || invitationsAccount !== accountId) return;
    const requestedAccountId = accountId;
    setInvitationBusy(true); setInvitationError("");
    try {
      await businessApi.respondCollaboratorInvitation(item.membershipId, accept);
      const refreshed = (await businessApi.list()).businesses.map(toBusinessDetails);
      if (accountRef.current !== requestedAccountId) return;
      setBusinesses(refreshed);
      if (!business.id && refreshed[0]) setBusiness(refreshed[0]);
      setInvitations(current => current.filter(candidate => candidate.id !== item.id));
      setInvitationChoice(null);
    } catch (cause) {
      if (accountRef.current === requestedAccountId)
        setInvitationError(cause instanceof Error ? cause.message : "No se pudo responder la invitación.");
    } finally { setInvitationBusy(false); }
  };
  useEffect(() => {
    if (authState.status !== "authenticated") return;
    let active = true;
    setLoading(true);
    setError("");
    const load = async (retryAfterRefresh: boolean) => {
      try {
        const { businesses: values } = await businessApi.list();
        if (!active) return;
        const next = values.map(toBusinessDetails);
        setBusinesses(next);
        // Preserve the user's selected business; BusinessStore handles invalid selections.
      } catch (cause) {
        if (!active) return;
        if (retryAfterRefresh && cause instanceof BusinessApiError && cause.status === 401) {
          const refreshed = await refresh();
          if (refreshed.status === "authenticated") {
            await load(false);
            return;
          }
          return;
        }
        setError(cause instanceof BusinessApiError && cause.status === 0
          ? "No pudimos conectar con XAMUKO. Comprueba tu conexión e intenta nuevamente."
          : cause instanceof BusinessApiError
            ? cause.message
            : "No se pudieron cargar tus negocios.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load(true);
    return () => { active = false; };
  }, [authState.status, accountId, refresh, retryAttempt, setBusiness, setBusinesses]);
  const visibleInvitations = invitationsAccount === accountId && accountId ? invitations : [];
  const visibleTransfers = transfersAccount === accountId && accountId ? transfers : [];
  const selectBusiness = (item: BusinessDetails, index: number) => { setBusiness(item); navigate(`/mi-negocio/detalle/${index}`); };
  const listedBusinesses = businesses.map((item, index) => ({ item, index })).filter(({ item }) => item.deletionStatus !== "DELETED");
  return <><PageHeader eyebrow="" title="Mis negocios" description="Administra todos los negocios asociados a tu cuenta." />
    {visibleInvitations.length > 0 && <section className="business-invitations surface-card" aria-labelledby="business-invitations-title">
      <div className="card-heading"><div><h2 id="business-invitations-title">Invitaciones para colaborar</h2>
        <p>Estas solicitudes corresponden a tu cuenta y a negocios a los que todavía no perteneces. No se mezclan con las notificaciones del negocio seleccionado.</p></div>
        <span className="business-invitation-count">{visibleInvitations.length} pendiente{visibleInvitations.length === 1 ? "" : "s"}</span></div>
      {visibleInvitations.map(item => <article className="business-invitation-row" key={item.id}>
        <div className="business-invitation-information"><strong>{item.business.name}</strong>
          <span>{item.message}</span><small>Invitación recibida · {new Intl.DateTimeFormat("es-CO", { dateStyle: "medium" }).format(new Date(item.createdAt))}</small></div>
        <div className="business-invitation-buttons">
          {invitationChoice?.id === item.id ? <>
            <span>{invitationChoice.accept ? "¿Aceptar esta invitación?" : "¿Rechazar esta invitación?"}</span>
            <button type="button" className={invitationChoice.accept ? "action-button" : "danger-button"}
              disabled={invitationBusy} onClick={() => void respondInvitation(item, invitationChoice.accept)}>
              {invitationBusy ? "Procesando…" : "Confirmar"}</button>
            <button type="button" className="outline-button" disabled={invitationBusy} onClick={() => setInvitationChoice(null)}>Cancelar</button>
          </> : <>
            <button type="button" className="action-button" disabled={invitationBusy} onClick={() => setInvitationChoice({ id: item.id, accept: true })}>Aceptar</button>
            <button type="button" className="outline-button" disabled={invitationBusy} onClick={() => setInvitationChoice({ id: item.id, accept: false })}>Rechazar</button>
          </>}
        </div></article>)}
    </section>}
    {invitationError && <div className="form-error" role="alert">{invitationError}</div>}
    {visibleTransfers.length > 0 && <section className="business-invitations surface-card" aria-labelledby="business-transfers-title">
      <div className="card-heading"><div><h2 id="business-transfers-title">Transferencias de propiedad pendientes</h2>
        <p>Solicitudes dirigidas a tu cuenta. Al aceptar asumirás la propiedad del negocio; estas solicitudes no se mezclan con sus notificaciones.</p></div>
        <span className="business-invitation-count">{visibleTransfers.length} pendiente{visibleTransfers.length === 1 ? "" : "s"}</span></div>
      {visibleTransfers.map(item => <article className="business-invitation-row" key={item.id}>
        <div className="business-invitation-information"><strong>{item.business.name}</strong>
          <span>Solicitud de transferencia enviada por {item.fromUser.displayName}.</span>
          <small>Recibida el {new Intl.DateTimeFormat("es-CO", { dateStyle: "medium" }).format(new Date(item.requestedAt))}</small>
        </div>
        <div className="business-invitation-buttons">{transferChoice?.id === item.id ? <>
          <span>{transferChoice.accept ? "¿Confirmas que aceptarás la propiedad de este negocio?" : "¿Rechazar esta transferencia?"}</span>
          <button type="button" className={transferChoice.accept ? "action-button" : "danger-button"}
            disabled={transferBusy} onClick={() => void respondTransfer(item.id, transferChoice.accept)}>{transferBusy ? "Procesando…" : "Confirmar"}</button>
          <button type="button" className="outline-button" disabled={transferBusy} onClick={() => setTransferChoice(null)}>Cancelar</button>
        </> : <>
          <button type="button" className="action-button" disabled={transferBusy} onClick={() => setTransferChoice({ id: item.id, accept: true })}>Aceptar</button>
          <button type="button" className="outline-button" disabled={transferBusy} onClick={() => setTransferChoice({ id: item.id, accept: false })}>Rechazar</button>
        </>}</div></article>)}
    </section>}
    {transferError && <div className="form-error" role="alert">{transferError}</div>}
    <section className="business-list-surface surface-card"><div className="card-heading"><div><h2>Tus negocios</h2><p>Selecciona uno para consultar toda su información o crea uno nuevo.</p></div><button className="action-button" type="button" onClick={() => navigate("/mis-negocios/nuevo")}>＋ Crear negocio</button></div>{loading && <p className="auth-status">Cargando tus negocios…</p>}{error && <div className="form-error" role="alert"><p>{error}</p><button className="outline-button" type="button" onClick={() => setRetryAttempt(value => value + 1)}>Reintentar</button></div>}{!loading && !error && <div className="business-list">{listedBusinesses.map(({ item, index }) => { const cover = item.coverImage || item.images?.[0] || ""; const publicAddress = item.locationVisibility === "PUBLIC" && item.address.trim(); return <article className={`business-list-item${item === business ? " active" : ""}`} key={item.id ?? `${item.name}-${index}`}><button type="button" className="business-list-select" onClick={() => selectBusiness(item, index)}><span className="business-list-icon">{cover ? <PersistedPhoto src={cover} alt="" /> : item.name.charAt(0).toUpperCase()}</span><span className="business-list-copy"><strong>{item.name}</strong><PioneerBadge pioneerNumber={item.pioneerNumber} />{item.sede?.trim() && <small className="business-list-sede">Sede {item.sede.trim()}</small>}<small>{formatCategoryName(item.category)} · {item.city || "Ciudad no registrada"}</small>{publicAddress ? <small className="business-list-address">{item.address}</small> : <small className="business-list-address">{item.locationVisibility === "PUBLIC" ? "Ubicación pendiente" : "Atención sin dirección pública"}</small>}{/* status indicators intentionally remain unchanged */}<BusinessIndicatorRow business={item} /><em className="business-role-badge">{item.role}</em></span></button><div className="business-list-actions"><details className="business-list-menu"><summary>Opciones</summary><button className="business-duplicate-button" type="button" onClick={() => navigate(`/mis-negocios/nuevo?duplicar=${index}`)}>Duplicar negocio</button></details></div></article>; })}{listedBusinesses.length === 0 && <div className="business-empty-state"><h3>¡Comienza con tu primer negocio!</h3><p>Registra tu negocio en XAMUKO y empieza a conectar con personas que buscan tus productos o servicios.</p></div>}</div>}</section></>;
}
