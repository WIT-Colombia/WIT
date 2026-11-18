import { useEffect, useState, type FormEvent } from 'react';
import { Icon } from '../../components/Icon';
import {
  getRecordHistory, type HistoryKind, type RecordHistory, type RecordState,
} from '../../services/adminBusinessRecord';
import { Empty, Loading, date, label, number, useResource } from './shared';

const categories: Array<{ key: HistoryKind; label: string; icon: string }> = [
  { key: 'ALL', label: 'Todos', icon: 'layers' },
  { key: 'VISIBILITY', label: 'Visibilidad', icon: 'eye' },
  { key: 'VERIFICATION', label: 'Verificación', icon: 'shield' },
  { key: 'SUBSCRIPTION', label: 'Suscripción', icon: 'crown' },
  { key: 'OFFER', label: 'Productos y servicios', icon: 'box' },
];

export function actionName(action: string) { return ({
  ADMIN_BUSINESS_HIDE: 'Ocultamiento administrativo anterior',
  ADMIN_BUSINESS_SET_HIDDEN: 'Negocio ocultado por Admin',
  ADMIN_BUSINESS_SET_VISIBLE: 'Visibilidad activada por Admin',
  ADMIN_BUSINESS_SUSPEND: 'Suspensión administrativa',
  ADMIN_BUSINESS_RESTORE: 'Restricción levantada',
  ADMIN_BUSINESS_DELETED: 'Eliminación administrativa',
  ADMIN_BUSINESS_VERIFIED_MANUALLY: 'Negocio verificado por Admin',
  ADMIN_BUSINESS_UNVERIFIED_MANUALLY: 'Verificación retirada por Admin',
  ADMIN_BUSINESS_PLAN_CHANGED: 'Suscripción modificada por Admin',
  ADMIN_OFFER_ACTIVATED: 'Producto o servicio activado por Admin',
  ADMIN_OFFER_DEACTIVATED: 'Producto o servicio desactivado por Admin',
  ADMIN_OFFER_DELETED: 'Producto o servicio eliminado por Admin',
  BUSINESS_VISIBILITY_SET_VISIBLE: 'Negocio reactivado desde Business',
  BUSINESS_VISIBILITY_SET_HIDDEN: 'Negocio ocultado desde Business',
  BUSINESS_CREATED: 'Registro del negocio',
  BUSINESS_UPDATED: 'Información del negocio actualizada',
  BUSINESS_PUBLISHED_AUTOMATICALLY: 'Publicación automática del negocio',
  BUSINESS_MODALITY_CREATED: 'Modalidad del negocio registrada',
  BUSINESS_MODALITY_ACTIVATED: 'Modalidad del negocio activada',
  BUSINESS_MODALITY_PAUSED: 'Modalidad del negocio pausada',
  BUSINESS_DELETION_REQUESTED: 'Eliminación solicitada',
  BUSINESS_RECOVERED: 'Negocio recuperado',
  PIONEER_ASSIGNED_AUTOMATICALLY: 'Reconocimiento pionero asignado',
  BUSINESS_PUBLISHED: 'Publicación del negocio',
  BUSINESS_VISIBILITY_EXPIRED: 'Vigencia vencida',
  BUSINESS_VERIFICATION_REQUESTED: 'Verificación solicitada',
  BUSINESS_VERIFICATION_APPROVED: 'Verificación aprobada',
  BUSINESS_VERIFICATION_REJECTED: 'Verificación rechazada',
  BUSINESS_VISIBILITY_RENEWED: 'Visibilidad renovada',
  BUSINESS_VISIBILITY_RESTORED: 'Visibilidad restituida',
  BUSINESS_OWNERSHIP_TRANSFERRED: 'Cambio de propietario',
  BUSINESS_ADULT_CLASSIFICATION_CHANGED: 'Clasificación de edad actualizada',
} as Record<string, string>)[action] ?? 'Actuación registrada'; }

type Group = 'VISIBILITY' | 'VERIFICATION' | 'SUBSCRIPTION' | 'OFFER' | 'REGISTRATION' | 'OTHER';

function groupFor(action: string): Group {
  if (/^(ADMIN_OFFER_|BUSINESS_OFFER_|OFFER_)/.test(action) || action.includes('CATALOG')) return 'OFFER';
  if (action.includes('VERIF')) return 'VERIFICATION';
  if (action.includes('PLAN') || action.includes('SUBSCRIPTION')) return 'SUBSCRIPTION';
  if (action.includes('VISIBILITY') || action.includes('PUBLISHED') || /^ADMIN_BUSINESS_(HIDE|SET_|SUSPEND|RESTORE)/.test(action)) return 'VISIBILITY';
  if (action === 'BUSINESS_CREATED') return 'REGISTRATION';
  return 'OTHER';
}

const presentation: Record<Group, { label: string; icon: string; tone: string }> = {
  VISIBILITY: { label: 'Visibilidad', icon: 'eye', tone: 'violet' },
  VERIFICATION: { label: 'Verificación', icon: 'shield', tone: 'green' },
  SUBSCRIPTION: { label: 'Suscripción', icon: 'crown', tone: 'purple' },
  OFFER: { label: 'Productos y servicios', icon: 'box', tone: 'rose' },
  REGISTRATION: { label: 'Registro', icon: 'store', tone: 'green' },
  OTHER: { label: 'Información', icon: 'file', tone: 'neutral' },
};

const fields: Record<string, string> = {
  name: 'Nombre', visibilityStatus: 'Visibilidad', publicationStatus: 'Publicación',
  lifecycleStatus: 'Ciclo del negocio', deletionStatus: 'Eliminación',
  verificationStatus: 'Verificación', administrativeRestriction: 'Restricción administrativa',
  completeness: 'Progreso de la ficha', plan: 'Suscripción',
  offerName: 'Producto o servicio', offerCode: 'Código de publicación', offerState: 'Estado del contenido',
  description: 'Descripción', sede: 'Sede', cityName: 'Ciudad', regionName: 'Región',
  adultOnly: 'Clasificación para adultos', phonePublic: 'Teléfono público',
  whatsappPublic: 'WhatsApp público', emailPublic: 'Correo público',
  status: 'Estado de modalidad', type: 'Tipo de modalidad', changedFields: 'Campos modificados',
};
type StateValue = string | number | boolean | null;
function stateLabel(key: string, value: StateValue | undefined): string {
  if (value === undefined) return 'No conservado';
  if (value === null) return key === 'administrativeRestriction' ? 'Sin restricción' : 'No registrado';
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (typeof value === 'number') return String(value) + (key === 'completeness' ? '%' : '');
  if (['name', 'offerName', 'offerCode', 'description', 'sede', 'cityName', 'regionName', 'changedFields'].includes(key)) return value;
  if (key === 'plan') return value === 'PRO' ? 'Business PRO' : value === 'BASIC' ? 'Básico' : label(value);
  if (key === 'verificationStatus' && value === 'NONE') return 'Sin verificar';
  return label(value);
}

function State({ value }: { value: RecordState }) {
  if (!value || Object.keys(value).length === 0) return <p className="bd-note">Estado no conservado en este registro.</p>;
  return <dl className="bd-history-state">{Object.entries(value).map(([key, val]) =>
    <div key={key}><dt>{fields[key] || 'Dato registrado'}</dt><dd>{stateLabel(key, val)}</dd></div>)}</dl>;
}

function mainChange(entry: RecordHistory): { before: string; after: string; field: string } | null {
  const group = groupFor(entry.action);
  if (group === 'REGISTRATION') return { before: 'No registrado', after: 'Registrado', field: 'Registro' };
  const preferred = group === 'VERIFICATION' ? ['verificationStatus']
    : group === 'SUBSCRIPTION' ? ['plan']
      : group === 'OFFER' ? ['offerState', 'publicationStatus']
        : group === 'VISIBILITY' ? ['visibilityStatus', 'administrativeRestriction', 'publicationStatus']
          : ['name', 'description', 'sede', 'cityName', 'regionName', 'adultOnly',
              'phonePublic', 'whatsappPublic', 'emailPublic', 'deletionStatus',
              'lifecycleStatus', 'publicationStatus', 'completeness', 'offerName', 'status'];
  const before = entry.previousState, after = entry.newState;
  if (!before || !after) return null;
  // Only compare explicitly persisted, actually different values. A repeated
  // autosave or an old audit with stripped fields must never fabricate a delta.
  const fieldsToCheck = [...new Set([...preferred, ...Object.keys(after), ...Object.keys(before)])];
  const field = fieldsToCheck.find(key => key !== 'changedFields'
    && Object.prototype.hasOwnProperty.call(before, key)
    && Object.prototype.hasOwnProperty.call(after, key)
    && before[key] !== after[key]);
  if (!field) return null;
  const previous = stateLabel(field, before[field]);
  let next = stateLabel(field, after[field]);
  if (group === 'VISIBILITY' && entry.action.includes('SUSPEND')
    && after.administrativeRestriction === 'SUSPENDED') next = 'Suspendido';
  return { before: previous, after: next, field: fields[field] ?? 'Estado' };
}
function hasSnapshot(value: RecordState): boolean {
  return Boolean(value && Object.keys(value).some(key => key !== 'changedFields'));
}

function toneFor(value: string): string {
  if (/suspend|ocult|rechaz|elimin|desactivad|vencid/i.test(value)) return 'red';
  if (/pendiente|revisi[oó]n|sin verificar|solicit/i.test(value)) return 'amber';
  if (/visible|registrado|verificado|activado|activo|aprobado/i.test(value)) return 'green';
  if (/business pro/i.test(value)) return 'purple';
  return 'neutral';
}
function actorFor(entry: RecordHistory) {
  return entry.actor?.displayName || (entry.action === 'BUSINESS_VISIBILITY_EXPIRED' ? 'Sistema' : 'Responsable no disponible');
}

export function HistoryTimeline({ entries, compact = false }: { entries: RecordHistory[]; compact?: boolean }) {
  return <ol className={compact ? 'bd-timeline bd-timeline--compact' : 'bd-history-list'}>
    {entries.map(entry => {
      const style = presentation[groupFor(entry.action)];
      const change = mainChange(entry);
      const changedFields = typeof entry.newState?.changedFields === 'string' ? entry.newState.changedFields : '';
      const hasStates = hasSnapshot(entry.previousState) || hasSnapshot(entry.newState);
      const expandable = hasStates || Boolean(entry.reason && entry.comment);
      return <li className="bd-history-item" key={entry.id}>
        <span className="bd-history-point" aria-hidden="true"/>
        <article className={'bd-history-entry' + (!change ? ' bd-history-entry--no-comparison' : '')}
          aria-label={actionName(entry.action)}>
          <div className="bd-history-entry-intro">
            <span className={'bd-history-event-icon bd-history-tone--' + style.tone}><Icon name={style.icon} size={23}/></span>
            <div className="bd-history-entry-identity">
              <div className="bd-history-entry-title"><strong>{actionName(entry.action)}</strong>
                <span className={'bd-history-category bd-history-tone--' + style.tone}>{style.label}</span></div>
              <time dateTime={entry.createdAt}><Icon name="calendar" size={14}/>{date(entry.createdAt)}</time>
            </div>
          </div>
          <div className="bd-history-entry-context">
            <p><Icon name="users" size={15}/><span>Responsable: <strong>{actorFor(entry)}</strong></span></p>
            {entry.reason
              ? <p><Icon name="file" size={15}/><span>Motivo: {entry.reason}</span></p>
              : entry.comment && <p><Icon name="file" size={15}/><span>Observación: {entry.comment}</span></p>}
            {changedFields && <p><Icon name="file" size={15}/><span>Campos modificados: {changedFields}</span></p>}
            {!change && !changedFields && <p className="bd-history-missing-detail">
              <Icon name="info" size={15}/><span>El registro original no incluye el detalle del cambio.</span></p>}
          </div>
          {change && <div className="bd-history-transition" aria-label={'Cambio de ' + change.field}>
            <div><small>Estado anterior</small><span className={'bd-history-state-pill bd-history-state-pill--' + toneFor(change.before)}>{change.before}</span></div>
            <Icon name="arrow" size={18}/>
            <div><small>Estado nuevo</small><span className={'bd-history-state-pill bd-history-state-pill--' + toneFor(change.after)}>{change.after}</span></div>
          </div>}
          {!compact && expandable && <details className="bd-history-details bd-history-entry-details">
            <summary>Ver detalles del registro</summary>
            {entry.reason && entry.comment && <p><strong>Observaciones:</strong> {entry.comment}</p>}
            {hasStates && <div><section><h3>Estado anterior</h3><State value={entry.previousState}/></section>
              <section><h3>Estado nuevo</h3><State value={entry.newState}/></section></div>}
          </details>}
        </article>
      </li>;
    })}
  </ol>;
}

export function HistoryPanel({ businessId, revision }: { businessId: string; revision: number }) {
  const [draft, setDraft] = useState(''), [search, setSearch] = useState('');
  const [kind, setKind] = useState<HistoryKind>('ALL'), [page, setPage] = useState(1);
  useEffect(() => {
    const handle = setTimeout(() => {
      const next = draft.trim();
      if (next !== search) { setPage(1); setSearch(next); }
    }, 350);
    return () => clearTimeout(handle);
  }, [draft, search]);
  const history = useResource(
    () => getRecordHistory(businessId, page, { kind, search }),
    [businessId, page, kind, search, revision],
  );
  const applySearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setPage(1); setSearch(draft.trim());
  };
  const pagination = history.data?.pagination;
  const firstPage = pagination && Math.max(1, Math.min(pagination.page - 1, pagination.totalPages - 2));
  const pages = pagination ? Array.from({ length: Math.min(3, pagination.totalPages) },
    (_, index) => (firstPage || 1) + index) : [];

  return <section className="bd-history-panel" aria-label="Historial administrativo del negocio">
    <header className="bd-history-heading">
      <span className="bd-history-heading-icon"><Icon name="clock" size={23}/></span>
      <div><h2>Historial administrativo</h2><p>Consulta las actuaciones registradas de este negocio, con responsables, fechas, motivos y cambios aplicados.</p></div>
    </header>
    <div className="bd-history-surface">
      <div className="bd-history-toolbar">
        <form className="bd-history-search" role="search" onSubmit={applySearch}>
          <Icon name="search" size={18}/>
          <input aria-label="Buscar por actuación o responsable" placeholder="Buscar por actuación o responsable"
            value={draft} onChange={event => setDraft(event.target.value)} maxLength={100}/>
          <button type="submit" aria-label="Buscar actuaciones"><Icon name="arrow" size={17}/></button>
        </form>
        <div className="bd-history-filters" role="group" aria-label="Filtrar actuaciones">
          {categories.map(option => <button key={option.key} type="button"
            className={option.key === kind ? 'bd-history-filter bd-history-filter--active' : 'bd-history-filter'}
            aria-pressed={option.key === kind} onClick={() => { setKind(option.key); setPage(1); }}>
            {option.key !== 'ALL' && <Icon name={option.icon} size={16}/>}
            {option.label}
          </button>)}
        </div>
      </div>
      {history.loading ? <Loading {...history}/> : history.error ? <Loading {...history}/> : history.data && (
        history.data.history.length
          ? <HistoryTimeline entries={history.data.history}/>
          : <Empty icon="clock" title={search || kind !== 'ALL' ? 'Sin resultados para esta búsqueda' : 'Sin actuaciones registradas'}
              message={search || kind !== 'ALL' ? 'Prueba otra búsqueda o selecciona Todos.' : 'Aún no hay registros de auditoría para este negocio.'}/>
      )}
      {pagination && !history.loading && !history.error && pagination.totalPages > 0 && <nav className="bd-history-pagination" aria-label="Páginas del historial">
        <span>{number(pagination.total)} {pagination.total === 1 ? 'actuación' : 'actuaciones'}</span>
        <div>
          <button type="button" disabled={page <= 1} onClick={() => setPage(value => value - 1)}> <Icon name="arrow" size={15}/>Anterior</button>
          {pages.map(item => <button key={item} type="button" aria-label={'Página ' + item}
            aria-current={item === page ? 'page' : undefined}
            className={item === page ? 'bd-history-page-active' : ''}
            onClick={() => setPage(item)}>{item}</button>)}
          <button type="button" disabled={page >= pagination.totalPages} onClick={() => setPage(value => value + 1)}>Siguiente<Icon name="arrow" size={15}/></button>
        </div>
      </nav>}
      <p className="bd-history-source-note">Registro de consulta. Horarios expresados en Bogotá (UTC−5). Las actuaciones no pueden modificarse desde esta pestaña.</p>
    </div>
  </section>;
}
