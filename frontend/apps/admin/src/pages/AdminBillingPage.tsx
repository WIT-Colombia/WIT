import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AdminPageHeading } from '../components/AdminPageHeading';
import { FinanceSectionNav } from '../components/FinanceSectionNav';
import { Icon } from '../components/Icon';
import { StatePanel } from '../components/common';
import { getSession } from '../services/adminService';
import {
  getAdminDashboardStats, listAdminSubscriptions,
  type AdminDashboardStats, type AdminSubscriptionRecord, type AdminSubscriptionsPage,
} from '../services/adminApiClient';
import './AdminBillingPage.css';

const number = (value: number) => value.toLocaleString('es-CO');
const date = (value: string | null) => value
  ? new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeZone: 'America/Bogota' }).format(new Date(value))
  : 'No definida';
const states: Array<{ value: AdminSubscriptionRecord['status'] | ''; label: string }> = [
  { value: '', label: 'Todos los estados' },
  { value: 'ACTIVE', label: 'Activa registrada' },
  { value: 'PENDING', label: 'Pendiente' },
  { value: 'EXPIRED', label: 'Vencida' },
  { value: 'REVOKED', label: 'Revocada' },
];
const statusLabel: Record<AdminSubscriptionRecord['status'], string> = {
  ACTIVE: 'Activa registrada', PENDING: 'Pendiente', EXPIRED: 'Vencida', REVOKED: 'Revocada',
};
const csvCell = (value: string) => '"' +
  (/^\s*[=+\-@]/.test(value) ? "'" : '') + value.replaceAll('"', '""') + '"';

export function AdminBillingPage() {
  const session = getSession();
  const allowed = session?.permissions?.includes('finance:read') ?? false;
  const canReadBusinesses = session?.permissions?.includes('business:write') ?? false;
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const requestedStatus = params.get('status') ?? '';
  const status = states.some(item => item.value === requestedStatus) ? requestedStatus : '';
  const requestedPage = Number(params.get('page') ?? '1');
  const page = Number.isFinite(requestedPage) ? Math.max(1, Math.min(100000, Math.floor(requestedPage))) : 1;
  const [draft, setDraft] = useState(q);
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(allowed);
  const [summaryError, setSummaryError] = useState('');
  const [records, setRecords] = useState<AdminSubscriptionsPage | null>(null);
  const [recordsLoading, setRecordsLoading] = useState(allowed && canReadBusinesses);
  const [recordsError, setRecordsError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => { setDraft(q); }, [q]);

  useEffect(() => {
    if (!allowed) return;
    let mounted = true;
    setSummaryLoading(true); setSummaryError('');
    void getAdminDashboardStats().then(value => {
      if (mounted) setStats(value);
    }).catch(cause => {
      if (mounted) {
        setStats(null);
        setSummaryError(cause instanceof Error ? cause.message : 'No se pudo consultar el resumen administrativo.');
      }
    }).finally(() => { if (mounted) setSummaryLoading(false); });
    return () => { mounted = false; };
  }, [allowed, revision]);

  useEffect(() => {
    if (!allowed || !canReadBusinesses) return;
    let mounted = true;
    setRecordsLoading(true); setRecordsError('');
    void listAdminSubscriptions({ page, q, status }).then(value => {
      if (mounted) setRecords(value);
    }).catch(cause => {
      if (mounted) {
        setRecords(null);
        setRecordsError(cause instanceof Error ? cause.message : 'No se pudo consultar el registro.');
      }
    }).finally(() => { if (mounted) setRecordsLoading(false); });
    return () => { mounted = false; };
  }, [allowed, canReadBusinesses, page, q, status, revision]);

  function updateFilter(changes: { q?: string; status?: string; page?: number }) {
    const next = new URLSearchParams(params);
    if (changes.q !== undefined) {
      if (changes.q) next.set('q', changes.q); else next.delete('q');
      next.delete('page');
    }
    if (changes.status !== undefined) {
      if (changes.status) next.set('status', changes.status); else next.delete('status');
      next.delete('page');
    }
    if (changes.page !== undefined) {
      if (changes.page > 1) next.set('page', String(changes.page)); else next.delete('page');
    }
    setParams(next, { replace: true });
  }
  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateFilter({ q: draft.trim() });
  }
  function reset() {
    setDraft('');
    setParams({}, { replace: true });
  }
  function exportOperationalCsv() {
    if (!records?.subscriptions.length) return;
    const rows = [
      ['Negocio', 'Identificador', 'Plan registrado', 'Estado registrado', 'Vigencia efectiva',
        'Fecha de inicio', 'Fecha de vencimiento', 'Renovación automática', 'Activación especial'],
      ...records.subscriptions.map(item => [
        item.business.name, item.business.publicId, item.plan, item.status,
        item.effective ? 'Sí' : 'No', date(item.startsAt), date(item.expiresAt),
        item.autoRenew ? 'Sí' : 'No', item.specialActivation ? 'Sí' : 'No',
      ]),
    ];
    const text = '\ufeff' + rows.map(row => row.map(csvCell).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'xamuko-actividad-comercial-pagina.csv';
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  if (!allowed) return <StatePanel kind="error" title="Acceso restringido"
    message="Necesitas el permiso FINANCE_READ para consultar Ingresos y facturación."/>;

  const commercial = [
    { label: 'Negocios con PRO vigente', value: stats?.subscriptions.proActive,
      note: 'Negocios únicos con suscripción efectiva', icon: 'crown', tone: 'purple' },
    { label: 'PRO pendiente', value: stats?.subscriptions.proPending,
      note: 'Negocios únicos con solicitud pendiente', icon: 'clock', tone: 'orange' },
    { label: 'PRO por vencer', value: stats?.subscriptions.proExpiring30Days,
      note: 'Negocios únicos; próximos 30 días', icon: 'calendar', tone: 'blue' },
  ];
  const monetary = [
    { label: 'Ingresos confirmados', note: 'No hay una API de recaudos comerciales conectada', icon: 'card' },
    { label: 'Facturación emitida', note: 'No existe un registro de facturas a clientes', icon: 'file' },
    { label: 'Cartera por cobrar', note: 'No hay obligaciones comerciales registradas', icon: 'chart' },
    { label: 'Pagos por conciliar', note: 'No existe un registro de pagos entrantes', icon: 'clock' },
  ];

  return <main className="abill-page">
    <AdminPageHeading title="Ingresos y facturación" icon="card"
      description="Estado financiero comercial y seguimiento de suscripciones, con datos verificables."
      actions={<div className="abill-heading-actions">
        <Link className="abill-btn abill-btn-outline" to="/plans"><Icon name="crown" size={16}/> Planes y suscripciones</Link>
        <button className="abill-btn abill-btn-main" type="button" onClick={() => setRevision(v => v+1)}>
          <Icon name="refresh" size={17}/> Actualizar
        </button>
      </div>}/>
    <FinanceSectionNav/>
    <section className="abill-reality-banner" aria-label="Disponibilidad de ingresos">
      <span className="abill-banner-icon"><Icon name="shield" size={25}/></span>
      <div><strong>Registro de ingresos comerciales aún no integrado</strong>
        <p>La plataforma registra Business PRO, pero no comprobantes de cobro, recaudos, facturas expedidas a clientes ni saldos de cartera.
          El estado de una suscripción no acredita un pago.</p>
      </div>
      <span className="abill-banner-tag">Sin fuente de recaudo</span>
    </section>

    <section className="abill-finance-overview" aria-labelledby="abill-money-heading">
      <div className="abill-section-top">
        <div><span className="abill-eyebrow">CONTROL FINANCIERO</span>
          <h2 id="abill-money-heading">Ingresos y facturación comercial</h2>
          <p>Los valores sin integración se muestran como no disponibles, nunca como $0.</p></div>
        <span className="abill-data-source"><Icon name="info" size={16}/> Sin fuente monetaria validada</span>
      </div>
      <div className="abill-monetary-grid">
        {monetary.map(item => <article key={item.label} className="abill-money-card">
          <div className="abill-money-top"><span className="abill-money-icon"><Icon name={item.icon} size={22}/></span>
            <span className="abill-unknown">No disponible</span></div>
          <div className="abill-money-copy"><h3>{item.label}</h3><strong aria-label={item.label+' no disponible'}>—</strong><p>{item.note}</p></div>
        </article>)}
      </div>
    </section>

    <section className="abill-commercial" aria-labelledby="abill-commercial-heading">
      <header className="abill-section-top"><div><span className="abill-eyebrow">ACTIVIDAD VERIFICABLE</span>
        <h2 id="abill-commercial-heading">Business PRO · actividad comercial</h2>
        <p>Información operacional registrada; no representa ingresos, facturas ni pagos.</p></div>
        <Link className="abill-text-link" to="/business-pro">Explorar Business PRO <Icon name="arrow" size={16}/></Link>
      </header>
      {summaryError && <div className="abill-inline-error" role="alert">{summaryError}
        <button type="button" onClick={() => setRevision(v=>v+1)}>Reintentar</button></div>}
      <div className="abill-commercial-grid">
        {commercial.map(item => <article key={item.label} className={'abill-commercial-card abill-commercial-'+item.tone}>
          <span className="abill-commercial-icon"><Icon name={item.icon} size={22}/></span>
          <div><small>{item.label}</small><strong aria-busy={summaryLoading}>
            {typeof item.value === 'number' ? number(item.value) : '—'}</strong>
            <span>{item.note}</span></div>
        </article>)}
      </div>
      <p className="abill-metric-note"><Icon name="info" size={15}/>
        Los indicadores corresponden a negocios únicos y pueden coincidir entre sí. No deben sumarse ni interpretarse como ventas.
      </p>
    </section>

    <section className="abill-record-section" aria-labelledby="abill-register-title">
      <header className="abill-section-top">
        <div><span className="abill-eyebrow">TRAZABILIDAD COMERCIAL</span><h2 id="abill-register-title">Registro operativo de suscripciones</h2>
          <p>Consulta suscripciones efectivamente registradas, sus fechas y su estado. No son documentos tributarios.</p></div>
        {canReadBusinesses && <button className="abill-btn abill-btn-outline" type="button"
          disabled={recordsLoading || !records?.subscriptions.length} onClick={exportOperationalCsv}>
          <Icon name="download" size={16}/> Exportar página (CSV operativo)
        </button>}
      </header>
      {!canReadBusinesses ? <div className="abill-no-business"><Icon name="lock" size={24}/>
        <div><strong>Consulta de negocios restringida</strong><p>Se necesita adicionalmente el permiso BUSINESSES_READ para acceder a la identidad y los registros individuales de los negocios.</p></div>
      </div> : <>
        <form className="abill-filters" onSubmit={search}>
          <label className="abill-field abill-search-field"><span>Buscar negocio</span>
            <span className="abill-input-group"><Icon name="search" size={18}/>
              <input type="search" aria-label="Buscar registro comercial" maxLength={100}
                placeholder="Nombre o ID del negocio…" value={draft} onChange={event => setDraft(event.target.value)}/>
            </span></label>
          <label className="abill-field"><span>Estado registrado</span>
            <select aria-label="Filtrar suscripciones por estado" value={status}
              onChange={event => updateFilter({ status: event.target.value })}>
              {states.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select></label>
          <div className="abill-filter-actions">
            <button className="abill-btn abill-btn-outline" type="button" onClick={reset}>Limpiar</button>
            <button className="abill-btn abill-btn-main" type="submit"><Icon name="search" size={16}/> Buscar</button>
          </div>
        </form>
        <div className="abill-register-result">
          <strong>{recordsLoading ? 'Consultando registros…' : records
            ? number(records.pagination.total) + (records.pagination.total === 1 ? ' registro' : ' registros')
            : 'Registro operativo'}</strong>
          <span>Origen: BusinessSubscription · datos actuales de XAMUKO</span>
        </div>
        {recordsLoading ? <div className="abill-register-message" role="status">Consultando las suscripciones registradas…</div>
          : recordsError ? <div className="abill-register-error" role="alert">
            <Icon name="shield" size={20}/><span>{recordsError}. El backend puede requerir actualización.</span>
            <button className="abill-btn abill-btn-outline" type="button" onClick={() => setRevision(v=>v+1)}>Reintentar</button>
          </div>
          : !records?.subscriptions.length ? <div className="abill-register-empty"><Icon name="search" size={25}/>
              <strong>Sin coincidencias</strong><p>No hay suscripciones que cumplan estos criterios.</p>
              <button className="abill-btn abill-btn-outline" type="button" onClick={reset}>Limpiar filtros</button>
            </div>
          : <>
            <div className="abill-table-scroll"><table className="abill-table">
              <thead><tr><th>Negocio</th><th>Estado registrado</th><th>Vigencia efectiva</th>
                <th>Inicio</th><th>Vencimiento</th><th>Acción</th></tr></thead>
              <tbody>{records.subscriptions.map(item => <tr key={item.id}>
                <td><div className="abill-business-name">
                  <span className="abill-business-avatar"><Icon name="store" size={20}/></span>
                  <span><Link to={'/businesses/'+encodeURIComponent(item.business.id)}>{item.business.name}</Link>
                    <small>{item.business.publicId}</small></span></div></td>
                <td><span className={'abill-status abill-status-'+item.status.toLowerCase()}>{statusLabel[item.status]}</span></td>
                <td><span className={'abill-effective '+(item.effective?'yes':'no')}>
                  {item.effective?'PRO vigente':'No vigente'}</span>
                  {item.specialActivation && <small className="abill-special">Activación especial</small>}</td>
                <td>{date(item.startsAt)}</td>
                <td>{item.expiresAt ? date(item.expiresAt) : item.specialActivation ? 'Sin vencimiento' : 'No definida'}</td>
                <td><Link className="abill-row-action" to={'/businesses/'+encodeURIComponent(item.business.id)}>
                  Ver ficha <Icon name="arrow" size={15}/></Link></td>
              </tr>)}</tbody>
            </table></div>
            <div className="abill-mobile-records">{records.subscriptions.map(item => <article key={item.id}>
              <header><Link to={'/businesses/'+encodeURIComponent(item.business.id)}>{item.business.name}</Link>
                <small>{item.business.publicId}</small></header>
              <div className="abill-mobile-badges"><span className={'abill-status abill-status-'+item.status.toLowerCase()}>{statusLabel[item.status]}</span>
                <span className={'abill-effective '+(item.effective?'yes':'no')}>{item.effective?'PRO vigente':'No vigente'}</span></div>
              <dl><div><dt>Inicio</dt><dd>{date(item.startsAt)}</dd></div>
                <div><dt>Vencimiento</dt><dd>{item.expiresAt ? date(item.expiresAt) : item.specialActivation ? 'Sin vencimiento' : 'No definida'}</dd></div>
                <div><dt>Activación especial</dt><dd>{item.specialActivation?'Sí':'No'}</dd></div>
                <div><dt>Renovación automática</dt><dd>{item.autoRenew?'Sí':'No'}</dd></div></dl>
              <Link className="abill-row-action" to={'/businesses/'+encodeURIComponent(item.business.id)}>Ver ficha de negocio <Icon name="arrow" size={15}/></Link>
            </article>)}</div>
          </>}
        {records && records.pagination.totalPages > 1 && <nav className="abill-pagination" aria-label="Páginas del registro comercial">
          <span>Página {page} de {records.pagination.totalPages}</span>
          <div><button className="abill-btn abill-btn-outline" type="button" disabled={recordsLoading || page<=1}
              onClick={() => updateFilter({ page: page-1 })}>Anterior</button>
            <button className="abill-btn abill-btn-main" type="button" disabled={recordsLoading || page>=records.pagination.totalPages}
              onClick={() => updateFilter({ page: page+1 })}>Siguiente <Icon name="arrow" size={15}/></button></div>
        </nav>}
      </>}
    </section>

    <section className="abill-integrations" aria-labelledby="abill-integration-title">
      <div className="abill-section-top"><div><span className="abill-eyebrow">ALCANCE ACTUAL</span>
        <h2 id="abill-integration-title">Trazabilidad contable y documental</h2>
        <p>Funciones verificadas en el sistema, sin asumir que existe facturación electrónica.</p></div></div>
      <div className="abill-integration-grid">
        <article><span><Icon name="file" size={21}/></span><h3>Facturas emitidas a clientes</h3>
          <p>No hay servicio integrado de emisión, numeración ni consulta de facturas de venta.</p></article>
        <article><span><Icon name="card" size={21}/></span><h3>Pagos comerciales</h3>
          <p>El registro de Business PRO no contiene evidencia de transacciones cobradas.</p></article>
        <article><span><Icon name="chart" size={21}/></span><h3>Facturas de proveedores</h3>
          <p>Los documentos de servicios tecnológicos sí cuentan con un módulo separado de egresos.</p>
          <Link to="/financial-reports">Consultar gastos tecnológicos <Icon name="arrow" size={15}/></Link></article>
      </div>
    </section>
    <p className="abill-footer-source"><Icon name="shield" size={17}/>
      No se han calculado ingresos estimados a partir del número de negocios, suscripciones PRO, precios de planes
      ni facturas de proveedores. Los importes financieros se mostrarán solo cuando exista una fuente de recaudo verificable.</p>
  </main>;
}
