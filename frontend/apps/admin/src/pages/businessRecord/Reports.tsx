import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { getSession } from '../../services/adminService';
import { listRecordBusinessReports } from '../../services/adminApiClient';
import { Card, Empty, Loading, Pager, number, useResource } from './shared';

const statusLabels: Record<string, string> = {
  PENDING: 'Pendiente', UNDER_REVIEW: 'En revisión', RESOLVED: 'Resuelto', REJECTED: 'Rechazado',
};
const reasons: Record<string, string> = {
  IMPERSONATION: 'Suplantación de identidad', FALSE_INFORMATION: 'Información falsa',
  SUSPECTED_FRAUD: 'Posible fraude', INAPPROPRIATE_CONTENT: 'Contenido inapropiado', OTHER: 'Otro motivo',
};
const formatDate = (iso: string) => new Date(iso).toLocaleString('es-CO', {
  timeZone: 'America/Bogota', dateStyle: 'medium', timeStyle: 'short',
});

export function Reports({ businessId, businessName }: { businessId: string; businessName: string }) {
  const allowed = Boolean(getSession()?.permissions?.includes('content:moderate'));
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const source = useResource(
    () => listRecordBusinessReports(businessId, page, status),
    [businessId, page, status], allowed,
  );
  if (!allowed) return <Empty icon="lock" title="Reportes de acceso restringido"
    message="Necesitas permiso de revisión de reportes para consultar las denuncias sobre este negocio."/>;
  return <Card title="Reportes del negocio" icon="flag" className="bd-business-reports">
    <div className="bd-reports-intro">
      <div><span className="bd-eyebrow">SUPERVISIÓN ADMINISTRATIVA</span>
        <h3>Reportes de {businessName}</h3>
        <p>Consulta las denuncias registradas, su estado y las decisiones documentadas.
          La información del denunciante es de acceso administrativo.</p></div>
      <div className="bd-reports-total"><Icon name="flag" size={20}/><strong>{source.data ? number(source.data.pagination.total) : '—'}</strong><span>Reportes</span></div>
    </div>
    <div className="bd-reports-toolbar">
      <label>Estado del reporte
        <select value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}>
          <option value="">Todos los estados</option><option value="PENDING">Pendientes</option>
          <option value="UNDER_REVIEW">En revisión</option><option value="RESOLVED">Resueltos</option>
          <option value="REJECTED">Rechazados</option>
        </select>
      </label>
      <button type="button" className="bd-button" onClick={source.retry} disabled={source.loading}>
        <Icon name="refresh" size={16}/> Actualizar
      </button>
      <Link className="bd-button bd-button--soft" to="/business-reports">
        <Icon name="shield" size={16}/> Centro de moderación
      </Link>
    </div>
    <Loading {...source}/>
    {!source.loading && !source.error && source.data && (source.data.reports.length
      ? <div className="bd-reports-list">{source.data.reports.map(report =>
        <article className="bd-report-item" key={report.id}>
          <div className="bd-report-head"><div><span className="bd-report-reason">{reasons[report.reason] ?? report.reason}</span>
            <time dateTime={report.createdAt}>{formatDate(report.createdAt)}</time></div>
            <span className={'bd-report-state bd-report-state--' + report.status.toLowerCase()}>
              {statusLabels[report.status] ?? 'Sin clasificar'}</span></div>
          <p className="bd-report-description">{report.description}</p>
          <dl><div><dt>Presentado por</dt><dd>{report.reporter?.displayName ?? 'Usuario no identificado'}</dd></div>
            <div><dt>Identificador</dt><dd>{report.id}</dd></div></dl>
          {report.decisionNote && <div className="bd-report-decision"><strong>Decisión administrativa</strong><p>{report.decisionNote}</p></div>}
        </article>)}</div>
      : <Empty icon="check" title="No hay reportes para este filtro"
        message="No se encontraron denuncias asociadas al negocio con el estado seleccionado."/>)}
    {source.data?.pagination && source.data.pagination.totalPages > 1 &&
      <Pager pagination={source.data.pagination} onPage={setPage} loading={source.loading}/>}
    <p className="bd-reports-footer"><Icon name="shield" size={16}/> Las actuaciones de moderación se realizan en el centro de reportes, con permisos y auditoría.</p>
  </Card>;
}
