import { useState } from 'react';
import { getAdminPlusUser, setAdminPlusUser, type AdminPlusUser } from '../services/adminApiClient';
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
  const canManage = getSession()?.role === 'SUPER_ADMIN';
  async function lookup() {
    setError(''); setNotice(''); setMember(null);
    if (!userIdPattern.test(userId)) { setError('Ingresa un ID de usuario válido.'); return; }
    setBusy(true);
    try {
      setMember(await getAdminPlusUser(userId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible consultar al usuario.');
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
      <p>Consulta un usuario y concede o revoca el acceso manualmente para pruebas autorizadas, sin generar cobros. Cada cambio deja auditoría administrativa.</p>
    </div>
    <div className="admin-plus-member-search">
      <label>ID del usuario<input value={userId} onChange={event => setUserId(event.target.value)} placeholder="UUID del usuario" spellCheck={false} autoComplete="off"/></label>
      <button type="button" onClick={() => void lookup()} disabled={!canManage || busy || !userId.trim()}>
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
