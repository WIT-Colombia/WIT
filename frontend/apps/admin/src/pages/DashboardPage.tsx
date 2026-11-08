import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { getSession, can } from '../services/adminService';
import { loadDashboardSnapshot, type DashboardSnapshot } from '../services/dashboardService';

const cards = [
  { label: 'Negocios registrados', icon: 'store', tone: 'violet' },
  { label: 'Usuarios activos', icon: 'users', tone: 'blue' },
  { label: 'Verificaciones pendientes', icon: 'shield', tone: 'violet' },
  { label: 'Ingresos del mes', icon: 'card', tone: 'blue' },
] as const;
const empty = 'Sin datos disponibles';
const indicators = ['Usuarios', 'Negocios', 'Opiniones'] as const;
type Indicator = typeof indicators[number];
function GrowthChart({ points, label }: { points: { month: string; value: number }[]; label: string }) {
  if (!points.length) return <div className="xa-chart-empty"><span className="xa-empty-graphic-icon"><Icon name="chart" size={24} /></span><strong>{empty}</strong><p>Aún no hay registros históricos para este indicador.</p></div>;
  const max = Math.max(1, ...points.map(point => point.value));
  const coords = points.map((point, index) => ({ ...point, x: points.length === 1 ? 50 : 4 + index * 92 / (points.length - 1), y: 92 - (point.value / max) * 78 }));
  const line = coords.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
  const area = `${line} L ${coords[coords.length - 1].x} 100 L ${coords[0].x} 100 Z`;
  return <div className="xa-reference-chart" role="img" aria-label={`${label}: ${points.map(point => `${point.month}: ${point.value}`).join(', ')}`}>
    <div className="xa-chart-y" aria-hidden="true">{[1, .75, .5, .25, 0].map(ratio => <span key={ratio}>{Math.round(max * ratio).toLocaleString('es-CO')}</span>)}</div>
    <div className="xa-reference-plot"><div className="xa-reference-grid" aria-hidden="true"><i /><i /><i /><i /><i /></div><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path className="xa-reference-area" d={area} /><path className="xa-reference-line" d={line} />{coords.map(point => <circle key={point.month} cx={point.x} cy={point.y} r="1.5"><title>{`${point.month}: ${point.value.toLocaleString('es-CO')}`}</title></circle>)}</svg><div className="xa-reference-months">{coords.map(point => <span key={point.month}>{new Date(`${point.month}-01T12:00:00Z`).toLocaleDateString('es-CO', { month: 'short', year: '2-digit', timeZone: 'UTC' })}</span>)}</div></div>
  </div>;
}

function Panel({ title, icon, children, className = '' }: { title: string; icon: string; children: React.ReactNode; className?: string }) {
  return <section className={`xa-panel ${className}`}><div className="xa-panel-head"><h2><Icon name={icon} size={20} />{title}</h2></div>{children}</section>;
}

function formatActivityDate(value: string) {
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export function DashboardPage() {
  const [searchParams] = useSearchParams();
  const month = searchParams.get('month');
  const admin = getSession();
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [indicator, setIndicator] = useState<Indicator>('Negocios');

  useEffect(() => {
    if (!admin) return;
    let active = true;
    setLoading(true);
    loadDashboardSnapshot(admin).then(result => { if (active) setSnapshot(result); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [admin?.id, reload]);

  if (!admin || !can(admin, 'dashboard:read')) return <section className="xa-dashboard"><div className="xa-empty-state">Acceso restringido</div></section>;

  const firstName = admin.name.trim().split(/\s+/)[0] || 'administrador';
  const stats = snapshot?.stats;
  const growthPoints = stats?.monthly.map(point => ({ month: point.month, value: indicator === 'Usuarios' ? point.users : indicator === 'Negocios' ? point.businesses : point.reviews })) ?? [];
  const activity = [
    ...(snapshot?.recentReviews ?? []).map(item => ({ id: `review-${item.id}`, title: 'Opinión publicada', user: item.user.displayName, context: item.business.name, date: item.createdAt, href: '/reviews', icon: 'star' })),
    ...(snapshot?.recentReports ?? []).map(item => ({ id: `report-${item.id}`, title: 'Reporte de opinión recibido', user: item.reporter.displayName, context: item.review.business.name, date: item.createdAt, href: '/reports', icon: 'flag' })),
  ].filter(item => !month || item.date.slice(0, 7) === month).sort((a, b) => Date.parse(b.date) - Date.parse(a.date)).slice(0, 6);

  const metricValues: Array<number | null> = [stats?.totals.businesses ?? null, stats?.userStatuses.active ?? null, snapshot?.pendingVerifications ?? null, stats?.revenue ?? null];
  const hasError = Boolean(snapshot?.statsError || snapshot?.reviewError || snapshot?.verificationError);
  const priorities = [
    { label: 'Verificaciones por revisar', count: snapshot?.pendingVerifications ?? null, href: '/verifications', icon: 'shield', allowed: can(admin, 'verification:write') },
    { label: 'Reportes de opiniones pendientes', count: snapshot?.pendingReports ?? null, href: '/reports', icon: 'flag', allowed: can(admin, 'content:moderate') },
  ].filter(item => item.allowed);

  const today = new Date();
  const periodLabel = stats?.monthly.length ? `Últimos ${stats.monthly.length} meses` : empty;

  return <div className="xa-dashboard">
    <header className="xa-welcome"><div><h1>Resumen ejecutivo</h1><p>Bienvenido, {firstName}. Aquí tienes el estado general de XAMUKO.</p></div><div className="xa-welcome-meta"><span className="xa-session-status"><i aria-hidden="true" />Sesión activa</span><span className="xa-welcome-divider" /><time dateTime={today.toISOString()}><Icon name="calendar" size={15} />{new Intl.DateTimeFormat('es-CO', { dateStyle: 'full' }).format(today)}</time></div></header>
    <section className="xa-metrics" aria-label="Indicadores principales">{cards.map((card, index) => {
      const value = metricValues[index];
      const verificationUnavailable = index === 2 && !can(admin, 'verification:write');
      return <article className={`xa-metric xa-${card.tone}`} key={card.label}><span className="xa-metric-icon"><Icon name={card.icon} size={24} /></span><div><span>{card.label}</span><strong>{loading ? '…' : value === null ? empty : value.toLocaleString('es-CO')}</strong><small>{loading ? 'Consultando API' : verificationUnavailable ? 'Sin permiso para consultar' : value === null ? 'La API aún no expone este indicador' : 'Consulta actual de la API'}</small></div></article>;
    })}</section>
    {hasError && <div className="xa-dashboard-notice" role="alert">No se pudieron consultar algunas fuentes autorizadas. <button onClick={() => setReload(value => value + 1)}>Reintentar</button></div>}
    <div className="xa-top-grid">
      <Panel title="Crecimiento de la plataforma" icon="chart" className="xa-growth">
        <div className="xa-growth-controls"><div><strong>{indicator === 'Negocios' ? 'Negocios registrados' : indicator === 'Usuarios' ? 'Usuarios' : 'Opiniones publicadas'}</strong><small>{periodLabel}</small></div><label><span className="sr-only">Indicador del gráfico</span><select value={indicator} onChange={event => setIndicator(event.target.value as Indicator)}>{indicators.map(value => <option key={value}>{value}</option>)}</select></label></div>
        {loading ? <p className="xa-panel-state">Consultando estadísticas…</p> : stats ? <GrowthChart points={growthPoints} label={`Registros mensuales de ${indicator.toLowerCase()}`} /> : <div className="xa-chart-empty"><div><span className="xa-empty-graphic-icon"><Icon name="chart" size={23} /></span><strong>{empty}</strong><p>No se pudo consultar el histórico de crecimiento.</p></div></div>}
      </Panel>
      <Panel title="Pendientes prioritarios" icon="flag" className="xa-priorities">{loading ? <p className="xa-panel-state">Consultando API…</p> : priorities.length === 0 ? <p className="xa-panel-state">No hay fuentes disponibles para tu perfil.</p> : <ul>{priorities.map(item => <li key={item.href}><Link to={item.href}><span className="xa-priority-icon"><Icon name={item.icon} size={18} /></span><span>{item.label}</span><strong>{item.count === null ? '—' : item.count.toLocaleString('es-CO')}</strong><Icon name="arrow" size={16} /></Link></li>)}</ul>}</Panel>
    </div>
    <div className="xa-bottom-grid">
      <Panel title="Actividad reciente" icon="chart" className="xa-activity">{loading ? <p className="xa-panel-state">Consultando actividad real…</p> : activity.length ? <div className="xa-activity-table"><div className="xa-activity-table-head"><span>Fecha y hora</span><span>Actividad</span><span>Usuario</span><span>Detalle</span></div><ul>{activity.slice(0, 4).map(item => <li key={item.id}><Link to={item.href}><time dateTime={item.date}>{formatActivityDate(item.date)}</time><span className="xa-activity-title"><Icon name={item.icon} size={16} />{item.title}</span><span className="xa-activity-user">{item.user}</span><span className="xa-activity-detail">{item.context}</span></Link></li>)}</ul>{can(admin, 'content:moderate') && <Link className="xa-activity-more" to="/reviews">Ver actividad disponible <Icon name="arrow" size={14} /></Link>}</div> : <p className="xa-panel-state">{hasError ? 'No se pudo cargar la actividad disponible.' : `Sin actividad disponible${month ? ' en el periodo seleccionado' : ''}.`}</p>}</Panel>
      <Panel title="Acciones rápidas" icon="up" className="xa-actions"><div className="xa-action-list">{can(admin, 'verification:write') && <Link to="/verifications"><Icon name="shield" />Revisar verificaciones <Icon name="arrow" size={16} /></Link>}{can(admin, 'content:moderate') && <Link to="/reviews"><Icon name="star" />Consultar opiniones <Icon name="arrow" size={16} /></Link>}{can(admin, 'content:moderate') && <Link to="/reports"><Icon name="flag" />Revisar reportes <Icon name="arrow" size={16} /></Link>}{!can(admin, 'verification:write') && !can(admin, 'content:moderate') && <p className="xa-panel-state">No hay acciones disponibles para tu perfil.</p>}</div></Panel>
      <Panel title="Roles y accesos" icon="users" className="xa-roles"><p>Perfiles previstos para una etapa futura. Los permisos actuales se conservan.</p><ul>{['Superadministrador', 'Soporte', 'Abogado', 'Contador', 'Marketing'].map(role => <li key={role}><span>{role}</span><small>Planeado</small></li>)}</ul></Panel>
    </div>
  </div>;
}
