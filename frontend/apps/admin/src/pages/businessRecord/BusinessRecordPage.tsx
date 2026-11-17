import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { StatePanel } from '../../components/common';
import { AdminBusinessDeleteDialog } from '../../components/businesses/AdminBusinessDeleteDialog';
import { AdminBusinessVisibilityDialog } from '../../components/businesses/AdminBusinessVisibilityDialog';
import { BusinessRecordPhoto, BusinessRecordPhotos } from '../../components/businesses/BusinessRecordPhoto';
import { adminBusinessVisibilityLabel, type AdminVisibilityAction } from '../../services/adminApiClient';
import { getSession } from '../../services/adminService';
import { getRecordBusiness, getRecordHistory, type RecordBusiness, type RecordHistory } from '../../services/adminBusinessRecord';
import { Activity } from './Activity';
import { Catalog } from './Catalog';
import { Gallery } from './Gallery';
import { HistoryTimeline } from './History';
import { Information, Members, Overview, owners } from './Information';
import { Reviews } from './Reviews';
import { Reports } from './Reports';
import { BusinessDecisionDialog, type BusinessDecision } from './BusinessDecisionDialog';
import { Badge, Card, Empty, Loading, Pager, categoryName, date, label, number, useResource } from './shared';
import './businessRecord.css';

const tabs = [
  { key: 'summary', title: 'Resumen', icon: 'home' }, { key: 'information', title: 'Información general', icon: 'file' },
  { key: 'catalog', title: 'Productos y servicios', icon: 'box' }, { key: 'reviews', title: 'Opiniones', icon: 'star' },
  { key: 'photos', title: 'Fotografías', icon: 'image' }, { key: 'activity', title: 'Actividad del negocio', icon: 'chart' },
  { key: 'history', title: 'Historial administrativo', icon: 'clock' },
  { key: 'reports', title: 'Reportes', icon: 'flag' },
] as const;
type Tab = typeof tabs[number]['key'];
const visibility = (business: RecordBusiness) => business.record?.effectiveVisibility === 'NOT_STARTED' && !business.administrativeRestriction ? 'Vigencia no iniciada' : adminBusinessVisibilityLabel({ ...business, visibilityStatus: business.record?.effectiveVisibility || business.visibilityStatus });
function businessState(business: RecordBusiness) {
  if (business.deletionStatus === 'DELETED') return { title: 'Eliminado administrativamente', tone: 'red', text: 'El establecimiento fue retirado. Se conserva su información y trazabilidad para consulta.' };
  if (business.administrativeRestriction === 'SUSPENDED') return { title: 'Suspensión vigente', tone: 'amber', text: 'La medida administrativa impide renovar, activar o volver a publicar el establecimiento.' };
  if (business.administrativeRestriction === 'HIDDEN') return { title: 'Ocultamiento administrativo', tone: 'amber', text: 'El establecimiento no aparece públicamente. Solo Admin puede levantar esta restricción.' };
  if (business.publicationStatus === 'PUBLISHED' && business.record?.effectiveVisibility === 'VISIBLE' && business.lifecycleStatus === 'ACTIVE' && business.record?.accountStatus === 'ACTIVE') return { title: 'Publicado y visible', tone: 'green', text: 'El registro está publicado y su estado de visibilidad es visible, sin restricciones administrativas.' };
  return { title: label(business.publicationStatus), tone: 'neutral', text: `Visibilidad: ${visibility(business)}. Ciclo del negocio: ${label(business.lifecycleStatus)}. Cuenta del negocio: ${label(business.record?.accountStatus)}.` };
}
export function BusinessRecordPage() { const { id = '' } = useParams(); return <BusinessRecord key={id} id={id}/>; }
function BusinessRecord({ id }: { id: string }) {
  const session = getSession(), allowed = Boolean(session?.permissions?.includes('business:write'));
  const catalogAllowed = Boolean(session?.permissions?.includes('catalog:read')), reviewsAllowed = Boolean(session?.permissions?.includes('content:moderate'));
  const [revision, setRevision] = useState(0), [historyPage, setHistoryPage] = useState(1), [notice, setNotice] = useState(''), [operationPending, setOperationPending] = useState(false);
  const source = useResource(() => getRecordBusiness(id), [id, revision], allowed);
  const history = useResource(() => getRecordHistory(id, historyPage), [id, revision, historyPage], allowed && Boolean(source.data));
  const [latest, setLatest] = useState<RecordHistory[]>([]);
  useEffect(() => { if (history.data?.pagination?.page === 1) setLatest(history.data.history.slice(0, 3)); }, [history.data]);
  useEffect(() => { if (source.data) setOperationPending(false); }, [source.data]);
  const [tab, setTab] = useState<Tab>('summary'), [visited, setVisited] = useState<Set<Tab>>(new Set(['summary']));
  const [visibilityAction, setVisibilityAction] = useState<AdminVisibilityAction | null>(null), [deleting, setDeleting] = useState(false);
  const [visibilityOpen, setVisibilityOpen] = useState(false);
  const [decision, setDecision] = useState<BusinessDecision | null>(null);
  const nav = useRef<HTMLDivElement>(null);
  const choose = (value: Tab) => { setVisited(old => new Set([...old, value])); setTab(value); };
  const changed = (message: string) => { setDeleting(false); setVisibilityAction(null); setVisibilityOpen(false); setDecision(null); setNotice(message); setOperationPending(true); setHistoryPage(1); setRevision(value => value + 1); };
  if (!allowed) return <StatePanel kind="error" title="Acceso restringido" message="Necesitas permiso de consulta de negocios para abrir la ficha."/>;
  if (!source.data) return source.error ? <StatePanel kind="error" title="No pudimos abrir la ficha" message={source.error} retry={source.retry}/> : <StatePanel kind="loading" title="Cargando ficha administrativa" message="Consultando el establecimiento y su información registrada."/>;
  const business = source.data, record = business.record, state = businessState(business);
  const canAct = session?.role === 'SUPER_ADMIN' && Boolean(record) && business.deletionStatus !== 'DELETED';
  const actionDisabled = source.loading || Boolean(source.error) || operationPending;
  const photoCount = record ? record.businessPhotos + (catalogAllowed ? record.catalogPhotos : 0) : 0;
  const copyId = async () => {
    try { if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(business.publicId);
      else { const input = document.createElement('textarea'); input.value = business.publicId; input.style.position = 'fixed'; input.style.left = '-10000px'; document.body.appendChild(input); input.select(); const success = document.execCommand('copy'); input.remove(); if (!success) throw new Error(); }
      setNotice('ID público copiado.');
    } catch { setNotice('No se pudo copiar automáticamente. Puedes seleccionar el ID público en la ficha.'); }
  };
  return <BusinessRecordPhotos businessId={business.id}><div className="bd-record">
    <header className="bd-topbar"><Link className="bd-back" to="/businesses"><Icon name="arrow" size={18}/><span>Volver a negocios</span></Link><div className="bd-page-title"><h1>Ficha administrativa del negocio</h1><p>{business.name}</p></div></header>
    {notice && <p className="bd-notice" role="status"><Icon name="check" size={17}/>{notice}<button aria-label="Cerrar aviso" onClick={() => setNotice('')}><Icon name="close" size={16}/></button></p>}
    {source.error && <Loading error={source.error} loading={false} retry={source.retry}/>}
    {!record && <div className="bd-error" role="alert">La ficha completa requiere la actualización del backend. Las acciones se habilitarán cuando esté disponible su información administrativa.</div>}
    <section className="bd-identity" aria-label="Identificación del establecimiento"><div className="bd-cover"><BusinessRecordPhoto id={business.coverPhotoId} alt={`Portada de ${business.name}`} size={0} eager position={record?.coverPosition} className="bd-cover-photo"/>
      <div className="bd-identity-content"><BusinessRecordPhoto id={business.profilePhotoId} alt={`Perfil de ${business.name}`} size={320} eager position={record?.profilePosition} className="bd-business-logo"/><div className="bd-identity-copy"><h2>{business.name}</h2><span className="bd-category"><Icon name="store" size={14}/>{categoryName(business.category)}</span><p className="bd-location-text"><Icon name="pin" size={16}/><span>{business.location ? [business.location.cityName, business.location.regionName].filter(Boolean).join(', ') : 'Ubicación no registrada'}</span></p><div className="bd-id-row"><span>ID público: <strong>{business.publicId}</strong></span><button aria-label="Copiar ID público" title="Copiar ID público" onClick={() => void copyId()}><Icon name="copy" size={16}/></button></div></div></div>
      {photoCount > 0 && <button className="bd-gallery-shortcut" onClick={() => choose('photos')}><Icon name="image" size={17}/>Ver galería ({number(photoCount)})</button>}</div>
      <aside className="bd-owner-card"><div><span><Icon name="users"/></span><section><small>Propietario actual</small><strong>{record ? owners(business) : 'Pendiente de consulta'}</strong></section></div><div><span><Icon name="calendar"/></span><section><small>Fecha de registro</small><time dateTime={business.createdAt}>{date(business.createdAt)}</time></section></div><div><span><Icon name="calendar"/></span><section><small>Última actualización</small><time dateTime={business.updatedAt}>{date(business.updatedAt)}</time></section></div></aside>
    </section>
    <section className="bd-indicators" aria-label="Indicadores principales">
      <article className="bd-interactive-indicator">
        <button className="bd-indicator-trigger" type="button" disabled={!canAct || actionDisabled}
          aria-expanded={visibilityOpen} aria-label="Cambiar visibilidad del negocio"
          onClick={() => setVisibilityOpen(open => !open)}>
          <span className="bd-indicator-icon"><Icon name="eye" size={25}/></span>
          <span><span className="bd-indicator-title">Visibilidad</span>
            <Badge tone={business.deletionStatus === 'DELETED' ? 'red' : business.administrativeRestriction ? 'amber' : record?.effectiveVisibility === 'VISIBLE' ? 'green' : 'neutral'}>
              {business.administrativeRestriction === 'SUSPENDED' ? 'Suspendida' : business.deletionStatus === 'DELETED' ? 'Eliminada' : visibility(business)}
            </Badge></span>
          {canAct && <Icon name="chevron" size={16}/>}
        </button>
        {visibilityOpen && canAct && <div className="bd-visibility-options" role="group" aria-label="Elegir estado de visibilidad">
          <button type="button" onClick={() => { setVisibilityOpen(false); setVisibilityAction('SET_VISIBLE'); }}><Icon name="eye" size={17}/> Visible</button>
          <button type="button" onClick={() => { setVisibilityOpen(false); setVisibilityAction('SET_HIDDEN'); }}><Icon name="eye-off" size={17}/> Oculta <small>El propietario puede reactivarla</small></button>
          <button type="button" onClick={() => { setVisibilityOpen(false); setVisibilityAction('SUSPEND'); }}><Icon name="lock" size={17}/> Suspendida <small>Solo Admin puede levantarla</small></button>
        </div>}
      </article>
      <article className="bd-interactive-indicator"><button className="bd-indicator-trigger" type="button"
        disabled={!canAct || actionDisabled || business.verificationStatus === 'APPROVED'}
        onClick={() => setDecision('verification')} aria-label="Verificar administrativamente el negocio">
        <span className="bd-indicator-icon bd-icon--violet"><Icon name="shield" size={25}/></span>
        <span><span className="bd-indicator-title">Verificación</span><Badge tone={business.verificationStatus === 'APPROVED' ? 'green' : 'amber'}>
          {business.verificationStatus === 'NONE' ? 'Sin verificar' : label(business.verificationStatus)}</Badge></span>
        {canAct && business.verificationStatus !== 'APPROVED' && <Icon name="chevron" size={16}/>}</button></article>
      <article><span className="bd-completeness"><svg viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="17" fill="none" stroke="#DCFCE7" strokeWidth="5"/><circle cx="22" cy="22" r="17" fill="none" stroke="#22C55E" strokeWidth="5" strokeLinecap="round" strokeDasharray={`${Math.max(0, Math.min(100, business.completeness)) / 100 * 106.82} 106.82`} transform="rotate(-90 22 22)"/></svg></span><div><h3>Completitud</h3><strong>{business.completeness}%</strong></div></article>
      <article className="bd-interactive-indicator"><button className="bd-indicator-trigger" type="button"
        disabled={!canAct || actionDisabled} onClick={() => setDecision('plan')} aria-label="Cambiar el plan del negocio">
        <span className="bd-indicator-icon bd-icon--violet"><Icon name="crown" size={25}/></span>
        <span><span className="bd-indicator-title">Suscripción</span><Badge tone={business.isPro ? 'violet' : 'neutral'}>
          {business.isPro === true ? 'Business PRO' : business.isPro === false ? 'Básico' : 'No disponible'}</Badge></span>
        {canAct && <Icon name="chevron" size={16}/>}</button></article>
      <article className="bd-interactive-indicator"><button className="bd-indicator-trigger" type="button"
        onClick={() => choose('reports')} aria-label="Consultar reportes de este negocio">
        <span className="bd-indicator-icon bd-icon--red"><Icon name="flag" size={25}/></span>
        <span><span className="bd-indicator-title">Reportes</span><strong className={business._count?.reports ? 'bd-report-count' : ''}>
          {business._count?.reports ?? '—'}</strong></span><Icon name="arrow" size={16}/></button></article>
    </section>
    <div ref={nav} className="bd-tabs" role="tablist" aria-label="Secciones de la ficha administrativa" onKeyDown={event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault(); const current = tabs.findIndex(item => item.key === tab), index = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      choose(tabs[index].key); const target = nav.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[index]; target?.focus({ preventScroll: true }); target?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }}>{tabs.map(item => <button role="tab" aria-selected={tab === item.key} aria-controls={`bd-panel-${item.key}`} id={`bd-tab-${item.key}`} tabIndex={tab === item.key ? 0 : -1} key={item.key} onClick={() => choose(item.key)}><Icon name={item.icon} size={17}/>{item.title}</button>)}</div>
    <div className="bd-body"><div className="bd-tab-content">{tabs.map(item => <section className="bd-tab-panel" role="tabpanel" id={`bd-panel-${item.key}`} aria-labelledby={`bd-tab-${item.key}`} hidden={tab !== item.key} key={item.key} tabIndex={0}>
      {visited.has(item.key) && (item.key === 'summary' ? <Overview business={business} latest={latest} historyStatus={history.loading || history.error ? <Loading {...history}/> : null} onActivity={() => choose('activity')} onHistory={() => choose('history')}/>
        : item.key === 'information' ? <div className="bd-information"><Information business={business}/><Members business={business}/></div>
        : item.key === 'catalog' ? <Catalog id={business.id} allowed={catalogAllowed} canModerate={catalogAllowed && Boolean(session?.permissions?.includes('content:moderate:write'))}/>
        : item.key === 'reviews' ? <Reviews business={business} allowed={reviewsAllowed}/>
        : item.key === 'photos' ? <Gallery id={business.id} catalogAllowed={catalogAllowed}/>
        : item.key === 'activity' ? <Activity id={business.id}/>
        : item.key === 'reports' ? <Reports businessId={business.id} businessName={business.name}/>
        : <Card title="Historial administrativo" icon="clock"><p className="bd-card-caption">Actuaciones conservadas en la auditoría. Fechas en hora de Bogotá.</p><Loading {...history}/>{!history.loading && !history.error && history.data && <>{history.data.history.length ? <HistoryTimeline entries={history.data.history}/> : <Empty icon="clock" title="Sin actuaciones registradas" message="No se encontraron registros de auditoría para este establecimiento."/>}{history.data.pagination && <Pager pagination={history.data.pagination} onPage={setHistoryPage}/>}</>}</Card>)}
    </section>)}</div><aside className="bd-administration">
      <Card title="Estado administrativo" icon="layers"><div className={`bd-current-state bd-current-state--${state.tone}`}><Icon name={state.tone === 'green' ? 'check' : state.tone === 'red' ? 'trash' : 'shield'} size={22}/><div><h3>{state.title}</h3><p>{state.text}</p></div></div>{business.administrativeRestriction && <div className="bd-restriction"><strong>Motivo registrado</strong><p>{business.administrativeRestrictionReason || 'Sin motivo disponible.'}</p>{business.administrativeRestrictedAt && <small>Desde {date(business.administrativeRestrictedAt)}</small>}</div>}</Card>
      <Card title="Acciones administrativas" icon="settings"><p className="bd-action-hint"><Icon name="info" size={17}/>Las acciones disponibles dependen del estado del negocio y los permisos de tu cuenta.</p>
        {canAct ? <div className="bd-action-list">{business.administrativeRestriction === 'SUSPENDED' ? <button disabled={actionDisabled} className="bd-action bd-action--hide" onClick={() => setVisibilityAction('SET_HIDDEN')}><Icon name="eye-off" size={18}/>Cambiar a ocultamiento</button> : business.administrativeRestriction !== 'HIDDEN' && <button disabled={actionDisabled} className="bd-action bd-action--hide" onClick={() => setVisibilityAction('SET_HIDDEN')}><Icon name="eye-off" size={18}/>Ocultar negocio</button>}
          {business.administrativeRestriction !== 'SUSPENDED' && <button disabled={actionDisabled} className="bd-action bd-action--suspend" onClick={() => setVisibilityAction('SUSPEND')}><Icon name="lock" size={18}/>Suspender negocio</button>}
          {business.administrativeRestriction && <button disabled={actionDisabled} className="bd-action bd-action--restore" onClick={() => setVisibilityAction('RESTORE')}><Icon name="check" size={18}/>Levantar restricción</button>}
          <div className="bd-danger-zone"><button disabled={actionDisabled} className="bd-action bd-action--delete" onClick={() => setDeleting(true)}><Icon name="trash" size={18}/>Eliminar administrativamente</button></div>
        </div> : <p className="bd-note">{business.deletionStatus === 'DELETED' ? 'El negocio está eliminado. Su información e historial permanecen disponibles para consulta.' : !record ? 'Actualiza el backend para confirmar las acciones disponibles.' : 'Estas medidas están reservadas al administrador principal.'}</p>}
        <details className="bd-action-help"><summary><Icon name="info" size={18}/>¿Qué hace cada acción?</summary><p><strong>Ocultar:</strong> retira la visibilidad pública; el propietario puede reactivarla desde Business con vigencia válida.</p><p><strong>Suspender:</strong> también impide renovar o activar el establecimiento.</p><p><strong>Levantar restricción:</strong> conserva la vigencia y el ocultamiento voluntario; no concede nuevos días.</p><p><strong>Eliminar:</strong> retira el negocio, cancela transferencias pendientes y revoca sus planes. Conserva la cuenta del propietario y la auditoría.</p></details>
      </Card><p className="bd-security-note"><Icon name="shield" size={15}/>Cada medida requiere confirmación y motivo. Las decisiones se conservan en el historial.</p><button className="bd-button bd-refresh" disabled={source.loading} onClick={() => { setHistoryPage(1); setRevision(value => value + 1); }}><Icon name="refresh" size={16}/>Actualizar ficha</button>
    </aside></div>
    {visibilityAction && <AdminBusinessVisibilityDialog business={business} action={visibilityAction} onClose={() => setVisibilityAction(null)} onSuccess={changed}/>}
    {deleting && <AdminBusinessDeleteDialog business={business} onClose={() => setDeleting(false)} onSuccess={changed}/>}
    {decision && <BusinessDecisionDialog business={business} decision={decision}
      onClose={() => setDecision(null)} onSuccess={changed}/>}
  </div></BusinessRecordPhotos>;
}
