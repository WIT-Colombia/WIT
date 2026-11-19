import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { Link, useSearchParams } from 'react-router-dom';
import { AdminPageHeading } from '../components/AdminPageHeading';
import { Icon } from '../components/Icon';
import { StatePanel } from '../components/common';
import { getSession } from '../services/adminService';
import {
  adminBusinessVisibilityLabel, changeAdminBusinessPlan, getAdminBusinessesFilterOptions,
  getAdminBusinessesOverview, getAdminDashboardStats, getAdminVisibilityAudit,
  listAdminBusinesses,
  type AdminBusinessRecord, type AdminBusinessPage, type AdminBusinessOverview,
  type AdminDashboardStats, type AdminVisibilityAuditResult,
  type AdminBusinessFilterOptions,
} from '../services/adminApiClient';
import { adminDirectoryPageSummary } from '../utils/adminDirectoryPagination';
import './AdminPlansPage.css';

const PAGE_SIZE = 15;
type Plan = 'BASIC' | 'PRO';
const number = (value: number) => value.toLocaleString('es-CO');
const date = (value: string) => new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'medium', timeZone: 'America/Bogota',
}).format(new Date(value));
const dateTime = (value: string) => new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Bogota',
}).format(new Date(value));
const displayPlan = (value: Plan) => value === 'PRO' ? 'Business PRO' : 'Básico';
const planOf = (business: AdminBusinessRecord): Plan => business.isPro ? 'PRO' : 'BASIC';

function PlanDecisionDialog({ business, close, completed }: {
  business: AdminBusinessRecord; close: () => void; completed: (message: string) => void;
}) {
  const next: Plan = business.isPro ? 'BASIC' : 'PRO';
  const [reason, setReason] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const ref = useRef<HTMLElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    const prior = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    cancelRef.current?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) { event.preventDefault(); closeRef.current(); }
      if (event.key !== 'Tab') return;
      const options = [...ref.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled),input:not(:disabled),textarea:not(:disabled)',
      ) ?? []].filter(item => item.getClientRects().length > 0);
      if (!options.length) return;
      const first = options[0], last = options[options.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', onKey);
      prior?.focus({ preventScroll: true });
    };
  }, [busy]);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || reason.trim().length < 12 || reason.trim().length > 500 || confirmation !== next) return;
    setBusy(true); setError('');
    try {
      const result = await changeAdminBusinessPlan(business.id, next, reason.trim(), confirmation);
      completed(result.message);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible cambiar el plan.');
      setBusy(false);
    }
  };
  return createPortal(<div className="aps-dialog-backdrop" onMouseDown={e => {
    if (e.target === e.currentTarget && !busy) closeRef.current();
  }}>
    <section className="aps-dialog" ref={ref} role="dialog" aria-modal="true"
      aria-labelledby="aps-dialog-title" aria-describedby="aps-dialog-description">
      <div className="aps-dialog-top"><span className="aps-dialog-icon"><Icon name="crown" size={23}/></span>
        <button type="button" className="aps-close" aria-label="Cerrar" disabled={busy} onClick={close}>
          <Icon name="close" size={19}/>
        </button></div>
      <h2 id="aps-dialog-title">Cambiar plan de negocio</h2>
      <p className="aps-dialog-business">{business.name} · {business.publicId}</p>
      <div className="aps-decision-grid"><div><small>Plan actual</small><strong>{displayPlan(planOf(business))}</strong></div>
        <Icon name="arrow" size={20}/><div><small>Nuevo plan</small><strong>{displayPlan(next)}</strong></div></div>
      <p id="aps-dialog-description" className="aps-dialog-description">
        {next === 'PRO'
          ? 'Se activará Business PRO de forma administrativa, sin cargo ni renovación automática. Es una activación especial sin fecha de vencimiento.'
          : 'Se revocarán las suscripciones PRO efectivas del negocio. No se modificarán sus publicaciones ni se generará un reembolso.'}
        {' '}El cambio se registrará en auditoría y se notificará a los propietarios.
      </p>
      <form onSubmit={event => void submit(event)}>
        <label htmlFor="aps-reason">Motivo administrativo obligatorio (12 a 500 caracteres)</label>
        <textarea id="aps-reason" required minLength={12} maxLength={500} value={reason}
          onChange={event => setReason(event.target.value)} rows={4}
          placeholder="Explica la decisión con hechos verificables." disabled={busy}/>
        <label htmlFor="aps-confirmation">Escribe <strong>{next}</strong> para confirmar el cambio</label>
        <input id="aps-confirmation" value={confirmation} onChange={event => setConfirmation(event.target.value)}
          autoComplete="off" placeholder={next} disabled={busy} required/>
        {error && <p className="aps-dialog-error" role="alert">{error}</p>}
        <div className="aps-dialog-actions">
          <button ref={cancelRef} type="button" className="aps-secondary" disabled={busy} onClick={close}>Cancelar</button>
          <button type="submit" className="aps-primary" disabled={busy || confirmation !== next || reason.trim().length < 12 || reason.trim().length > 500}>
            {busy ? 'Guardando decisión…' : 'Confirmar cambio de plan'}
          </button>
        </div>
      </form>
    </section>
  </div>, document.body);
}

export function AdminPlansPage() {
  const admin = getSession();
  const allowed = admin?.permissions?.includes('business:write') ?? false;
  const canManage = allowed && admin?.role === 'SUPER_ADMIN';
  const canAudit = admin?.permissions?.includes('audit:read') ?? false;
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const plan = params.get('plan') ?? '';
  const city = params.get('city') ?? '';
  const order = params.get('order') ?? '';
  const requestedPage = Number(params.get('page') ?? '1');
  const page = Number.isFinite(requestedPage) ? Math.max(1, Math.min(100000, Math.floor(requestedPage))) : 1;
  const [search, setSearch] = useState(q);
  const [listing, setListing] = useState<AdminBusinessPage | null>(null);
  const [overview, setOverview] = useState<AdminBusinessOverview | null>(null);
  const [statistics, setStatistics] = useState<AdminDashboardStats | null>(null);
  const [options, setOptions] = useState<AdminBusinessFilterOptions>({ categories: [], cities: [] });
  const [loading, setLoading] = useState(true);
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [error, setError] = useState('');
  const [metricsError, setMetricsError] = useState('');
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState('');
  const [target, setTarget] = useState<AdminBusinessRecord | null>(null);
  const [audit, setAudit] = useState<AdminVisibilityAuditResult | null>(null);
  const [auditPage, setAuditPage] = useState(1);
  const [auditError, setAuditError] = useState('');
  const [auditLoading, setAuditLoading] = useState(false);

  useEffect(() => { setSearch(q); }, [q]);
  useEffect(() => {
    if (!allowed) return;
    let active = true;
    setLoading(true); setError('');
    void listAdminBusinesses(q, page, PAGE_SIZE, '', { plan, city, order })
      .then(result => { if (active) setListing(result); })
      .catch(cause => { if (active) { setListing(null); setError(cause instanceof Error ? cause.message : 'No se pudo consultar el directorio.'); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [allowed, q, page, plan, city, order, revision]);
  useEffect(() => {
    if (!allowed) return;
    let active = true;
    setLoadingMetrics(true); setMetricsError('');
    void Promise.allSettled([getAdminBusinessesOverview(), getAdminDashboardStats()])
      .then(([businessResult, dashboardResult]) => {
        if (!active) return;
        setOverview(businessResult.status === 'fulfilled' ? businessResult.value : null);
        setStatistics(dashboardResult.status === 'fulfilled' ? dashboardResult.value : null);
        if (businessResult.status !== 'fulfilled' || dashboardResult.status !== 'fulfilled')
          setMetricsError('No todos los indicadores están disponibles. Los datos faltantes se muestran con —.');
      }).finally(() => { if (active) setLoadingMetrics(false); });
    return () => { active = false; };
  }, [allowed, revision]);
  useEffect(() => {
    if (!allowed) return;
    let active = true;
    void getAdminBusinessesFilterOptions().then(value => { if (active) setOptions(value); }).catch(() => {});
    return () => { active = false; };
  }, [allowed]);
  useEffect(() => {
    if (!allowed || !canAudit) return;
    let active = true;
    setAuditLoading(true); setAuditError('');
    void getAdminVisibilityAudit({ page: auditPage, kind: 'SUBSCRIPTION', search: '' })
      .then(value => { if (active) setAudit(value); })
      .catch(cause => { if (active) { setAudit(null); setAuditError(cause instanceof Error ? cause.message : 'No se pudo consultar la auditoría.'); } })
      .finally(() => { if (active) setAuditLoading(false); });
    return () => { active = false; };
  }, [allowed, canAudit, auditPage, revision]);

  const apply = (key: 'q' | 'plan' | 'city' | 'order', value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    next.delete('page');
    setParams(next, { replace: true });
  };
  const changePage = (targetPage: number) => {
    const next = new URLSearchParams(params);
    if (targetPage <= 1) next.delete('page'); else next.set('page', String(targetPage));
    setParams(next);
  };
  const clear = () => { setSearch(''); setParams({}, { replace: true }); };
  const submitted = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); apply('q', search.trim());
  };
  const completed = (message: string) => {
    setTarget(null); setNotice(message); setRevision(value => value + 1); setAuditPage(1);
  };
  const csv = () => {
    if (!listing?.businesses.length) return;
    const cell = (value: string) => '"' + (/^[=+\-@\t\r\n]/.test(value) ? "'" : '') + value.replaceAll('"','""') + '"';
    const rows = [['Negocio', 'Identificador', 'Plan efectivo', 'Ciudad', 'Visibilidad', 'Registro'],
      ...listing.businesses.map(b => [b.name, b.publicId, displayPlan(planOf(b)),
        b.location?.cityName ?? '', adminBusinessVisibilityLabel(b), date(b.createdAt)])];
    const content = '\ufeff' + rows.map(row => row.map(cell).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = 'xamuko-admin-planes-pagina.csv'; a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  if (!allowed) return <StatePanel kind="error" title="Acceso restringido"
    message="Necesitas permiso de consulta de negocios para ver planes y suscripciones."/>;
  const indicators = [
    { id: 'total', label: 'Negocios registrados', value: overview?.total, icon: 'store', tone: 'violet',
      caption: 'Negocios no eliminados', plan: '' },
    { id: 'pro', label: 'Business PRO vigente', value: overview?.pro, icon: 'crown', tone: 'blue',
      caption: 'Plan PRO efectivo en este momento', plan: 'pro' },
    { id: 'pending', label: 'PRO pendiente', value: statistics?.subscriptions.proPending, icon: 'clock', tone: 'amber',
      caption: 'Negocios con solicitud pendiente; pueden coincidir con PRO', plan: null },
    { id: 'expiring', label: 'PRO por vencer', value: statistics?.subscriptions.proExpiring30Days, icon: 'calendar', tone: 'rose',
      caption: 'Planes PRO con vencimiento en 30 días; incluidos en PRO vigente', plan: null },
  ] as const;

  return <main className="aps-page">
    <AdminPageHeading icon="crown" title="Planes y suscripciones"
      description="Consulta los planes de negocios y gestiona los cambios administrativos de Business PRO con información real."
      actions={<div className="aps-header-actions">
        <Link to="/businesses" className="aps-button aps-button-outline"><Icon name="store" size={17}/> Ver negocios</Link>
        <button type="button" className="aps-button aps-button-primary" onClick={() => { setNotice(''); setRevision(v => v+1); }}>
          <Icon name="refresh" size={17}/> Actualizar datos
        </button>
      </div>}/>
    {notice && <div className="aps-notice" role="status"><Icon name="check" size={18}/>{notice}</div>}
    <section aria-label="Indicadores de suscripciones" className="aps-kpis">
      {indicators.map(item => item.plan !== null
        ? <button key={item.id} type="button" aria-pressed={plan === item.plan && !city && !q && !order}
          onClick={() => { clear(); if (item.plan) setParams({ plan: item.plan }, { replace: true }); }}
          className={'aps-kpi aps-kpi-'+item.tone+(plan === item.plan && !city && !q && !order ? ' selected' : '')}>
          <span className="aps-kpi-icon"><Icon name={item.icon} size={25}/></span>
          <span className="aps-kpi-body"><span>{item.label}</span><strong aria-busy={loadingMetrics}>{typeof item.value === 'number' ? number(item.value) : '—'}</strong>
            <small>{item.caption}</small></span>
        </button>
        : <article key={item.id} className={'aps-kpi aps-kpi-'+item.tone}>
          <span className="aps-kpi-icon"><Icon name={item.icon} size={25}/></span>
          <div className="aps-kpi-body"><span>{item.label}</span><strong aria-busy={loadingMetrics}>{typeof item.value === 'number' ? number(item.value) : '—'}</strong>
            <small>{item.caption}</small></div>
        </article>)}
    </section>
    {metricsError && <p className="aps-warning" role="status"><Icon name="shield" size={16}/>{metricsError}</p>}
    <section className="aps-plans-overview" aria-label="Planes que utiliza XAMUKO">
      <article className="aps-plan-definition">
        <div className="aps-plan-icon aps-plan-basic"><Icon name="store" size={22}/></div>
        <div><h2>Básico</h2><p>Negocios sin una suscripción Business PRO vigente. No equivale a una suscripción de pago registrada.</p></div>
        <button type="button" onClick={() => { clear(); setParams({ plan: 'basic' }, { replace: true }); }}>
          Ver negocios <Icon name="arrow" size={16}/>
        </button>
      </article>
      <article className="aps-plan-definition aps-plan-definition-pro">
        <div className="aps-plan-icon aps-plan-pro"><Icon name="crown" size={22}/></div>
        <div><h2>Business PRO</h2><p>Negocios con una activación PRO efectiva. Una asignación administrativa no genera cobros ni renovación automática.</p></div>
        <button type="button" onClick={() => { clear(); setParams({ plan: 'pro' }, { replace: true }); }}>
          Ver negocios <Icon name="arrow" size={16}/>
        </button>
      </article>
    </section>
    <section className="aps-directory" aria-labelledby="aps-directory-title">
      <header className="aps-panel-head"><div><span className="aps-eyebrow">GESTIÓN REAL DE NEGOCIOS</span>
        <h2 id="aps-directory-title">Directorio por plan</h2>
        <p>Busca negocios y consulta su plan vigente. Los cambios se realizan únicamente con autorización administrativa.</p></div>
        <button className="aps-button aps-button-outline" type="button" onClick={csv}
          disabled={loading || !listing?.businesses.length}><Icon name="download" size={16}/> Exportar página</button>
      </header>
      <form className="aps-filters" onSubmit={submitted}>
        <label className="aps-field aps-field-search"><span>Buscar negocio</span><div className="aps-search-wrap"><Icon name="search" size={18}/>
          <input type="search" value={search} onChange={event => setSearch(event.target.value)}
            aria-label="Buscar negocios por nombre o identificador" placeholder="Nombre, ID o propietario…"/></div></label>
        <label className="aps-field"><span>Plan efectivo</span><select aria-label="Filtrar por plan" value={plan} onChange={event => apply('plan', event.target.value)}>
          <option value="">Todos los planes</option><option value="pro">Business PRO</option><option value="basic">Sin PRO vigente</option>
        </select></label>
        <label className="aps-field"><span>Ciudad</span><select aria-label="Filtrar por ciudad" value={city} onChange={event => apply('city', event.target.value)}>
          <option value="">Todas las ciudades</option>{options.cities.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select></label>
        <label className="aps-field"><span>Ordenar</span><select aria-label="Ordenar negocios" value={order} onChange={event => apply('order', event.target.value)}>
          <option value="">Más recientes</option><option value="oldest">Más antiguos</option><option value="name">Nombre A–Z</option><option value="city">Ciudad</option>
        </select></label>
        <div className="aps-filter-actions">
          <button className="aps-button aps-button-outline" type="button" onClick={clear}>Limpiar</button>
          <button className="aps-button aps-button-primary" type="submit"><Icon name="search" size={16}/> Buscar</button>
        </div>
      </form>
      <div className="aps-result-bar"><strong>{loading ? 'Consultando negocios…'
        : listing ? number(listing.pagination.total) + (listing.pagination.total === 1 ? ' negocio encontrado' : ' negocios encontrados') : 'Directorio'}</strong>
        <span>{listing && !loading ? adminDirectoryPageSummary(listing.pagination, listing.businesses.length, 'negocios')
          : 'Datos consultados desde XAMUKO'}</span></div>
      {loading ? <StatePanel kind="loading" title="Consultando planes" message="Cargando registros reales de los negocios."/>
        : error ? <StatePanel kind="error" title="No se pudo cargar el directorio" message={error} retry={() => setRevision(v => v+1)}/>
        : listing?.businesses.length === 0 ? <StatePanel kind="empty" title="No hay coincidencias" message="No hay negocios que coincidan con estos filtros."/>
        : <div className="aps-table-wrap"><table className="aps-table">
          <thead><tr><th>Negocio</th><th>Plan vigente</th><th>Ciudad</th><th>Visibilidad</th><th>Registro</th><th>Acciones</th></tr></thead>
          <tbody>{listing?.businesses.map(b => <tr key={b.id}>
            <td><div className="aps-business-name"><span className="aps-business-avatar"><Icon name="store" size={20}/></span>
              <span><Link to={'/businesses/'+encodeURIComponent(b.id)}>{b.name}</Link><small>{b.publicId}</small></span></div></td>
            <td><span className={'aps-plan-badge '+(b.isPro?'pro':'basic')}><Icon name={b.isPro?'crown':'store'} size={15}/>
              {displayPlan(planOf(b))}</span></td>
            <td>{b.location?.cityName ?? 'Sin ciudad'}</td>
            <td><span className="aps-visibility">{adminBusinessVisibilityLabel(b)}</span></td>
            <td>{date(b.createdAt)}</td>
            <td><div className="aps-row-actions"><Link className="aps-row-link" to={'/businesses/'+encodeURIComponent(b.id)}>
              <Icon name="eye" size={16}/> Ver ficha</Link>
              {canManage && <button className="aps-row-change" type="button" onClick={() => setTarget(b)}>
                <Icon name="refresh" size={16}/> Cambiar plan</button>}
            </div></td>
          </tr>)}</tbody>
        </table></div>}
      {listing && listing.pagination.totalPages > 1 && <nav className="aps-pagination" aria-label="Páginas de planes">
        <span>Página {page} de {listing.pagination.totalPages}</span><div>
          <button className="aps-button aps-button-outline" type="button" disabled={loading || page<=1}
            onClick={() => changePage(page-1)}>Anterior</button>
          <button className="aps-button aps-button-primary" type="button" disabled={loading || page>=listing.pagination.totalPages}
            onClick={() => changePage(page+1)}>Siguiente <Icon name="arrow" size={15}/></button>
        </div></nav>}
      {!canManage && <p className="aps-readonly"><Icon name="shield" size={16}/> La asignación manual de planes está reservada al administrador principal.</p>}
    </section>
    {canAudit && <section className="aps-history" id="aps-history" aria-labelledby="aps-history-title">
      <header className="aps-panel-head"><div><span className="aps-eyebrow">TRAZABILIDAD ADMINISTRATIVA</span>
        <h2 id="aps-history-title">Cambios administrativos de plan</h2>
        <p>Registros de asignaciones manuales. No es un historial de facturación ni incluye todas las renovaciones comerciales.</p></div>
        <button className="aps-button aps-button-outline" type="button" onClick={() => { setAuditPage(1); setRevision(v => v+1); }}>
          <Icon name="refresh" size={16}/> Actualizar</button>
      </header>
      {auditLoading ? <p className="aps-history-state" role="status">Consultando auditoría…</p>
        : auditError ? <p className="aps-history-state" role="alert">{auditError}</p>
        : audit?.entries.length === 0 ? <p className="aps-history-state">No hay cambios administrativos de plan registrados.</p>
        : <div className="aps-history-list">{audit?.entries.map(item => <article className="aps-history-item" key={item.id}>
          <span className="aps-history-icon"><Icon name="shield" size={19}/></span>
          <div><div className="aps-history-heading"><strong>{item.business
            ? <Link to={'/businesses/'+encodeURIComponent(item.business.id)}>{item.business.name}</Link>
            : 'Negocio no disponible'}</strong><time dateTime={item.createdAt}>{dateTime(item.createdAt)}</time></div>
            <p>Plan: {item.previousState?.plan === 'PRO' ? 'Business PRO' : item.previousState?.plan === 'BASIC' ? 'Básico' : 'No registrado'}
              {' → '}
              {item.newState?.plan === 'PRO' ? 'Business PRO' : item.newState?.plan === 'BASIC' ? 'Básico' : 'No registrado'}</p>
            <small>{item.actor?.displayName ?? 'Sistema'} · {item.reason ?? 'Sin motivo visible'}</small>
          </div>
        </article>)}</div>}
      {audit && audit.pagination.totalPages > 1 && <nav className="aps-pagination" aria-label="Páginas de auditoría">
        <span>Página {auditPage} de {audit.pagination.totalPages}</span><div>
          <button className="aps-button aps-button-outline" type="button" disabled={auditLoading || auditPage<=1} onClick={() => setAuditPage(v=>v-1)}>Anterior</button>
          <button className="aps-button aps-button-outline" type="button" disabled={auditLoading || auditPage>=audit.pagination.totalPages} onClick={() => setAuditPage(v=>v+1)}>Siguiente</button>
        </div></nav>}
    </section>}
    <p className="aps-source-note"><Icon name="shield" size={17}/>
      <span>Fuente: directorio y resumen de negocios, estadísticas administrativas y auditoría de XAMUKO.
      PRO vigente no significa pago confirmado. Las solicitudes pendientes y los próximos vencimientos pueden coincidir con negocios ya contabilizados.
      XAMUKO Plus, precios, ingresos, facturación y pagos no se calculan aquí porque estos servicios no tienen una API operativa en esta pantalla.</span>
    </p>
    {target && <PlanDecisionDialog business={target} close={() => setTarget(null)} completed={completed}/>}
  </main>;
}
