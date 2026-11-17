import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { getSession } from '../services/adminService';
import {
  getAdminVisibilityAudit, type AdminVisibilityAuditKind,
  type AdminVisibilityAuditEntry,
} from '../services/adminApiClient';
import { actionName } from './businessRecord/History';
import { label, useResource } from './businessRecord/shared';
import './AdminAuditPage.css';

const kinds: Array<{ value: AdminVisibilityAuditKind; text: string }> = [
  { value: 'ALL', text: 'Todos los cambios' },
  { value: 'VISIBLE', text: 'Visible' },
  { value: 'HIDDEN', text: 'Oculta' },
  { value: 'SUSPENDED', text: 'Suspendida' },
  { value: 'RESTORED', text: 'Restricción levantada' },
  { value: 'RENEWED', text: 'Vigencia renovada' },
  { value: 'VERIFIED', text: 'Verificado' },
  { value: 'UNVERIFIED', text: 'Sin verificar' },
];
const auditDate = (createdAt: string) => new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Bogota',
}).format(new Date(createdAt));
const stateNames: Record<string, string> = {
  visibilityStatus: 'Visibilidad', administrativeRestriction: 'Restricción administrativa', verificationStatus: 'Verificación',
};
function stateText(value: string | null, key: string) {
  return value === null ? key === 'administrativeRestriction' ? 'Sin restricción' : 'No registrado'
    : key === 'verificationStatus' && value === 'APPROVED' ? 'Verificado' : key === 'verificationStatus' && value === 'NONE' ? 'Sin verificar' : label(value);
}
function AuditState({ state, emptyText }: { state: Record<string, string | null> | null; emptyText: string }) {
  const entries = Object.entries(state ?? {});
  return entries.length ? <dl className="xa-audit-state-list">{entries.map(([key, value]) =>
    <div key={key}><dt>{stateNames[key] ?? key}</dt><dd>{stateText(value, key)}</dd></div>)}</dl>
    : <p className="xa-audit-state-empty">{emptyText}</p>;
}
function AuditEntry({ entry }: { entry: AdminVisibilityAuditEntry }) {
  const isVerification = entry.action === 'ADMIN_BUSINESS_VERIFIED_MANUALLY' || entry.action === 'ADMIN_BUSINESS_UNVERIFIED_MANUALLY';
  const isSuspension = entry.action.includes('SUSPEND');
  const isHidden = entry.action.includes('HIDDEN') || entry.action.includes('HIDE') || entry.action === 'ADMIN_BUSINESS_UNVERIFIED_MANUALLY';
  const tone = isSuspension ? 'suspended' : isHidden ? 'hidden' : 'visible';
  return <article className="xa-audit-event" aria-label={actionName(entry.action)}>
    <div className={`xa-audit-event-symbol xa-audit-event-symbol--${tone}`}>
      <Icon name={isVerification ? 'shield' : isSuspension ? 'lock' : isHidden ? 'eye-off' : 'eye'} size={22}/>
    </div>
    <div className="xa-audit-event-content">
      <header className="xa-audit-event-header">
        <div><span className="xa-audit-event-kind">{isVerification ? "CAMBIO DE VERIFICACIÓN" : "CAMBIO DE VISIBILIDAD"}</span>
          <h2>{actionName(entry.action)}</h2>
          {entry.business
            ? <Link className="xa-audit-business" to={`/businesses/${encodeURIComponent(entry.business.id)}`}>
              <Icon name="store" size={14}/>{entry.business.name}<Icon name="arrow" size={14}/>
            </Link>
            : <span className="xa-audit-business">Negocio no disponible</span>}
        </div>
        <time dateTime={entry.createdAt}><Icon name="calendar" size={14}/>{auditDate(entry.createdAt)}</time>
      </header>
      <div className="xa-audit-event-details">
        <div><strong>Responsable</strong><span>{entry.actor?.displayName || 'Responsable no disponible'}</span></div>
        {entry.business && <div><strong>ID del negocio</strong><span>{entry.business.publicId}</span></div>}
      </div>
      <div className="xa-audit-reason"><strong>Motivo registrado</strong>
        <p>{entry.reason || entry.comment || 'No se registró un motivo en este evento.'}</p></div>
      <details className="xa-audit-expand"><summary><Icon name="layers" size={15}/> Consultar estado anterior y nuevo</summary>
        <div className="xa-audit-diff">
          <section><h3>Estado anterior</h3><AuditState state={entry.previousState} emptyText="No conservado"/></section>
          <section><h3>Estado nuevo</h3><AuditState state={entry.newState} emptyText="No conservado"/></section>
        </div>
      </details>
    </div>
  </article>;
}

export function AdminAuditPage() {
  const session = getSession();
  const allowed = session?.role === 'SUPER_ADMIN' || Boolean(session?.permissions?.includes('audit:read'));
  const [kind, setKind] = useState<AdminVisibilityAuditKind>('ALL');
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const result = useResource(
    () => getAdminVisibilityAudit({ page, kind, search }),
    [page, kind, search], allowed,
  );
  const searchAudit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    setSearch(draft.trim());
  };
  if (!allowed) return <main className="xa-audit-workspace"><div className="xa-audit-error" role="alert">
    <Icon name="lock" size={23}/><h1>Acceso restringido</h1>
    <p>Necesitas el permiso de lectura de auditoría para consultar las actuaciones administrativas.</p>
  </div></main>;
  return <main className="xa-audit-workspace">
    <header className="xa-audit-heading">
      <div><span className="xa-audit-eyebrow"><Icon name="shield" size={16}/> CONFIGURACIÓN Y SEGURIDAD</span>
        <h1>Auditoría</h1>
        <p>Consulta las decisiones de visibilidad y verificación de los negocios, con sus responsables, motivos y estados anterior y nuevo.</p>
      </div>
      <button className="xa-audit-refresh" type="button" onClick={result.retry} disabled={result.loading}>
        <Icon name="refresh" size={17}/> Actualizar
      </button>
    </header>
    <div className="xa-audit-toolbar">
      <form onSubmit={searchAudit}>
        <label htmlFor="xa-audit-search">Buscar negocio</label>
        <div><input id="xa-audit-search" value={draft} maxLength={100}
          onChange={e => setDraft(e.target.value)} placeholder="Nombre o ID público"/>
          <button type="submit"><Icon name="search" size={16}/> Buscar</button></div>
      </form>
      <label className="xa-audit-kind" htmlFor="xa-audit-kind">Tipo de actuación
        <select id="xa-audit-kind" value={kind} onChange={event => {
          setKind(event.target.value as AdminVisibilityAuditKind); setPage(1);
        }}>{kinds.map(item => <option key={item.value} value={item.value}>{item.text}</option>)}</select>
      </label>
      {(search || kind !== 'ALL') && <button className="xa-audit-clear" type="button" onClick={() => {
        setSearch(''); setDraft(''); setKind('ALL'); setPage(1);
      }}>Limpiar filtros</button>}
    </div>
    <div className="xa-audit-feed">
      <div className="xa-audit-feed-heading"><h2><Icon name="clock" size={20}/> Historial de visibilidad y verificación</h2>
        <span>{result.data ? `${result.data.pagination.total.toLocaleString('es-CO')} registros` : 'Consulta protegida'}</span>
      </div>
      {result.loading && <p className="xa-audit-loading" role="status">Consultando actuaciones registradas…</p>}
      {result.error && <div className="xa-audit-error" role="alert"><h3>No fue posible consultar la auditoría</h3>
        <p>{result.error}</p><button type="button" onClick={result.retry}>Reintentar</button></div>}
      {!result.loading && !result.error && result.data &&
        (result.data.entries.length ? <div className="xa-audit-list">{result.data.entries.map(item =>
          <AuditEntry key={item.id} entry={item}/>)}</div> :
          <div className="xa-audit-empty"><Icon name="shield" size={29}/><h3>Sin actuaciones para esta consulta</h3>
            <p>No se encontraron cambios de visibilidad con los filtros seleccionados.</p></div>)}
      {result.data && result.data.pagination.totalPages > 1 && <nav className="xa-audit-pages" aria-label="Páginas de auditoría">
        <span>Página {result.data.pagination.page} de {result.data.pagination.totalPages}</span>
        <div><button type="button" disabled={result.loading || page <= 1}
          onClick={() => setPage(value => Math.max(1, value - 1))}>Anterior</button>
          <button type="button" disabled={result.loading || page >= result.data.pagination.totalPages}
          onClick={() => setPage(value => value + 1)}>Siguiente</button></div>
      </nav>}
    </div>
    <footer className="xa-audit-footnote"><Icon name="shield" size={16}/>
      Los registros provienen de la misma auditoría conservada en la ficha administrativa de cada negocio.
      No se duplican actuaciones. Las fechas se muestran en hora de Bogotá. Esta vista presenta cambios de visibilidad y verificación.
    </footer>
  </main>;
}
