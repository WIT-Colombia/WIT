import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { getAdminBusiness, listAdminBusinesses, getAdminBusinessesOverview, getAdminBusinessesFilterOptions,
  adminBusinessVisibilityLabel, type AdminBusinessPage, type AdminBusinessRecord, type AdminBusinessOverview,
  type AdminBusinessFilterOptions, type AdminBusinessesFilters, type AdminVisibilityAction } from '../services/adminApiClient';
import { StatePanel } from '../components/common';
import { Icon } from '../components/Icon';
import { getSession } from '../services/adminService';
import { AdminBusinessGrowthPanel } from './AdminBusinessGrowthPanel';
import { AdminBusinessDeleteDialog } from '../components/businesses/AdminBusinessDeleteDialog';
import { AdminBusinessVisibilityDialog } from '../components/businesses/AdminBusinessVisibilityDialog';
import { AdminBusinessOperationsOverview } from './AdminBusinessOperationsOverview';
import { AdminBusinessAuditTimeline } from './AdminBusinessAuditTimeline';
import './AdminBusinessesRefresh.css';
import './AdminBusinessesControl.css';
import { ADMIN_DIRECTORY_PAGE_SIZE, adminDirectoryPageSummary } from '../utils/adminDirectoryPagination';

const PAGE_SIZE = ADMIN_DIRECTORY_PAGE_SIZE;
const date = (value: string) => new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value));
const categoryName = (category: AdminBusinessRecord['category']) =>
  category.translations.find(item => item.locale === 'es-CO')?.name ??
  category.translations.find(item => item.locale === 'es')?.name ??
  category.translations[0]?.name ?? category.code ?? 'Sin categoría';
const visibilityTone: Record<string, string> = { VISIBLE: 'status-visible', HIDDEN: 'status-hidden', EXPIRED: 'status-expired', REVIEW: 'status-review' };
const verificationTone: Record<string, string> = { NONE: 'status-none', PENDING: 'status-pending', INFORMATION: 'status-information', APPROVED: 'status-approved', REJECTED: 'status-rejected' };
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
  const canDelete = getSession()?.role === 'SUPER_ADMIN';
  const [deleteTarget, setDeleteTarget] = useState<AdminBusinessRecord | null>(null);
  const [visibilityTarget, setVisibilityTarget] = useState<{ business: AdminBusinessRecord; action: AdminVisibilityAction } | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const status = params.get('status') ?? '';
  const requestedPage = Number(params.get('page'));
  const page = Number.isFinite(requestedPage) ? Math.max(1, Math.floor(requestedPage)) : 1;
  const [input, setInput] = useState(q);
  const [data, setData] = useState<AdminBusinessPage | null>(null);
  const [overview, setOverview] = useState<AdminBusinessOverview | null>(null);
  const [overviewError, setOverviewError] = useState('');
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [filtersAvailable, setFiltersAvailable] = useState<AdminBusinessFilterOptions>({ categories: [], cities: [] });
  const [loading, setLoading] = useState(allowed);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const advanced: AdminBusinessesFilters = {
    city: params.get('city') ?? '', categoryId: params.get('categoryId') ?? '',
    visibility: params.get('visibility') ?? '', verification: params.get('verification') ?? '',
    plan: params.get('plan') ?? '', restriction: params.get('restriction') ?? '',
    from: params.get('from') ?? '', to: params.get('to') ?? '', order: params.get('order') ?? '',
  };
  const filtersActive = [...params.keys()].filter(k => !['page'].includes(k) && Boolean(params.get(k))).length;
  const filtersKey = [...params.entries()].filter(([k]) => k !== 'page').sort(([a], [b]) => a.localeCompare(b)).map(([k,v]) => k+'='+v).join('&');

  useEffect(() => { setInput(q); }, [q]);
  useEffect(() => {
    if (!allowed) return;
    let active = true;
    setLoading(true); setError('');
    listAdminBusinesses(q, page, PAGE_SIZE, status, advanced).then(result => { if (active) setData(result); })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'No se pudo consultar el directorio.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [allowed, q, status, page, revision, filtersKey]);
  useEffect(() => {
    if (!allowed) return;
    let active = true;
    setOverviewLoading(true); setOverviewError('');
    void getAdminBusinessesOverview().then(value => { if (active) setOverview(value); })
      .catch(cause => { if (active) setOverviewError(cause instanceof Error ? cause.message : 'No disponible'); })
      .finally(() => { if (active) setOverviewLoading(false); });
    return () => { active = false; };
  }, [allowed, revision]);
  useEffect(() => {
    if (!allowed) return;
    let active = true;
    void getAdminBusinessesFilterOptions().then(value => { if (active) setFiltersAvailable(value); }).catch(() => {});
    return () => { active = false; };
  }, [allowed]);

  function setFilter(key: keyof AdminBusinessesFilters, value: string) {
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
    const csv = [fields, ...rows.map(item => [item.name, categoryName(item.category), adminBusinessVisibilityLabel(item), date(item.createdAt)])]
      .map(row => row.map(value => escape(String(value))).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'negocios-xamuko.csv'; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  if (!allowed) return <StatePanel kind="error" title="Acceso restringido" message="Necesitas permiso para consultar negocios." />;

  const totalPages = Math.max(1, data?.pagination.totalPages ?? 1);
  const rows = data?.businesses ?? [];
  const pageNumbers = Array.from({ length: Math.min(totalPages, 3) }, (_, index) => Math.max(1, Math.min(totalPages - 2, page - 1)) + index);

  return <div className="businesses-page">

    <header className="admin-section-heading"><h1 id="businesses-page-title">Negocios</h1></header>
    {notice && <div className="admin-business-delete-success" role="status">{notice}</div>}

    <AdminBusinessOperationsOverview data={overview} loading={overviewLoading} error={overviewError} retry={() => setRevision(n => n + 1)} />

    <section className="panel business-directory businesses-directory">
      <div className="directory-heading businesses-directory-heading"><div><h2>Listado de negocios</h2><p>Administra, consulta y gestiona los negocios registrados en XAMUKO.</p></div><div className="businesses-actions"><button className="secondary-button" onClick={exportBusinesses} disabled={!rows.length} title="Exporta los negocios visibles en la página actual"><Icon name="download" size={17} /> Exportar página</button><a className="primary businesses-create" href="https://business.xamuko.com"><span aria-hidden="true">＋</span> Crear negocio</a></div></div>
      <form className="businesses-toolbar" onSubmit={event => { event.preventDefault(); setFilter('q', input.trim()); }}>
        <label className="directory-search"><Icon name="search" size={18} /><input aria-label="Buscar por nombre, identificador o propietario" placeholder="Nombre, ID, propietario o correo…" value={input} onChange={event => setInput(event.target.value)} /></label>
        <label className="businesses-status-filter"><span className="sr-only">Estado</span><select value={status} onChange={event => setFilter('status', event.target.value)}><option value="">Todos los estados</option><option value="active">Activos</option><option value="review">En revisión</option><option value="inactive">No publicados</option><option value="deleted">Eliminados</option></select></label>
        <button type="button" className="secondary-button businesses-clear" onClick={() => { setInput(''); setParams({}); }} disabled={filtersActive === 0}><Icon name="refresh" size={16} /> Limpiar</button>
      </form>
      <div className="ad-ops-filter-bar">
        <span><Icon name="search" size={16}/> {filtersActive ? `${filtersActive} filtro(s) activo(s)` : 'Todas las ubicaciones y categorías'}</span>
        <button type="button" onClick={() => setAdvancedOpen(open => !open)} aria-expanded={advancedOpen} aria-controls="ad-ops-advanced-filters">
          <Icon name="settings" size={17}/> {advancedOpen ? 'Ocultar filtros avanzados' : 'Filtros avanzados'} <Icon name="chevron" size={16}/>
        </button>
      </div>
      <div id="ad-ops-advanced-filters" className="ad-ops-advanced-filters" hidden={!advancedOpen}>
        <label>Ciudad<select aria-label="Ciudad" value={advanced.city} onChange={event => setFilter('city', event.target.value)}>
          <option value="">Todas las ciudades</option>{filtersAvailable.cities.map(item => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>
        <label>Categoría<select aria-label="Categoría" value={advanced.categoryId} onChange={event => setFilter('categoryId', event.target.value)}>
          <option value="">Todas las categorías</option>{filtersAvailable.categories.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
        <label>Visibilidad<select aria-label="Visibilidad" value={advanced.visibility} onChange={event => setFilter('visibility', event.target.value)}>
          <option value="">Todas</option><option value="VISIBLE">Visible</option><option value="HIDDEN">Oculto</option><option value="EXPIRED">Vencido</option>
          <option value="REVIEW">En revisión</option><option value="ADMIN_HIDDEN">Bajo medida administrativa</option></select></label>
        <label>Verificación<select aria-label="Verificación" value={advanced.verification} onChange={event => setFilter('verification', event.target.value)}>
          <option value="">Todas</option><option value="NONE">Sin verificar</option><option value="PENDING">Pendiente</option>
          <option value="INFORMATION">Requiere información</option><option value="APPROVED">Verificado</option><option value="REJECTED">Rechazado</option></select></label>
        <label>Suscripción<select aria-label="Suscripción" value={advanced.plan} onChange={event => setFilter('plan', event.target.value)}>
          <option value="">Todos los planes</option><option value="pro">Business PRO vigente</option><option value="basic">Sin PRO vigente</option></select></label>
        <label>Medida administrativa<select aria-label="Medida administrativa" value={advanced.restriction} onChange={event => setFilter('restriction', event.target.value)}>
          <option value="">Todas</option><option value="NONE">Sin medida</option><option value="HIDDEN">Ocultamiento</option><option value="SUSPENDED">Suspensión</option></select></label>
        <label>Desde<input type="date" aria-label="Registro desde" value={advanced.from} max={advanced.to || undefined} onChange={event => setFilter('from', event.target.value)}/></label>
        <label>Hasta<input type="date" aria-label="Registro hasta" value={advanced.to} min={advanced.from || undefined} onChange={event => setFilter('to', event.target.value)}/></label>
        <label>Ordenar<select aria-label="Ordenar negocios" value={advanced.order} onChange={event => setFilter('order', event.target.value)}>
          <option value="">Más recientes</option><option value="oldest">Más antiguos</option><option value="name">Nombre A–Z</option></select></label>
      </div>
      {loading ? <StatePanel kind="loading" title="Cargando negocios" message="Consultando registros reales." /> : error ? <StatePanel kind="error" title="No pudimos cargar los negocios" message={error} retry={() => setRevision(value => value + 1)} /> : data && <>
        {rows.length === 0 ? <div className="businesses-empty"><StoreIllustration /><h2>No se encontraron negocios</h2><p>Intenta ajustar los filtros de búsqueda o crear un nuevo negocio.</p><a className="primary businesses-create empty-create" href="https://business.xamuko.com"><span aria-hidden="true">＋</span> Crear primer negocio</a></div> : <>
          <div className="business-table-wrap"><table className="business-table businesses-table"><caption className="sr-only">Listado de negocios de XAMUKO</caption><thead><tr><th>#</th><th>Negocio</th><th>Categoría</th><th>Visibilidad</th><th>Plan</th><th>Reportes</th><th>Registro</th><th>Acciones</th></tr></thead><tbody>{rows.map((item: AdminBusinessRecord, index: number) => {
            const category = categoryName(item.category);
            const tone = item.administrativeRestriction ? (item.administrativeRestriction === 'SUSPENDED' ? 'status-expired' : 'status-hidden') : (visibilityTone[item.visibilityStatus] ?? 'status-review');
            return <tr key={item.id}><td className="business-number">#{String((page - 1) * PAGE_SIZE + index + 1).padStart(3, '0')}</td><td><Link to={`/businesses/${item.id}`} className="business-cell"><span className="business-avatar"><Icon name="store" size={18} /></span><div><strong>{item.name}</strong><small>{item.memberships?.[0]?.user?.displayName || item.createdBy.displayName || 'Sin propietario'}</small></div></Link></td><td><span className="business-category"><Icon name="grid" size={14} />{category}</span></td><td><span className={`badge ${tone}`}><span aria-hidden="true">●</span> {adminBusinessVisibilityLabel(item)}</span></td>
              <td><span className={item.isPro ? 'ad-ops-plan pro' : 'ad-ops-plan'}>{item.isPro ? 'PRO' : 'Básico'}</span></td>
              <td><span className="ad-ops-reports">{item._count?.reports ?? 0}</span></td><td className="business-date">{date(item.createdAt)}</td><td><div className="business-row-actions"><Link className="icon-button businesses-view" to={`/businesses/${item.id}`} aria-label={`Ver ${item.name}`}><Icon name="eye" size={18} /></Link>{canDelete && item.deletionStatus !== 'DELETED' && (item.administrativeRestriction
              ? <>
                {item.administrativeRestriction === 'HIDDEN' && <button type="button" className="icon-button ad-ops-suspend-button" title={'Suspender ' + item.name} aria-label={'Suspender ' + item.name} onClick={() => setVisibilityTarget({ business: item, action: 'SUSPEND' })}><Icon name="lock" size={18}/></button>}
                {item.administrativeRestriction === 'SUSPENDED' && <button type="button" className="icon-button ad-ops-hide-button" title={'Cambiar a ocultamiento ' + item.name} aria-label={'Ocultar ' + item.name} onClick={() => setVisibilityTarget({ business: item, action: 'HIDE' })}><Icon name="eye-off" size={18}/></button>}
                <button type="button" className="icon-button ad-ops-restore-button" title={'Levantar restricción de ' + item.name} aria-label={'Restituir ' + item.name} onClick={() => setVisibilityTarget({ business: item, action: 'RESTORE' })}><Icon name="check" size={18}/></button>
              </>
              : <>
                <button type="button" className="icon-button ad-ops-hide-button" title={'Ocultar ' + item.name} aria-label={'Ocultar ' + item.name} onClick={() => setVisibilityTarget({ business: item, action: 'HIDE' })}><Icon name="eye-off" size={18}/></button>
                <button type="button" className="icon-button ad-ops-suspend-button" title={'Suspender ' + item.name} aria-label={'Suspender ' + item.name} onClick={() => setVisibilityTarget({ business: item, action: 'SUSPEND' })}><Icon name="lock" size={18}/></button>
              </>)}
              {canDelete && item.deletionStatus !== 'DELETED' && <button type="button" className="icon-button businesses-delete" aria-label={`Eliminar ${item.name}`} title={`Eliminar ${item.name}`} onClick={() => setDeleteTarget(item)}><Icon name="trash" size={18}/></button>}</div></td></tr>;
          })}</tbody></table></div>
          <div className="business-mobile-list businesses-mobile-list">{rows.map(item => <article className="business-mobile-card" key={item.id}><Link to={`/businesses/${item.id}`} className="businesses-mobile-card-link"><div className="mobile-business-heading"><span className="business-avatar"><Icon name="store" size={18} /></span><div><strong>{item.name}</strong><small>{categoryName(item.category)} · {item.location?.cityName ?? 'Sin ubicación'}</small></div><Icon name="arrow" size={17} /></div><div className="mobile-business-badges"><span className={`badge ${item.administrativeRestriction === 'SUSPENDED' ? 'status-expired' : item.administrativeRestriction === 'HIDDEN' ? 'status-hidden' : visibilityTone[item.visibilityStatus] ?? 'status-review'}`}>{adminBusinessVisibilityLabel(item)}</span><span className={item.isPro ? 'ad-ops-plan pro' : 'ad-ops-plan'}>{item.isPro ? 'PRO' : 'Básico'}</span></div><small className="mobile-expiry">Registro: {date(item.createdAt)}</small></Link>{canDelete && item.deletionStatus !== 'DELETED' && <div className="ad-ops-mobile-actions">
              {item.administrativeRestriction ? <>
                  {item.administrativeRestriction === 'HIDDEN' && <button type="button" onClick={() => setVisibilityTarget({ business: item, action: 'SUSPEND' })}><Icon name="lock" size={16}/> Suspender</button>}
                  {item.administrativeRestriction === 'SUSPENDED' && <button type="button" onClick={() => setVisibilityTarget({ business: item, action: 'HIDE' })}><Icon name="eye-off" size={16}/> Ocultar</button>}
                  <button type="button" onClick={() => setVisibilityTarget({ business: item, action: 'RESTORE' })}><Icon name="check" size={16}/> Restituir</button>
                </>
                : <><button type="button" onClick={() => setVisibilityTarget({ business: item, action: 'HIDE' })}><Icon name="eye-off" size={16}/> Ocultar</button>
                   <button type="button" onClick={() => setVisibilityTarget({ business: item, action: 'SUSPEND' })}><Icon name="lock" size={16}/> Suspender</button></>}
            </div>}
            {canDelete && item.deletionStatus !== 'DELETED' && <button type="button" className="businesses-mobile-delete" onClick={() => setDeleteTarget(item)}><Icon name="trash" size={16}/> Eliminar negocio</button>}</article>)}</div>
          <div className="business-pagination businesses-pagination"><span>{adminDirectoryPageSummary(data!.pagination, rows.length, 'negocios')}</span><div><button className="secondary-button page-arrow" aria-label="Página anterior" disabled={page <= 1} onClick={() => goToPage(page - 1)}>‹</button>{pageNumbers.map(number => <button className={`page-number ${page === number ? 'selected' : ''}`} key={number} aria-current={page === number ? 'page' : undefined} onClick={() => goToPage(number)}>{number}</button>)}{totalPages > 3 && <><span className="page-ellipsis">…</span><button className="page-number" onClick={() => goToPage(totalPages)}>{totalPages}</button></>}<button className="secondary-button page-arrow" aria-label="Página siguiente" disabled={page >= totalPages} onClick={() => goToPage(page + 1)}>›</button></div></div>
        </>}
      </>}
    </section>
    <AdminBusinessGrowthPanel />
    {deleteTarget && <AdminBusinessDeleteDialog business={deleteTarget}
      onClose={() => setDeleteTarget(null)}
      onSuccess={message => { setDeleteTarget(null); setNotice(message); setRevision(value => value + 1); }}/>} 
    {visibilityTarget && <AdminBusinessVisibilityDialog business={visibilityTarget.business} action={visibilityTarget.action}
      onClose={() => setVisibilityTarget(null)} onSuccess={message => { setVisibilityTarget(null); setNotice(message); setRevision(value => value + 1); }}/>} 
  </div>;
}

export function AdminBusinessDetailPage() {
  const allowed = getSession()?.permissions?.includes('business:write') ?? false;
  const canDelete = getSession()?.role === 'SUPER_ADMIN';
  const navigate = useNavigate();
  const [deleteTarget, setDeleteTarget] = useState<AdminBusinessRecord | null>(null);
  const [visibilityAction, setVisibilityAction] = useState<AdminVisibilityAction | null>(null);
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState('');
  const { id = '' } = useParams();
  const [item, setItem] = useState<AdminBusinessRecord | null>(null);
  const [loading, setLoading] = useState(allowed);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!allowed) return;
    let active = true;
    getAdminBusiness(id).then(result => { if (active) setItem(result); }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'No se pudo consultar el negocio.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [allowed, id, revision]);
  if (!allowed) return <StatePanel kind="error" title="Acceso restringido" message="Necesitas permiso para consultar negocios." />;
  if (loading) return <StatePanel kind="loading" title="Cargando negocio" message="Consultando el registro real." />;
  if (error || !item) return <StatePanel kind="error" title="No se pudo abrir el negocio" message={error || 'No encontramos el registro.'} />;
  return <div className="admin-business-detail admin-business-detail-refreshed">
    {notice && <p className="ad-ops-detail-notice" role="status">{notice}</p>}
    <Link className="ad-business-detail-back" to="/businesses"><Icon name="arrow" size={17} /> Volver al directorio</Link>
    <header className="ad-business-detail-hero">
      <span className="ad-business-detail-icon"><Icon name="store" size={31} /></span>
      <div><span className="ad-business-detail-eyebrow">FICHA ADMINISTRATIVA</span><h1>{item.name}</h1><p>Registro de negocio · Actualizado el {date(item.updatedAt)}</p></div>
      {canDelete && item.deletionStatus !== 'DELETED' && <div className="ad-ops-detail-actions">
        {item.administrativeRestriction ? <>
          {item.administrativeRestriction === 'HIDDEN' && <button type="button" className="ad-ops-suspend-action" onClick={() => setVisibilityAction('SUSPEND')}><Icon name="lock" size={17}/> Suspender</button>}
          {item.administrativeRestriction === 'SUSPENDED' && <button type="button" onClick={() => setVisibilityAction('HIDE')}><Icon name="eye-off" size={17}/> Cambiar a ocultamiento</button>}
          <button type="button" className="ad-ops-restore-action" onClick={() => setVisibilityAction('RESTORE')}><Icon name="check" size={17}/> Levantar restricción</button>
        </>
          : <><button type="button" onClick={() => setVisibilityAction('HIDE')}><Icon name="eye-off" size={17}/> Ocultar</button>
            <button type="button" className="ad-ops-suspend-action" onClick={() => setVisibilityAction('SUSPEND')}><Icon name="lock" size={17}/> Suspender</button></>}
        <button type="button" className="ad-business-delete-trigger" onClick={() => setDeleteTarget(item)}><Icon name="trash" size={17}/> Eliminar negocio</button>
      </div>}
    </header>
    <section className="admin-business-facts ad-business-detail-highlights" aria-label="Estado del negocio">
      <article><span><Icon name="eye" size={18} /> Visibilidad</span><strong className={'business-status-text ' + (item.administrativeRestriction === 'SUSPENDED' ? 'status-expired' : item.administrativeRestriction === 'HIDDEN' ? 'status-hidden' : (visibilityTone[item.visibilityStatus] ?? 'status-review'))}>{adminBusinessVisibilityLabel(item)}</strong></article>
      <article><span><Icon name="shield" size={18} /> Verificación</span><strong className={'business-status-text ' + (verificationTone[item.verificationStatus] ?? 'status-information')}>{translatedStatus(verificationLabels, item.verificationStatus)}</strong></article>
      <article><span><Icon name="check" size={18} /> Completitud</span><strong>{item.completeness}%</strong></article>
      <article><span><Icon name="crown" size={18} /> Suscripción</span><strong>{item.isPro ? 'Business PRO' : 'Plan Básico'}</strong></article>
      <article><span><Icon name="flag" size={18} /> Reportes recibidos</span><strong>{item._count?.reports ?? 0}</strong></article>
    </section>
    <section className="panel admin-business-information ad-business-detail-information" aria-labelledby="ad-business-detail-info-title">
      <div className="ad-business-detail-section-heading"><span className="ad-business-detail-section-icon"><Icon name="grid" size={22} /></span>
        <div><h2 id="ad-business-detail-info-title">Información general</h2><p>Datos registrados y disponibles para consulta administrativa.</p></div>
      </div>
      <dl>
        <div><dt>Nombre del negocio</dt><dd>{item.name}</dd></div>
        <div><dt>Categoría</dt><dd>{categoryName(item.category)}</dd></div>
        <div><dt>Propietario actual</dt><dd>{item.memberships?.[0]?.user?.displayName || 'No registrado'}</dd></div>
        <div><dt>Registrado por</dt><dd>{item.createdBy.displayName || 'No registrado'}</dd></div>
        <div><dt>ID público</dt><dd className="ad-ops-id">{item.publicId}</dd></div>
        <div><dt>Publicación</dt><dd>{item.publicationStatus}</dd></div>
        <div><dt>Productos y servicios</dt><dd>{item._count?.offers ?? 0} publicaciones registradas</dd></div>
        <div><dt>Opiniones</dt><dd>{item._count?.reviews ?? 0} registros</dd></div>
        <div><dt>Cuentas vinculadas</dt><dd>{item._count?.memberships ?? 0} miembros</dd></div>
        <div><dt>Fecha de registro</dt><dd>{date(item.createdAt)}</dd></div>
        <div><dt>Ubicación</dt><dd>{item.location ? [item.location.address, item.location.cityName, item.location.countryCode].filter(Boolean).join(', ') : 'No registrada'}</dd></div>
        <div><dt>Correo electrónico</dt><dd>{item.email ?? 'No registrado'}</dd></div>
        <div><dt>Teléfono</dt><dd>{item.phone ?? 'No registrado'}</dd></div>
        <div className="ad-business-detail-description"><dt>Descripción</dt><dd>{item.description ?? 'No registrada'}</dd></div>
      </dl>
    </section>
    {item.administrativeRestriction && <div className="ad-ops-restriction-status" role="status">
      <Icon name="shield" size={19}/><div><strong>Restricción administrativa vigente</strong>
        <p>Medida: {item.administrativeRestriction === 'SUSPENDED' ? 'Suspensión' : 'Ocultamiento'}.
          {item.administrativeRestrictedAt ? ' Desde ' + date(item.administrativeRestrictedAt) : ''}
          {item.administrativeRestrictionReason ? ' · Motivo: ' + item.administrativeRestrictionReason : ''}</p>
      </div>
    </div>}
    <AdminBusinessAuditTimeline businessId={item.id} revision={revision} />
    {visibilityAction && <AdminBusinessVisibilityDialog business={item} action={visibilityAction}
      onClose={() => setVisibilityAction(null)}
      onSuccess={message => { setVisibilityAction(null); setNotice(message); setRevision(n => n + 1); }}/>}
    {deleteTarget && <AdminBusinessDeleteDialog business={deleteTarget}
      onClose={() => setDeleteTarget(null)}
      onSuccess={() => navigate("/businesses", { replace: true })}/>}
  </div>;
}
