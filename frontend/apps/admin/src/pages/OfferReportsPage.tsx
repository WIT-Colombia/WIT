import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminApiError, listAdminOfferReports, type AdminOfferReport } from '../services/adminApiClient';
import './OfferReportsPage.css';

type LoadState = 'loading' | 'ready' | 'pending-api' | 'error' | 'permission';
type StatusFilter = 'ALL' | AdminOfferReport['status'];
type KindFilter = 'ALL' | 'PRODUCT' | 'SERVICE';
const states: Record<AdminOfferReport['status'], string> = {
  PENDING: 'Pendiente', UNDER_REVIEW: 'En revisión', RESOLVED: 'Resuelto', REJECTED: 'Rechazado',
};
const reasons: Record<string,string> = {
  UNAVAILABLE: 'Ya no está disponible',
  WRONG_INFORMATION: 'Información o precio incorrecto',
  WRONG_IMAGE: 'Imagen incorrecta',
  OTHER: 'Otro motivo',
};
function dateLabel(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
}

export function OfferReportsPage() {
  const [records, setRecords] = useState<AdminOfferReport[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [kind, setKind] = useState<KindFilter>('ALL');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 25, total: 0, totalPages: 0 });
  const [pendingTotal, setPendingTotal] = useState(0);
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const requestSequence = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => { setDebouncedQuery(query); setPage(1); }, 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  const reload = useCallback(async () => {
    const sequence = ++requestSequence.current;
    setState('loading'); setError('');
    try {
      const result = await listAdminOfferReports({ page, status, kind, q: debouncedQuery });
      if (sequence !== requestSequence.current) return;
      setRecords(Array.isArray(result.reports) ? result.reports : []);
      setPagination(result.pagination);
      setPendingTotal(result.pendingTotal ?? 0);
      setState('ready');
    } catch (caught) {
      if (sequence !== requestSequence.current) return;
      setRecords([]);
      setPagination({ page, pageSize: 25, total: 0, totalPages: 0 });
      if (caught instanceof AdminApiError && [404, 405, 501].includes(caught.status)) {
        setState('pending-api');
      } else if (caught instanceof AdminApiError && caught.status === 403) {
        setState('permission');
      } else {
        setError(caught instanceof Error ? caught.message : 'No se pudo consultar la bandeja.');
        setState('error');
      }
    }
  }, [page, status, kind, debouncedQuery]);
  useEffect(() => { void reload(); }, [reload]);

  return <section className="offer-reports-admin" aria-labelledby="offer-reports-title">
    <header className="page-heading offer-reports-heading">
      <div><p className="eyebrow">ATENCIÓN Y SOPORTE</p>
        <h1 id="offer-reports-title">Reportes de productos</h1>
        <p>Bandeja de reportes sobre productos y servicios publicados en XAMUKO.</p>
      </div>
      <button className="offer-reports-refresh" type="button" onClick={() => void reload()} disabled={state === 'loading'}>Actualizar</button>
    </header>

    <div className="offer-reports-metrics" aria-label="Resumen de reportes">
      <div><span>Reportes recibidos</span><strong>{state === 'ready' ? pagination.total : '—'}</strong><small>Datos del servidor</small></div>
      <div><span>Pendientes</span><strong>{state === 'ready' ? pendingTotal : '—'}</strong><small>Por revisar</small></div>
      <div><span>Origen</span><strong>Usuarios</strong><small>Productos y servicios</small></div>
    </div>

    <div className="offer-reports-panel">
      <div className="offer-reports-toolbar">
        <label>Buscar reporte
          <input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Producto, negocio, usuario o motivo" />
        </label>
        <label>Tipo
          <select value={kind} onChange={event=>{setKind(event.target.value as KindFilter); setPage(1);}}>
            <option value="ALL">Todos</option><option value="PRODUCT">Productos</option><option value="SERVICE">Servicios</option>
          </select>
        </label>
        <label>Estado
          <select value={status} onChange={event=>{setStatus(event.target.value as StatusFilter); setPage(1);}}>
            <option value="ALL">Todos</option>
            {Object.entries(states).map(([key,label])=><option key={key} value={key}>{label}</option>)}
          </select>
        </label>
      </div>
      {state === 'loading' ? <div className="offer-reports-state" role="status"><h2>Consultando reportes…</h2><p>Obteniendo la bandeja desde la API.</p></div> :
       state === 'pending-api' ? <div className="offer-reports-state" role="status">
         <span className="offer-reports-state-icon" aria-hidden="true">⚑</span>
         <h2>Integración con backend pendiente</h2>
         <p>La sección está preparada, pero el endpoint <code>GET /api/v1/admin/offer-reports</code> todavía no está implementado. No hay reportes sincronizados con Admin ni registros ficticios.</p>
         <p className="offer-reports-technical">Los reportes guardados en el navegador del usuario no se pueden consultar desde esta aplicación hasta conectar el envío y la recepción en el backend.</p>
       </div> :
       state === 'permission' ? <div className="offer-reports-state" role="alert"><h2>Acceso no autorizado</h2><p>La revisión de reportes requiere permiso administrativo REPORTS_REVIEW.</p></div> :
       state === 'error' ? <div className="offer-reports-state" role="alert"><h2>No se pudieron cargar los reportes</h2><p>{error}</p><button type="button" className="offer-reports-refresh" onClick={() => void reload()}>Reintentar</button></div> :
       records.length === 0 ? <div className="offer-reports-state" role="status"><h2>Sin reportes para mostrar</h2><p>{query || kind !== 'ALL' || status !== 'ALL' ? 'No hay resultados con estos filtros.' : 'No hay reportes registrados en el servidor.'}</p></div> :
       <div className="offer-reports-records">{records.map(report => {
         const isExpanded = expanded === report.id;
         return <article className="offer-reports-record" key={report.id}>
           <div className="offer-reports-record-main">
             <div><span className="offer-reports-kind">{report.offer?.kind === 'SERVICE' ? 'Servicio' : 'Producto'}</span>
               <h2>{report.offer?.name || 'Elemento no disponible'}</h2>
               <p>{report.offer?.business?.name || 'Negocio no disponible'} · {dateLabel(report.createdAt)}</p></div>
             <span className={`offer-reports-status status-${report.status.toLowerCase()}`}>{states[report.status] ?? report.status}</span>
           </div>
           <p><strong>Motivo:</strong> {reasons[report.reason] ?? report.reason}</p>
           <div className="offer-reports-record-actions">
             <button type="button" onClick={() => setExpanded(isExpanded ? null : report.id)} aria-expanded={isExpanded}>{isExpanded ? 'Ocultar detalle' : 'Ver detalle'}</button>
             {report.offer?.id && <a href={`https://user.xamuko.com/${report.offer.kind === 'SERVICE' ? 'service' : 'product'}/${encodeURIComponent(report.offer.id)}`} target="_blank" rel="noopener noreferrer">Ver publicación</a>}
           </div>
           {isExpanded && <div className="offer-reports-detail">
             <p><strong>Radicado:</strong> {report.id}</p>
             <p><strong>Reportante:</strong> {report.reporter?.displayName || 'No identificado'}</p>
             <p><strong>Descripción:</strong> {report.description || 'Sin descripción'}</p>
             <p className="offer-reports-technical">Las decisiones de moderación se habilitarán con el endpoint seguro y auditado del backend.</p>
           </div>}
         </article>;
       })}</div>}
    </div>
    {state === 'ready' && pagination.totalPages > 1 && <nav className="offer-reports-pager" aria-label="Páginas de reportes">
      <button type="button" disabled={page <= 1} onClick={() => setPage(value => Math.max(1, value - 1))}>Anterior</button>
      <span>Página {page} de {pagination.totalPages} · {pagination.total} reportes</span>
      <button type="button" disabled={page >= pagination.totalPages} onClick={() => setPage(value => value + 1)}>Siguiente</button>
    </nav>}
    <p className="offer-reports-footer">La bandeja distingue entre datos reales del servidor e integración pendiente. No modifica reportes ni inventa estados.</p>
    <Link className="offer-reports-help-link" to="/reports">Ir a reportes de comentarios</Link>
  </section>;
}
