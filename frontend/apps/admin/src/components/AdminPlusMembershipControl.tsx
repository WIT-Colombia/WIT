import { useEffect, useState } from 'react';
import { getAdminPlusUser, setAdminPlusUser, getAdminPlusPurchaseRequests, closeAdminPlusPurchaseRequest, type AdminPlusUser, type AdminPlusPurchaseRequest } from '../services/adminApiClient';
import { getSession } from '../services/adminService';
import './AdminPlusMembershipControl.css';

const userIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function AdminPlusMembershipControl() {
  const [userId, setUserId] = useState('');
  const [member, setMember] = useState<AdminPlusUser | null>(null);
  const [expiry, setExpiry] = useState('');
  const [reason, setReason] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [requests, setRequests] = useState<AdminPlusPurchaseRequest[]>([]);
  const [requestsError, setRequestsError] = useState('');
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [closingRequestId, setClosingRequestId] = useState<string | null>(null);
  const [closeReason, setCloseReason] = useState('');
  const [closeConfirmed, setCloseConfirmed] = useState(false);
  const canManage = getSession()?.role === 'SUPER_ADMIN';
  async function lookup(targetId = userId) {
    setError(''); setNotice(''); setMember(null);
    if (!userIdPattern.test(targetId)) { setError('Ingresa un ID de usuario válido.'); return; }
    setBusy(true);
    try {
      setMember(await getAdminPlusUser(targetId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible consultar al usuario.');
    } finally { setBusy(false); }
  }
  async function loadRequests() {
    if (!canManage) return;
    setRequestsLoading(true); setRequestsError('');
    try { setRequests((await getAdminPlusPurchaseRequests()).requests); }
    catch (cause) { setRequestsError(cause instanceof Error ? cause.message : 'No pudimos consultar las solicitudes.'); }
    finally { setRequestsLoading(false); }
  }
  useEffect(() => {
    let active = true;
    if (!canManage) return;
    void getAdminPlusPurchaseRequests().then(data => { if (active) setRequests(data.requests); })
      .catch(cause => { if (active) setRequestsError(cause instanceof Error ? cause.message : 'No pudimos consultar solicitudes Plus.'); });
    return () => { active = false; };
  }, [canManage]);

  async function closeRequest() {
    if (!closingRequestId || closeReason.trim().length < 12 || !closeConfirmed) return;
    setBusy(true); setRequestsError('');
    try {
      await closeAdminPlusPurchaseRequest(closingRequestId, closeReason.trim());
      setClosingRequestId(null); setCloseConfirmed(false); setCloseReason('');
      await loadRequests();
      setNotice('Solicitud cerrada y registrada en la auditoría. Cerrar una solicitud no concede ni revoca Plus.');
    } catch (cause) {
      setRequestsError(cause instanceof Error ? cause.message : 'No pudimos cerrar la solicitud.');
    } finally { setBusy(false); }
  }

  async function save(enabled: boolean) {
    if (!member || !canManage || busy || reason.trim().length < 12 || confirmation !== 'CONFIRMAR') return;
    setBusy(true); setError(''); setNotice('');
    try {
      const expiresAt = enabled ? new Date(expiry).toISOString() : undefined;
      await setAdminPlusUser(member.user.id, enabled, expiresAt, reason.trim(), 'CONFIRMAR');
      setMember(await getAdminPlusUser(member.user.id));
      setReason(''); setConfirmation('');
      setNotice(enabled ? 'Membresía Plus habilitada para el usuario.' : 'Membresía Plus revocada. Sus datos se conservan.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible actualizar la membresía.');
    } finally { setBusy(false); }
  }
  const active = member?.subscription?.status === 'ACTIVE' && !member.subscription.revokedAt
    && new Date(member.subscription.expiresAt).getTime() > Date.now();
  return <section className="admin-plus-member" aria-labelledby="admin-plus-membership-title">
    <div className="admin-plus-member-head">
      <h2 id="admin-plus-membership-title">Suscripciones individuales de Xamuko Plus</h2>
      <p>Administra solicitudes de adquisición y suscripciones individuales. Una solicitud no equivale a un pago: verifica el cobro antes de activar una membresía. Todas las actuaciones administrativas quedan auditadas.</p>
    </div>
    {canManage && <div className="admin-plus-member-requests" aria-label="Solicitudes pendientes de Xamuko Plus">
      <div className="admin-plus-member-requests-header">
        <div><h3>Solicitudes de Xamuko Plus</h3><p>Precio registrado: $4.900 COP/mes · no implica pago realizado.</p></div>
        <button type="button" className="admin-plus-request-refresh" disabled={requestsLoading} onClick={() => void loadRequests()}>
          {requestsLoading ? 'Actualizando…' : 'Actualizar solicitudes'}
        </button>
      </div>
      {requestsError && <p className="admin-plus-member-error" role="alert">{requestsError}</p>}
      {requests.length ? <div className="admin-plus-request-list">{requests.map(request => <article key={request.id}>
        <div className="admin-plus-request-identity">
          <strong>{request.user.displayName}</strong>
          <small>{request.user.emailNormalized || request.userId}</small>
          <span>Solicitud: {new Date(request.createdAt).toLocaleString('es-CO')} · {request.amountCop.toLocaleString('es-CO')} COP por mes</span>
        </div>
        <div className="admin-plus-request-actions">
          <button type="button" disabled={busy} onClick={() => { setUserId(request.userId); void lookup(request.userId); }}>
            Gestionar membresía
          </button>
          <button type="button" className="is-secondary" disabled={busy}
            onClick={() => { setClosingRequestId(request.id); setCloseReason(''); setCloseConfirmed(false); }}>Cerrar solicitud</button>
        </div>
        {closingRequestId === request.id && <div className="admin-plus-request-confirm">
          <p>El cierre es administrativo y no certifica que el usuario haya pagado.</p>
          <label>Motivo del cierre<textarea rows={2} maxLength={500} value={closeReason}
            onChange={event => setCloseReason(event.target.value)} placeholder="Indica por qué se cierra esta solicitud" /></label>
          <label className="admin-plus-request-check"><input type="checkbox" checked={closeConfirmed}
            onChange={event => setCloseConfirmed(event.target.checked)}/>Confirmo que he revisado esta solicitud.</label>
          <div><button type="button" disabled={busy || closeReason.trim().length < 12 || !closeConfirmed}
            onClick={() => void closeRequest()}>Confirmar cierre</button>
            <button type="button" className="is-secondary" onClick={() => setClosingRequestId(null)}>Cancelar</button></div>
        </div>}
      </article>)}</div>
        : !requestsLoading && !requestsError ? <p className="admin-plus-requests-empty">No hay solicitudes pendientes de Xamuko Plus.</p> : null}
    </div>}
    <div className="admin-plus-member-search">
      <label>ID del usuario<input value={userId} onChange={event => setUserId(event.target.value)} placeholder="UUID del usuario" spellCheck={false} autoComplete="off"/></label>
      <button type="button" onClick={() => void lookup(userId)} disabled={!canManage || busy || !userId.trim()}>
        {busy ? 'Consultando…' : 'Consultar usuario'}
      </button>
    </div>
    {!canManage && <p>Solo el superadministrador puede consultar y modificar las membresías.</p>}
    {member && <div className="admin-plus-member-details">
      <div><strong>{member.user.displayName}</strong><small>{member.user.emailNormalized ?? member.user.id}</small>
        <span>{active ? 'Plus vigente' : 'Sin Plus vigente'} · {member.subscription ? 'Vence: ' + new Date(member.subscription.expiresAt).toLocaleDateString('es-CO') : 'Sin suscripción registrada'}</span></div>
      <label>Vigencia de la nueva activación<input type="datetime-local" value={expiry} onChange={event => setExpiry(event.target.value)}/></label>
      <label>Motivo obligatorio (mínimo 12 caracteres)<textarea rows={3} maxLength={500} value={reason} onChange={event => setReason(event.target.value)} placeholder="Justificación administrativa"/></label>
      <label>Confirmación de seguridad<input value={confirmation} onChange={event => setConfirmation(event.target.value)} placeholder="Escribe CONFIRMAR" autoComplete="off"/></label>
      <div className="admin-plus-member-actions">
        <button type="button" disabled={busy || !expiry || !reason.trim() || reason.trim().length < 12 || confirmation !== 'CONFIRMAR'} onClick={() => void save(true)}>Habilitar Plus para usuario</button>
        <button className="is-danger" type="button" disabled={busy || !member.subscription || reason.trim().length < 12 || confirmation !== 'CONFIRMAR'} onClick={() => void save(false)}>Revocar Plus</button>
      </div>
      <p>Activar el interruptor maestro no asigna suscripciones automáticamente. Si el interruptor está apagado, el usuario no recibe beneficios aunque tenga una membresía vigente.</p>
    </div>}
    {notice && <p className="admin-plus-member-success" role="status">{notice}</p>}
    {error && <p className="admin-plus-member-error" role="alert">{error}</p>}
  </section>;
}
