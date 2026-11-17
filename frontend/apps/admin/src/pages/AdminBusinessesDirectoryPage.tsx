import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { StatePanel } from '../components/common';
import { AdminBusinessCoverPhoto } from '../components/businesses/AdminBusinessCoverPhoto';
import { getSession } from '../services/adminService';
import {
  getAdminBusinessesOverview, getAdminBusinessesFilterOptions, getAdminDashboardStats,
  listAdminBusinesses, type AdminBusinessPage, type AdminBusinessesFilters,
  type AdminBusinessOverview, type AdminDashboardStats, type AdminBusinessRecord,
  type AdminBusinessFilterOptions,
} from '../services/adminApiClient';
import { adminDirectoryPageSummary } from '../utils/adminDirectoryPagination';
import './AdminBusinessesDirectoryPage.css';

const PAGE_SIZE = 10;
const number = (value: number) => value.toLocaleString('es-CO');
const shortDate = (value: string) => new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
const categoryName = (value: AdminBusinessRecord['category']) =>
  value.translations.find(t => t.locale === 'es-CO')?.name ??
  value.translations.find(t => t.locale === 'es')?.name ??
  value.translations[0]?.name ?? value.code ?? 'Sin categoría';

const verificationState: Record<string, { label: string; className: string; icon: string }> = {
  APPROVED: { label: 'Verificado', className: 'verified', icon: 'check' },
  PENDING: { label: 'En verificación', className: 'pending', icon: 'clock' },
  INFORMATION: { label: 'Información solicitada', className: 'pending', icon: 'clock' },
  REJECTED: { label: 'Rechazado', className: 'rejected', icon: 'close' },
  NONE: { label: 'Sin verificar', className: 'none', icon: 'shield' },
};
const statusOf = (value: string) => verificationState[value] ??
  { label: 'Estado desconocido', className: 'none', icon: 'shield' };

/** Compact numbered pagination with current-page neighbours and accurate ellipses. */
export function businessDirectoryPages(current: number, total: number): Array<number | '…'> {
  const last = Math.max(1, total);
  const near = Array.from({ length: 5 }, (_, index) => Math.max(2, Math.min(last - 4, current - 2)) + index);
  const items = [...new Set([1, last, ...near.filter(n => n > 1 && n < last)])].sort((a,b) => a-b);
  const result: Array<number | '…'> = [];
  items.forEach((value, index) => {
    if (index > 0 && value > items[index - 1] + 1) result.push('…');
    result.push(value);
  });
  return result;
}

function VerificationBadge({ value }: { value: string }) {
  const status = statusOf(value);
  return <span className={'abv1-status ' + status.className}>
    <Icon name={status.icon} size={15} />{status.label}
  </span>;
}

export function AdminBusinessesPage() {
  const allowed = getSession()?.permissions?.includes('business:write') ?? false;
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const pageParam = Number(params.get('page') ?? 1);
  const page = Number.isFinite(pageParam) ? Math.max(1, Math.min(100000, Math.floor(pageParam))) : 1;
  const [input, setInput] = useState(q);
  const [data, setData] = useState<AdminBusinessPage | null>(null);
  const [loading, setLoading] = useState(allowed);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [overview, setOverview] = useState<AdminBusinessOverview | null>(null);
  const [legacy, setLegacy] = useState<AdminDashboardStats | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(allowed);
  const [filterOptions, setFilterOptions] = useState<AdminBusinessFilterOptions>({ cities: [], categories: [] });
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const advanced: AdminBusinessesFilters = {
    city: params.get('city') ?? '',
    categoryId: params.get('categoryId') ?? '',
    verification: params.get('verification') ?? '',
    status: params.get('status') ?? '',
    visibility: params.get('visibility') ?? '',
    plan: params.get('plan') ?? '',
    restriction: params.get('restriction') ?? '',
    from: params.get('from') ?? '',
    to: params.get('to') ?? '',
    order: params.get('order') ?? '',
  };
  const filtersKey = [...params.entries()].filter(([key]) => key !== 'page')
    .sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => key + '=' + value).join('&');
  const filtersActive = [...params.entries()].filter(([key, value]) => key !== 'page' && !!value).length;

  useEffect(() => { setInput(q); }, [q]);
  useEffect(() => {
    if (!allowed) return;
    let active = true;
    setLoading(true);
    setError('');
    void listAdminBusinesses(q, page, PAGE_SIZE, advanced.status, advanced).then(value => {
      if (active) setData(value);
    }).catch(cause => {
      if (active) { setData(null); setError(cause instanceof Error ? cause.message : 'No pudimos consultar los negocios.'); }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [allowed, q, page, filtersKey, revision]);

  useEffect(() => {
    if (!allowed) return;
    let active = true;
    setOverviewLoading(true);
    void getAdminBusinessesOverview().then(value => {
      if (active) { setOverview(value); setLegacy(null); }
    }).catch(() => {
      if (!active) return;
      setOverview(null);
      void getAdminDashboardStats().then(value => { if (active) setLegacy(value); })
        .catch(() => { if (active) setLegacy(null); });
    }).finally(() => { if (active) setOverviewLoading(false); });
    return () => { active = false; };
  }, [allowed, revision]);

  useEffect(() => {
    if (!allowed) return;
    let active = true;
    void getAdminBusinessesFilterOptions().then(value => { if (active) setFilterOptions(value); }).catch(() => {});
    return () => { active = false; };
  }, [allowed]);

  function setFilter(key: keyof AdminBusinessesFilters, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    next.delete('page');
    setParams(next, { replace: true });
  }
  function clearFilters() {
    setInput('');
    setParams({}, { replace: true });
  }
  function goToPage(nextPage: number) {
    const next = new URLSearchParams(params);
    if (nextPage <= 1) next.delete('page'); else next.set('page', String(nextPage));
    setParams(next);
  }
  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFilter('q', input.trim());
  }
  const totalPages = Math.max(1, data?.pagination.totalPages ?? 1);
  const rows = data?.businesses ?? [];
  const cards = [
    { key: 'total', title: 'Total de negocios', value: overview?.total ?? legacy?.totals.businesses, icon: 'store', tone: 'purple' },
    { key: 'verified', title: 'Verificados', value: overview?.verified ?? legacy?.totals.businessesVerified, icon: 'check', tone: 'green' },
    { key: 'pending', title: 'En verificación', value: overview?.pendingVerification, icon: 'clock', tone: 'yellow' },
    { key: 'rejected', title: 'Rechazados', value: overview?.rejectedVerification, icon: 'close', tone: 'red' },
  ] as const;

  if (!allowed) return <StatePanel kind="error" title="Acceso restringido" message="Necesitas permiso para consultar negocios." />;

  const sortColumn = (label: string, order: string) =>
    <button type="button" className="abv1-sort" onClick={() => setFilter('order', advanced.order === order ? '' : order)}
      aria-label={'Ordenar por ' + label} aria-pressed={advanced.order === order}>
      {label}<span aria-hidden="true">↕</span>
    </button>;

  return <div className="businesses-page abv1">
    <header className="abv1-heading">
      <span className="abv1-heading-icon"><Icon name="store" size={32} /></span>
      <div><h1 id="businesses-page-title">Negocios</h1><p>Gestiona, verifica y administra los negocios registrados en Xamuko.</p></div>
    </header>

    <section className="abv1-kpis" aria-label="Indicadores de negocios registrados">
      {cards.map(card => <article className={'abv1-kpi abv1-kpi-' + card.tone} key={card.key}>
        <span className="abv1-kpi-icon"><Icon name={card.icon} size={27}/></span>
        <div><span>{card.title}</span><strong aria-busy={overviewLoading}>
          {overviewLoading ? '…' : card.value === undefined ? '—' : number(card.value)}
        </strong></div>
      </article>)}
    </section>

    <section className="abv1-directory" aria-labelledby="businesses-page-title">
      <form className="abv1-toolbar" onSubmit={submitSearch} role="search">
        <label className="abv1-search"><Icon name="search" size={20}/>
          <input aria-label="Buscar negocio por nombre, ID, propietario o ciudad"
            placeholder="Buscar negocio por nombre, ID o ciudad…" value={input} onChange={event => setInput(event.target.value)} />
        </label>
        <label className="abv1-select"><Icon name="pin" size={19}/><span className="sr-only">Ciudad</span>
          <select value={advanced.city} aria-label="Filtrar por ciudad" onChange={event => setFilter('city', event.target.value)}>
            <option value="">Todas las ciudades</option>
            {filterOptions.cities.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <label className="abv1-select"><Icon name="layers" size={19}/><span className="sr-only">Estado de verificación</span>
          <select value={advanced.verification} aria-label="Filtrar por estado de verificación" onChange={event => setFilter('verification', event.target.value)}>
            <option value="">Todos los estados</option>
            <option value="APPROVED">Verificados</option>
            <option value="PENDING">Pendientes de verificación</option>
            <option value="INFORMATION">Información solicitada</option>
            <option value="REJECTED">Rechazados</option>
            <option value="NONE">Sin verificar</option>
          </select>
        </label>
        <button className="abv1-more-filters" type="button" aria-controls="abv1-advanced" aria-expanded={advancedOpen}
          onClick={() => setAdvancedOpen(open => !open)}><Icon name="filter" size={19}/> Más filtros{filtersActive > 0 && <span>{filtersActive}</span>}</button>
      </form>
      {advancedOpen && <div className="abv1-advanced" id="abv1-advanced">
        <label>Categoría<select value={advanced.categoryId} onChange={event => setFilter('categoryId', event.target.value)}>
          <option value="">Todas las categorías</option>{filterOptions.categories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select></label>
        <label>Publicación<select value={advanced.status} onChange={event => setFilter('status', event.target.value)}>
          <option value="">Todas</option><option value="active">Publicados</option><option value="review">En revisión</option>
          <option value="inactive">No publicados</option><option value="deleted">Eliminados</option>
        </select></label>
        <label>Visibilidad<select value={advanced.visibility} onChange={event => setFilter('visibility', event.target.value)}>
          <option value="">Todas</option><option value="VISIBLE">Visibles</option><option value="HIDDEN">Ocultos</option>
          <option value="EXPIRED">Vencidos</option><option value="REVIEW">En revisión</option><option value="ADMIN_HIDDEN">Restringidos por Admin</option>
        </select></label>
        <label>Suscripción<select value={advanced.plan} onChange={event => setFilter('plan', event.target.value)}>
          <option value="">Todos los planes</option><option value="pro">Business PRO</option><option value="basic">Básico</option>
        </select></label>
        <label>Medida administrativa<select value={advanced.restriction} onChange={event => setFilter('restriction', event.target.value)}>
          <option value="">Todas</option><option value="NONE">Sin medida</option><option value="HIDDEN">Ocultamiento</option><option value="SUSPENDED">Suspensión</option>
        </select></label>
        <label>Registro desde<input type="date" value={advanced.from} max={advanced.to || undefined} onChange={event => setFilter('from', event.target.value)} /></label>
        <label>Registro hasta<input type="date" value={advanced.to} min={advanced.from || undefined} onChange={event => setFilter('to', event.target.value)} /></label>
        <label>Orden<select value={advanced.order} onChange={event => setFilter('order', event.target.value)}>
          <option value="">Más recientes</option><option value="oldest">Más antiguos</option><option value="name">Nombre A–Z</option>
          <option value="city">Ciudad A–Z</option><option value="category">Categoría A–Z</option><option value="verification">Estado de verificación</option>
        </select></label>
        <button type="button" className="abv1-clear" disabled={!filtersActive} onClick={clearFilters}>
          <Icon name="refresh" size={16}/> Limpiar filtros
        </button>
      </div>}

      {loading ? <StatePanel kind="loading" title="Cargando negocios" message="Consultando los registros reales de Xamuko."/> :
        error ? <StatePanel kind="error" title="No pudimos cargar los negocios" message={error} retry={() => setRevision(n => n + 1)}/> :
        data && (rows.length === 0 ? <div className="abv1-empty"><Icon name="store" size={38}/><h2>No se encontraron negocios</h2><p>Prueba con otra búsqueda o ajusta los filtros.</p></div> : <>
        <div className="abv1-table-wrap"><table className="abv1-table">
          <caption className="sr-only">Directorio de negocios de Xamuko</caption>
          <thead><tr>
            <th>{sortColumn('Negocio', 'name')}</th>
            <th>{sortColumn('Ciudad', 'city')}</th>
            <th>{sortColumn('Categoría', 'category')}</th>
            <th>{sortColumn('Registro', 'oldest')}</th>
            <th>{sortColumn('Estado', 'verification')}</th>
            <th>Acciones</th>
          </tr></thead>
          <tbody>{rows.map(item => <tr key={item.id}>
            <td><Link to={'/businesses/' + encodeURIComponent(item.id)} className="abv1-business">
              <AdminBusinessCoverPhoto photoId={item.coverPhotoId} name={item.name}/>
              <span><strong>{item.name}</strong><small>ID: {item.publicId}</small></span>
            </Link></td>
            <td><span className="abv1-city"><Icon name="pin" size={16}/>{item.location?.cityName ?? 'Sin ciudad'}</span></td>
            <td><span className="abv1-category">{categoryName(item.category)}</span></td>
            <td><span className="abv1-date"><Icon name="calendar" size={16}/>{shortDate(item.createdAt)}</span></td>
            <td><VerificationBadge value={item.verificationStatus}/></td>
            <td className="abv1-action-cell"><Link className="abv1-view" to={'/businesses/' + encodeURIComponent(item.id)}
              aria-label={'Ver detalles de ' + item.name} title="Ver detalles">
              <Icon name="eye" size={20}/>
            </Link></td>
          </tr>)}</tbody>
        </table></div>
        <div className="abv1-mobile-list">{rows.map(item => <article className="abv1-mobile-card" key={item.id}>
          <div className="abv1-mobile-card-top"><Link to={'/businesses/' + encodeURIComponent(item.id)} className="abv1-business">
            <AdminBusinessCoverPhoto photoId={item.coverPhotoId} name={item.name}/>
            <span><strong>{item.name}</strong><small>ID: {item.publicId}</small></span>
          </Link><Link className="abv1-view" to={'/businesses/' + encodeURIComponent(item.id)}
            aria-label={'Ver detalles de ' + item.name} title="Ver detalles"><Icon name="eye" size={20}/></Link></div>
          <div className="abv1-mobile-card-info"><span className="abv1-city"><Icon name="pin" size={16}/>{item.location?.cityName ?? 'Sin ciudad'}</span>
            <span className="abv1-category">{categoryName(item.category)}</span></div>
          <div className="abv1-mobile-card-bottom"><VerificationBadge value={item.verificationStatus}/><span className="abv1-date"><Icon name="calendar" size={15}/>{shortDate(item.createdAt)}</span></div>
        </article>)}</div>
        </>)}

      {data && !loading && !error && <nav className="abv1-pagination" aria-label="Paginación de negocios">
        <span>{adminDirectoryPageSummary(data.pagination, rows.length, 'negocios')}</span>
        <div><button type="button" className="abv1-page" aria-label="Página anterior" disabled={page <= 1} onClick={() => goToPage(page-1)}>‹</button>
          {businessDirectoryPages(page, totalPages).map((item,index) => item === '…'
            ? <span className="abv1-ellipsis" key={'ellipsis-'+index}>…</span>
            : <button type="button" className={'abv1-page' + (page === item ? ' selected' : '')} key={item}
                aria-current={page === item ? 'page' : undefined} onClick={() => goToPage(item)}>{item}</button>)}
          <button type="button" className="abv1-page" aria-label="Página siguiente" disabled={page >= totalPages} onClick={() => goToPage(page+1)}>›</button>
        </div>
      </nav>}
    </section>
  </div>;
}
