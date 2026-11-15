import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useBusinessStore } from "../services/businessStore";
import { businessApi, type BusinessMembership, type ResolvedCollaboratorRecipient } from "../services/businessApiClient";
import { PersistedPhoto } from "../components/common/PersistedPhoto";
import "./CollaboratorsPage.css";

const permissions = [
  ["MANAGE_CATALOG", "Productos y servicios", "package"],
  ["MANAGE_PROMOTIONS", "Promociones", "megaphone"],
  ["READ_ANALYTICS", "Estadísticas", "chart"],
  ["EDIT_BUSINESS", "Información del negocio", "building"],
] as const;


type CollabIconName = "users" | "mail" | "check" | "pause" | "userPlus" | "package" | "megaphone" | "chart" | "building" | "book" | "send" | "search" | "pencil" | "x" | "clock" | "crown" | "user" | "shield";
function CollabIcon({ name }: { name: CollabIconName }) {
  const icons: Record<CollabIconName, ReactNode> = {
    users: <><path d="M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 20v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></>,
    check: <><circle cx="12" cy="12" r="9"/><path d="m8 12 2.7 2.7L16 9.5"/></>,
    pause: <><circle cx="12" cy="12" r="9"/><path d="M10 8v8M14 8v8"/></>,
    userPlus: <><path d="M15.5 20v-1.7A4.3 4.3 0 0 0 11.2 14H6.8a4.3 4.3 0 0 0-4.3 4.3V20"/><circle cx="9" cy="7" r="4"/><path d="M19 8v8m-4-4h8"/></>,
    package: <><path d="m12 2 9 5-9 5-9-5 9-5ZM3 7v10l9 5 9-5V7M12 12v10"/></>,
    megaphone: <><path d="M3 11v3a2 2 0 0 0 2 2h2l2 5h3l-2-5 10-5V6L10 11H5a2 2 0 0 0-2 2M20 9v4"/></>,
    chart: <><path d="M4 20h16"/><rect x="5" y="12" width="3" height="7" rx=".5"/><rect x="11" y="8" width="3" height="11" rx=".5"/><rect x="17" y="4" width="3" height="15" rx=".5"/></>,
    building: <><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 7h1m4 0h1M9 11h1m4 0h1M9 15h1m4 0h1M10 21v-4h4v4"/></>,
    book: <><path d="M4 4.5C7 3.3 9.4 4 12 5.8c2.6-1.8 5-2.5 8-1.3v14c-3-1.2-5.4-.5-8 1.3-2.6-1.8-5-2.5-8-1.3v-14ZM12 5.8v14"/></>,
    send: <><path d="m22 2-8.3 20-3.5-8.2L2 10.3 22 2ZM22 2 10.2 13.8"/></>,
    search: <><circle cx="10.7" cy="10.7" r="6.7"/><path d="m15.7 15.7 5.3 5.3"/></>,
    pencil: <><path d="m15 4 5 5-11 11-5.5.5L4 15 15 4ZM12 7l5 5"/></>,
    x: <><path d="M6 6l12 12M18 6 6 18"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></>,
    crown: <><path d="m3 8 5 4 4-7 4 7 5-4-2 11H5L3 8ZM5 19h14"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></>,
    shield: <><path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3ZM9 12l2 2 4-4"/></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{icons[name]}</svg>;
}

const permissionLabels: Record<string, string> = Object.fromEntries(permissions.map(([code, label]) => [code, label]));
const formatDate = (value: string | null | undefined) => value
  ? new Intl.DateTimeFormat("es-CO", { dateStyle: "short", timeStyle: "short" }).format(new Date(value))
  : "—";
const normalizedNickname = (value: string) => {
  const trimmed = value.trim().toLocaleLowerCase("en-US");
  return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
};

export function CollaboratorsPage() {
  const { business } = useBusinessStore();
  const [rows, setRows] = useState<BusinessMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [recipient, setRecipient] = useState<ResolvedCollaboratorRecipient | null>(null);
  const [recipientError, setRecipientError] = useState("");
  const [editing, setEditing] = useState<BusinessMembership | null>(null);
  const editOverlayRef = useRef<HTMLDivElement>(null);
  const isOwner = business.role === "Propietario";

  // Align the Editar permisos dialog with the *visual* viewport, not the
  // document behind the sticky Business header on iOS/iPadOS.
  useLayoutEffect(() => {
    if (!editing) return;
    const overlay = editOverlayRef.current;
    if (!overlay) return;
    const viewport = window.visualViewport;
    const priorOverflow = document.body.style.overflow;
    const syncViewport = () => {
      overlay.style.setProperty("--collab-viewport-top", `${viewport?.offsetTop ?? 0}px`);
      overlay.style.setProperty("--collab-viewport-left", `${viewport?.offsetLeft ?? 0}px`);
      overlay.style.setProperty("--collab-viewport-width", `${viewport?.width ?? window.innerWidth}px`);
      overlay.style.setProperty("--collab-viewport-height", `${viewport?.height ?? window.innerHeight}px`);
    };
    document.body.classList.add("collab-dialog-active");
    document.body.style.overflow = "hidden";
    syncViewport();
    window.addEventListener("resize", syncViewport);
    viewport?.addEventListener("resize", syncViewport);
    viewport?.addEventListener("scroll", syncViewport);
    overlay.querySelector<HTMLButtonElement>(".collab-modal-close")?.focus({ preventScroll: true });
    return () => {
      window.removeEventListener("resize", syncViewport);
      viewport?.removeEventListener("resize", syncViewport);
      viewport?.removeEventListener("scroll", syncViewport);
      document.body.style.overflow = priorOverflow;
      document.body.classList.remove("collab-dialog-active");
    };
  }, [Boolean(editing)]);
  useEffect(() => {
    if (!editing || busy) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setEditing(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [Boolean(editing), busy]);


  const load = useCallback(async () => {
    if (!business.id || business.source !== "real") { setRows([]); setLoading(false); return; }
    setLoading(true); setError("");
    try { setRows((await businessApi.listCollaborators(business.id)).memberships); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudieron cargar los colaboradores."); }
    finally { setLoading(false); }
  }, [business.id, business.source]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    setRecipient(null); setRecipientError("");
    if (!business.id || business.source !== "real" || !isOwner || !/^@?[a-zA-Z0-9._-]{3,30}$/.test(identifier.trim())) {
      setResolving(false); return;
    }
    let active = true;
    const timer = window.setTimeout(() => {
      setResolving(true);
      void businessApi.resolveCollaboratorRecipient(business.id!, normalizedNickname(identifier))
        .then(({ recipient: value }) => { if (active) setRecipient(value); })
        .catch(cause => { if (active) setRecipientError(cause instanceof Error ? cause.message : "No se encontró ese nickname."); })
        .finally(() => { if (active) setResolving(false); });
    }, 350);
    return () => { active = false; window.clearTimeout(timer); };
  }, [business.id, business.source, identifier, isOwner]);

  const owner = rows.find(item => item.role === "OWNER");
  const active = rows.filter(item => item.role === "COLLABORATOR" && item.status === "ACTIVE");
  const invited = rows.filter(item => item.status === "INVITED");
  const expired = rows.filter(item => item.status === "EXPIRED");
  const suspended = rows.filter(item => item.status === "SUSPENDED");
  const peopleWithAccess = [owner, ...active, ...suspended].filter(Boolean).length;
  const visible = rows.filter(item => ["ACTIVE", "SUSPENDED"].includes(item.status)
    && `${item.user.displayName} ${item.user.emailNormalized ?? ""} ${item.user.nickname ?? ""}`.toLocaleLowerCase("es-CO").includes(query.toLocaleLowerCase("es-CO")));
  const invitationRows = [...invited, ...expired];

  const act = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true); setError(""); setNotice("");
    try { await action(); setNotice(success); await load(); return true; }
    catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo completar la acción."); return false; }
    finally { setBusy(false); }
  };

  const invite = async (event: FormEvent) => {
    event.preventDefault();
    if (!business.id || !recipient) { setError(recipientError || "Confirma primero un nickname válido."); return; }
    if (!selected.length) { setError("Selecciona al menos un permiso."); return; }
    const sent = await act(() => businessApi.inviteCollaborator(business.id!, recipient.nickname, selected), "Invitación enviada.");
    if (sent) { setIdentifier(""); setSelected([]); setRecipient(null); }
  };
  const toggle = (permission: string) => setSelected(current => current.includes(permission) ? current.filter(item => item !== permission) : [...current, permission]);
  const permissionText = (membership: BusinessMembership) => membership.role === "OWNER"
    ? "Todos los permisos"
    : membership.permissions.filter(item => item.allowed).map(item => permissionLabels[item.permission] ?? item.permission).join(", ") || "Sin permisos";

  return <main className="collab-page">
    <header className="collab-heading"><div className="collab-heading-copy"><span className="collab-eyebrow">GESTIÓN DE ACCESOS</span><div className="collab-heading-main"><span className="collab-heading-icon"><CollabIcon name="users" /></span><div><h1>Colaboradores</h1><p>Administra las personas con acceso a este establecimiento.</p><small>{business.name}</small></div></div></div><button type="button" className="collab-guide" onClick={() => setNotice("El propietario invita mediante el nickname único de XAMUKO y asigna permisos individuales.")}><CollabIcon name="book" /><span>Guía de colaboradores</span></button></header>
    {error && <div className="collab-alert error" role="alert">{error}</div>}{notice && <div className="collab-alert" role="status">{notice}</div>}
    <section className="collab-stats" aria-label="Resumen de colaboradores"><article><span className="collab-stat-icon violet"><CollabIcon name="users" /></span><div><b>{peopleWithAccess}</b><strong>Personas con acceso</strong><small>{owner ? "1 propietario" : ""}{active.length ? ` · ${active.length} colaboradores` : ""}</small></div></article><article><span className="collab-stat-icon pink"><CollabIcon name="mail" /></span><div><b>{invited.length}</b><strong>Invitación pendiente</strong><small>{invited[0]?.expiresAt ? `Expira ${formatDate(invited[0].expiresAt)}` : "Invitaciones enviadas"}</small></div></article><article><span className="collab-stat-icon blue"><CollabIcon name="check" /></span><div><b>{active.length}</b><strong>Colaboradores activos</strong><small>Con acceso al negocio</small></div></article><article><span className="collab-stat-icon orange"><CollabIcon name="pause" /></span><div><b>{suspended.length}</b><strong>Suspendidos</strong><small>Sin acceso temporal</small></div></article></section>
    <form className="collab-invite" onSubmit={invite}>
      <div className="collab-invite-title"><span className="collab-invite-icon"><CollabIcon name="userPlus" /></span><div><h2>Invitar colaborador</h2><p>Escribe su nickname único y define los permisos de acceso.</p></div></div>
      <div className="collab-invite-controls"><label className="collab-nickname-field"><span>Nickname único</span><input aria-label="Nickname único" placeholder="Ej. @laura.gomez" pattern="@?[a-zA-Z0-9._-]{3,30}" value={identifier} onChange={event => setIdentifier(event.target.value)} required disabled={busy || !isOwner}/></label><button disabled={busy || !isOwner || resolving || !recipient || selected.length === 0}><CollabIcon name="send" />{busy ? "Enviando…" : "Enviar invitación"}</button></div>
      <div className={`collab-recipient ${recipient ? "resolved" : ""}`} aria-live="polite">{resolving ? <span>Buscando cuenta XAMUKO…</span> : recipient ? <><span className="collab-recipient-avatar">{recipient.avatarUrl ? <img src={recipient.avatarUrl} alt=""/> : recipient.displayName.slice(0, 1).toUpperCase()}</span><span><b>{recipient.displayName}</b><small>{recipient.nickname}</small></span><strong>Cuenta confirmada</strong></> : recipientError ? <span className="collab-recipient-error">{recipientError}</span> : identifier.trim() ? <span>Escribe un nickname completo para identificar la cuenta.</span> : null}</div>
      <div className="collab-permissions"><b>Permisos:</b>{permissions.map(([code, name, icon]) => <button key={code} type="button" aria-pressed={selected.includes(code)} onClick={() => toggle(code)} className={selected.includes(code) ? "selected" : ""} disabled={!isOwner || busy}><span className="collab-permission-icon"><CollabIcon name={icon} /></span>{selected.includes(code) && <span className="collab-permission-check"><CollabIcon name="check" /></span>}{name}</button>)}</div>
    </form>
    <section className="collab-table-card"><div className="collab-table-heading"><h2>Personas con acceso ({peopleWithAccess})</h2><label className="collab-search"><CollabIcon name="search" /><span className="sr-only">Buscar personas con acceso</span><input aria-label="Buscar personas con acceso" placeholder="Buscar por nombre, correo o nickname…" value={query} onChange={event => setQuery(event.target.value)}/></label></div>{loading ? <p className="collab-empty">Cargando colaboradores…</p> : <div className="collab-scroll"><table><thead><tr><th>Persona</th><th>Rol</th><th>Permisos</th><th>Estado</th><th>Última actividad</th><th>Acciones</th></tr></thead><tbody>{visible.map(membership => <tr key={membership.id}><td data-label="Persona"><div className="collab-person">{membership.user.avatarUrl ? <PersistedPhoto src={membership.user.avatarUrl} alt="" className="collab-person-avatar"/> : <i>{membership.user.displayName.slice(0, 1).toUpperCase()}</i>}<span><b>{membership.user.displayName}</b><small>{membership.user.nickname || membership.user.emailNormalized || "Cuenta XAMUKO"}</small></span></div></td><td data-label="Rol"><em className={membership.role === "OWNER" ? "owner" : ""}>{membership.role === "OWNER" ? <><CollabIcon name="crown" /> Propietario</> : <><CollabIcon name="user" /> Colaborador</>}</em></td><td data-label="Permisos" className="collab-permtext">{permissionText(membership)}</td><td data-label="Estado"><em className={`state ${membership.status.toLowerCase()}`}>● {membership.status === "ACTIVE" ? "Activo" : "Suspendido"}</em></td><td data-label="Última actividad">{formatDate(membership.user.lastLoginAt)}</td><td data-label="Acciones">{membership.role === "OWNER" ? <button type="button" disabled>Propietario</button> : <div className="collab-actions"><button type="button" disabled={busy || !isOwner} onClick={() => setEditing(membership)}><CollabIcon name="pencil" />Editar</button><select aria-label="Acciones de colaborador" value="" disabled={busy || !isOwner} onChange={event => { const action = event.target.value; if (action === "s") void act(() => businessApi.suspendCollaborator(membership.id), "Colaborador suspendido."); if (action === "r") void act(() => businessApi.reactivateCollaborator(membership.id), "Acceso reactivado."); if (action === "x") void act(() => businessApi.revokeCollaborator(membership.id), "Acceso revocado."); }}><option value="">Acciones</option>{membership.status === "ACTIVE" ? <option value="s">Suspender</option> : <option value="r">Reactivar</option>}<option value="x">Revocar acceso</option></select></div>}</td></tr>)}</tbody></table>{!visible.length && <p className="collab-empty">No hay personas con acceso que coincidan con la búsqueda.</p>}</div>}</section>
    <section className="collab-table-card"><div className="collab-table-heading"><h2>Invitaciones ({invitationRows.length})</h2></div>{invitationRows.length ? <div className="collab-scroll"><table><thead><tr><th>Persona</th><th>Enviada el</th><th>Expira el</th><th>Permisos</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{invitationRows.map(membership => <tr key={membership.id}><td data-label="Persona"><div className="collab-person"><i>{membership.user.displayName.slice(0, 1).toUpperCase()}</i><span><b>{membership.user.displayName}</b><small>{membership.user.nickname || membership.user.emailNormalized}</small></span></div></td><td data-label="Enviada el">{formatDate(membership.invitedAt)}</td><td data-label="Expira el">{formatDate(membership.expiresAt)}</td><td data-label="Permisos">{permissionText(membership)}</td><td data-label="Estado"><em className={`state ${membership.status.toLowerCase()}`}>{membership.status === "EXPIRED" ? "Vencida" : <><CollabIcon name="clock" /> Pendiente</>}</em></td><td data-label="Acciones">{membership.status === "INVITED" ? <button type="button" disabled={busy || !isOwner} className="cancel" onClick={() => void act(() => businessApi.cancelCollaboratorInvitation(membership.id), "Invitación cancelada.")}><CollabIcon name="x" />Cancelar</button> : <span>Sin acciones</span>}</td></tr>)}</tbody></table></div> : <p className="collab-empty">No hay invitaciones.</p>}</section>
    {editing && createPortal(<div ref={editOverlayRef} className="collab-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !busy) setEditing(null); }}><section className="collab-modal" role="dialog" aria-modal="true" aria-labelledby="collab-edit-title" aria-describedby="collab-edit-description" aria-busy={busy}>
      <header className="collab-modal-header"><span className="collab-modal-heading-icon"><CollabIcon name="shield" /></span><div><span className="collab-modal-eyebrow">GESTIÓN DE ACCESOS</span><h2 id="collab-edit-title">Editar permisos</h2><p id="collab-edit-description">Define los permisos de {editing.user.displayName}.</p></div><button type="button" className="collab-modal-close" aria-label="Cerrar formulario" disabled={busy} onClick={() => setEditing(null)}><CollabIcon name="x" /></button></header>
      <div className="collab-modal-content"><p className="collab-modal-intro">Selecciona los permisos que podrá utilizar este colaborador en XAMUKO Business.</p><div className="collab-modal-permission-list">{permissions.map(([code, name, icon]) => <label key={code} className="collab-modal-permission"><span className="collab-modal-permission-icon"><CollabIcon name={icon} /></span><span>{name}</span><input type="checkbox" disabled={busy} checked={editing.permissions.some(item => item.permission === code && item.allowed)} onChange={event => setEditing({ ...editing, permissions: [...editing.permissions.filter(item => item.permission !== code), ...(event.target.checked ? [{ permission: code, allowed: true }] : [])] })}/></label>)}</div></div>
      <footer className="collab-modal-actions"><button type="button" className="outline-button" disabled={busy} onClick={() => setEditing(null)}>Cancelar</button><button type="button" className="action-button" disabled={busy || !editing.permissions.some(item => item.allowed)} onClick={() => void act(() => businessApi.updateCollaboratorPermissions(editing.id, editing.permissions.filter(item => item.allowed).map(item => item.permission)), "Permisos actualizados.").then(saved => { if (saved) setEditing(null); })}><CollabIcon name="check" />{busy ? "Guardando…" : "Guardar cambios"}</button></footer>
    </section></div>, document.body)}
  </main>;
}
