import { useState, type ReactNode } from 'react';
import { Icon } from '../../components/Icon';
import { getRecordActivity, type RecordBusiness, type RecordHistory } from '../../services/adminBusinessRecord';
import { ActivityChart } from './Activity';
import { actionName } from './History';
import { Empty, Loading, date, number, useResource } from './shared';

const periods = [
  { value: 'last30', label: 'Últimos 30 días' },
  { value: 'day', label: 'Hoy' },
  { value: 'week', label: 'Esta semana' },
  { value: 'month', label: 'Este mes' },
  { value: 'year', label: 'Este año' },
  { value: 'all', label: 'Todo el historial' },
];

function administrativeIcon(action: string): string {
  if (action.includes('VERIF')) return 'shield';
  if (action.includes('PLAN')) return 'crown';
  if (action.includes('VISIB') || action.includes('HIDDEN') || action.includes('VISIBLE') || action.includes('HIDE')) return 'eye';
  if (action.includes('SUSPEND')) return 'lock';
  if (action.includes('RESTORE')) return 'check';
  return 'clock';
}

function actionDescription(entry: RecordHistory): string {
  const current = entry.newState;
  if (entry.action === 'ADMIN_BUSINESS_PLAN_CHANGED') {
    return current?.plan === 'PRO' ? 'Asignado a Business PRO' : current?.plan === 'BASIC' ? 'Asignado a Básico' : 'Cambio de suscripción registrado';
  }
  if (entry.action === 'ADMIN_BUSINESS_VERIFIED_MANUALLY') return 'Cambiado a Verificado';
  if (entry.action === 'ADMIN_BUSINESS_UNVERIFIED_MANUALLY') return 'Cambiado a Sin verificar';
  if (current?.administrativeRestriction === 'SUSPENDED') return 'Cambiado a Suspendida';
  if (current?.visibilityStatus === 'VISIBLE') return 'Cambiado a Visible';
  if (current?.visibilityStatus === 'HIDDEN') return 'Cambiado a Oculta';
  return entry.reason || entry.comment || 'Actuación registrada';
}

export function Overview({ business, latest, historyStatus, onActivity, onHistory, catalogAllowed }: {
  business: RecordBusiness;
  latest: RecordHistory[];
  historyStatus: ReactNode;
  onActivity: () => void;
  onHistory: () => void;
  catalogAllowed: boolean;
}) {
  const [period, setPeriod] = useState('all');
  const activity = useResource(() => getRecordActivity(business.id, period), [business.id, period]);
  const rating = business.record?.rating;
  const photoCount = business.record
    ? business.record.businessPhotos + (catalogAllowed ? business.record.catalogPhotos : 0)
    : undefined;
  const ratingText = rating?.value === null || rating?.value === undefined
    ? '—'
    : rating.value.toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const ratingLabel = rating ? number(rating.count) + (rating.count === 1 ? ' opinión' : ' opiniones') : 'Sin calificaciones';
  const total = (value: number | undefined) => value === undefined ? '—' : number(value);
  const metricCards = [
    { label: 'Visualizaciones', value: activity.data ? total(activity.data.totals.views) : '—', icon: 'eye', tone: 'purple', hint: 'En el período' },
    { label: 'Me gusta', value: activity.data?.current ? total(activity.data.current.offerLikes) : '—', icon: 'thumbs-up', tone: 'blue', hint: 'En productos y servicios' },
    { label: 'Calificación promedio', value: ratingText, icon: 'star', tone: 'gold', hint: ratingLabel },
    { label: 'Favoritos', value: activity.data?.current ? total(activity.data.current.favorites) : '—', icon: 'heart', tone: 'green', hint: 'Personas que lo guardaron' },
  ];
  const contentRows = [
    { label: 'Productos', value: business.record?.products, icon: 'box' },
    { label: 'Servicios', value: business.record?.services, icon: 'settings' },
    { label: 'Opiniones', value: business._count?.reviews, icon: 'star' },
    { label: 'Fotos', value: photoCount, icon: 'image' },
  ];

  return <div className="bd-summary">
    <section className="bd-summary-card bd-summary-performance" aria-labelledby="bd-summary-performance-title">
      <header className="bd-summary-heading">
        <span className="bd-summary-heading-icon"><Icon name="up" size={24}/></span>
        <div className="bd-summary-title-copy">
          <h2 id="bd-summary-performance-title">Rendimiento en Xamuko</h2>
          <p>{period === 'all' ? 'Actividad de todo el historial' : period === 'last30' ? 'Actividad de los últimos 30 días' : 'Actividad: ' + (periods.find(item => item.value === period)?.label.toLowerCase() ?? '')}</p>
        </div>
        <label className="bd-summary-period">
          <Icon name="calendar" size={17}/>
          <span className="bd-summary-period-caption" aria-hidden="true">{periods.find(item => item.value === period)?.label}</span>
          <select aria-label="Período del resumen" value={period} onChange={event => setPeriod(event.target.value)}>
            {periods.map(item => <option value={item.value} key={item.value}>{item.label}</option>)}
          </select>
          <Icon name="chevron" size={15}/>
        </label>
      </header>
      <div className="bd-summary-metrics" aria-label="Indicadores de rendimiento">
        {metricCards.map(item => <article className={'bd-summary-metric bd-summary-metric--' + item.tone} key={item.label}>
          <span className="bd-summary-metric-icon"><Icon name={item.icon} size={24}/></span>
          <strong>{item.value}</strong>
          <span className="bd-summary-metric-name">{item.label}</span>
          <small>{item.hint}</small>
        </article>)}
      </div>
      <div className="bd-summary-plot">
        <div className="bd-summary-plot-heading">
          <div><h3>Visualizaciones</h3><p>Comportamiento registrado por fecha · Hora de Bogotá</p></div>
          <span className="bd-summary-legend"><span/>Visualizaciones</span>
        </div>
        {activity.loading || activity.error ? <Loading {...activity}/> : activity.data?.series.length
          ? <ActivityChart data={activity.data} metric="views" variant="overview"/>
          : <Empty icon="chart" title="Sin datos para graficar" message="No hay intervalos disponibles en el período seleccionado."/>}
        <div className="bd-summary-chart-footer">
          <button type="button" className="bd-summary-outline-action bd-summary-text-link" onClick={onActivity}>Explorar actividad <Icon name="arrow" size={15}/></button>
        </div>
      </div>
    </section>

    <section className="bd-summary-card bd-summary-content" aria-labelledby="bd-summary-content-title">
      <header className="bd-summary-heading">
        <span className="bd-summary-heading-icon"><Icon name="layers" size={23}/></span>
        <div className="bd-summary-title-copy"><h2 id="bd-summary-content-title">Contenido registrado</h2></div>
      </header>
      <ul className="bd-summary-content-list">
        {contentRows.map(item => <li key={item.label}>
          <span className="bd-summary-content-icon"><Icon name={item.icon} size={21}/></span>
          <span>{item.label}</span>
          <strong>{total(item.value)}</strong>
        </li>)}
      </ul>
      {!catalogAllowed && <p className="bd-summary-content-note">El total de fotos no incluye el catálogo sin permiso de consulta.</p>}
    </section>

    <section className="bd-summary-card bd-summary-history" aria-labelledby="bd-summary-history-title">
      <header className="bd-summary-heading">
        <span className="bd-summary-heading-icon"><Icon name="calendar" size={22}/></span>
        <div className="bd-summary-title-copy">
          <h2 id="bd-summary-history-title">Últimas actuaciones administrativas</h2>
          <p>Registros más recientes sobre este negocio</p>
        </div>
      </header>
      {historyStatus || (latest.length ? <ol className="bd-summary-history-list">
        {latest.map(entry => <li key={entry.id}><button type="button" onClick={onHistory}
          aria-label={'Consultar en el historial: ' + actionName(entry.action)}>
          <span className="bd-summary-history-icon"><Icon name={administrativeIcon(entry.action)} size={19}/></span>
          <span className="bd-summary-history-copy"><strong>{actionName(entry.action)}</strong><small>{actionDescription(entry)}</small></span>
          <time dateTime={entry.createdAt}><Icon name="calendar" size={14}/>{date(entry.createdAt)}</time>
          <Icon name="arrow" size={17}/>
        </button></li>)}
      </ol> : <Empty icon="clock" title="Sin actuaciones registradas" message="Los cambios y decisiones del negocio aparecerán aquí cuando se registren."/>)}
      <div className="bd-summary-history-footer">
        <button type="button" className="bd-summary-outline-action bd-summary-history-link" onClick={onHistory}>
          Ver historial completo <Icon name="arrow" size={16}/>
        </button>
      </div>
    </section>
  </div>;
}
