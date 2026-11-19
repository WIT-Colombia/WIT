import { AdminPageHeading } from '../components/AdminPageHeading';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  assignAdministratorRole, changeAdministratorPermission, listAdministrators, revokeAdministratorRole,
  type AdministratorRecord, type ManagedAdminPermission,
} from '../services/adminApiClient';
import { getSession } from '../services/adminService';
import { StatePanel } from '../components/common';
import { AdminDialog } from '../components/AdminDialog';
import { Icon } from '../components/Icon';

const permissionLabels: Array<{ value: ManagedAdminPermission; label: string; detail: string }> = [
  { value: 'BUSINESSES_READ', label: 'Negocios', detail: 'Consulta administrativa de negocios' },
  { value: 'CATALOG_READ', label: 'Catálogo', detail: 'Consulta de productos y servicios' },
  { value: 'REPORTS_REVIEW', label: 'Reportes', detail: 'Revisión de reportes y opiniones' },
  { value: 'CONTENT_MODERATE', label: 'Moderación', detail: 'Acciones sobre contenido' },
  { value: 'AUDIT_READ', label: 'Auditoría', detail: 'Consulta del historial habilitado' },
  { value: 'ADMINS_MANAGE', label: 'Administradores', detail: 'Gestión de accesos y permisos' },
  { value: 'PIONEER_MANAGE', label: 'Pioneros', detail: 'Gestión del programa de pioneros' },
];
const permissionName = (value: string) => permissionLabels.find(item => item.value === value)?.label ?? value;
const activeRoles = (user: AdministratorRecord) => user.adminRoleAssignments.filter(role => role.active).map(role => role.role);
const grants = (user: AdministratorRecord) => user.adminPermissionGrants.filter(grant => grant.granted).map(grant => grant.permission);
const isActiveAccount = (user: AdministratorRecord) => user.status === 'ACTIVE' && activeRoles(user).length > 0;
type Change = 'ROLE_GRANT' | 'ROLE_REVOKE' | 'PERMISSION_GRANT' | 'PERMISSION_REVOKE';
const actionLabel: Record<Change, string> = {
  ROLE_GRANT: 'Asignar rol administrador',
  ROLE_REVOKE: 'Revocar rol administrador',
  PERMISSION_GRANT: 'Conceder permiso',
  PERMISSION_REVOKE: 'Revocar permiso',
};

export function AdministratorsPage() {
  const session = getSession();
  const allowed = session?.permissions?.includes('settings:write') ?? false;
  const mayManage = session?.role === 'SUPER_ADMIN' && allowed;
  const [records, setRecords] = useState<AdministratorRecord[] | null>(null);
  const [loading, setLoading] = useState(allowed);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'ENABLED' | 'INACTIVE' | 'PRIVILEGED'>('ALL');
  const [target, setTarget] = useState<AdministratorRecord | null>(null);
  const [operation, setOperation] = useState<Change>('PERMISSION_GRANT');
  const [permission, setPermission] = useState<ManagedAdminPermission>('BUSINESSES_READ');
  const [reason, setReason] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    if (!allowed) { setLoading(false); return; }
    let active = true; setLoading(true); setError('');
    void listAdministrators().then(result => { if (active) setRecords(result); })
      .catch(cause => { if (active) { setRecords(null); setError(cause instanceof Error ? cause.message : 'No fue posible cargar las cuentas.'); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [allowed, revision]);

  const filtered = useMemo(() => (records ?? []).filter(record => {
    const text = (record.displayName + ' ' + (record.emailNormalized ?? '')).toLocaleLowerCase('es-CO');
    if (!text.includes(search.trim().toLocaleLowerCase('es-CO'))) return false;
    if (filter === 'ENABLED') return isActiveAccount(record);
    if (filter === 'INACTIVE') return !isActiveAccount(record);
    if (filter === 'PRIVILEGED') return activeRoles(record).includes('SUPER_ADMIN');
    return true;
  }), [records, search, filter]);

  function manage(record: AdministratorRecord) {
    if (!mayManage || record.id === session?.id || activeRoles(record).includes('SUPER_ADMIN')) return;
    setTarget(record);
    setOperation(activeRoles(record).includes('ADMIN') ? 'PERMISSION_GRANT' : 'ROLE_GRANT');
    setPermission('BUSINESSES_READ');
    setReason('');
    setConfirmation('');
    setActionError('');
  }

  async function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!target || !mayManage || busy || target.id === session?.id || activeRoles(target).includes('SUPER_ADMIN')) return;
    if (reason.trim().length < 12 || ((operation === 'ROLE_REVOKE' || operation === 'PERMISSION_REVOKE') && confirmation !== 'CONFIRMAR')) return;
    const hasAdmin = activeRoles(target).includes('ADMIN');
    const hasPermission = grants(target).includes(permission);
    if ((operation === 'ROLE_GRANT' && hasAdmin) || (operation === 'ROLE_REVOKE' && !hasAdmin) ||
      (operation === 'PERMISSION_GRANT' && hasPermission) || (operation === 'PERMISSION_REVOKE' && !hasPermission)) {
      setActionError('Este acceso ya tiene ese estado. Actualiza el listado para verificarlo.'); return;
    }
    setBusy(true); setActionError('');
    try {
      if (operation === 'ROLE_GRANT') await assignAdministratorRole(target.id, 'ADMIN', reason.trim());
      else if (operation === 'ROLE_REVOKE') await revokeAdministratorRole(target.id, 'ADMIN', reason.trim());
      else await changeAdministratorPermission(target.id, permission, operation === 'PERMISSION_GRANT', reason.trim());
      setTarget(null);
      setNotice('El cambio fue confirmado por el servidor y se solicitó actualizar el registro.');
      setRevision(value => value + 1);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'No fue posible aplicar el cambio.');
    } finally { setBusy(false); }
  }

  if (!allowed) return <StatePanel kind="error" title="Acceso restringido" message="Necesitas el permiso de gestión administrativa para consultar estas cuentas." />;

  const enabled = records?.filter(isActiveAccount).length;
  const privileged = records?.filter(record => isActiveAccount(record) && activeRoles(record).includes('SUPER_ADMIN')).length;
  const withoutAccess = records?.filter(record => !isActiveAccount(record)).length;
  const disabled = (operation === 'ROLE_REVOKE' || operation === 'PERMISSION_REVOKE') && confirmation !== 'CONFIRMAR';
  return <section className="sec-workspace sec-administrators" aria-labelledby="sec-admin-title">
    <AdminPageHeading icon="users" id="sec-admin-title" title="Administradores y accesos"
      description="Cuentas administrativas, roles y permisos registrados. Los cambios requieren autorización y motivo auditable."
      actions={<button type="button" className="sec-button" disabled={loading || busy}
        onClick={() => setRevision(value => value + 1)}><Icon name="refresh" size={17}/> Actualizar</button>}/>
    <div className="sec-info" role="note"><Icon name="shield" size={19}/><p>La administración de roles y permisos está reservada al superadministrador. No se modifica el acceso propio ni el de otros superadministradores desde esta vista. Los permisos financieros y perfiles jurídicos especializados requieren una integración adicional.</p></div>
    {notice && <div className="sec-notice" role="status"><Icon name="check" size={18}/>{notice}<button type="button" aria-label="Cerrar aviso" onClick={() => setNotice('')}><Icon name="close" size={17}/></button></div>}
    <div className="sec-kpis" aria-label="Resumen de cuentas administrativas">
      <article><span className="sec-kpi-icon"><Icon name="users" size={21}/></span><small>Cuentas registradas</small><strong>{records ? records.length : '—'}</strong><p>Historial de asignaciones</p></article>
      <article><span className="sec-kpi-icon"><Icon name="shield" size={21}/></span><small>Con acceso activo</small><strong>{enabled ?? '—'}</strong><p>Cuenta activa y rol activo</p></article>
      <article><span className="sec-kpi-icon"><Icon name="lock" size={21}/></span><small>Superadministradores</small><strong>{privileged ?? '—'}</strong><p>Con rol vigente</p></article>
      <article><span className="sec-kpi-icon"><Icon name="clock" size={21}/></span><small>Sin acceso activo</small><strong>{withoutAccess ?? '—'}</strong><p>Sin rol vigente o cuenta inactiva</p></article>
    </div>
    <section className="sec-panel" aria-labelledby="sec-register-title">
      <div className="sec-panel-header"><div><h2 id="sec-register-title">Directorio de accesos</h2><p>Los roles y concesiones se consultan directamente desde la API administrativa.</p></div>{records && <span className="sec-count">{filtered.length} registros visibles</span>}</div>
      <div className="sec-toolbar">
        <label><span>Buscar cuenta</span><input type="search" value={search} onChange={event => setSearch(event.target.value)}
          placeholder="Nombre o correo electrónico" aria-label="Buscar por nombre o correo"/></label>
        <label><span>Estado de acceso</span><select value={filter} onChange={event => setFilter(event.target.value as typeof filter)}>
          <option value="ALL">Todos</option><option value="ENABLED">Acceso activo</option>
          <option value="INACTIVE">Sin acceso activo</option><option value="PRIVILEGED">Superadministradores</option>
        </select></label>
        {(search || filter !== 'ALL') && <button className="sec-button" type="button" onClick={() => { setSearch(''); setFilter('ALL'); }}>Limpiar filtros</button>}
      </div>
      {loading ? <div className="sec-state" role="status"><Icon name="refresh" size={22}/> Consultando cuentas autorizadas…</div>
        : error ? <div className="sec-state sec-state-error" role="alert"><strong>La consulta no está disponible</strong><p>{error}</p><button className="sec-button" onClick={() => setRevision(value => value + 1)}>Reintentar</button></div>
        : records?.length === 0 ? <div className="sec-state"><Icon name="users" size={24}/> No se recibieron cuentas administrativas.</div>
        : filtered.length === 0 ? <div className="sec-state">No se encontraron cuentas con los filtros actuales.</div>
        : <div className="sec-table-wrap"><table className="sec-table"><thead><tr><th>Cuenta</th><th>Acceso</th><th>Roles registrados</th><th>Permisos adicionales</th><th>Gestión</th></tr></thead>
          <tbody>{filtered.map(record => {
            const roles = activeRoles(record), extra = grants(record);
            const self = record.id === session?.id;
            const editable = mayManage && !self && !roles.includes('SUPER_ADMIN');
            return <tr key={record.id}><td><div className="sec-account"><strong>{record.displayName}</strong><small>{record.emailNormalized || 'Correo no disponible'}</small>{self && <span className="sec-self">Tu cuenta</span>}</div></td>
              <td><span className={'sec-status ' + (isActiveAccount(record) ? 'sec-status-on' : 'sec-status-off')}>{isActiveAccount(record) ? 'Activo' : 'Sin acceso'}</span><small className="sec-cell-note">Cuenta: {record.status}</small></td>
              <td><div className="sec-chips">{roles.length ? roles.map(role => <span className="sec-chip" key={role}>{role === 'SUPER_ADMIN' ? 'Superadministrador' : role === 'ADMIN' ? 'Administrador' : role}</span>) : <span className="sec-muted">Sin rol activo</span>}</div></td>
              <td><details className="sec-permissions"><summary>{extra.length} concesiones registradas</summary><div className="sec-chips">{extra.length ? extra.map(permission => <span className="sec-chip" key={permission}>{permissionName(permission)}</span>) : <span className="sec-muted">Sin permisos adicionales</span>}</div></details></td>
              <td>{editable ? <button type="button" className="sec-button sec-button-primary" onClick={() => manage(record)}><Icon name="settings" size={16}/> Administrar</button> : <span className="sec-muted">{self ? 'Protegido' : 'Solo consulta'}</span>}</td>
            </tr>;
          })}</tbody></table></div>}
    </section>
    <p className="sec-footnote"><Icon name="info" size={16}/> El listado muestra asignaciones y concesiones devueltas por el backend; no equivale a un inventario completo de sesiones, autenticadores o permisos financieros. Los cambios se registran en el historial de auditoría del servidor, cuya consulta global aún necesita integración.</p>
    {target && <AdminDialog title={actionLabel[operation]} contextLabel="XAMUKO · CONTROL DE ACCESOS" busy={busy}
      onClose={() => setTarget(null)}>
      <form className="sec-dialog-form" onSubmit={event => { void apply(event); }}>
        <div className="sec-target"><strong>{target.displayName}</strong><small>{target.emailNormalized || 'Sin correo registrado'}</small></div>
        <label><span>Operación</span><select value={operation} disabled={busy}
          onChange={event => { setOperation(event.target.value as Change); setConfirmation(''); setActionError(''); }}>
          {!activeRoles(target).includes('ADMIN') && <option value="ROLE_GRANT">Asignar rol ADMIN</option>}
          {activeRoles(target).includes('ADMIN') && <option value="ROLE_REVOKE">Revocar rol ADMIN</option>}
          <option value="PERMISSION_GRANT">Conceder permiso</option><option value="PERMISSION_REVOKE">Revocar permiso</option>
        </select></label>
        {(operation === 'PERMISSION_GRANT' || operation === 'PERMISSION_REVOKE') && <label><span>Permiso</span>
          <select value={permission} disabled={busy} onChange={event => setPermission(event.target.value as ManagedAdminPermission)}>
            {permissionLabels.filter(item => operation === 'PERMISSION_GRANT' ? !grants(target).includes(item.value) : grants(target).includes(item.value))
              .map(item => <option key={item.value} value={item.value}>{item.label} — {item.detail}</option>)}
          </select>
          <small>La asignación efectiva depende también del rol activo y de las validaciones del backend.</small></label>}
        <label><span>Justificación obligatoria</span><textarea value={reason} disabled={busy} required minLength={12} maxLength={500} rows={3}
          placeholder="Explica quién autoriza el cambio y por qué es necesario" onChange={event => setReason(event.target.value)}/></label>
        {(operation === 'ROLE_REVOKE' || operation === 'PERMISSION_REVOKE') && <label><span>Escribe CONFIRMAR para revocar</span>
          <input value={confirmation} disabled={busy} autoComplete="off" onChange={event => setConfirmation(event.target.value)} placeholder="CONFIRMAR"/></label>}
        {operation === 'ROLE_REVOKE' && <p className="sec-warning">Revocar el rol ADMIN puede interrumpir de inmediato el acceso administrativo de esta cuenta.</p>}
        {actionError && <p className="sec-action-error" role="alert">{actionError}</p>}
        <div className="sec-dialog-actions"><button type="button" className="sec-button" disabled={busy} onClick={() => setTarget(null)}>Cancelar</button>
          <button type="submit" className="sec-button sec-button-primary" disabled={busy || reason.trim().length < 12 || disabled ||
            ((operation === 'PERMISSION_GRANT' || operation === 'PERMISSION_REVOKE') &&
              !permissionLabels.some(item => item.value === permission && (operation === 'PERMISSION_GRANT' ? !grants(target).includes(item.value) : grants(target).includes(item.value)))}
          >{busy ? 'Guardando…' : actionLabel[operation]}</button></div>
      </form>
    </AdminDialog>}
  </section>;
}
