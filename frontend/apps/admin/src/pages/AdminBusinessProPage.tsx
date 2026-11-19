import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AdminPageHeading } from '../components/AdminPageHeading';
import { Icon } from '../components/Icon';
import { StatePanel } from '../components/common';
import { getSession } from '../services/adminService';
import {
  getAdminBusinessesOverview, getAdminDashboardStats, listAdminSubscriptions,
  type AdminBusinessOverview, type AdminDashboardStats, type AdminSubscriptionsPage,
  type AdminSubscriptionRecord,
} from '../services/adminApiClient';
import './AdminPlansPage.css';
import './AdminBusinessProPage.css';

type View = 'ALL' | 'EFFECTIVE' | 'EXPIRING_30_DAYS' | 'SPECIAL_EFFECTIVE' | 'PENDING';
const views: Array<{ value: View; label: string; summary: string }> = [
  { value: 'EFFECTIVE', label: 'PRO vigente', summary: 'Suscripciones con vigencia efectiva ahora' },
  { value: 'EXPIRING_30_DAYS', label: 'Por vencer', summary: 'Vigentes que vencen dentro de 30 días' },
  { value: 'SPECIAL_EFFECTIVE', label: 'Activaciones especiales', summary: 'Activaciones administrativas especiales vigentes' },
  { value: 'PENDING', label: 'Pendientes', summary: 'Solicitudes con estado PENDING registrado' },
  { value: 'ALL', label: 'Todo el historial', summary: 'Incluye registros vigentes y no vigentes' },
];
const number = (n: number) => n.toLocaleString('es-CO');
const date = (value: string | null) => value ? new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'medium', timeZone: 'America/Bogota',
}).format(new Date(value)) : 'No definida';
const stateLabel: Record<AdminSubscriptionRecord['status'], string> = {
  PENDING: 'Pendiente', ACTIVE: 'Activa registrada', EXPIRED: 'Vencida', REVOKED: 'Revocada',
};
const csvCell = (value: string) => '"' + (/^[\s]*[=+\-@]/.test(value) ? "'" : '') + value.replaceAll('"', '""') + '"';

export function AdminBusinessProPage() {
  const admin = getSession();
  const allowed = admin?.permissions?.includes('business:write') ?? false;
  const canManage = allowed && admin?.role === 'SUPER_ADMIN';
  const [params, setParams] = useSearchParams();
  const requestedView = (params.get('view') ?? 'EFFECTIVE').toUpperCase();
  const view: View = views.some(option => option.value === requestedView) ? requestedView as View : 'EFFECTIVE';
  const q = params.get('q') ?? '';
  const requestedPage = Number(params.get('page') ?? 1);
  const page = Number.isFinite(requestedPage) ? Math.max(1, Math.min(100000, Math.floor(requestedPage))) : 1;
  const [search, setSearch] = useState(q);
  const [result, setResult] = useState<AdminSubscriptionsPage | null>(null);
  const [overview, setOverview] = useState<AdminBusinessOverview | null>(null);
  const [dashboard, setDashboard] = useState<AdminDashboardStats | null>(null);
  const [specialCount, setSpecialCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [error, setError] = useState('');
  const [metricsError, setMetricsError] = useState('');
  const [revision, setRevision] = useState(0);

  useEffect(() => { setSearch(q); }, [q]);
  useEffect(() => {
    if (!allowed) return;
    let active = true;
    setLoading(true); setError('');
    void listAdminSubscriptions({
      view: view === 'PENDING' ? 'ALL' : view,
      status: view === 'PENDING' ? 'PENDING' : '',
      q, page,
    }).then(data => { if (active) setResult(data); })
      .catch(reason => {
        if (active) {
          setResult(null);
          setError(reason instanceof Error ? reason.message : 'No pudimos consultar Business PRO.');
        }
      }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [allowed, q, view, page, revision]);
  useEffect(() => {
    if (!allowed) return;
    let active = true;
    setMetricsLoading(true); setMetricsError('');
    void Promise.allSettled([
      getAdminBusinessesOverview(), getAdminDashboardStats(),
      listAdminSubscriptions({ view: 'SPECIAL_EFFECTIVE', page: 1 }),
    ]).then(([businesses, stats, special]) => {
      if (!active) return;
      setOverview(businesses.status === 'fulfilled' ? businesses.value : null);
      setDashboard(stats.status === 'fulfilled' ? stats.value : null);
      setSpecialCount(special.status === 'fulfilled' ? special.value.pagination.total : null);
      if (businesses.status !== 'fulfilled' || stats.status !== 'fulfilled' || special.status !== 'fulfilled') {
        setMetricsError('Algunos indicadores no se pudieron consultar. Los valores desconocidos aparecen como —.');
      }
    }).finally(() => { if (active) setMetricsLoading(false); });
    return () => { active = false; };
  }, [allowed, revision]);

  const updateQuery = (next: { view?: View; q?: string; page?: number }) => {
    const query = new URLSearchParams(params);
    if (next.view !== undefined) {
      if (next.view === 'EFFECTIVE') query.delete('view'); else query.set('view', next.view);
      query.delete('page');
    }
    if (next.q !== undefined) {
      if (next.q) query.set('q', next.q); else query.delete('q');
      query.delete('page');
    }
    if (next.page !== undefined) {
      if (next.page <= 1) query.delete('page'); else query.set('page', String(next.page));
    }
    setParams(query, { replace: true });
  };
  const searchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); updateQuery({ q: search.trim() });
  };
  const download = () => {
    if (!result?.subscriptions.length) return;
    const rows = [['Negocio','Identificador','Estado registrado','PRO efectivo','Inicio','Vencimiento','Renovación automática','Activación especial'],
      ...result.subscriptions.map(s => [
        s.business.name, s.business.publicId, s.status, s.effective ? 'Sí' : 'No',
        date(s.startsAt), date(s.expiresAt), s.autoRenew ? 'Sí' : 'No', s.specialActivation ? 'Sí' : 'No',
      ])];
    const blob = new Blob(['\ufeff' + rows.map(row => row.map(csvCell).join(';')).join('\r\n')], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'xamuko-business-pro-pagina.csv';
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  if (!allowed) return <StatePanel kind="error" title="Acceso restringido"
    message="Necesitas autorización de consulta de negocios para acceder a Business PRO."/>;
  const stats: Array<{ view: View; label: string; count: number | null | undefined; icon: string; tone: string; note: string }> = [
    { view: 'EFFECTIVE', label: 'Negocios con PRO vigente', count: overview?.pro, icon: 'crown', tone: 'violet',
      note: 'Negocios únicos con PRO efectivo ahora' },
    { view: 'PENDING', label: 'PRO pendiente', count: dashboard?.subscriptions.proPending, icon: 'clock', tone: 'amber',
      note: 'Negocios con al menos una solicitud pendiente' },
    { view: 'EXPIRING_30_DAYS', label: 'Vencen en 30 días', count: dashboard?.subscriptions.proExpiring30Days,
      icon: 'calendar', tone: 'rose', note: 'Negocios únicos con PRO próximo a vencer' },
    { view: 'SPECIAL_EFFECTIVE', label: 'Activaciones especiales', count: specialCount, icon: 'star', tone: 'blue',
      note: 'Registros de activación especial con vigencia efectiva' },
  ];
  return <main className="aps-page abp-page">
    <AdminPageHeading title="Business PRO" icon="crown"
      description="Controla la vigencia de las suscripciones PRO con los registros actuales de XAMUKO."
      actions={<div className="aps-header-actions">
        <button className="aps-button aps-button-primary" type="button" onClick={() => setRevision(i => i+1)}>
          <Icon name="refresh" size={16}/> Actualizar
        </button>
      </div>} />
    <section aria-label="Indicadores reales Business PRO" className="aps-kpis abp-kpis">
      {stats.map(item => <button type="button" key={item.view} aria-pressed={view === item.view}
        className={'aps-kpi aps-kpi-'+item.tone+(view === item.view ? ' selected' : '')}
        onClick={() => updateQuery({ view: item.view })}>
        <span className="aps-kpi-icon"><Icon name={item.icon} size={25}/></span>
        <span className="aps-kpi-body"><span>{item.label}</span>
          <strong aria-busy={metricsLoading}>{typeof item.count === 'number' ? number(item.count) : '—'}</strong>
          <small>{item.note}</small></span>
      </button>)}
    </section>
    {metricsError && <div className="aps-warning" role="status"><Icon name="shield" size={16}/>{metricsError}</div>}
    <section className="aps-subscriptions abp-register" aria-labelledby="abp-register-title">
      <header className="aps-panel-head"><div><span className="aps-eyebrow">REGISTRO VERIFICABLE · BUSINESS PRO</span>
        <h2 id="abp-register-title">Seguimiento de suscripciones</h2>
        <p>Filtra los registros existentes según su estado y vigencia. Cada fila corresponde a una suscripción almacenada, no a un pago.</p>
      </div><button type="button" className="aps-button aps-button-outline" onClick={download}
        disabled={loading || !result?.subscriptions.length}>
        <Icon name="download" size={16}/> Exportar página
      </button></header>
      <div className="abp-view-tabs" role="group" aria-label="Vistas de Business PRO">
        {views.map(item => <button type="button" key={item.value} title={item.summary}
          aria-pressed={view === item.value} onClick={() => updateQuery({ view: item.value })}>
          {item.label}
        </button>)}
      </div>
      <form className="abp-filters" onSubmit={searchSubmit}>
        <label className="aps-field"><span>Buscar por nombre o identificador del negocio</span>
          <span className="aps-search-wrap"><Icon name="search" size={18}/>
            <input type="search" aria-label="Buscar negocios Business PRO" value={search}
              onChange={event => setSearch(event.target.value)} maxLength={100}
              placeholder="Nombre o ID del negocio…"/></span></label>
        <button type="button" className="aps-button aps-button-outline" onClick={() => {
          setSearch(''); updateQuery({ q: '', view: 'EFFECTIVE' });
        }}>Limpiar</button>
        <button type="submit" className="aps-button aps-button-primary"><Icon name="search" size={16}/> Buscar</button>
      </form>
      <div className="aps-result-bar">
        <strong>{loading ? 'Consultando suscripciones…' : result
          ? number(result.pagination.total) + (result.pagination.total === 1 ? ' registro encontrado' : ' registros encontrados')
          : 'Registro de Business PRO'}</strong>
        <span>{views.find(item => item.value === view)?.summary}</span>
      </div>
      {loading ? <p className="aps-history-state" role="status">Consultando el registro real de Business PRO…</p>
        : error ? <div className="abp-error" role="alert">
          <Icon name="shield" size={21}/>
          <p>{error}. Esta sección necesita que la versión del backend esté actualizada.</p>
          <button type="button" className="aps-button aps-button-outline" onClick={() => setRevision(i => i+1)}>
            Reintentar
          </button>
        </div>
        : !result?.subscriptions.length ? <div className="abp-empty">
            <Icon name="search" size={28}/>
            <strong>Sin registros en esta vista</strong>
            <p>No hay suscripciones que coincidan con los filtros seleccionados.</p>
            <button type="button" className="aps-button aps-button-outline" onClick={() => {
              setSearch(''); setParams({}, { replace:true });
            }}>Ver PRO vigente</button>
          </div>
        : <>
          <div className="aps-subscription-table-wrap"><table className="aps-table aps-subscriptions-table">
            <thead><tr><th>Negocio</th><th>Estado registrado</th><th>Vigencia efectiva</th>
              <th>Inicio</th><th>Vencimiento</th><th>Renovación</th><th>Acción</th></tr></thead>
            <tbody>{result.subscriptions.map(s => <tr key={s.id}>
              <td><div className="aps-subscription-business">
                <Link to={'/businesses/'+encodeURIComponent(s.business.id)}>{s.business.name}</Link>
                <small>{s.business.publicId}{s.business.deletionStatus === 'DELETED' ? ' · Negocio eliminado' : ''}</small>
              </div></td>
              <td><span className={'aps-record-status '+s.status.toLowerCase()}>{stateLabel[s.status]}</span></td>
              <td><span className={'aps-effective '+(s.effective ? 'is-effective':'not-effective')}>
                <Icon name={s.effective ? 'check' : 'clock'} size={15}/>
                {s.effective ? 'PRO efectivo' : 'No efectivo'}</span>
                {s.specialActivation && <small className="aps-sub-detail">Activación especial</small>}
              </td>
              <td>{date(s.startsAt)}</td>
              <td>{s.expiresAt ? date(s.expiresAt) : s.specialActivation ? 'Sin vencimiento' : 'Sin fecha definida'}</td>
              <td><strong className="aps-renewal">{s.autoRenew ? 'Sí' : 'No'}</strong></td>
              <td><div className="aps-row-actions">
                <Link className="aps-row-link" to={'/businesses/'+encodeURIComponent(s.business.id)}>
                  <Icon name="eye" size={15}/> Ficha
                </Link>
                {canManage && s.business.deletionStatus !== 'DELETED' &&
                  <Link className="aps-row-change" to={'/plans?q='+encodeURIComponent(s.business.publicId)}>
                    <Icon name="refresh" size={15}/> Gestionar plan
                  </Link>}
              </div></td>
            </tr>)}</tbody>
          </table></div>
          <div className="aps-subscription-cards">{result.subscriptions.map(s => <article key={s.id}>
            <header><Link to={'/businesses/'+encodeURIComponent(s.business.id)}>{s.business.name}</Link>
              <small>{s.business.publicId}{s.business.deletionStatus === 'DELETED' ? ' · Negocio eliminado' : ''}</small>
            </header>
            <div className="aps-subscription-card-badges">
              <span className={'aps-record-status '+s.status.toLowerCase()}>{stateLabel[s.status]}</span>
              <span className={'aps-effective '+(s.effective?'is-effective':'not-effective')}>
                {s.effective ? 'PRO efectivo' : 'No efectivo'}</span>
            </div>
            <dl>
              <div><dt>Inicio</dt><dd>{date(s.startsAt)}</dd></div>
              <div><dt>Vencimiento</dt><dd>{s.expiresAt ? date(s.expiresAt) : s.specialActivation ? 'Sin vencimiento' : 'Sin fecha definida'}</dd></div>
              <div><dt>Renovación automática</dt><dd>{s.autoRenew ? 'Sí':'No'}</dd></div>
              <div><dt>Activación especial</dt><dd>{s.specialActivation ? 'Sí':'No'}</dd></div>
              {s.revocationReason && <div className="aps-revocation-reason"><dt>Motivo de revocación</dt><dd>{s.revocationReason}</dd></div>}
            </dl>
            <div className="abp-card-actions">
              <Link className="aps-row-link" to={'/businesses/'+encodeURIComponent(s.business.id)}>Ver ficha</Link>
              {canManage && s.business.deletionStatus !== 'DELETED' &&
                <Link className="aps-row-change" to={'/plans?q='+encodeURIComponent(s.business.publicId)}>Gestionar plan</Link>}
            </div>
          </article>)}</div>
        </>}
      {result && result.pagination.totalPages > 1 && <nav className="aps-pagination" aria-label="Páginas de Business PRO">
        <span>Página {page} de {result.pagination.totalPages}</span>
        <div><button type="button" className="aps-button aps-button-outline" disabled={page <= 1 || loading}
          onClick={() => updateQuery({ page: page-1 })}>Anterior</button>
          <button type="button" className="aps-button aps-button-primary" disabled={page >= result.pagination.totalPages || loading}
            onClick={() => updateQuery({ page: page+1 })}>Siguiente <Icon name="arrow" size={15}/></button></div>
      </nav>}
      <p className="aps-ledger-note"><Icon name="shield" size={16}/>
        La vigencia efectiva se calcula con estado ACTIVE, fecha de inicio, vencimiento y ausencia de revocación.
        Las vistas son filtros derivados; no modifican estados. No se deducen ingresos, cobros ni renovaciones efectivamente pagadas.</p>
    </section>
    <div className="abp-info-line">
      <Icon name="info" size={18}/>
      <p>Los indicadores de PRO vigente, pendiente y por vencer cuentan <strong>negocios únicos</strong>.
        El listado y el indicador de activaciones especiales cuentan <strong>registros de suscripción</strong>.
        Estas cantidades no deben sumarse entre sí.</p>
    </div>
  </main>;
}
