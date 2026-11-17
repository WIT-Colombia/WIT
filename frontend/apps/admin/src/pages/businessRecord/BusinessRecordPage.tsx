import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { AdminDialog } from '../../components/AdminDialog';
import { StatePanel } from '../../components/common';
import { AdminBusinessVisibilityDialog } from '../../components/businesses/AdminBusinessVisibilityDialog';
import { AdminBusinessVisibilityPicker } from './AdminBusinessVisibilityPicker';
import { AdminBusinessVerificationPicker } from './AdminBusinessVerificationPicker';
import { AdminBusinessSubscriptionPicker } from './AdminBusinessSubscriptionPicker';
import { BusinessRecordPhoto, BusinessRecordPhotos } from '../../components/businesses/BusinessRecordPhoto';
import { adminBusinessVisibilityLabel, type AdminVisibilityAction } from '../../services/adminApiClient';
import { getSession } from '../../services/adminService';
import { getRecordBusiness, getRecordHistory, type RecordBusiness, type RecordHistory } from '../../services/adminBusinessRecord';
import { Activity } from './Activity';
import { Catalog } from './Catalog';
import { Gallery } from './Gallery';
import { HistoryTimeline } from './History';
import { Information, Members, owners } from './Information';
import { Overview } from './Overview';
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
  const [visibilityAction, setVisibilityAction] = useState<AdminVisibilityAction | null>(null);
  const [visibilityOpen, setVisibilityOpen] = useState(false);
  const [verificationOpen, setVerificationOpen] = useState(false);
  const [subscriptionOpen, setSubscriptionOpen] = useState(false);
  const [referralsOpen, setReferralsOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'BASIC' | 'PRO' | null>(null);
  const [decision, setDecision] = useState<BusinessDecision | null>(null);
  const nav = useRef<HTMLDivElement>(null);
  const choose = (value: Tab) => { setVisited(old => new Set([...old, value])); setTab(value); };
  const openSection = (value: Tab) => {
    choose(value);
    nav.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  };
  const changed = (message: string) => { setVisibilityAction(null); setVisibilityOpen(false); setVerificationOpen(false); setSubscriptionOpen(false); setSelectedPlan(null); setDecision(null); setNotice(message); setOperationPending(true); setHistoryPage(1); setRevision(value => value + 1); };
  if (!allowed) return <StatePanel kind="error" title="Acceso restringido" message="Necesitas permiso de consulta de negocios para abrir la ficha."/>;
  if (!source.data) return source.error ? <StatePanel kind="error" title="No pudimos abrir la ficha" message={source.error} retry={source.retry}/> : <StatePanel kind="loading" title="Cargando ficha administrativa" message="Consultando el establecimiento y su información registrada."/>;
  const business = source.data, record = business.record;
  // Visibility is available from the basic business record, even when the
  // extended administrative detail endpoint has not been deployed yet.
  // Mutations remain SUPER_ADMIN-only and are authorized again by the backend.
  const canChangeVisibility = session?.role === 'SUPER_ADMIN' && business.deletionStatus !== 'DELETED';
  const canChangeVerification = canChangeVisibility;
  const canChangeSubscription = canChangeVisibility;
  const actionDisabled = source.loading || Boolean(source.error) || operationPending;
  const photoCount = record ? record.businessPhotos + (catalogAllowed ? record.catalogPhotos : 0) : 0;
  const referralCount = record?.referrals;
  const publicBusinessUrl = 'https://user.xamuko.com/business/' + encodeURIComponent(business.publicId);
  return <BusinessRecordPhotos businessId={business.id}><div className="bd-record">
    <header className="bd-topbar"><Link className="bd-back" to="/businesses"><Icon name="arrow" size={18}/><span>Volver a negocios</span></Link><div className="bd-page-title"><h1>Ficha administrativa del negocio</h1><p>{business.name}</p></div>
      <a className="bd-public-business-link" href={publicBusinessUrl} target="_blank" rel="noopener noreferrer"
        aria-label={'Ver ficha pública de ' + business.name + ' en Xamuko'} title="Abrir la ficha pública en una pestaña nueva">
        <Icon name="eye" size={17}/><span>Ver negocio</span><span className="bd-public-business-link-context">en Xamuko</span><Icon name="arrow" size={16}/>
      </a></header>
    {notice && <p className="bd-notice" role="status"><Icon name="check" size={17}/>{notice}<button aria-label="Cerrar aviso" onClick={() => setNotice('')}><Icon name="close" size={16}/></button></p>}
    {source.error && <Loading error={source.error} loading={false} retry={source.retry}/>}
    {!record && <div className="bd-error" role="status">La información administrativa ampliada todavía no está disponible. Puedes gestionar la visibilidad desde su tarjeta si tienes autorización; algunas otras funciones requieren la actualización del backend.</div>}
    <section className="bd-identity" aria-label="Identificación del establecimiento"><div className="bd-cover">
      <div className="bd-identity-content"><BusinessRecordPhoto id={business.profilePhotoId} alt={`Perfil de ${business.name}`} size={320} eager position={record?.profilePosition} className="bd-business-logo" fallbackLetter={business.name}/><div className="bd-identity-copy"><h2>{business.name}</h2><span className="bd-category"><Icon name="store" size={14}/>{categoryName(business.category)}</span><p className="bd-location-text"><Icon name="pin" size={16}/><span>{business.location ? [business.location.cityName, business.location.regionName].filter(Boolean).join(', ') : 'Ubicación no registrada'}</span></p></div></div>
      {photoCount > 0 && <button className="bd-gallery-shortcut" onClick={() => choose('photos')}><Icon name="image" size={17}/>Ver galería ({number(photoCount)})</button>}</div>
      <aside className="bd-owner-card"><div><span><Icon name="users"/></span><section><small>Propietario actual</small><strong>{record ? owners(business) : 'Pendiente de consulta'}</strong></section></div><div><span><Icon name="calendar"/></span><section><small>Fecha de registro</small><time dateTime={business.createdAt}>{date(business.createdAt)}</time></section></div><div><span><Icon name="calendar"/></span><section><small>Última actualización</small><time dateTime={business.updatedAt}>{date(business.updatedAt)}</time></section></div></aside>
    </section>
    <section className="bd-indicators" aria-label="Indicadores principales">
      <article className="bd-interactive-indicator">
        <button className="bd-indicator-trigger" type="button" disabled={!canChangeVisibility || actionDisabled}
          aria-expanded={visibilityOpen} aria-haspopup="dialog" aria-label="Cambiar visibilidad del negocio"
          onClick={() => setVisibilityOpen(open => !open)}>
          <span className="bd-indicator-icon"><Icon name="eye" size={25}/></span>
          <span className="bd-indicator-content"><span className="bd-indicator-title">Visibilidad</span>
            <Badge tone={business.deletionStatus === 'DELETED' ? 'red' : business.administrativeRestriction ? 'amber' : (record?.effectiveVisibility ?? business.visibilityStatus) === 'VISIBLE' ? 'visible' : 'neutral'}>
              {business.administrativeRestriction === 'SUSPENDED' ? 'Suspendida' : business.deletionStatus === 'DELETED' ? 'Eliminado' : visibility(business)}
            </Badge></span>
          {canChangeVisibility && <Icon name="chevron" size={16}/>}
        </button>
      </article>
      <article className="bd-interactive-indicator"><button className="bd-indicator-trigger" type="button"
        disabled={!canChangeVerification || actionDisabled}
        aria-expanded={verificationOpen} aria-haspopup="dialog" aria-label="Cambiar verificación del negocio"
        onClick={() => setVerificationOpen(open => !open)}>
        <span className="bd-indicator-icon bd-icon--violet"><Icon name="shield" size={25}/></span>
        <span className="bd-indicator-content"><span className="bd-indicator-title">Verificación</span><Badge tone={business.verificationStatus === 'APPROVED' ? 'green' : business.verificationStatus === 'NONE' ? 'neutral' : 'amber'}>
          {business.verificationStatus === 'APPROVED' ? 'Verificado' : business.verificationStatus === 'NONE' ? 'Sin verificar' : label(business.verificationStatus)}</Badge></span>
        {canChangeVerification && <Icon name="chevron" size={16}/>}</button></article>
      <article className="bd-interactive-indicator">
        <button className="bd-indicator-trigger" type="button" aria-label="Consultar referidos del negocio"
          aria-haspopup="dialog" aria-expanded={referralsOpen} onClick={() => setReferralsOpen(true)}>
          <span className="bd-indicator-icon bd-icon--violet"><Icon name="users" size={25}/></span>
          <span className="bd-indicator-content"><span className="bd-indicator-title">Referidos</span>
            <strong className="bd-referrals-count">{referralCount === undefined ? '—' : number(referralCount)}</strong></span>
          <Icon name="arrow" size={16}/>
        </button>
      </article>
      <article className="bd-interactive-indicator"><button className="bd-indicator-trigger" type="button"
        disabled={!canChangeSubscription || actionDisabled} aria-expanded={subscriptionOpen} aria-haspopup="dialog"
        onClick={() => setSubscriptionOpen(open => !open)} aria-label="Cambiar suscripción del negocio">
        <span className="bd-indicator-icon bd-icon--violet"><Icon name="crown" size={25}/></span>
        <span className="bd-indicator-content"><span className="bd-indicator-title">Suscripción</span><Badge tone={business.isPro ? 'violet' : 'neutral'}>
          {business.isPro === true ? 'Business PRO' : business.isPro === false ? 'Básico' : 'No disponible'}</Badge></span>
        {canChangeSubscription && <Icon name="chevron" size={16}/>}</button></article>
      <article className="bd-interactive-indicator"><button className="bd-indicator-trigger" type="button"
        onClick={() => openSection('reports')} aria-label="Consultar reportes de este negocio">
        <span className="bd-indicator-icon bd-icon--red"><Icon name="flag" size={25}/></span>
        <span className="bd-indicator-content"><span className="bd-indicator-title">Reportes</span><strong className={business._count?.reports ? 'bd-report-count' : ''}>
          {business._count?.reports ?? '—'}</strong></span><Icon name="arrow" size={16}/></button></article>
    </section>
    <div ref={nav} className="bd-tabs" role="tablist" aria-label="Secciones de la ficha administrativa" onKeyDown={event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault(); const current = tabs.findIndex(item => item.key === tab), index = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      choose(tabs[index].key); const target = nav.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[index]; target?.focus({ preventScroll: true }); target?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }}>{tabs.map(item => <button role="tab" aria-selected={tab === item.key} aria-controls={`bd-panel-${item.key}`} id={`bd-tab-${item.key}`} tabIndex={tab === item.key ? 0 : -1} key={item.key} onClick={() => choose(item.key)}><Icon name={item.icon} size={17}/>{item.title}</button>)}</div>
    <div className="bd-body"><div className="bd-tab-content">{tabs.map(item => <section className="bd-tab-panel" role="tabpanel" id={`bd-panel-${item.key}`} aria-labelledby={`bd-tab-${item.key}`} hidden={tab !== item.key} key={item.key} tabIndex={0}>
      {visited.has(item.key) && (item.key === 'summary' ? <Overview business={business} latest={latest} historyStatus={history.loading || history.error ? <Loading {...history}/> : null} onActivity={() => choose('activity')} onHistory={() => choose('history')} catalogAllowed={catalogAllowed}/>
        : item.key === 'information' ? <div className="bd-information"><Information business={business}/><Members business={business}/></div>
        : item.key === 'catalog' ? <Catalog id={business.id} allowed={catalogAllowed} canModerate={catalogAllowed && Boolean(session?.permissions?.includes('content:moderate:write'))}
            canDelete={session?.role === 'SUPER_ADMIN'} onChanged={changed}/>
        : item.key === 'reviews' ? <Reviews business={business} allowed={reviewsAllowed}/>
        : item.key === 'photos' ? <Gallery id={business.id} catalogAllowed={catalogAllowed}/>
        : item.key === 'activity' ? <Activity id={business.id}/>
        : item.key === 'reports' ? <Reports businessId={business.id} businessName={business.name}/>
        : <Card title="Historial administrativo" icon="clock"><p className="bd-card-caption">Actuaciones conservadas en la auditoría. Fechas en hora de Bogotá.</p><Loading {...history}/>{!history.loading && !history.error && history.data && <>{history.data.history.length ? <HistoryTimeline entries={history.data.history}/> : <Empty icon="clock" title="Sin actuaciones registradas" message="No se encontraron registros de auditoría para este establecimiento."/>}{history.data.pagination && <Pager pagination={history.data.pagination} onPage={setHistoryPage}/>}</>}</Card>)}
    </section>)}</div></div>
    {referralsOpen && <AdminDialog title="Referidos del negocio" contextLabel="XAMUKO ADMIN · INDICADOR DE REFERIDOS"
      onClose={() => setReferralsOpen(false)}>
      <div className="bd-referrals-detail">
        <span className="bd-referrals-detail-icon"><Icon name="users" size={25}/></span>
        <div><span>Usuarios referidos válidos</span><strong>{referralCount === undefined ? 'No disponible' : number(referralCount)}</strong></div>
        <p>Este indicador contabiliza las cuentas nuevas registradas mediante el código de referidos de este negocio. Solo incluye referidos validados; no invitaciones pendientes.</p>
      </div>
    </AdminDialog>}
    {visibilityOpen && canChangeVisibility && <AdminBusinessVisibilityPicker businessName={business.name}
      visibilityStatus={business.visibilityStatus} administrativeRestriction={business.administrativeRestriction}
      onClose={() => setVisibilityOpen(false)}
      onChoose={action => { setVisibilityOpen(false); setVisibilityAction(action); }}/>}
    {verificationOpen && canChangeVerification && <AdminBusinessVerificationPicker
      businessName={business.name} verificationStatus={business.verificationStatus}
      onClose={() => setVerificationOpen(false)}
      onChoose={action => { setVerificationOpen(false); setDecision(action === 'VERIFY' ? 'verification' : 'unverification'); }}/>}
    {subscriptionOpen && canChangeSubscription && <AdminBusinessSubscriptionPicker
      businessName={business.name} currentPlan={business.isPro ? 'PRO' : 'BASIC'}
      onClose={() => setSubscriptionOpen(false)}
      onChoose={plan => { setSubscriptionOpen(false); setSelectedPlan(plan); setDecision('plan'); }}/>}
    {visibilityAction && <AdminBusinessVisibilityDialog business={business} action={visibilityAction} onClose={() => setVisibilityAction(null)} onSuccess={changed}/>}
    {decision && <BusinessDecisionDialog business={business} decision={decision} selectedPlan={selectedPlan ?? undefined}
      onClose={() => { setDecision(null); setSelectedPlan(null); }} onSuccess={changed}/>}
  </div></BusinessRecordPhotos>;
}
