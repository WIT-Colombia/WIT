import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { decideOperationalRecord, getOperationalBusinessReport, listOperationalRecords, type OperationalKind, type OperationalRecord, type OperationalStatus } from '../services/adminApiClient';
import './OperationalInboxPage.css';
import { Icon } from '../components/Icon';
import { SupportDecisionDialog } from '../components/SupportDecisionDialog';
import { getSession } from '../services/adminService';

const config: Record<OperationalKind, { title: string; description: string }> = {
  needs: { title: 'Necesidades de usuarios', description: 'Solicitudes recibidas desde «¿Qué necesitas encontrar?» en XAMUKO Usuarios.' },
  'business-reports': { title: 'Reportes de negocios', description: 'Denuncias enviadas desde las fichas públicas de negocios.' },
  'offer-reports': { title: 'Reportes de productos', description: 'Reportes sobre productos y servicios publicados en XAMUKO.' },
  support: { title: 'Mensajes de soporte', description: 'Solicitudes de asistencia enviadas desde XAMUKO Business.' },
  suggestions: { title: 'Sugerencias', description: 'Ideas y propuestas recibidas desde XAMUKO Business.' },
};
const labels: Record<OperationalStatus, string> = {
  PENDING: 'Pendiente', UNDER_REVIEW: 'En revisión', RESOLVED: 'Resuelto', REJECTED: 'Rechazado',
};
const reasonLabels: Record<string,string> = {
  IMPERSONATION:'Suplantación', FALSE_INFORMATION:'Información falsa',
  SUSPECTED_FRAUD:'Posible fraude', INAPPROPRIATE_CONTENT:'Contenido inapropiado',
  WRONG_INFORMATION:'Información incorrecta', WRONG_IMAGE:'Imagen incorrecta',
  UNAVAILABLE:'No disponible', OTHER:'Otro motivo',
};
const readable = (value: string) => reasonLabels[value] ?? value;
const date = (value: string) => {
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
};

export function OperationalInboxPage({ kind }: { kind: OperationalKind }) {
  const canDecide = getSession()?.permissions?.includes('content:moderate:write') ?? false;
  const [params] = useSearchParams();
  const focusedId = kind === 'business-reports' ? params.get('report') : null;
  const [focusedRecord, setFocusedRecord] = useState<OperationalRecord | null>(null);
  const [records, setRecords] = useState<OperationalRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [actionCounts, setActionCounts] = useState({ pending: 0, reviewing: 0 });
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('ALL');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [decision, setDecision] = useState<OperationalStatus | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const result = await listOperationalRecords(kind, { page, status, q: search });
      setRecords(result.records); setTotal(result.pagination.total); setTotalPages(result.pagination.totalPages);
    } catch (cause) {
      setRecords([]); setError(cause instanceof Error ? cause.message : 'No se pudieron consultar los registros.');
    } finally { setLoading(false); }
  }, [kind, page, search, status]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    let active = true;
    const fetchCounts = async () => {
      try {
        const [pending, reviewing] = await Promise.all([
          listOperationalRecords(kind, { page: 1, status: 'PENDING' }),
          listOperationalRecords(kind, { page: 1, status: 'UNDER_REVIEW' }),
        ]);
        if (active) setActionCounts({ pending: pending.pagination.total, reviewing: reviewing.pagination.total });
      } catch { /* The directory remains usable if summary counters are unavailable. */ }
    };
    void fetchCounts();
    return () => { active = false; };
  }, [kind, page, status, search, confirmation]);

  useEffect(() => {
    setSelected(focusedId || null); setConfirmation(''); setNote('');
  }, [kind, page, status, search, focusedId]);
  useEffect(() => {
    if (!focusedId) { setFocusedRecord(null); return; }
    let active = true;
    void getOperationalBusinessReport(focusedId).then(record => {
      if (!active) return;
      setFocusedRecord(record); setSelected(record.id); setNote(record.decisionNote ?? '');
    }).catch(cause => {
      if (active) setError(cause instanceof Error ? cause.message : 'No se pudo consultar el expediente solicitado.');
    });
    return () => { active = false; };
  }, [focusedId]);
  const chosen = records.find(record => record.id === selected)
    ?? (focusedRecord?.id === selected ? focusedRecord : undefined);
  async function decide(next: OperationalStatus, justification: string) {
    if (!chosen || busy) return;
    setBusy(true); setError(''); setConfirmation('');
    try {
      await decideOperationalRecord(kind, chosen.id, next, justification);
      setDecision(null); setNote('');
      setConfirmation('Decisión registrada. Se generó una notificación interna para los destinatarios identificados.');
      await load();
      if (focusedId === chosen.id) setFocusedRecord(await getOperationalBusinessReport(chosen.id));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo guardar la decisión.'); throw cause; }
    finally { setBusy(false); }
  }
  return <section className="ops-inbox" aria-labelledby="ops-title">
    <header className="admin-section-heading"><h1 id="ops-title">{config[kind].title}</h1></header>
    <div className="ops-attention-summary" aria-label="Casos que requieren atención">
      <button type="button" aria-pressed={status === 'PENDING'} onClick={() => { setPage(1); setStatus('PENDING'); }}>
        <span>Pendientes de atención</span><strong>{actionCounts.pending}</strong>
      </button>
      <button type="button" aria-pressed={status === 'UNDER_REVIEW'} onClick={() => { setPage(1); setStatus('UNDER_REVIEW'); }}>
        <span>En seguimiento</span><strong>{actionCounts.reviewing}</strong>
      </button>
    </div>
    <div className="ops-toolbar">
      <form onSubmit={event => { event.preventDefault(); setPage(1); setSearch(query); }}>
        <label>Buscar<input type="search" aria-label="Buscar solicitudes" value={query} placeholder="Nombre, motivo o descripción" onChange={event => setQuery(event.target.value)} /></label>
        <button type="submit">Buscar</button>
      </form>
      <label>Estado<select value={status} onChange={event => { setPage(1); setStatus(event.target.value); }}>
        <option value="ALL">Todos los estados</option>
        {Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select></label>
      <button type="button" onClick={() => void load()} disabled={loading}>Actualizar</button>
      {!loading && !error && <small>{total} registros reales</small>}
    </div>
    {error && <p className="ops-error" role="alert">{error}</p>}
    {confirmation && <p className="ops-confirmation" role="status">{confirmation}</p>}
    {loading ? <p role="status">Consultando solicitudes del servidor…</p> : !error && records.length === 0 ? <div className="ops-empty ad-empty"><span className="ad-large-icon"><Icon name={kind.includes('reports') ? 'flag' : kind === 'needs' ? 'search' : 'message'} size={30}/></span><h2>No hay solicitudes para mostrar</h2><p>No hay solicitudes registradas para estos filtros. Aquí podrás consultar y gestionar los mensajes recibidos en esta sección.</p></div> : null}
    {!loading && records.length > 0 && <div className="ops-table-scroll"><table className="ops-table">
      <thead><tr><th>Radicado</th><th>Fecha</th><th>Asunto</th><th>Origen</th><th>Estado</th><th>Detalle</th></tr></thead>
      <tbody>{records.map(record => <tr key={record.id}>
        <td title={record.id}>{record.id.slice(0, 8)}</td><td>{date(record.createdAt)}</td>
        <td><strong>{record.title}</strong><small>{readable(record.category)}</small></td>
        <td>{record.reporter}<small>{record.context}</small></td>
        <td>{labels[record.status]}</td>
        <td><button type="button" aria-expanded={selected === record.id} onClick={() => { setSelected(current => current === record.id ? null : record.id); setNote(record.decisionNote ?? ''); }}>Ver y gestionar</button></td>
      </tr>)}</tbody>
    </table></div>}
    {chosen && <section className="ops-detail" aria-label="Detalle de solicitud">
      <header><div><h2>{chosen.title}</h2><small>Radicado: {chosen.id}</small></div><button type="button" onClick={() => setSelected(null)}>Cerrar</button></header>
      <dl><div><dt>Fecha</dt><dd>{date(chosen.createdAt)}</dd></div><div><dt>Solicitante</dt><dd>{chosen.reporter}</dd></div>
        <div><dt>Origen</dt><dd>{chosen.context}</dd></div><div><dt>Motivo o tema</dt><dd>{readable(chosen.category)}</dd></div>
        <div><dt>Descripción</dt><dd>{chosen.description || 'No se proporcionaron detalles adicionales.'}</dd></div><div><dt>Estado actual</dt><dd>{labels[chosen.status]}</dd></div></dl>
      {chosen.targetPath && <div className="ops-record-link"><Icon name={kind === 'offer-reports' ? 'box' : 'store'} size={19}/>
        <div><strong>Registro vinculado</strong><small>Abre la ficha para consultar los antecedentes o aplicar medidas sobre el contenido.</small></div>
        <Link to={chosen.targetPath}>{chosen.targetLabel ?? 'Consultar ficha'} <Icon name="arrow" size={15}/></Link>
      </div>}
      {canDecide && <label className="ops-note">{kind === 'business-reports' || kind === 'offer-reports' ? 'Justificación administrativa (reservada)' : 'Respuesta para el solicitante (se notificará)'}<textarea value={note} onChange={event => setNote(event.target.value)} maxLength={1000} rows={4} placeholder={kind === 'business-reports' || kind === 'offer-reports' ? 'Describe los motivos y la decisión' : 'Explica la decisión al solicitante'} /></label>}
      {canDecide ? <><p className="ops-hint">Selecciona una decisión y confírmala en la ventana de revisión. La observación será obligatoria y quedará auditada.</p>
      <div className="ops-actions">{(['UNDER_REVIEW', 'RESOLVED', 'REJECTED'] as const).map(next =>
        <button key={next} type="button" disabled={busy || next === chosen.status || ['RESOLVED','REJECTED'].includes(chosen.status)}
          onClick={() => setDecision(next)}>{labels[next]}</button>
      )}</div></> : <p className="ops-hint">Puedes consultar los registros. Tu cuenta no tiene permisos para tomar decisiones de moderación.</p>}
    </section>}
    {decision && chosen && <SupportDecisionDialog
      title={decision === 'UNDER_REVIEW' ? 'Iniciar revisión' : decision === 'RESOLVED' ? 'Resolver solicitud' : 'Rechazar solicitud'}
      description={decision === 'RESOLVED'
        ? 'Esta acción cierra el caso administrativamente. No equivale por sí sola a sancionar o eliminar un negocio o una publicación.'
        : decision === 'REJECTED' ? 'Esta acción cierra el caso sin acoger el reporte o solicitud.'
        : 'Se cambiará el estado a «En revisión» para iniciar el seguimiento administrativo.'}
      affected={chosen.title}
      confirmWord={decision === 'RESOLVED' ? 'RESOLVER' : decision === 'REJECTED' ? 'RECHAZAR' : 'REVISAR'}
      initialReason={note}
      shareReason={kind !== 'business-reports' && kind !== 'offer-reports'}
      onClose={() => setDecision(null)}
      onConfirm={reason => decide(decision, reason)}
    />}
    {!loading && totalPages > 1 && <nav className="ops-pagination" aria-label="Paginación">
      <button type="button" onClick={() => setPage(x => Math.max(1, x - 1))} disabled={page <= 1}>Anterior</button>
      <span>Página {page} de {totalPages}</span>
      <button type="button" onClick={() => setPage(x => Math.min(totalPages, x + 1))} disabled={page >= totalPages}>Siguiente</button>
    </nav>}
  </section>;
}
