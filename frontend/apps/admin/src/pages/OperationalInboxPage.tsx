import { useCallback, useEffect, useState } from 'react';
import { decideOperationalRecord, listOperationalRecords, type OperationalKind, type OperationalRecord, type OperationalStatus } from '../services/adminApiClient';
import './OperationalInboxPage.css';
import { Icon } from '../components/Icon';

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
const date = (value: string) => {
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
};

export function OperationalInboxPage({ kind }: { kind: OperationalKind }) {
  const [records, setRecords] = useState<OperationalRecord[]>([]);
  const [total, setTotal] = useState(0);
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
  useEffect(() => { setSelected(null); setConfirmation(''); setNote(''); }, [kind, page, status, search]);
  const chosen = records.find(record => record.id === selected);
  async function decide(next: OperationalStatus) {
    if (!chosen || busy || (['RESOLVED', 'REJECTED'].includes(next) && note.trim().length < 10)) return;
    setBusy(true); setError(''); setConfirmation('');
    try {
      await decideOperationalRecord(kind, chosen.id, next, note.trim());
      setConfirmation('La decisión quedó registrada con trazabilidad.');
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo guardar la decisión.'); }
    finally { setBusy(false); }
  }
  return <section className="ops-inbox" aria-labelledby="ops-title">
    <header className="page-heading"><div><p className="eyebrow">ATENCIÓN Y SOPORTE</p><h1 id="ops-title">{config[kind].title}</h1><p>{config[kind].description}</p></div></header>
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
        <td><strong>{record.title}</strong><small>{record.category}</small></td>
        <td>{record.reporter}<small>{record.context}</small></td>
        <td>{labels[record.status]}</td>
        <td><button type="button" aria-expanded={selected === record.id} onClick={() => { setSelected(current => current === record.id ? null : record.id); setNote(record.decisionNote ?? ''); }}>Ver y gestionar</button></td>
      </tr>)}</tbody>
    </table></div>}
    {!loading && chosen && <section className="ops-detail" aria-label="Detalle de solicitud">
      <header><div><h2>{chosen.title}</h2><small>Radicado: {chosen.id}</small></div><button type="button" onClick={() => setSelected(null)}>Cerrar</button></header>
      <dl><div><dt>Fecha</dt><dd>{date(chosen.createdAt)}</dd></div><div><dt>Solicitante</dt><dd>{chosen.reporter}</dd></div>
        <div><dt>Origen</dt><dd>{chosen.context}</dd></div><div><dt>Motivo o tema</dt><dd>{chosen.category}</dd></div>
        <div><dt>Descripción</dt><dd>{chosen.description || 'No se proporcionaron detalles adicionales.'}</dd></div><div><dt>Estado actual</dt><dd>{labels[chosen.status]}</dd></div></dl>
      <label className="ops-note">Observación administrativa<textarea value={note} onChange={event => setNote(event.target.value)} maxLength={1500} rows={4} placeholder="Registra la justificación de tu decisión" /></label>
      <p className="ops-hint">Para resolver o rechazar, escribe una justificación de al menos 10 caracteres. La decisión quedará auditada.</p>
      <div className="ops-actions">{(['UNDER_REVIEW', 'RESOLVED', 'REJECTED'] as const).map(next =>
        <button key={next} type="button" disabled={busy || next === chosen.status || ((next === 'RESOLVED' || next === 'REJECTED') && note.trim().length < 10)} onClick={() => void decide(next)}>{busy ? 'Guardando…' : labels[next]}</button>
      )}</div>
    </section>}
    {!loading && totalPages > 1 && <nav className="ops-pagination" aria-label="Paginación">
      <button type="button" onClick={() => setPage(x => Math.max(1, x - 1))} disabled={page <= 1}>Anterior</button>
      <span>Página {page} de {totalPages}</span>
      <button type="button" onClick={() => setPage(x => Math.min(totalPages, x + 1))} disabled={page >= totalPages}>Siguiente</button>
    </nav>}
  </section>;
}
