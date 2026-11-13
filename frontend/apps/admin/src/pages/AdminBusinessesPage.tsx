import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { getAdminBusiness, getAdminDashboardStats, listAdminBusinesses, type AdminBusinessPage, type AdminBusinessRecord, type AdminDashboardStats } from '../services/adminApiClient';
import { StatePanel } from '../components/common';
import { Icon } from '../components/Icon';
import { getSession } from '../services/adminService';

const PAGE_SIZE = 3;
const date = (value: string) => new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value));
const count = (value: number) => value.toLocaleString('es-CO');
const visibilityTone: Record<string, string> = { VISIBLE: 'status-visible', HIDDEN: 'status-hidden', EXPIRED: 'status-expired', REVIEW: 'status-review' };
const verificationTone: Record<string, string> = { NONE: 'status-none', PENDING: 'status-pending', INFORMATION: 'status-information', APPROVED: 'status-approved', REJECTED: 'status-rejected' };
const visibilityStatusLabels: Record<string, string> = { VISIBLE: 'Visible', HIDDEN: 'Oculto', EXPIRED: 'Visibilidad vencida', REVIEW: 'En revisión' };
const verificationLabels: Record<string, string> = { NONE: 'Sin verificar', PENDING: 'Pendiente de verificación', INFORMATION: 'Información solicitada', APPROVED: 'Verificado', REJECTED: 'Rechazado' };
const translatedStatus = (labels: Record<string, string>, value: string) => labels[value] ?? 'Estado no reconocido';

function StoreIllustration() {
  return <svg className="business-empty-illustration" viewBox="0 0 360 180" role="img" aria-label="Ilustración de una tienda">
    <path d="M50 137c-24-1-31-24-16-39 8-8 19-9 28-5 2-25 28-39 49-26 9-25 39-31 56-13 22-25 61-14 67 17 25-5 45 12 43 34 19 3 30 20 23 37-4 10-13 15-27 15H58c-4 0-7-8-8-20Z" fill="#eeeaff"/>
    <path d="M82 79h174l-16 43H98L82 79Z" fill="#7350ec" stroke="#38238f" strokeWidth="5" strokeLinejoin="round"/>
    <path d="m96 80 15 41m29-41-4 41m35-41v41m38-41-7 41m38-41-17 41" stroke="#fff" strokeWidth="7"/>
    <path d="M101 121h139v44H101z" fill="#fff" stroke="#38238f" strokeWidth="5"/>
    <path d="M119 140h28v25h-28zM164 135h47v16h-47z" fill="#d7d0ff" stroke="#38238f" strokeWidth="4" strokeLinejoin="round"/>
    <circle cx="245" cy="139" r="27" fill="#fff" stroke="#38238f" strokeWidth="6"/><path d="m265 159 20 19" stroke="#38238f" strokeWidth="10" strokeLinecap="round"/>
  </svg>;
}

export function AdminBusinessesPage() {
  const allowed = getSession()?.permissions?.includes('business:write') ?? false;
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const status = params.get('status') ?? '';
  const requestedPage = Number(params.get('page'));
  const page = Number.isFinite(requestedPage) ? Math.max(1, Math.floor(requestedPage)) : 1;
  const [input, setInput] = useState(q);
  const [data, setData] = useState<AdminBusinessPage | null>(null);
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [loading, setLoading] = useState(allowed);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);

  useEffect(() => { setInput(q); }, [q]);
  useEffect(() => {
    if (!allowed) return;
    let active = true;
    setLoading(true); setError('');
    listAdminBusinesses(q, page, PAGE_SIZE, status).then(result => { if (active) setData(result); })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'No se pudo consultar el directorio.'); })
      .finally(() => { if (active) setLoading(false); });
    getAdminDashboardStats().then(result => { if (active) setStats(result); }).catch(() => { if (active) setStats(null); });
    return () => { active = false; };
  }, [allowed, q, status, page, revision]);

  function setFilter(key: 'q' | 'status', value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    next.delete('page');
    setParams(next, { replace: true });
  }
  function goToPage(target: number) {
    const next = new URLSearchParams(params);
    if (target <= 1) next.delete('page'); else next.set('page', String(target));
    setParams(next);
  }
  function exportBusinesses() {
    const fields = ['Negocio', 'Categoría', 'Visibilidad', 'Registro'];
    const rows = data?.businesses ?? [];
    const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const csv = [fields, ...rows.map(item => [item.name, item.category.translations[0]?.name ?? 'Sin categoría', translatedStatus(visibilityStatusLabels, item.visibilityStatus), date(item.createdAt)])]
      .map(row => row.map(value => escape(String(value))).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'negocios-xamuko.csv'; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  if (!allowed) return <StatePanel kind="error" title="Acceso restringido" message="Necesitas permiso para consultar negocios." />;

  const total = data?.pagination.total ?? 0;
  const totalPages = Math.max(1, data?.pagination.totalPages ?? 1);
  const rows = data?.businesses ?? [];
  const statValues = stats ? [
    { label: 'Total negocios', value: stats.totals.businesses, icon: 'store', tone: 'purple', percent: null },
    { label: 'Activos', value: stats.businessStatuses.published, icon: 'check', tone: 'green', percent: stats.totals.businesses ? stats.businessStatuses.published / stats.totals.businesses * 100 : 0 },
    { label: 'En revisión', value: stats.businessStatuses.review, icon: 'clock', tone: 'blue', percent: stats.totals.businesses ? stats.businessStatuses.review / stats.totals.businesses * 100 : 0 },
    { label: 'Inactivos', value: stats.businessStatuses.unpublished, icon: 'close', tone: 'red', percent: stats.totals.businesses ? stats.businessStatuses.unpublished / stats.totals.businesses * 100 : 0 },
  ] : [];
  const pageNumbers = Array.from({ length: Math.min(totalPages, 3) }, (_, index) => Math.max(1, Math.min(totalPages - 2, page - 1)) + index);

  return <div className="businesses-page">
    <div className="business-breadcrumb"><span><Icon name="home" size={15} /> Inicio</span><Icon name="arrow" size={13} /><strong>Negocios</strong></div>
    <div className="page-heading businesses-title-row"><div><p className="eyebrow">GESTIÓN DE PLATAFORMA</p><div className="businesses-title"><span className="businesses-title-icon"><Icon name="store" size={28} /></span><div><h1>Negocios</h1><p>Directorio administrativo consultado desde la base de datos de XAMUKO.</p></div></div></div></div>

    <section className="business-stats businesses-summary" aria-label="Resumen de negocios">
      {(statValues.length ? statValues : [
        { label: 'Total negocios', value: total, icon: 'store', tone: 'purple', percent: null },
        { label: 'Activos', value: 0, icon: 'check', tone: 'green', percent: 0 },
        { label: 'En revisión', value: 0, icon: 'clock', tone: 'blue', percent: 0 },
        { label: 'Inactivos', value: 0, icon: 'close', tone: 'red', percent: 0 },
      ]).map(item => <article className={`business-stat businesses-stat ${item.tone}`} key={item.label}>
        <span className="businesses-stat-icon"><Icon name={item.icon} size={22} /></span><div><span>{item.label}</span><strong>{count(item.value)}</strong></div>
        {item.percent !== null && <small>{item.percent.toLocaleString('es-CO', { maximumFractionDigits: 1 })}%</small>}
      </article>)}
    </section>

    <section className="panel business-directory businesses-directory">
      <div className="directory-heading businesses-directory-heading"><div><h2>Listado de negocios</h2><p>Administra, consulta y gestiona los negocios registrados en XAMUKO.</p></div><div className="businesses-actions"><button className="secondary-button" onClick={exportBusinesses} disabled={!rows.length}><Icon name="download" size={17} /> Exportar</button><a className="primary businesses-create" href="https://business.xamuko.com"><span aria-hidden="true">＋</span> Crear negocio</a></div></div>
      <form className="businesses-toolbar" onSubmit={event => { event.preventDefault(); setFilter('q', input.trim()); }}>
        <label className="directory-search"><Icon name="search" size={18} /><input aria-label="Buscar por nombre del negocio" placeholder="Buscar por nombre del negocio…" value={input} onChange={event => setInput(event.target.value)} /></label>
        <label className="businesses-status-filter"><span className="sr-only">Estado</span><select value={status} onChange={event => setFilter('status', event.target.value)}><option value="">Todos los estados</option><option value="active">Activos</option><option value="review">En revisión</option><option value="inactive">Inactivos</option></select></label>
        <button type="button" className="secondary-button businesses-clear" onClick={() => { setInput(''); setParams({}); }} disabled={!q && !status}><Icon name="refresh" size={16} /> Limpiar</button>
      </form>
      {loading ? <StatePanel kind="loading" title="Cargando negocios" message="Consultando registros reales." /> : error ? <StatePanel kind="error" title="No pudimos cargar los negocios" message={error} retry={() => setRevision(value => value + 1)} /> : data && <>
        {rows.length === 0 ? <div className="businesses-empty"><StoreIllustration /><h2>No se encontraron negocios</h2><p>Intenta ajustar los filtros de búsqueda o crear un nuevo negocio.</p><a className="primary businesses-create empty-create" href="https://business.xamuko.com"><span aria-hidden="true">＋</span> Crear primer negocio</a></div> : <>
          <div className="business-table-wrap"><table className="business-table businesses-table"><caption className="sr-only">Listado de negocios de XAMUKO</caption><thead><tr><th>#</th><th>Negocio</th><th>Categoría</th><th>Visibilidad</th><th>Registro</th><th>Acciones</th></tr></thead><tbody>{rows.map((item: AdminBusinessRecord, index: number) => {
            const category = item.category.translations[0]?.name ?? 'Sin categoría';
            const tone = visibilityTone[item.visibilityStatus] ?? 'status-review';
            return <tr key={item.id}><td className="business-number">#{String((page - 1) * PAGE_SIZE + index + 1).padStart(3, '0')}</td><td><Link to={`/businesses/${item.id}`} className="business-cell"><span className="business-avatar"><Icon name="store" size={18} /></span><div><strong>{item.name}</strong><small>{item.createdBy.displayName || 'Administrador'}</small></div></Link></td><td><span className={`business-category ${index % 3 === 0 ? 'tools' : index % 3 === 1 ? 'food' : 'bakery'}`}><Icon name={index % 3 === 0 ? 'settings' : index % 3 === 1 ? 'grid' : 'star'} size={14} />{category}</span></td><td><span className={`badge ${tone}`}><span aria-hidden="true">●</span> {translatedStatus(visibilityStatusLabels, item.visibilityStatus)}</span></td><td className="business-date">{date(item.createdAt)}</td><td><div className="business-row-actions"><Link className="icon-button businesses-view" to={`/businesses/${item.id}`} aria-label={`Ver ${item.name}`}><Icon name="eye" size={18} /></Link><button className="icon-button businesses-view" type="button" aria-label={`Más acciones para ${item.name}`} title="Más acciones"><Icon name="more" size={18} /></button></div></td></tr>;
          })}</tbody></table></div>
          <div className="business-mobile-list businesses-mobile-list">{rows.map(item => <Link to={`/businesses/${item.id}`} className="business-mobile-card" key={item.id}><div className="mobile-business-heading"><span className="business-avatar"><Icon name="store" size={18} /></span><div><strong>{item.name}</strong><small>{item.category.translations[0]?.name ?? 'Sin categoría'} · {item.location?.cityName ?? 'Sin ubicación'}</small></div><Icon name="arrow" size={17} /></div><div className="mobile-business-badges"><span className={`badge ${visibilityTone[item.visibilityStatus] ?? 'status-review'}`}>{translatedStatus(visibilityStatusLabels, item.visibilityStatus)}</span></div><small className="mobile-expiry">Registro: {date(item.createdAt)}</small></Link>)}</div>
          <div className="business-pagination businesses-pagination"><span>Mostrando {(page - 1) * PAGE_SIZE + 1}–{Math.min((page - 1) * PAGE_SIZE + rows.length, total)} de {count(total)} negocios</span><div><button className="secondary-button page-arrow" aria-label="Página anterior" disabled={page <= 1} onClick={() => goToPage(page - 1)}>‹</button>{pageNumbers.map(number => <button className={`page-number ${page === number ? 'selected' : ''}`} key={number} aria-current={page === number ? 'page' : undefined} onClick={() => goToPage(number)}>{number}</button>)}{totalPages > 3 && <><span className="page-ellipsis">…</span><button className="page-number" onClick={() => goToPage(totalPages)}>{totalPages}</button></>}<button className="secondary-button page-arrow" aria-label="Página siguiente" disabled={page >= totalPages} onClick={() => goToPage(page + 1)}>›</button></div></div>
        </>}
      </>}
    </section>
    {rows.length > 0 && !loading && !error && data && <section className="businesses-empty-preview" aria-hidden="true"><StoreIllustration /><strong>No se encontraron negocios</strong><span>Intenta ajustar los filtros de búsqueda o crear un nuevo negocio.</span></section>}
  </div>;
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
  return <section className="admin-business-detail"><Link className="back-link" to="/businesses">← Volver al directorio</Link><div className="page-heading"><div><p className="eyebrow">REGISTRO ADMINISTRATIVO</p><h1>{item.name}</h1><p>Actualizado el {date(item.updatedAt)}</p></div></div><div className="admin-business-facts"><div><span>Visibilidad</span><strong className={`business-status-text ${visibilityTone[item.visibilityStatus] ?? 'status-review'}`}>{translatedStatus(visibilityStatusLabels, item.visibilityStatus)}</strong></div><div><span>Verificación</span><strong className={`business-status-text ${verificationTone[item.verificationStatus] ?? 'status-information'}`}>{translatedStatus(verificationLabels, item.verificationStatus)}</strong></div></div><div className="panel admin-business-information"><h2>Información registrada</h2><dl><div><dt>Creado por</dt><dd>{item.createdBy.displayName}</dd></div><div><dt>Categoría</dt><dd>{item.category.translations[0]?.name ?? 'Sin traducción'}</dd></div><div><dt>Ubicación</dt><dd>{item.location ? `${item.location.address}, ${item.location.cityName}, ${item.location.countryCode}` : 'No registrada'}</dd></div><div><dt>Correo</dt><dd>{item.email ?? 'No registrado'}</dd></div><div><dt>Teléfono</dt><dd>{item.phone ?? 'No registrado'}</dd></div><div><dt>Descripción</dt><dd>{item.description ?? 'No registrada'}</dd></div></dl></div></section>;
}
