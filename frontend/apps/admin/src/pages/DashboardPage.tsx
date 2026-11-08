import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { getSession, can } from '../services/adminService';
import { loadDashboardSnapshot, type DashboardSnapshot } from '../services/dashboardService';
import '../styles/dashboard-only.css';

const missing = 'Sin datos disponibles';
const cards = [
  { label: 'Negocios registrados', icon: 'store', tone: 'violet' },
  { label: 'Usuarios activos', icon: 'users', tone: 'blue' },
  { label: 'Verificaciones pendientes', icon: 'shield', tone: 'violet' },
  { label: 'Ingresos del mes', icon: 'card', tone: 'blue' },
] as const;

const indicators = ['Usuarios', 'Negocios', 'Opiniones'] as const;
type Indicator = typeof indicators[number];

function Panel({ title, icon, children, className = '' }: {
  title: string;
  icon: string;
  children: React.ReactNode;
  className?: string;
}) {
  return <section className={`xda-panel ${className}`}>
    <div className="xda-panel-heading"><h2><Icon name={icon} size={19} />{title}</h2></div>
    {children}
  </section>;
}

function GrowthChart({ points, label }: { points: { month: string; value: number }[]; label: string }) {
  if (!points.length) return <div className="xda-chart-empty">
    <Icon name="chart" size={29} />
    <strong>{missing}</strong>
    <p>No hay registros históricos disponibles para este indicador.</p>
  </div>;
  const max = Math.max(1, ...points.map(point => point.value));
  return <div className="xda-chart" role="img" aria-label={`${label}: ${points.map(point => `${point.month}: ${point.value}`).join(', ')}`}>
    {points.map(point => <div className="xda-chart-column" key={point.month}>
      <strong>{point.value.toLocaleString('es-CO')}</strong>
      <div className="xda-chart-track"><div style={{ height: `${point.value ? Math.max(5, point.value / max * 100) : 0}%` }} /></div>
      <span>{new Date(`${point.month}-01T12:00:00Z`).toLocaleDateString('es-CO', { month: 'short', timeZone: 'UTC' })}</span>
    </div>)}
  </div>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export function DashboardPage() {
  const [searchParams] = useSearchParams();
  const month = searchParams.get('month');
  const admin = getSession();
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [indicator, setIndicator] = useState<Indicator>('Usuarios');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!admin) return;
    let active = true;
    setLoading(true);
    loadDashboardSnapshot(admin)
      .then(result => { if (active) setSnapshot(result); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [admin?.id, reload]);

  if (!admin || !can(admin, 'dashboard:read')) {
    return <section className="xda-root"><div className="xda-empty-access">Acceso restringido</div></section>;
  }

  const stats = snapshot?.stats;
  const metricValues: Array<number | null> = [
    stats?.totals.businesses ?? null,
    stats?.userStatuses.active ?? null,
    snapshot?.pendingVerifications ?? null,
    null, // La API actual no ofrece ingresos del mes.
  ];
  const activity = [
    ...(snapshot?.recentReviews ?? []).map(item => ({
      id: `review-${item.id}`, title: 'Opinión publicada', context: item.business.name,
      date: item.createdAt, href: '/reviews', icon: 'star',
    })),
    ...(snapshot?.recentReports ?? []).map(item => ({
      id: `report-${item.id}`, title: 'Reporte recibido', context: item.review.business.name,
      date: item.createdAt, href: '/reports', icon: 'flag',
    })),
  ].filter(item => !month || item.date.slice(0, 7) === month)
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date)).slice(0, 6);

  const priorities = [
    { label: 'Verificaciones por revisar', count: snapshot?.pendingVerifications ?? null,
      path: '/verifications', icon: 'shield', allowed: can(admin, 'verification:write') },
    { label: 'Reportes de opiniones pendientes', count: snapshot?.pendingReports ?? null,
      path: '/reports', icon: 'flag', allowed: can(admin, 'content:moderate') },
  ].filter(item => item.allowed);

  const points = stats?.monthly.map(item => ({
    month: item.month,
    value: indicator === 'Usuarios' ? item.users : indicator === 'Negocios' ? item.businesses : item.reviews,
  })) ?? [];
  const hasError = Boolean(snapshot?.statsError || snapshot?.reviewError || snapshot?.verificationError);
  const firstName = admin.name.trim().split(/\s+/)[0] || 'administrador';

  return <div className="xa-dashboard xda-root">
    <header className="xda-welcome">
      <div><p className="xda-eyebrow">XAMUKO ADMIN</p><h1>Resumen ejecutivo</h1>
        <p>Bienvenido, {firstName}. Información real de la plataforma, según tus permisos.</p>
      </div>
    </header>

    <section className="xda-metrics" aria-label="Indicadores principales">
      {cards.map((card, index) => {
        const value = metricValues[index];
        const allowed = index !== 2 || can(admin, 'verification:write');
        return <article className={`xda-metric xda-${card.tone}`} key={card.label}>
          <span className="xda-metric-icon"><Icon name={card.icon} size={23} /></span>
          <div><span>{card.label}</span>
            <strong>{loading ? '…' : !allowed ? 'Sin permiso' : value === null ? missing : value.toLocaleString('es-CO')}</strong>
            <small>{loading ? 'Consultando API' : !allowed ? 'Acceso no autorizado' : value === null ? 'No disponible en la API actual' : 'Dato consultado en la API'}</small>
          </div>
        </article>;
      })}
    </section>

    {hasError && <div className="xda-notice" role="alert">
      Algunas consultas no estuvieron disponibles.
      <button onClick={() => setReload(value => value + 1)}>Reintentar</button>
    </div>}

    <div className="xda-top-grid">
      <Panel title="Crecimiento de la plataforma" icon="chart">
        <div className="xda-tabs" role="group" aria-label="Indicador de crecimiento">
          {indicators.map(value => <button key={value}
            aria-pressed={indicator === value}
            className={indicator === value ? 'is-active' : ''}
            onClick={() => setIndicator(value)}>{value}</button>)}
        </div>
        {loading ? <p className="xda-state">Consultando estadísticas…</p> :
          stats ? <GrowthChart points={points} label={`Registros mensuales de ${indicator.toLowerCase()}`} /> :
            <p className="xda-state">{missing}</p>}
      </Panel>
      <Panel title="Pendientes prioritarios" icon="flag">
        {loading ? <p className="xda-state">Consultando pendientes…</p> :
          priorities.length ? <ul className="xda-priorities">{priorities.map(item =>
            <li key={item.path}><Link to={item.path}><span className="xda-small-icon"><Icon name={item.icon} size={17} /></span>
              <span>{item.label}</span><strong>{item.count === null ? '—' : item.count.toLocaleString('es-CO')}</strong>
              <Icon name="arrow" size={15} /></Link></li>
          )}</ul> : <p className="xda-state">No hay consultas autorizadas para este perfil.</p>}
      </Panel>
    </div>

    <div className="xda-bottom-grid">
      <Panel title="Actividad reciente" icon="clock">
        {loading ? <p className="xda-state">Consultando actividad…</p> :
          activity.length ? <ul className="xda-activity">{activity.map(item => <li key={item.id}>
            <Link to={item.href}><span className="xda-small-icon"><Icon name={item.icon} size={16} /></span>
              <span className="xda-activity-copy"><strong>{item.title}</strong><small>{item.context}</small></span>
              <time dateTime={item.date}>{formatDate(item.date)}</time></Link>
          </li>)}</ul> :
            <p className="xda-state">{hasError ? 'No se pudo consultar toda la actividad.' : 'No hay actividad reciente disponible.'}</p>}
      </Panel>
      <Panel title="Acciones rápidas" icon="up">
        <div className="xda-actions">
          {can(admin, 'verification:write') && <Link to="/verifications"><Icon name="shield" size={18} />Revisar verificaciones <Icon name="arrow" size={15} /></Link>}
          {can(admin, 'content:moderate') && <Link to="/reviews"><Icon name="star" size={18} />Consultar opiniones <Icon name="arrow" size={15} /></Link>}
          {can(admin, 'content:moderate') && <Link to="/reports"><Icon name="flag" size={18} />Revisar reportes <Icon name="arrow" size={15} /></Link>}
          {!can(admin, 'verification:write') && !can(admin, 'content:moderate') &&
            <p className="xda-state">No hay acciones disponibles para tu perfil.</p>}
        </div>
      </Panel>
      <Panel title="Roles y accesos" icon="users">
        <p className="xda-roles-intro">Perfiles previstos para el futuro. Los permisos actuales permanecen intactos.</p>
        <ul className="xda-roles">
          {['Superadministrador', 'Soporte', 'Abogado', 'Contador', 'Marketing'].map(role =>
            <li key={role}><span>{role}</span><small>Planeado</small></li>)}
        </ul>
      </Panel>
    </div>
  </div>;
}
