import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Panel, StatePanel } from '../components/common';
import { Icon } from '../components/Icon';
import { getSession } from '../services/adminService';
import { AdminApiError, assignPioneer, listPioneers, reviewPioneerClaim, type PioneerRegistry } from '../services/adminApiClient';

const stamp = (value: string) => new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

export function PioneersPage() {
  const allowed = (getSession()?.permissions ?? []).includes('PIONEER_MANAGE');
  const [data, setData] = useState<PioneerRegistry | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('ALL');
  const canViewBusinesses = (getSession()?.permissions ?? []).includes('business:write');
  const load = () => { setLoading(true); setError(''); listPioneers().then(setData).catch(e => setError(e instanceof Error ? e.message : 'No se pudo cargar el registro.')).finally(() => setLoading(false)); };
  useEffect(() => { if (allowed) load(); else setLoading(false); }, [allowed]);
  if (!allowed) return <StatePanel kind="error" title="Acceso restringido" message="Necesitas el permiso PIONEER_MANAGE para gestionar estos reconocimientos." />;
  if (loading) return <StatePanel kind="loading" title="Cargando Negocios Pioneros" message="Consultando asignaciones reales." />;
  if (error) return <StatePanel kind="error" title="No se pudo cargar" message={error} retry={load} />;
  if (!data) return <StatePanel kind="empty" title="Registro no disponible" message="No se recibió información del servicio." />;
  const assigned = new Map(data.assignments.map(item => [item.number, item]));
  const slots = Array.from({ length: data.max }, (_, index) => { const number = index + 1; return { number, assignment: assigned.get(number) ?? null }; });
  const filteredSlots = slots.filter(({ number, assignment }) => {
    const matchesStatus = filter === 'ALL' || (filter === 'OCCUPIED' ? Boolean(assignment) : !assignment);
    const name = assignment?.brand.legalName ?? '';
    return matchesStatus && (`${number} ${name}`).toLocaleLowerCase('es').includes(query.trim().toLocaleLowerCase('es'));
  });
  const pending = data.brands.flatMap(brand => brand.claims.filter(claim => !claim.reviewedAt).map(claim => ({ brand, claim })));
  const usage = data.max ? Math.round((data.assignments.length / data.max) * 100) : 0;
  const act = async (fn: () => Promise<unknown>, message: string) => {
    if (!window.confirm(message)) return;
    try { await fn(); load(); }
    catch (e) { setError(e instanceof AdminApiError && e.code === 'PIONEER_NOT_ELIGIBLE' ? 'La marca no cumple los requisitos de elegibilidad.' : e instanceof AdminApiError && e.code === 'PIONEER_LIMIT_REACHED' ? `Los ${data.max} cupos Pioneros están ocupados.` : e instanceof AdminApiError && (e.code === 'PIONEER_ASSIGNMENT_CONFLICT' || e.code === 'PIONEER_ALREADY_ASSIGNED') ? 'La marca ya tiene una asignación o entró en conflicto.' : e instanceof Error ? e.message : 'No se pudo completar la acción.'); }
  };
  const exportCsv = () => {
    const rows = [['Cupón', 'Negocio', 'Estado', 'Fecha de asignación'], ...slots.map(({ number, assignment }) => [String(number).padStart(3, '0'), assignment?.brand.legalName ?? '', assignment ? 'Ocupado' : 'Disponible', assignment ? stamp(assignment.assignedAt) : ''])];
    const csv = rows.map(row => row.map(value => `"${value.replaceAll('"', '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'cupones-pioneros.csv'; link.click(); URL.revokeObjectURL(url);
  };
  return <section className="pioneers-workspace">
    <header className="pioneers-heading"><span className="pioneers-heading-icon"><Icon name="ticket" size={27} /></span><div><h1>Cupones Pioneros</h1><p>Gestión de la numeración exclusiva para negocios pioneros.</p></div></header>
    <div className="pioneer-summary-grid">
      <article className="pioneer-summary-card"><span className="pioneer-summary-icon violet"><Icon name="ticket" /></span><div><small>Total de cupones</small><strong>{data.max}</strong></div></article>
      <article className="pioneer-summary-card"><span className="pioneer-summary-icon green"><Icon name="check" /></span><div><small>Ocupados</small><strong>{data.assignments.length}</strong></div><Badge tone="success">{usage}%</Badge></article>
      <article className="pioneer-summary-card"><span className="pioneer-summary-icon blue"><Icon name="clock" /></span><div><small>Disponibles</small><strong>{data.available}</strong></div></article>
      <article className="pioneer-summary-card pioneer-usage-card"><div className="pioneer-usage-top"><span className="pioneer-summary-icon violet"><Icon name="chart" /></span><div><small>Uso</small><strong>{usage}%</strong></div></div><div className="pioneer-progress" role="progressbar" aria-label="Uso de cupones" aria-valuenow={usage} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${usage}%` }} /></div></article>
    </div>
    <Panel className="pioneer-directory" title="Listado de cupones pioneros" subtitle="La numeración es asignada exclusivamente por el backend." action={<button className="secondary-button" onClick={exportCsv}><Icon name="download" size={16} /> Exportar</button>}>
      <div className="pioneer-toolbar"><label className="pioneer-search"><Icon name="search" size={17} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar por número o negocio…" aria-label="Buscar por número o negocio" /></label><select value={filter} onChange={event => setFilter(event.target.value)} aria-label="Filtrar cupones por estado"><option value="ALL">Todos los estados</option><option value="OCCUPIED">Ocupados</option><option value="AVAILABLE">Disponibles</option></select></div>
      {filteredSlots.length === 0 ? <StatePanel kind="empty" title="Sin resultados" message="No hay cupones que coincidan con tu búsqueda." /> : <div className="pioneer-table-wrap"><table className="pioneer-table"><thead><tr><th># Cupón</th><th>Negocio</th><th>Estado</th><th>Fecha de asignación</th></tr></thead><tbody>{filteredSlots.map(({ number, assignment }) => {
        const businesses = assignment ? data.brands.find(brand => brand.id === assignment.brand.id)?.businesses ?? [] : [];
        return <tr key={number}><td data-label="# Cupón"><strong className="pioneer-number"><Icon name="ticket" size={17} /> #{String(number).padStart(3, '0')}</strong></td><td data-label="Negocio">{assignment ? <div className="pioneer-business-list">{businesses.length ? businesses.map(business => <span className="pioneer-business" key={business.id}><Icon name="store" size={16} />{business.name}{canViewBusinesses ? <Link className="pioneer-business-eye" to={`/businesses/${encodeURIComponent(business.id)}`} aria-label={`Ver perfil de ${business.name}`} title={`Ver perfil de ${business.name}`}><Icon name="eye" size={17} /></Link> : <span className="pioneer-business-eye disabled" aria-label="Necesitas permiso para consultar negocios"><Icon name="eye" size={17} /></span>}</span>) : <span className="pioneer-business"><Icon name="store" size={16} />{assignment.brand.legalName}</span>}</div> : '—'}</td><td data-label="Estado"><span className={`pioneer-status ${assignment ? 'occupied' : 'available'}`}><Icon name={assignment ? 'check' : 'clock'} size={14} />{assignment ? 'Ocupado' : 'Disponible'}</span></td><td data-label="Fecha de asignación">{assignment ? stamp(assignment.assignedAt) : '—'}</td></tr>;
      })}</tbody></table></div>}
    </Panel>
    {pending.length > 0 && <Panel title="Reclamaciones de marca" subtitle="Revisa solicitudes recibidas antes de aprobarlas o rechazarlas."><div className="mock-record-list">{pending.map(({ brand, claim }) => <article className="mock-record" key={claim.id}><span className="mock-record-copy"><strong>{brand.legalName}</strong><small>Negocios asociados: {brand.businesses.map(business => business.name).join(', ') || 'Sin negocio asociado'}</small><div className="content-detail-actions"><button className="secondary-button" onClick={() => void act(() => reviewPioneerClaim(claim.id, true, 'Aprobación revisada por Admin'), '¿Aprobar esta reclamación?')}>Aprobar</button><button className="danger-outline" onClick={() => void act(() => reviewPioneerClaim(claim.id, false, 'Rechazo revisado por Admin'), '¿Rechazar esta reclamación?')}>Rechazar</button><button className="outline-button" onClick={() => void act(() => assignPioneer(brand.id, 'Asignación revisada por Admin'), '¿Asignar un cupo Pionero a esta marca?')}>Asignar cupo</button></div></span></article>)}</div></Panel>}
  </section>;
}
