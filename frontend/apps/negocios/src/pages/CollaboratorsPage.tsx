import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useBusinessStore } from "../services/businessStore";
import { businessApi, type BusinessMembership, type ResolvedCollaboratorRecipient } from "../services/businessApiClient";
import { PersistedPhoto } from "../components/common/PersistedPhoto";
import "./CollaboratorsPage.css";

const permissions = [
  ["MANAGE_CATALOG", "Productos y servicios", "⬡"],
  ["MANAGE_PROMOTIONS", "Promociones", "◇"],
  ["READ_ANALYTICS", "Estadísticas", "▥"],
  ["EDIT_BUSINESS", "Información del negocio", "▣"],
] as const;

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
  const isOwner = business.role === "Propietario";

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
    <header className="collab-heading"><div className="collab-heading-icon">♧</div><div><h1>Colaboradores</h1><p>Administra las personas con acceso a este establecimiento.</p><small>{business.name}</small></div><button type="button" className="collab-guide" onClick={() => setNotice("El propietario invita mediante el nickname único de XAMUKO y asigna permisos individuales.")}>▣ <span>Guía de colaboradores</span></button></header>
    {error && <div className="collab-alert error" role="alert">{error}</div>}{notice && <div className="collab-alert" role="status">{notice}</div>}
    <section className="collab-stats"><article><i>♙</i><div><b>{peopleWithAccess}</b><strong>Personas con acceso</strong><small>{owner ? "1 propietario" : ""}{active.length ? ` · ${active.length} colaboradores` : ""}</small></div></article><article><i className="pink">✉</i><div><b>{invited.length}</b><strong>Invitación pendiente</strong><small>{invited[0]?.expiresAt ? `Expira ${formatDate(invited[0].expiresAt)}` : "Invitaciones enviadas"}</small></div></article><article><i className="green">✓</i><div><b>{active.length}</b><strong>Colaboradores activos</strong><small>Con acceso al negocio</small></div></article><article><i className="orange">♙</i><div><b>{suspended.length}</b><strong>Suspendidos</strong><small>Sin acceso temporal</small></div></article></section>
    <form className="collab-invite" onSubmit={invite}>
      <div className="collab-invite-title"><i>♙+</i><div><h2>Invitar colaborador</h2><p>Escribe su nickname único y define los permisos de acceso.</p></div></div>
      <div className="collab-invite-controls"><label className="collab-nickname-field"><span>Nickname único</span><input aria-label="Nickname único" placeholder="Ej. @laura.gomez" pattern="@?[a-zA-Z0-9._-]{3,30}" value={identifier} onChange={event => setIdentifier(event.target.value)} required disabled={busy || !isOwner}/></label><button disabled={busy || !isOwner || resolving || !recipient || selected.length === 0}>{busy ? "Enviando…" : "➤  Enviar invitación"}</button></div>
      <div className={`collab-recipient ${recipient ? "resolved" : ""}`} aria-live="polite">{resolving ? <span>Buscando cuenta XAMUKO…</span> : recipient ? <><span className="collab-recipient-avatar">{recipient.avatarUrl ? <img src={recipient.avatarUrl} alt=""/> : recipient.displayName.slice(0, 1).toUpperCase()}</span><span><b>{recipient.displayName}</b><small>{recipient.nickname}</small></span><strong>Cuenta confirmada</strong></> : recipientError ? <span className="collab-recipient-error">{recipientError}</span> : identifier.trim() ? <span>Escribe un nickname completo para identificar la cuenta.</span> : null}</div>
      <div className="collab-permissions"><b>Permisos:</b>{permissions.map(([code, name, icon]) => <button key={code} type="button" aria-pressed={selected.includes(code)} onClick={() => toggle(code)} className={selected.includes(code) ? "selected" : ""} disabled={!isOwner || busy}><i>{icon}</i>{selected.includes(code) ? "✓ " : ""}{name}</button>)}</div>
    </form>
    <section className="collab-table-card"><div className="collab-table-heading"><h2>Personas con acceso ({peopleWithAccess})</h2><input placeholder="Buscar por nombre, correo o nickname…" value={query} onChange={event => setQuery(event.target.value)}/></div>{loading ? <p className="collab-empty">Cargando colaboradores…</p> : <div className="collab-scroll"><table><thead><tr><th>Persona</th><th>Rol</th><th>Permisos</th><th>Estado</th><th>Última actividad</th><th>Acciones</th></tr></thead><tbody>{visible.map(membership => <tr key={membership.id}><td><div className="collab-person">{membership.user.avatarUrl ? <PersistedPhoto src={membership.user.avatarUrl} alt="" className="collab-person-avatar"/> : <i>{membership.user.displayName.slice(0, 1).toUpperCase()}</i>}<span><b>{membership.user.displayName}</b><small>{membership.user.nickname || membership.user.emailNormalized || "Cuenta XAMUKO"}</small></span></div></td><td><em className={membership.role === "OWNER" ? "owner" : ""}>{membership.role === "OWNER" ? "♛ Propietario" : "♧ Colaborador"}</em></td><td className="collab-permtext">{permissionText(membership)}</td><td><em className={`state ${membership.status.toLowerCase()}`}>● {membership.status === "ACTIVE" ? "Activo" : "Suspendido"}</em></td><td>{formatDate(membership.user.lastLoginAt)}</td><td>{membership.role === "OWNER" ? <button disabled>Propietario</button> : <div className="collab-actions"><button onClick={() => setEditing(membership)}>Editar</button><select aria-label="Acciones" value="" onChange={event => { const action = event.target.value; if (action === "s") void act(() => businessApi.suspendCollaborator(membership.id), "Colaborador suspendido."); if (action === "r") void act(() => businessApi.reactivateCollaborator(membership.id), "Acceso reactivado."); if (action === "x") void act(() => businessApi.revokeCollaborator(membership.id), "Acceso revocado."); }}><option value="">•••</option>{membership.status === "ACTIVE" ? <option value="s">Suspender</option> : <option value="r">Reactivar</option>}<option value="x">Revocar acceso</option></select></div>}</td></tr>)}</tbody></table>{!visible.length && <p className="collab-empty">No hay personas con acceso que coincidan con la búsqueda.</p>}</div>}</section>
    <section className="collab-table-card"><div className="collab-table-heading"><h2>Invitaciones ({invitationRows.length})</h2></div>{invitationRows.length ? <div className="collab-scroll"><table><thead><tr><th>Persona</th><th>Enviada el</th><th>Expira el</th><th>Permisos</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{invitationRows.map(membership => <tr key={membership.id}><td><div className="collab-person"><i>{membership.user.displayName.slice(0, 1).toUpperCase()}</i><span><b>{membership.user.displayName}</b><small>{membership.user.nickname || membership.user.emailNormalized}</small></span></div></td><td>{formatDate(membership.invitedAt)}</td><td>{formatDate(membership.expiresAt)}</td><td>{permissionText(membership)}</td><td><em className={`state ${membership.status.toLowerCase()}`}>{membership.status === "EXPIRED" ? "Vencida" : "◷ Pendiente"}</em></td><td>{membership.status === "INVITED" ? <button className="cancel" onClick={() => void act(() => businessApi.cancelCollaboratorInvitation(membership.id), "Invitación cancelada.")}>▣ Cancelar</button> : <span>Sin acciones</span>}</td></tr>)}</tbody></table></div> : <p className="collab-empty">No hay invitaciones.</p>}</section>
    {editing && <div className="collab-modal-backdrop" onClick={() => setEditing(null)}><section className="collab-modal" onClick={event => event.stopPropagation()}><h2>Editar permisos</h2><p>{editing.user.displayName}</p>{permissions.map(([code, name]) => <label key={code}><input type="checkbox" checked={editing.permissions.some(item => item.permission === code && item.allowed)} onChange={event => setEditing({ ...editing, permissions: [...editing.permissions.filter(item => item.permission !== code), ...(event.target.checked ? [{ permission: code, allowed: true }] : [])] })}/>{name}</label>)}<footer><button onClick={() => setEditing(null)}>Cancelar</button><button disabled={busy || !editing.permissions.some(item => item.allowed)} onClick={() => void act(() => businessApi.updateCollaboratorPermissions(editing.id, editing.permissions.filter(item => item.allowed).map(item => item.permission)), "Permisos actualizados.").then(saved => { if (saved) setEditing(null); })}>Guardar</button></footer></section></div>}
  </main>;
}
