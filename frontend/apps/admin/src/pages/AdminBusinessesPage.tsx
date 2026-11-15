import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { getAdminBusiness, getAdminDashboardStats, listAdminBusinesses, type AdminBusinessPage, type AdminBusinessRecord, type AdminDashboardStats } from '../services/adminApiClient';
import { StatePanel } from '../components/common';
import { Icon } from '../components/Icon';
import { getSession } from '../services/adminService';
import { AdminBusinessGrowthPanel } from './AdminBusinessGrowthPanel';
import './AdminBusinessesRefresh.css';

const PAGE_SIZE = 10;
const date = (value: string) => new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value));
const count = (value: number) => value.toLocaleString('es-CO');
const categoryName = (category: AdminBusinessRecord['category']) =>
  category.translations.find(item => item.locale === 'es-CO')?.name ??
  category.translations.find(item => item.locale === 'es')?.name ??
  category.translations[0]?.name ?? category.code ?? 'Sin categoría';
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
    const csv = [fields, ...rows.map(item => [item.name, categoryName(item.category), translatedStatus(visibilityStatusLabels, item.visibilityStatus), date(item.createdAt)])]
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

    <header className="businesses-hero" aria-labelledby="businesses-page-title">
      <div className="businesses-hero-copy">
        <span className="businesses-hero-eyebrow">DIRECTORIO · CONTROL Y CRECIMIENTO</span>
        <div className="businesses-hero-heading">
          <span className="businesses-hero-icon"><Icon name="store" size={31} /></span>
          <div><h1 id="businesses-page-title">Negocios</h1><p>Gestiona tu directorio, supervisa sus estados y analiza el crecimiento de la plataforma desde un mismo lugar.</p></div>
        </div>
      </div>
      <svg className="businesses-hero-art" viewBox="0 0 420 148" aria-hidden="true" focusable="false">
        <defs><linearGradient id="businesses-hero-fill" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#dbe7ff" /><stop offset="100%" stopColor="#ede4ff" /></linearGradient></defs>
        <path d="M65 119C38 112 27 82 46 64c10-9 23-10 33-6C93 21 135 18 158 45c23-24 62-15 71 12 32-10 65 16 57 46-4 15-15 26-32 30H87c-9 0-16-5-22-14Z" fill="url(#businesses-hero-fill)" opacity=".8"/>
        <rect x="109" y="52" width="105" height="76" rx="10" fill="#fff" stroke="#adc5ff" strokeWidth="3"/>
        <path d="M98 62l17-25h93l17 25" fill="#7450e7" stroke="#5941cb" strokeWidth="3" strokeLinejoin="round"/>
        <path d="M100 62q12 17 26 0 12 17 26 0 13 17 26 0 13 17 26 0 12 17 22 0" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round"/>
        <rect x="131" y="88" width="34" height="40" rx="5" fill="#dbe6ff"/>
        <rect x="175" y="88" width="27" height="23" rx="4" fill="#e9e4ff"/>
        <path d="M232 116h133" stroke="#98b4f1" strokeWidth="2" strokeDasharray="5 6"/>
        <path d="M245 100l28-27 27 9 27-45 35-10" fill="none" stroke="#285ff0" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="273" cy="73" r="6" fill="#fff" stroke="#285ff0" strokeWidth="3"/>
        <circle cx="300" cy="82" r="6" fill="#fff" stroke="#285ff0" strokeWidth="3"/>
        <circle cx="327" cy="37" r="6" fill="#fff" stroke="#285ff0" strokeWidth="3"/>
        <circle cx="362" cy="27" r="7" fill="#fff" stroke="#743fff" strokeWidth="3"/>
      </svg>
    </header>

    <section className="business-stats businesses-summary" aria-label="Resumen de negocios">
      {(statValues.length ? statValues : [
        { label: 'Total negocios', value: null, icon: 'store', tone: 'purple', percent: null },
        { label: 'Activos', value: null, icon: 'check', tone: 'green', percent: null },
        { label: 'En revisión', value: null, icon: 'clock', tone: 'blue', percent: null },
        { label: 'Inactivos', value: null, icon: 'close', tone: 'red', percent: null },
      ]).map(item => <article className={`business-stat businesses-stat ${item.tone}`} key={item.label}>
        <span className="businesses-stat-icon"><Icon name={item.icon} size={22} /></span><div><span>{item.label}</span><strong>{item.value === null ? '—' : count(item.value)}</strong></div>
        {item.percent !== null && <small>{item.percent.toLocaleString('es-CO', { maximumFractionDigits: 1 })}%</small>}
      </article>)}
    </section>

    <section className="panel business-directory businesses-directory">
      <div className="directory-heading businesses-directory-heading"><div><h2>Listado de negocios</h2><p>Administra, consulta y gestiona los negocios registrados en XAMUKO.</p></div><div className="businesses-actions"><button className="secondary-button" onClick={exportBusinesses} disabled={!rows.length} title="Exporta los negocios visibles en la página actual"><Icon name="download" size={17} /> Exportar página</button><a className="primary businesses-create" href="https://business.xamuko.com"><span aria-hidden="true">＋</span> Crear negocio</a></div></div>
      <form className="businesses-toolbar" onSubmit={event => { event.preventDefault(); setFilter('q', input.trim()); }}>
        <label className="directory-search"><Icon name="search" size={18} /><input aria-label="Buscar por nombre del negocio" placeholder="Buscar por nombre del negocio…" value={input} onChange={event => setInput(event.target.value)} /></label>
        <label className="businesses-status-filter"><span className="sr-only">Estado</span><select value={status} onChange={event => setFilter('status', event.target.value)}><option value="">Todos los estados</option><option value="active">Activos</option><option value="review">En revisión</option><option value="inactive">Inactivos</option></select></label>
        <button type="button" className="secondary-button businesses-clear" onClick={() => { setInput(''); setParams({}); }} disabled={!q && !status}><Icon name="refresh" size={16} /> Limpiar</button>
      </form>
      {loading ? <StatePanel kind="loading" title="Cargando negocios" message="Consultando registros reales." /> : error ? <StatePanel kind="error" title="No pudimos cargar los negocios" message={error} retry={() => setRevision(value => value + 1)} /> : data && <>
        {rows.length === 0 ? <div className="businesses-empty"><StoreIllustration /><h2>No se encontraron negocios</h2><p>Intenta ajustar los filtros de búsqueda o crear un nuevo negocio.</p><a className="primary businesses-create empty-create" href="https://business.xamuko.com"><span aria-hidden="true">＋</span> Crear primer negocio</a></div> : <>
          <div className="business-table-wrap"><table className="business-table businesses-table"><caption className="sr-only">Listado de negocios de XAMUKO</caption><thead><tr><th>#</th><th>Negocio</th><th>Categoría</th><th>Visibilidad</th><th>Registro</th><th>Acciones</th></tr></thead><tbody>{rows.map((item: AdminBusinessRecord, index: number) => {
            const category = categoryName(item.category);
            const tone = visibilityTone[item.visibilityStatus] ?? 'status-review';
            return <tr key={item.id}><td className="business-number">#{String((page - 1) * PAGE_SIZE + index + 1).padStart(3, '0')}</td><td><Link to={`/businesses/${item.id}`} className="business-cell"><span className="business-avatar"><Icon name="store" size={18} /></span><div><strong>{item.name}</strong><small>{item.createdBy.displayName || 'Administrador'}</small></div></Link></td><td><span className="business-category"><Icon name="grid" size={14} />{category}</span></td><td><span className={`badge ${tone}`}><span aria-hidden="true">●</span> {translatedStatus(visibilityStatusLabels, item.visibilityStatus)}</span></td><td className="business-date">{date(item.createdAt)}</td><td><div className="business-row-actions"><Link className="icon-button businesses-view" to={`/businesses/${item.id}`} aria-label={`Ver ${item.name}`}><Icon name="eye" size={18} /></Link></div></td></tr>;
          })}</tbody></table></div>
          <div className="business-mobile-list businesses-mobile-list">{rows.map(item => <Link to={`/businesses/${item.id}`} className="business-mobile-card" key={item.id}><div className="mobile-business-heading"><span className="business-avatar"><Icon name="store" size={18} /></span><div><strong>{item.name}</strong><small>{categoryName(item.category)} · {item.location?.cityName ?? 'Sin ubicación'}</small></div><Icon name="arrow" size={17} /></div><div className="mobile-business-badges"><span className={`badge ${visibilityTone[item.visibilityStatus] ?? 'status-review'}`}>{translatedStatus(visibilityStatusLabels, item.visibilityStatus)}</span></div><small className="mobile-expiry">Registro: {date(item.createdAt)}</small></Link>)}</div>
          <div className="business-pagination businesses-pagination"><span>Mostrando {(page - 1) * PAGE_SIZE + 1}–{Math.min((page - 1) * PAGE_SIZE + rows.length, total)} de {count(total)} negocios</span><div><button className="secondary-button page-arrow" aria-label="Página anterior" disabled={page <= 1} onClick={() => goToPage(page - 1)}>‹</button>{pageNumbers.map(number => <button className={`page-number ${page === number ? 'selected' : ''}`} key={number} aria-current={page === number ? 'page' : undefined} onClick={() => goToPage(number)}>{number}</button>)}{totalPages > 3 && <><span className="page-ellipsis">…</span><button className="page-number" onClick={() => goToPage(totalPages)}>{totalPages}</button></>}<button className="secondary-button page-arrow" aria-label="Página siguiente" disabled={page >= totalPages} onClick={() => goToPage(page + 1)}>›</button></div></div>
        </>}
      </>}
    </section>
    <AdminBusinessGrowthPanel />
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
  return <div className="admin-business-detail admin-business-detail-refreshed">
    <Link className="ad-business-detail-back" to="/businesses"><Icon name="arrow" size={17} /> Volver al directorio</Link>
    <header className="ad-business-detail-hero">
      <span className="ad-business-detail-icon"><Icon name="store" size={31} /></span>
      <div><span className="ad-business-detail-eyebrow">FICHA ADMINISTRATIVA</span><h1>{item.name}</h1><p>Registro de negocio · Actualizado el {date(item.updatedAt)}</p></div>
    </header>
    <section className="admin-business-facts ad-business-detail-highlights" aria-label="Estado del negocio">
      <article><span><Icon name="eye" size={18} /> Visibilidad</span><strong className={'business-status-text ' + (visibilityTone[item.visibilityStatus] ?? 'status-review')}>{translatedStatus(visibilityStatusLabels, item.visibilityStatus)}</strong></article>
      <article><span><Icon name="shield" size={18} /> Verificación</span><strong className={'business-status-text ' + (verificationTone[item.verificationStatus] ?? 'status-information')}>{translatedStatus(verificationLabels, item.verificationStatus)}</strong></article>
      <article><span><Icon name="check" size={18} /> Completitud</span><strong>{item.completeness}%</strong></article>
    </section>
    <section className="panel admin-business-information ad-business-detail-information" aria-labelledby="ad-business-detail-info-title">
      <div className="ad-business-detail-section-heading"><span className="ad-business-detail-section-icon"><Icon name="grid" size={22} /></span>
        <div><h2 id="ad-business-detail-info-title">Información general</h2><p>Datos registrados y disponibles para consulta administrativa.</p></div>
      </div>
      <dl>
        <div><dt>Nombre del negocio</dt><dd>{item.name}</dd></div>
        <div><dt>Categoría</dt><dd>{categoryName(item.category)}</dd></div>
        <div><dt>Registrado por</dt><dd>{item.createdBy.displayName || 'No registrado'}</dd></div>
        <div><dt>Fecha de registro</dt><dd>{date(item.createdAt)}</dd></div>
        <div><dt>Ubicación</dt><dd>{item.location ? [item.location.address, item.location.cityName, item.location.countryCode].filter(Boolean).join(', ') : 'No registrada'}</dd></div>
        <div><dt>Correo electrónico</dt><dd>{item.email ?? 'No registrado'}</dd></div>
        <div><dt>Teléfono</dt><dd>{item.phone ?? 'No registrado'}</dd></div>
        <div className="ad-business-detail-description"><dt>Descripción</dt><dd>{item.description ?? 'No registrada'}</dd></div>
      </dl>
    </section>
  </div>;
}
