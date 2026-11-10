import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { listAdminOffers, type AdminOfferPage } from '../services/adminApiClient';
import { getSession } from '../services/adminService';
import { StatePanel } from '../components/common';

const date = (value: string) => new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(new Date(value));

export function AdminContentPage() {
  const allowed = getSession()?.permissions?.includes('dashboard:read') ?? false;
  const [params, setParams] = useSearchParams();
  const requestedPage = Number(params.get('page'));
  const page = Number.isFinite(requestedPage) ? Math.max(1, Math.min(100000, Math.floor(requestedPage))) : 1;
  const [data, setData] = useState<AdminOfferPage | null>(null);
  const [loading, setLoading] = useState(allowed);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!allowed) return;
    let active = true;
    setLoading(true); setError('');
    listAdminOffers(page).then(result => { if (active) setData(result); }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'No se pudo consultar el contenido.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [allowed, page, revision]);
  if (!allowed) return <StatePanel kind="error" title="Acceso restringido" message="Necesitas permiso de catálogo para consultar el contenido." />;
  return <section><div className="page-heading"><div><p className="eyebrow">GESTIÓN DE PLATAFORMA</p><h1>Contenido</h1><p>Productos y servicios registrados por los negocios.</p></div></div>
    {loading ? <StatePanel kind="loading" title="Cargando contenido" message="Consultando registros reales." /> : error ? <StatePanel kind="error" title="No pudimos cargar el contenido" message={error} retry={() => setRevision(value => value + 1)} /> : data && <><div className="admin-business-count"><strong>{data.pagination.total}</strong><span>registros</span></div>{data.offers.length === 0 ? <StatePanel kind="empty" title="Sin contenido" message="No hay productos ni servicios registrados." /> : <div className="admin-directory-table"><table><thead><tr><th>Contenido</th><th>Negocio</th><th>Tipo</th><th>Publicación</th><th>Actualizado</th></tr></thead><tbody>{data.offers.map(offer => <tr key={offer.id}><td><strong>{offer.name}</strong></td><td><Link to={`/businesses/${offer.business.id}`}>{offer.business.name}</Link></td><td>{offer.kind}</td><td><span className="status-pill">{offer.deletedAt ? 'Eliminado' : offer.publicationStatus}</span></td><td>{date(offer.updatedAt)}</td></tr>)}</tbody></table></div>}
      <nav className="admin-business-pagination" aria-label="Páginas de contenido"><button className="secondary-button" disabled={page <= 1} onClick={() => setParams({ page: String(page - 1) })}>Anterior</button><span>Página {page} de {Math.max(1, data.pagination.totalPages)}</span><button className="secondary-button" disabled={page >= data.pagination.totalPages} onClick={() => setParams({ page: String(page + 1) })}>Siguiente</button></nav></>}
  </section>;
}
