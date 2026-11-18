import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { getSession } from '../../services/adminService';
import {
  getBusinessReportCase, listRecordBusinessReports,
  type AdminRecordBusinessReport, type AdminBusinessReportStatus, type AdminBusinessReportFilters,
} from '../../services/adminApiClient';
import { Empty, Loading, Pager, date, number, useResource } from './shared';

const statusLabels: Record<string, string> = {
  PENDING: 'Pendiente', UNDER_REVIEW: 'En revisión', RESOLVED: 'Resuelto', REJECTED: 'Rechazado',
};
const reasons: Record<string, string> = {
  IMPERSONATION: 'Suplantación de identidad', FALSE_INFORMATION: 'Información falsa',
  SUSPECTED_FRAUD: 'Posible fraude', INAPPROPRIATE_CONTENT: 'Contenido inapropiado', OTHER: 'Otro motivo',
};
const filters: Array<{ value: AdminBusinessReportStatus | ''; label: string }> = [
  { value: '', label: 'Todos' }, { value: 'PENDING', label: 'Pendientes' },
  { value: 'UNDER_REVIEW', label: 'En revisión' }, { value: 'RESOLVED', label: 'Resueltos' },
  { value: 'REJECTED', label: 'Rechazados' },
];

function ReportDetails({ report }: { report: AdminRecordBusinessReport }) {
  const detail = useResource(() => getBusinessReportCase(report.id), [report.id]);
  return <section className="bd-report-case-detail" aria-label={'Detalle del reporte ' + report.id}>
    <Loading {...detail}/>
    {!detail.loading && !detail.error && detail.data && <>
      <div className="bd-report-case-info">
        <div><span>Presentado por</span><strong>{detail.data.report.reporter?.displayName || 'Usuario no identificado'}</strong></div>
        <div><span>Fecha de presentación</span><strong>{date(detail.data.report.createdAt)}</strong></div>
      </div>
      <h4>Descripción original</h4>
      <p>{detail.data.report.description}</p>
      {detail.data.report.decisionNote && <div className="bd-report-decision">
        <strong>Última decisión administrativa</strong><p>{detail.data.report.decisionNote}</p>
      </div>}
      <h4>Seguimiento y decisiones registradas</h4>
      <ol className="bd-report-actions">
        <li><span className="bd-report-actions-dot"/><div>
          <strong>Reporte recibido</strong><time dateTime={detail.data.report.createdAt}>{date(detail.data.report.createdAt)}</time>
          <p>Denuncia recibida. La presentación del reporte no acredita por sí sola una infracción.</p>
        </div></li>
        {detail.data.history.map(event => <li key={event.id}>
          <span className="bd-report-actions-dot"/><div>
            <strong>{event.newStatus ? (statusLabels[event.newStatus] || 'Estado actualizado') : 'Decisión administrativa'}</strong>
            <time dateTime={event.createdAt}>{date(event.createdAt)}</time>
            <p>Responsable: {event.actor?.displayName || 'No identificado'}</p>
            {event.previousStatus && event.newStatus && <p>
              {statusLabels[event.previousStatus] || event.previousStatus} → {statusLabels[event.newStatus] || event.newStatus}
            </p>}
            {event.reason && <p>Justificación: {event.reason}</p>}
          </div>
        </li>)}
      </ol>
    </>}
  </section>;
}

function ReportItem({ report, expanded, onToggle }: {
  report: AdminRecordBusinessReport; expanded: boolean; onToggle: () => void;
}) {
  const closed = report.status === 'RESOLVED' || report.status === 'REJECTED';
  return <article className="bd-report-entry" aria-label={'Reporte: ' + (reasons[report.reason] || report.reason)}>
    <header>
      <div className="bd-report-entry-title">
        <span className="bd-report-entry-symbol"><Icon name="flag" size={18}/></span>
        <div><h3>{reasons[report.reason] || 'Motivo no clasificado'}</h3>
          <time dateTime={report.createdAt}><Icon name="calendar" size={13}/>{date(report.createdAt)}</time></div>
      </div>
      <span className={'bd-report-state bd-report-state--' + report.status.toLowerCase()}>
        {statusLabels[report.status] || 'Estado no disponible'}
      </span>
    </header>
    <p className="bd-report-entry-description">{report.description}</p>
    {report.decisionNote && <p className="bd-report-entry-note">
      <Icon name="check" size={15}/>Decisión registrada: {report.decisionNote}
    </p>}
    <div className="bd-report-entry-actions">
      <button type="button" className="bd-report-read" aria-expanded={expanded}
        onClick={onToggle}><Icon name="file" size={15}/>{expanded ? 'Ocultar detalle' : 'Ver detalle'}</button>
      <Link className="bd-report-manage" to={'/business-reports?report=' + encodeURIComponent(report.id)}>
        <Icon name="shield" size={15}/>{closed ? 'Ver expediente' : 'Gestionar reporte'}<Icon name="arrow" size={14}/>
      </Link>
    </div>
    {expanded && <ReportDetails report={report}/>}
  </article>;
}

export function Reports({ businessId, businessName }: { businessId: string; businessName: string }) {
  const allowed = Boolean(getSession()?.permissions?.includes('content:moderate'));
  const [status, setStatus] = useState<AdminBusinessReportStatus | ''>('');
  const [reason, setReason] = useState('');
  const [draft, setDraft] = useState(''), [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const options: AdminBusinessReportFilters = { status, reason, q: search };
  const source = useResource(
    () => listRecordBusinessReports(businessId, page, options),
    [businessId, page, status, reason, search],
    allowed,
  );
  if (!allowed) return <Empty icon="lock" title="Reportes de acceso restringido"
    message="Necesitas permiso de revisión de reportes para consultar las denuncias sobre este negocio."/>;
  const summary = source.data?.summary;
  const counters = [
    { name: 'Total de reportes', value: summary?.total, icon: 'flag', tone: 'violet', action: '' },
    { name: 'Pendientes', value: summary?.pending, icon: 'clock', tone: 'amber', action: 'PENDING' },
    { name: 'En revisión', value: summary?.reviewing, icon: 'eye', tone: 'blue', action: 'UNDER_REVIEW' },
    { name: 'Finalizados', value: summary?.finalized, icon: 'check', tone: 'green', action: '' },
  ];
  const selectStatus = (next: AdminBusinessReportStatus | '') => {
    setStatus(next); setPage(1); setExpandedId(null);
  };
  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSearch(draft.trim()); setPage(1); setExpandedId(null);
  };
  return <section className="bd-report-register" aria-label="Seguimiento de reportes del negocio">
    <header className="bd-report-register-heading">
      <span className="bd-report-register-heading-icon"><Icon name="flag" size={23}/></span>
      <div><h2>Reportes del negocio</h2>
        <p>Seguimiento de denuncias sobre {businessName}. Un reporte recibido no significa que exista una infracción comprobada.</p></div>
      <Link className="bd-report-center-link" to="/business-reports"><Icon name="shield" size={16}/>Centro de moderación</Link>
    </header>
    <div className="bd-report-stats" aria-label="Resumen de reportes del negocio">
      {counters.map(item => <div className={'bd-report-stat bd-report-stat--' + item.tone} key={item.name}>
        <span className="bd-report-stat-icon"><Icon name={item.icon} size={18}/></span>
        <span className="bd-report-stat-body"><span>{item.name}</span>
          <strong>{item.value === undefined ? '—' : number(item.value)}</strong></span>
        {item.action && <button type="button" aria-label={'Filtrar ' + item.name.toLowerCase()}
          onClick={() => selectStatus(item.action as AdminBusinessReportStatus)}><Icon name="arrow" size={14}/></button>}
      </div>)}
    </div>
    {summary && <p className="bd-report-finalized-summary">
      Finalizados: {number(summary.resolved)} resueltos y {number(summary.rejected)} rechazados. Son decisiones distintas.
    </p>}
    <div className="bd-report-register-surface">
      <div className="bd-report-register-tools">
        <form className="bd-report-register-search" role="search" onSubmit={submitSearch}>
          <Icon name="search" size={17}/>
          <input type="search" aria-label="Buscar reportes" placeholder="Buscar por motivo o descripción"
            value={draft} maxLength={100} onChange={event => setDraft(event.target.value)}/>
          <button type="submit">Buscar</button>
        </form>
        <label className="bd-report-reason-filter">Motivo
          <select value={reason} aria-label="Filtrar por motivo"
            onChange={event => { setReason(event.target.value); setPage(1); setExpandedId(null); }}>
            <option value="">Todos los motivos</option>
            {Object.entries(reasons).map(([key, value]) => <option key={key} value={key}>{value}</option>)}
          </select>
        </label>
      </div>
      <div className="bd-report-status-filters" role="group" aria-label="Filtrar reportes por estado">
        {filters.map(option => <button key={option.value || 'all'} type="button"
          className={status === option.value ? 'bd-report-status-filter bd-report-status-filter--active' : 'bd-report-status-filter'}
          aria-pressed={status === option.value} onClick={() => selectStatus(option.value)}>
          {option.label}
        </button>)}
      </div>
      <Loading {...source}/>
      {!source.loading && !source.error && source.data && (source.data.reports.length
        ? <div className="bd-report-register-list">
          {source.data.reports.map(report => <ReportItem key={report.id} report={report}
            expanded={report.id === expandedId} onToggle={() => setExpandedId(value => value === report.id ? null : report.id)}/>)}
        </div>
        : <Empty icon="check" title="Sin reportes para esta consulta"
          message="No hay denuncias que coincidan con estos filtros. Puedes cambiar el estado o el motivo."/>)}
      {source.data && !source.error && source.data.pagination.totalPages > 1 &&
        <Pager pagination={source.data.pagination} onPage={next => { setPage(next); setExpandedId(null); }} loading={source.loading}/>}
      <p className="bd-report-register-footnote"><Icon name="shield" size={14}/>
        Las decisiones se adoptan en el Centro de moderación, con permisos y registro de auditoría. El historial no se puede editar aquí.</p>
    </div>
  </section>;
}
