import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { listAdminUsers, type AdminUserPage } from '../services/adminApiClient';
import { getSession } from '../services/adminService';
import { StatePanel } from '../components/common';

const date = (value: string) => new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(new Date(value));

export function AdminUsersPage() {
  const allowed = getSession()?.permissions?.includes('settings:write') ?? false;
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const requestedPage = Number(params.get('page'));
  const page = Number.isFinite(requestedPage) ? Math.max(1, Math.min(100000, Math.floor(requestedPage))) : 1;
  const [input, setInput] = useState(q);
  const [data, setData] = useState<AdminUserPage | null>(null);
  const [loading, setLoading] = useState(allowed);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => { setInput(q); }, [q]);
  useEffect(() => {
    if (!allowed) return;
    let active = true;
    setLoading(true); setError('');
    listAdminUsers(q, page).then(result => { if (active) setData(result); }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'No se pudo consultar la lista.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [allowed, q, page, revision]);
  if (!allowed) return <StatePanel kind="error" title="Acceso restringido" message="Necesitas permiso de administración para consultar usuarios." />;
  return <section className="admin-users-page"><div className="page-heading"><div><p className="eyebrow">GESTIÓN DE PLATAFORMA</p><h1>Usuarios</h1><p>Consulta de cuentas registradas en la base de datos.</p></div></div>
    <form className="admin-business-search" onSubmit={event => { event.preventDefault(); setParams(input.trim() ? { q: input.trim() } : {}); }}><label htmlFor="admin-user-q">Buscar nombre o correo</label><div><input id="admin-user-q" value={input} onChange={event => setInput(event.target.value)} placeholder="Nombre o correo" /><button className="primary" type="submit">Buscar</button></div></form>
    {loading ? <StatePanel kind="loading" title="Cargando usuarios" message="Consultando cuentas reales." /> : error ? <StatePanel kind="error" title="No pudimos cargar los usuarios" message={error} retry={() => setRevision(value => value + 1)} /> : data && <><div className="admin-business-count"><strong>{data.pagination.total}</strong><span>{data.pagination.total === 1 ? 'cuenta encontrada' : 'cuentas encontradas'}</span></div>{data.users.length === 0 ? <StatePanel kind="empty" title="Sin resultados" message={q ? 'Prueba otra búsqueda.' : 'La base de datos no contiene cuentas.'} /> : <div className="admin-directory-table"><table><thead><tr><th>Cuenta</th><th>Estado</th><th>Registro</th><th>Último acceso</th></tr></thead><tbody>{data.users.map(user => <tr key={user.id}><td><strong>{user.displayName}</strong><small>{user.emailNormalized ?? 'Sin correo'}</small></td><td><span className="status-pill">{user.status}</span></td><td>{date(user.createdAt)}</td><td>{user.lastLoginAt ? date(user.lastLoginAt) : 'Sin acceso registrado'}</td></tr>)}</tbody></table></div>}
      <nav className="admin-business-pagination" aria-label="Páginas de usuarios"><button className="secondary-button" disabled={page <= 1} onClick={() => setParams(q ? { q, page: String(page - 1) } : { page: String(page - 1) })}>Anterior</button><span>Página {page} de {Math.max(1, data.pagination.totalPages)}</span><button className="secondary-button" disabled={page >= data.pagination.totalPages} onClick={() => setParams(q ? { q, page: String(page + 1) } : { page: String(page + 1) })}>Siguiente</button></nav></>}
  </section>;
}
