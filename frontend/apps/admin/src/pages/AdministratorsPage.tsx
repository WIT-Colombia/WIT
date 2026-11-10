import { useEffect, useState } from 'react';
import { listAdministrators, type AdministratorRecord } from '../services/adminApiClient';
import { getSession } from '../services/adminService';
import { StatePanel } from '../components/common';

export function AdministratorsPage() {
  const allowed = getSession()?.permissions?.includes('settings:write') ?? false;
  const [records, setRecords] = useState<AdministratorRecord[]>([]);
  const [loading, setLoading] = useState(allowed);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!allowed) return;
    let active = true;
    setLoading(true);
    setError('');
    listAdministrators()
      .then(result => { if (active) setRecords(result); })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'No se pudo consultar la lista.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [allowed, revision]);

  if (!allowed) return <StatePanel kind="error" title="Acceso restringido" message="Necesitas permiso para consultar administradores." />;
  const active = records.filter(record => record.adminRoleAssignments.some(role => role.active));
  return <section className="administrators-page">
    <div className="page-heading"><div><p className="eyebrow">CONFIGURACIÓN Y SEGURIDAD</p><h1>Administradores y accesos</h1><p>Consulta las cuentas y permisos registrados en XAMUKO.</p></div></div>
    {loading ? <StatePanel kind="loading" title="Cargando administradores" message="Consultando cuentas reales." /> : error ? <StatePanel kind="error" title="No pudimos cargar las cuentas" message={error} retry={() => setRevision(value => value + 1)} /> : <>
      <div className="admin-directory-overview"><span>Administradores activos</span><strong>{active.length}</strong><small>Según los roles activos registrados</small></div>
      {records.length === 0 ? <StatePanel kind="empty" title="Sin administradores" message="La consulta no devolvió cuentas administrativas." /> : <div className="admin-directory-table"><table><thead><tr><th>Cuenta</th><th>Estado</th><th>Rol activo</th><th>Permisos</th></tr></thead><tbody>{records.map(record => <tr key={record.id}><td><strong>{record.displayName}</strong><small>{record.emailNormalized ?? 'Correo no disponible'}</small></td><td><span className="status-pill">{record.status}</span></td><td>{record.adminRoleAssignments.filter(role => role.active).map(role => role.role).join(', ') || 'Sin rol activo'}</td><td>{record.adminPermissionGrants.filter(grant => grant.granted).map(grant => grant.permission).join(', ') || 'Sin permisos adicionales'}</td></tr>)}</tbody></table></div>}
    </>}
  </section>;
}
