import { AdminPageHeading } from '../components/AdminPageHeading';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { getSession } from '../services/adminService';
import {
  getAdminVisibilityAudit, getAdminSecurityAudit, type AdminSecurityAuditEntry, type AdminVisibilityAuditKind,
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
  { value: 'SUBSCRIPTION', text: 'Suscripción' },
];
const auditDate = (createdAt: string) => new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Bogota',
}).format(new Date(createdAt));
const stateNames: Record<string, string> = {
  visibilityStatus: 'Visibilidad', administrativeRestriction: 'Restricción administrativa', verificationStatus: 'Verificación', plan: 'Suscripción',
};
function stateText(value: string | null, key: string) {
  return value === null ? key === 'administrativeRestriction' ? 'Sin restricción' : 'No registrado'
    : key === 'plan' ? value === 'PRO' ? 'Business PRO' : 'Básico'
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
  const isSubscription = entry.action === 'ADMIN_BUSINESS_PLAN_CHANGED';
  const isSuspension = entry.action.includes('SUSPEND');
  const isHidden = entry.action.includes('HIDDEN') || entry.action.includes('HIDE') || entry.action === 'ADMIN_BUSINESS_UNVERIFIED_MANUALLY';
  const tone = isSuspension ? 'suspended' : isHidden ? 'hidden' : 'visible';
  return <article className="xa-audit-event" aria-label={actionName(entry.action)}>
    <div className={`xa-audit-event-symbol xa-audit-event-symbol--${tone}`}>
      <Icon name={isSubscription ? 'crown' : isVerification ? 'shield' : isSuspension ? 'lock' : isHidden ? 'eye-off' : 'eye'} size={22}/>
    </div>
    <div className="xa-audit-event-content">
      <header className="xa-audit-event-header">
        <div><span className="xa-audit-event-kind">{isSubscription ? "CAMBIO DE SUSCRIPCIÓN" : isVerification ? "CAMBIO DE VERIFICACIÓN" : "CAMBIO DE VISIBILIDAD"}</span>
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


const securityActionLabel: Record<string, string> = {
  ADMIN_ROLE_ASSIGNED: 'Rol administrativo asignado',
  ADMIN_ROLE_REVOKED: 'Rol administrativo revocado',
  ADMIN_PERMISSION_GRANTED: 'Permiso administrativo concedido',
  ADMIN_PERMISSION_REVOKED: 'Permiso administrativo revocado',
  FINANCE_PERMISSION_GRANTED: 'Permiso financiero concedido',
  FINANCE_PERMISSION_REVOKED: 'Permiso financiero revocado',
  PAID_PLAN_AVAILABILITY_CHANGED: 'Disponibilidad global del plan modificada',
};
const securityPermissionName: Record<string, string> = {
  BUSINESSES_READ: 'Negocios', CATALOG_READ: 'Catálogo', REPORTS_REVIEW: 'Reportes',
  CONTENT_MODERATE: 'Moderación', AUDIT_READ: 'Auditoría',
  ADMINS_MANAGE: 'Administradores', PIONEER_MANAGE: 'Pioneros',
  FINANCE_READ: 'Lectura financiera', FINANCE_MANAGE: 'Gestión financiera',
};
function SecurityEvent({ entry }: { entry: AdminSecurityAuditEntry }) {
  const isRevocation = entry.action.includes('REVOKED');
  return <article className="sec-security-event">
    <span className={'sec-security-event-icon ' + (isRevocation ? 'sec-security-event-revoke' : '')}>
      <Icon name={isRevocation ? 'lock' : 'shield'} size={20}/></span>
    <div className="sec-security-event-content">
      <div className="sec-security-event-head"><div><small>{entry.planKey ? 'INTERRUPTOR MAESTRO DE PLAN' : entry.action.includes('ROLE') ? 'ROL ADMINISTRATIVO' : 'PERMISO DE ACCESO'}</small>
        <h3>{securityActionLabel[entry.action] ?? 'Cambio de acceso registrado'}</h3></div>
        <time dateTime={entry.createdAt}>{auditDate(entry.createdAt)}</time></div>
      <div className="sec-security-event-details">
        <span><strong>{entry.planKey ? 'Plan afectado' : 'Cuenta afectada'}</strong>{entry.subject}</span>
        <span><strong>Responsable</strong>{entry.actor || 'No disponible'}</span>
        {entry.role && <span><strong>Rol</strong>{entry.role === 'SUPER_ADMIN' ? 'Superadministrador' : 'Administrador'}</span>}
        {entry.permission && <span><strong>Permiso</strong>{securityPermissionName[entry.permission] ?? entry.permission}</span>}
        {entry.planKey && <span><strong>Estado anterior</strong>{entry.previousEnabled === null ? 'No registrado' : entry.previousEnabled ? 'Habilitado' : 'Deshabilitado'}</span>}
        {entry.planKey && <span><strong>Estado nuevo</strong>{entry.enabled ? 'Habilitado' : 'Deshabilitado'}</span>}
      </div>
      <div className="sec-security-reason"><strong>Justificación registrada</strong><p>{entry.reason || 'Motivo no disponible en esta actuación.'}</p></div>
    </div>
  </article>;
}

function SecurityAuditPanel() {
  const [kind, setKind] = useState<'ALL' | 'ROLE' | 'PERMISSION' | 'PLANS'>('ALL');
  const [page, setPage] = useState(1);
  const result = useResource(() => getAdminSecurityAudit({ page, kind }), [page, kind], true);
  return <section className="sec-panel sec-audit-panel" aria-labelledby="sec-security-audit-title">
    <div className="sec-panel-header"><div><h2 id="sec-security-audit-title">Cambios de accesos y planes</h2>
      <p>Eventos autorizados y registrados por el servidor. Esta consulta no incluye contraseñas ni datos secretos.</p></div>
      {result.data && <span className="sec-count">{result.data.pagination.total.toLocaleString('es-CO')} actuaciones</span>}
    </div>
    <div className="sec-toolbar sec-audit-toolbar">
      <label><span>Tipo de actuación</span><select value={kind} onChange={event => { setKind(event.target.value as typeof kind); setPage(1); }}>
        <option value="ALL">Todas</option><option value="ROLE">Roles</option><option value="PERMISSION">Permisos</option><option value="PLANS">Planes</option>
      </select></label>
      <button type="button" className="sec-button" disabled={result.loading} onClick={result.retry}><Icon name="refresh" size={16}/> Actualizar</button>
    </div>
    {result.loading ? <div className="sec-state" role="status">Consultando bitácora de seguridad…</div>
      : result.error ? <div className="sec-state sec-state-error" role="alert"><strong>No fue posible consultar la auditoría de accesos</strong>
        <p>{result.error}. Comprueba que la API actualizada esté disponible.</p><button className="sec-button" onClick={result.retry}>Reintentar</button></div>
      : result.data?.entries.length ? <div className="sec-security-feed">{result.data.entries.map(entry => <SecurityEvent key={entry.id} entry={entry}/>)}</div>
      : <div className="sec-state">No hay actuaciones registradas para este filtro.</div>}
    {result.data && result.data.pagination.totalPages > 1 && <nav className="sec-pagination" aria-label="Páginas de auditoría de accesos">
      <span>Página {result.data.pagination.page} de {result.data.pagination.totalPages}</span>
      <div><button type="button" className="sec-button" disabled={result.loading || page <= 1} onClick={() => setPage(value => Math.max(1, value - 1))}>Anterior</button>
      <button type="button" className="sec-button" disabled={result.loading || page >= result.data.pagination.totalPages} onClick={() => setPage(value => value + 1)}>Siguiente</button></div>
    </nav>}
    <p className="sec-footnote"><Icon name="lock" size={16}/> Fuente: AuditLog del backend, limitado a cambios de roles, permisos y disponibilidad global de planes. Solo el superadministrador puede consultar esta vista. No representa la totalidad de eventos de seguridad de la plataforma.</p>
  </section>;
}

export function AdminAuditPage() {
  const session = getSession();
  const allowed = session?.role === 'SUPER_ADMIN' || Boolean(session?.permissions?.includes('audit:read'));
  const [source, setSource] = useState<'BUSINESS' | 'SECURITY'>('BUSINESS');
  const [kind, setKind] = useState<AdminVisibilityAuditKind>('ALL');
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const result = useResource(
    () => getAdminVisibilityAudit({ page, kind, search }),
    [page, kind, search], allowed && source === 'BUSINESS',
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
    <AdminPageHeading icon="shield" title="Auditoría" description="Consulta actuaciones administrativas reales, responsables y justificaciones. Cada fuente mantiene sus permisos y cobertura."/>
    <div className="sec-audit-sources" role="group" aria-label="Fuente de auditoría">
      <button type="button" aria-pressed={source === 'BUSINESS'} onClick={() => setSource('BUSINESS')}><Icon name="store" size={18}/> Negocios</button>
      {session?.role === 'SUPER_ADMIN' && <button type="button" aria-pressed={source === 'SECURITY'} onClick={() => setSource('SECURITY')}><Icon name="lock" size={18}/> Seguridad y accesos</button>}
    </div>
    {source === 'BUSINESS' ? <>
      <div className="sec-business-audit-actions"><span>Visibilidad, verificaciones y suscripciones</span>
        <button className="xa-audit-refresh" type="button" onClick={result.retry} disabled={result.loading}><Icon name="refresh" size={17}/> Actualizar</button></div>
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
      <div className="xa-audit-feed-heading"><h2><Icon name="clock" size={20}/> Historial de visibilidad, verificación y suscripción</h2>
        <span>{result.data ? `${result.data.pagination.total.toLocaleString('es-CO')} registros` : 'Consulta protegida'}</span>
      </div>
      {result.loading && <p className="xa-audit-loading" role="status">Consultando actuaciones registradas…</p>}
      {result.error && <div className="xa-audit-error" role="alert"><h3>No fue posible consultar la auditoría</h3>
        <p>{result.error}</p><button type="button" onClick={result.retry}>Reintentar</button></div>}
      {!result.loading && !result.error && result.data &&
        (result.data.entries.length ? <div className="xa-audit-list">{result.data.entries.map(item =>
          <AuditEntry key={item.id} entry={item}/>)}</div> :
          <div className="xa-audit-empty"><Icon name="shield" size={29}/><h3>Sin actuaciones para esta consulta</h3>
            <p>No se encontraron actuaciones con los filtros seleccionados.</p></div>)}
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
      No se duplican actuaciones. Las fechas se muestran en hora de Bogotá. Esta vista presenta cambios de visibilidad, verificación y suscripción.
    </footer>
    </> : <SecurityAuditPanel/>}
  </main>;
}
