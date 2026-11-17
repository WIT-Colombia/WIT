import { Icon } from '../../components/Icon';
import type { RecordHistory, RecordState } from '../../services/adminBusinessRecord';
import { date, label } from './shared';

export function actionName(action: string) { return ({
  ADMIN_BUSINESS_HIDE: 'Ocultamiento administrativo anterior', ADMIN_BUSINESS_SET_HIDDEN: 'Negocio ocultado por Admin',
  ADMIN_BUSINESS_SET_VISIBLE: 'Visibilidad activada por Admin', ADMIN_BUSINESS_SUSPEND: 'Suspensión administrativa',
  ADMIN_BUSINESS_RESTORE: 'Restricción levantada', ADMIN_BUSINESS_DELETED: 'Eliminación administrativa',
  ADMIN_BUSINESS_VERIFIED_MANUALLY: 'Negocio verificado por Admin',
  ADMIN_BUSINESS_UNVERIFIED_MANUALLY: 'Verificación retirada por Admin',
  BUSINESS_VISIBILITY_SET_VISIBLE: 'Negocio reactivado desde Business',
  BUSINESS_VISIBILITY_SET_HIDDEN: 'Negocio ocultado desde Business',
  BUSINESS_CREATED: 'Registro del negocio', BUSINESS_UPDATED: 'Información actualizada', BUSINESS_PUBLISHED: 'Publicación del negocio', BUSINESS_VISIBILITY_EXPIRED: 'Vigencia vencida',
  BUSINESS_VERIFICATION_REQUESTED: 'Verificación solicitada', BUSINESS_VERIFICATION_APPROVED: 'Verificación aprobada', BUSINESS_VERIFICATION_REJECTED: 'Verificación rechazada', BUSINESS_VISIBILITY_RENEWED: 'Visibilidad renovada', BUSINESS_VISIBILITY_RESTORED: 'Visibilidad restituida', BUSINESS_OWNERSHIP_TRANSFERRED: 'Cambio de propietario', BUSINESS_ADULT_CLASSIFICATION_CHANGED: 'Clasificación de edad actualizada',
} as Record<string, string>)[action] ?? 'Actuación registrada'; }
const fields: Record<string, string> = { name: 'Nombre', visibilityStatus: 'Visibilidad', publicationStatus: 'Publicación', lifecycleStatus: 'Ciclo del negocio', deletionStatus: 'Eliminación', verificationStatus: 'Verificación', administrativeRestriction: 'Restricción administrativa', completeness: 'Completitud' };
function State({ value }: { value: RecordState }) {
  if (!value || Object.keys(value).length === 0) return <p className="bd-note">Estado no conservado en este registro.</p>;
  return <dl className="bd-history-state">{Object.entries(value).map(([key, val]) => <div key={key}><dt>{fields[key] || 'Dato registrado'}</dt><dd>{val === null ? key === 'administrativeRestriction' ? 'Sin restricción' : 'No registrado' : typeof val === 'boolean' ? val ? 'Sí' : 'No' : typeof val === 'number' ? `${val}${key === 'completeness' ? '%' : ''}` : key === 'name' ? val : key === 'verificationStatus' && val === 'APPROVED' ? 'Verificado' : key === 'verificationStatus' && val === 'NONE' ? 'Sin verificar' : label(val)}</dd></div>)}</dl>;
}
export function HistoryTimeline({ entries, compact = false }: { entries: RecordHistory[]; compact?: boolean }) {
  return <ol className={`bd-timeline ${compact ? 'bd-timeline--compact' : ''}`}>{entries.map(entry => <li key={entry.id}><span className="bd-timeline-dot"><Icon name={entry.action.includes('DELETED') ? 'trash' : entry.action.includes('SUSPEND') ? 'lock' : entry.action.includes('RESTORE') ? 'check' : 'shield'} size={16}/></span><div><header><strong>{actionName(entry.action)}</strong><time dateTime={entry.createdAt}>{date(entry.createdAt)}</time></header><p>{entry.reason || entry.comment || 'Sin observaciones adicionales registradas.'}</p><small>{entry.actor?.displayName || (entry.action === 'BUSINESS_VISIBILITY_EXPIRED' ? 'Sistema' : 'Responsable no disponible')}</small>{!compact && <>{entry.reason && entry.comment && <p>Observaciones: {entry.comment}</p>}<details className="bd-history-details"><summary>Consultar estado anterior y nuevo</summary><div><section><h3>Estado anterior</h3><State value={entry.previousState}/></section><section><h3>Estado nuevo</h3><State value={entry.newState}/></section></div></details></>}</div></li>)}</ol>;
}
