import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { getAdminBusiness, listAdminBusinesses, type AdminBusinessPage, type AdminBusinessRecord } from '../services/adminApiClient';
import { StatePanel } from '../components/common';
import { getSession } from '../services/adminService';

const date = (value: string) => new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(new Date(value));

export function AdminBusinessesPage() {
  const allowed = getSession()?.permissions?.includes('business:write') ?? false;
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const requestedPage = Number(params.get('page'));
  const page = Number.isFinite(requestedPage) ? Math.max(1, Math.min(100000, Math.floor(requestedPage))) : 1;
  const [input, setInput] = useState(q);
  const [data, setData] = useState<AdminBusinessPage | null>(null);
  const [loading, setLoading] = useState(allowed);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => { setInput(q); }, [q]);
  useEffect(() => {
    if (!allowed) return;
    let active = true;
    setLoading(true); setError('');
    listAdminBusinesses(q, page).then(result => { if (active) setData(result); }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'No se pudo consultar el directorio.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [allowed, q, page, revision]);
  if (!allowed) return <StatePanel kind="error" title="Acceso restringido" message="Necesitas permiso para consultar negocios." />;
  return <section className="admin-businesses-page"><div className="page-heading"><div><p className="eyebrow">GESTIÓN DE PLATAFORMA</p><h1>Negocios</h1><p>Directorio administrativo consultado desde la base de datos de XAMUKO.</p></div></div>
    <form className="admin-business-search" onSubmit={event => { event.preventDefault(); setParams(input.trim() ? { q: input.trim() } : {}); }}><label htmlFor="admin-business-q">Buscar por nombre</label><div><input id="admin-business-q" value={input} onChange={event => setInput(event.target.value)} placeholder="Nombre del negocio" /><button className="primary" type="submit">Buscar</button></div></form>
    {loading ? <StatePanel kind="loading" title="Cargando negocios" message="Consultando registros reales." /> : error ? <StatePanel kind="error" title="No pudimos cargar los negocios" message={error} retry={() => setRevision(value => value + 1)} /> : data && <><div className="admin-business-count"><strong>{data.pagination.total}</strong><span>{data.pagination.total === 1 ? 'negocio encontrado' : 'negocios encontrados'}</span></div>{data.businesses.length === 0 ? <StatePanel kind="empty" title="No encontramos negocios" message={q ? 'Prueba con otro nombre.' : 'Aún no hay registros en la base de datos.'} /> : <div className="admin-directory-table"><table><thead><tr><th>Negocio</th><th>Ubicación</th><th>Publicación</th><th>Verificación</th><th>Actualizado</th><th /></tr></thead><tbody>{data.businesses.map(item => <tr key={item.id}><td><strong>{item.name}</strong><small>{item.category.translations[0]?.name ?? 'Sin traducción de categoría'}</small></td><td>{item.location ? `${item.location.cityName}, ${item.location.countryCode}` : 'Sin ubicación'}</td><td><span className="status-pill">{item.publicationStatus}</span></td><td><span className="status-pill">{item.verificationStatus}</span></td><td>{date(item.updatedAt)}</td><td><Link className="admin-business-link" to={`/businesses/${item.id}`}>Ver detalle</Link></td></tr>)}</tbody></table></div>}
      <nav className="admin-business-pagination" aria-label="Páginas del directorio"><button className="secondary-button" disabled={page <= 1} onClick={() => setParams(q ? { q, page: String(page - 1) } : { page: String(page - 1) })}>Anterior</button><span>Página {page} de {Math.max(1, data.pagination.totalPages)}</span><button className="secondary-button" disabled={page >= data.pagination.totalPages} onClick={() => setParams(q ? { q, page: String(page + 1) } : { page: String(page + 1) })}>Siguiente</button></nav></>}
  </section>;
}

export function AdminBusinessDetailPage() {
  const allowed = getSession()?.permissions?.includes('business:write') ?? false;
  const { id = '' } = useParams();
  const [item, setItem] = useState<AdminBusinessRecord | null>(null);
  const [loading, setLoading] = useState(allowed);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!allowed) return;
    let active = true;
    getAdminBusiness(id).then(result => { if (active) setItem(result); }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'No se pudo consultar el negocio.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [allowed, id]);
  if (!allowed) return <StatePanel kind="error" title="Acceso restringido" message="Necesitas permiso para consultar negocios." />;
  if (loading) return <StatePanel kind="loading" title="Cargando negocio" message="Consultando el registro real." />;
  if (error || !item) return <StatePanel kind="error" title="No se pudo abrir el negocio" message={error || 'No encontramos el registro.'} />;
  return <section className="admin-business-detail"><Link className="back-link" to="/businesses">← Volver al directorio</Link><div className="page-heading"><div><p className="eyebrow">REGISTRO ADMINISTRATIVO</p><h1>{item.name}</h1><p>Actualizado el {date(item.updatedAt)}</p></div></div><div className="admin-business-facts"><div><span>Estado</span><strong>{item.lifecycleStatus}</strong></div><div><span>Publicación</span><strong>{item.publicationStatus}</strong></div><div><span>Visibilidad</span><strong>{item.visibilityStatus}</strong></div><div><span>Verificación</span><strong>{item.verificationStatus}</strong></div></div><div className="panel admin-business-information"><h2>Información registrada</h2><dl><div><dt>Creado por</dt><dd>{item.createdBy.displayName}</dd></div><div><dt>Categoría</dt><dd>{item.category.translations[0]?.name ?? 'Sin traducción'}</dd></div><div><dt>Ubicación</dt><dd>{item.location ? `${item.location.address}, ${item.location.cityName}, ${item.location.countryCode}` : 'No registrada'}</dd></div><div><dt>Correo</dt><dd>{item.email ?? 'No registrado'}</dd></div><div><dt>Teléfono</dt><dd>{item.phone ?? 'No registrado'}</dd></div><div><dt>Descripción</dt><dd>{item.description ?? 'No registrada'}</dd></div></dl></div></section>;
}
