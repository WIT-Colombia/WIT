import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  getAdminBusiness, getAdminBusinessesOverview, adminBusinessVisibilityLabel,
  type AdminBusinessRecord, type AdminVisibilityAction,
} from '../services/adminApiClient';
import { StatePanel } from '../components/common';
import { Icon } from '../components/Icon';
import { getSession } from '../services/adminService';
import { AdminBusinessDeleteDialog } from '../components/businesses/AdminBusinessDeleteDialog';
import { AdminBusinessVisibilityDialog } from '../components/businesses/AdminBusinessVisibilityDialog';
import { AdminBusinessAuditTimeline } from './AdminBusinessAuditTimeline';
import './AdminBusinessesRefresh.css';
import './AdminBusinessesControl.css';

export { AdminBusinessesPage } from './AdminBusinessesDirectoryPage';

const date = (value: string) => new Intl.DateTimeFormat('es-CO', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
}).format(new Date(value));
const categoryName = (category: AdminBusinessRecord['category']) =>
  category.translations.find(item => item.locale === 'es-CO')?.name ??
  category.translations.find(item => item.locale === 'es')?.name ??
  category.translations[0]?.name ?? category.code ?? 'Sin categoría';
const visibilityTone: Record<string, string> = {
  VISIBLE: 'status-visible', HIDDEN: 'status-hidden', EXPIRED: 'status-expired', REVIEW: 'status-review',
};
const verificationTone: Record<string, string> = {
  NONE: 'status-none', PENDING: 'status-pending', INFORMATION: 'status-information',
  APPROVED: 'status-approved', REJECTED: 'status-rejected',
};
const verificationLabels: Record<string, string> = {
  NONE: 'Sin verificar', PENDING: 'Pendiente de verificación', INFORMATION: 'Información solicitada',
  APPROVED: 'Verificado', REJECTED: 'Rechazado',
};
const translatedStatus = (labels: Record<string, string>, value: string) => labels[value] ?? 'Estado no reconocido';

export function AdminBusinessDetailPage() {
  const allowed = getSession()?.permissions?.includes('business:write') ?? false;
  const canDelete = getSession()?.role === 'SUPER_ADMIN';
  const [managementReady, setManagementReady] = useState(false);
  const navigate = useNavigate();
  const [deleteTarget, setDeleteTarget] = useState<AdminBusinessRecord | null>(null);
  const [visibilityAction, setVisibilityAction] = useState<AdminVisibilityAction | null>(null);
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState('');
  const { id = '' } = useParams();
  const [item, setItem] = useState<AdminBusinessRecord | null>(null);
  const [loading, setLoading] = useState(allowed);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!allowed) return;
    let active = true;
    getAdminBusiness(id).then(result => { if (active) setItem(result); }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'No se pudo consultar el negocio.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [allowed, id, revision]);
  useEffect(() => {
    if (!allowed) return;
    let active = true;
    void getAdminBusinessesOverview().then(() => { if (active) setManagementReady(true); })
      .catch(() => { if (active) setManagementReady(false); });
    return () => { active = false; };
  }, [allowed]);
  if (!allowed) return <StatePanel kind="error" title="Acceso restringido" message="Necesitas permiso para consultar negocios." />;
  if (loading) return <StatePanel kind="loading" title="Cargando negocio" message="Consultando el registro real." />;
  if (error || !item) return <StatePanel kind="error" title="No se pudo abrir el negocio" message={error || 'No encontramos el registro.'} />;
  return <div className="admin-business-detail admin-business-detail-refreshed">
    {notice && <p className="ad-ops-detail-notice" role="status">{notice}</p>}
    <Link className="ad-business-detail-back" to="/businesses"><Icon name="arrow" size={17} /> Volver al directorio</Link>
    <header className="ad-business-detail-hero">
      <span className="ad-business-detail-icon"><Icon name="store" size={31} /></span>
      <div><span className="ad-business-detail-eyebrow">FICHA ADMINISTRATIVA</span><h1>{item.name}</h1><p>Registro de negocio · Actualizado el {date(item.updatedAt)}</p></div>
      {canDelete && item.deletionStatus !== 'DELETED' && <div className="ad-ops-detail-actions">
        {managementReady && (item.administrativeRestriction ? <>
          {item.administrativeRestriction === 'HIDDEN' && <button type="button" className="ad-ops-suspend-action" onClick={() => setVisibilityAction('SUSPEND')}><Icon name="lock" size={17}/> Suspender</button>}
          {item.administrativeRestriction === 'SUSPENDED' && <button type="button" onClick={() => setVisibilityAction('HIDE')}><Icon name="eye-off" size={17}/> Cambiar a ocultamiento</button>}
          <button type="button" className="ad-ops-restore-action" onClick={() => setVisibilityAction('RESTORE')}><Icon name="check" size={17}/> Levantar restricción</button>
        </>
          : <><button type="button" onClick={() => setVisibilityAction('HIDE')}><Icon name="eye-off" size={17}/> Ocultar</button>
            <button type="button" className="ad-ops-suspend-action" onClick={() => setVisibilityAction('SUSPEND')}><Icon name="lock" size={17}/> Suspender</button></>)}
        <button type="button" className="ad-business-delete-trigger" onClick={() => setDeleteTarget(item)}><Icon name="trash" size={17}/> Eliminar negocio</button>
      </div>}
    </header>
    <section className="admin-business-facts ad-business-detail-highlights" aria-label="Estado del negocio">
      <article><span><Icon name="eye" size={18} /> Visibilidad</span><strong className={'business-status-text ' + (item.administrativeRestriction === 'SUSPENDED' ? 'status-expired' : item.administrativeRestriction === 'HIDDEN' ? 'status-hidden' : (visibilityTone[item.visibilityStatus] ?? 'status-review'))}>{adminBusinessVisibilityLabel(item)}</strong></article>
      <article><span><Icon name="shield" size={18} /> Verificación</span><strong className={'business-status-text ' + (verificationTone[item.verificationStatus] ?? 'status-information')}>{translatedStatus(verificationLabels, item.verificationStatus)}</strong></article>
      <article><span><Icon name="check" size={18} /> Completitud</span><strong>{item.completeness}%</strong></article>
      <article><span><Icon name="crown" size={18} /> Suscripción</span><strong>{item.isPro === true ? 'Business PRO' : item.isPro === false ? 'Plan Básico' : 'Pendiente de confirmar'}</strong></article>
      <article><span><Icon name="flag" size={18} /> Reportes recibidos</span><strong>{item._count?.reports ?? 0}</strong></article>
    </section>
    <section className="panel admin-business-information ad-business-detail-information" aria-labelledby="ad-business-detail-info-title">
      <div className="ad-business-detail-section-heading"><span className="ad-business-detail-section-icon"><Icon name="grid" size={22} /></span>
        <div><h2 id="ad-business-detail-info-title">Información general</h2><p>Datos registrados y disponibles para consulta administrativa.</p></div>
      </div>
      <dl>
        <div><dt>Nombre del negocio</dt><dd>{item.name}</dd></div>
        <div><dt>Categoría</dt><dd>{categoryName(item.category)}</dd></div>
        <div><dt>Propietario actual</dt><dd>{item.memberships?.[0]?.user?.displayName || 'No registrado'}</dd></div>
        <div><dt>Registrado por</dt><dd>{item.createdBy.displayName || 'No registrado'}</dd></div>
        <div><dt>ID público</dt><dd className="ad-ops-id">{item.publicId}</dd></div>
        <div><dt>Publicación</dt><dd>{item.publicationStatus}</dd></div>
        <div><dt>Productos y servicios</dt><dd>{item._count?.offers ?? 0} publicaciones registradas</dd></div>
        <div><dt>Opiniones</dt><dd>{item._count?.reviews ?? 0} registros</dd></div>
        <div><dt>Cuentas vinculadas</dt><dd>{item._count?.memberships ?? 0} miembros</dd></div>
        <div><dt>Fecha de registro</dt><dd>{date(item.createdAt)}</dd></div>
        <div><dt>Ubicación</dt><dd>{item.location ? [item.location.address, item.location.cityName, item.location.countryCode].filter(Boolean).join(', ') : 'No registrada'}</dd></div>
        <div><dt>Correo electrónico</dt><dd>{item.email ?? 'No registrado'}</dd></div>
        <div><dt>Teléfono</dt><dd>{item.phone ?? 'No registrado'}</dd></div>
        <div className="ad-business-detail-description"><dt>Descripción</dt><dd>{item.description ?? 'No registrada'}</dd></div>
      </dl>
    </section>
    {item.administrativeRestriction && <div className="ad-ops-restriction-status" role="status">
      <Icon name="shield" size={19}/><div><strong>Restricción administrativa vigente</strong>
        <p>Medida: {item.administrativeRestriction === 'SUSPENDED' ? 'Suspensión' : 'Ocultamiento'}.
          {item.administrativeRestrictedAt ? ' Desde ' + date(item.administrativeRestrictedAt) : ''}
          {item.administrativeRestrictionReason ? ' · Motivo: ' + item.administrativeRestrictionReason : ''}</p>
      </div>
    </div>}
    {managementReady && <AdminBusinessAuditTimeline businessId={item.id} revision={revision} />}
    {visibilityAction && <AdminBusinessVisibilityDialog business={item} action={visibilityAction}
      onClose={() => setVisibilityAction(null)}
      onSuccess={message => { setVisibilityAction(null); setNotice(message); setRevision(n => n + 1); }}/>}
    {deleteTarget && <AdminBusinessDeleteDialog business={deleteTarget}
      onClose={() => setDeleteTarget(null)}
      onSuccess={() => navigate("/businesses", { replace: true })}/>}
  </div>;
}
