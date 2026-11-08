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

  useEffect(() => {
    if (!admin) return;
    let active = true;
    setLoading(true);
    loadDashboardSnapshot(admin).then(result => { if (active) setSnapshot(result); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [admin?.id, reload]);

  if (!admin || !can(admin, 'dashboard:read')) return <section className="xa-dashboard"><div className="xa-empty-state">Acceso restringido</div></section>;

  const firstName = admin.name.trim().split(/\s+/)[0] || 'administrador';
  const activity = [
    ...(snapshot?.recentReviews ?? []).map(item => ({ id: `review-${item.id}`, title: 'Opinión publicada', user: item.user.displayName, detail: item.business.name, date: item.createdAt, href: '/reviews', icon: 'star' })),
    ...(snapshot?.recentReports ?? []).map(item => ({ id: `report-${item.id}`, title: 'Reporte de opinión recibido', user: item.reporter.displayName, detail: item.review.business.name, date: item.createdAt, href: '/reports', icon: 'flag' })),
  ].filter(item => !month || item.date.slice(0, 7) === month).sort((a, b) => Date.parse(b.date) - Date.parse(a.date)).slice(0, 4);

  const metricValues: Array<number | null> = [null, null, snapshot?.pendingVerifications ?? null, null];
  const hasError = Boolean(snapshot?.reviewError || snapshot?.verificationError);
  const priorities = [
    { label: 'Verificaciones por revisar', count: snapshot?.pendingVerifications ?? null, href: '/verifications', icon: 'shield', allowed: can(admin, 'verification:write') },
    { label: 'Reportes de opiniones pendientes', count: snapshot?.pendingReports ?? null, href: '/reports', icon: 'flag', allowed: can(admin, 'content:moderate') },
  ].filter(item => item.allowed);
  const today = new Date();

  return <div className="xa-dashboard">
    <header className="xa-welcome"><div><h1>Resumen ejecutivo</h1><p>Bienvenido, {firstName}. Aquí tienes el estado general de XAMUKO.</p></div><div className="xa-welcome-meta"><span className="xa-session-status"><i aria-hidden="true" />Sesión activa</span><span className="xa-welcome-divider" /><time dateTime={today.toISOString()}><Icon name="calendar" size={15} />{new Intl.DateTimeFormat('es-CO', { dateStyle: 'full' }).format(today)}</time></div></header>
    <section className="xa-metrics" aria-label="Indicadores principales">{cards.map((card, index) => {
      const value = metricValues[index];
      const verificationUnavailable = index === 2 && !can(admin, 'verification:write');
      return <article className={`xa-metric xa-${card.tone}`} key={card.label}><span className="xa-metric-icon"><Icon name={card.icon} size={24} /></span><div><span>{card.label}</span><strong>{loading ? '…' : value === null ? empty : value.toLocaleString('es-CO')}</strong><small>{loading ? 'Consultando API' : verificationUnavailable ? 'Sin permiso para consultar' : value === null ? 'La API aún no expone este indicador' : 'Consulta actual de la API'}</small></div></article>;
    })}</section>
    {hasError && <div className="xa-dashboard-notice" role="alert">No se pudieron consultar algunas fuentes autorizadas. <button onClick={() => setReload(value => value + 1)}>Reintentar</button></div>}
    <div className="xa-top-grid">
      <Panel title="Crecimiento de la plataforma" icon="chart" className="xa-growth"><div className="xa-chart-empty"><div className="xa-chart-y" aria-hidden="true"><span>—</span><span>—</span><span>—</span><span>—</span><span>—</span></div><div className="xa-chart-plot" aria-hidden="true"><i /><i /><i /><i /><i /></div><div className="xa-chart-message"><strong>{empty}</strong><p>La API actual no ofrece una serie histórica de crecimiento.</p></div><div className="xa-chart-x" aria-hidden="true"><span>Sin periodo disponible</span></div></div></Panel>
      <Panel title="Pendientes prioritarios" icon="flag" className="xa-priorities">{loading ? <p className="xa-panel-state">Consultando API…</p> : priorities.length === 0 ? <p className="xa-panel-state">No hay fuentes disponibles para tu perfil.</p> : <ul>{priorities.map(item => <li key={item.href}><Link to={item.href}><span className="xa-priority-icon"><Icon name={item.icon} size={18} /></span><span>{item.label}</span><strong>{item.count === null ? '—' : item.count.toLocaleString('es-CO')}</strong><Icon name="arrow" size={16} /></Link></li>)}</ul>}</Panel>
    </div>
    <div className="xa-bottom-grid">
      <Panel title="Actividad reciente" icon="chart" className="xa-activity">{loading ? <p className="xa-panel-state">Consultando actividad real…</p> : activity.length ? <div className="xa-activity-table"><div className="xa-activity-table-head"><span>Fecha y hora</span><span>Actividad</span><span>Usuario</span><span>Detalle</span></div><ul>{activity.map(item => <li key={item.id}><Link to={item.href}><time dateTime={item.date}>{formatActivityDate(item.date)}</time><span className="xa-activity-title"><Icon name={item.icon} size={16} />{item.title}</span><span className="xa-activity-user">{item.user}</span><span className="xa-activity-detail">{item.detail}</span></Link></li>)}</ul><Link className="xa-activity-more" to="/reviews">Ver actividad disponible <Icon name="arrow" size={14} /></Link></div> : <p className="xa-panel-state">{hasError ? 'No se pudo cargar la actividad disponible.' : `Sin actividad disponible${month ? ' en el periodo seleccionado' : ''}.`}</p>}</Panel>
      <Panel title="Acciones rápidas" icon="up" className="xa-actions"><div className="xa-action-list">{can(admin, 'verification:write') && <Link to="/verifications"><Icon name="shield" />Revisar verificaciones <Icon name="arrow" size={16} /></Link>}{can(admin, 'content:moderate') && <Link to="/reviews"><Icon name="star" />Consultar opiniones <Icon name="arrow" size={16} /></Link>}{can(admin, 'content:moderate') && <Link to="/reports"><Icon name="flag" />Revisar reportes <Icon name="arrow" size={16} /></Link>}{!can(admin, 'verification:write') && !can(admin, 'content:moderate') && <p className="xa-panel-state">No hay acciones disponibles para tu perfil.</p>}</div></Panel>
      <Panel title="Roles y accesos" icon="users" className="xa-roles"><p>Perfiles previstos para una etapa futura. Los permisos actuales se conservan.</p><ul>{['Superadministrador', 'Soporte', 'Abogado', 'Contador', 'Marketing'].map(role => <li key={role}><span>{role}</span><small>Planeado</small></li>)}</ul></Panel>
    </div>
  </div>;
}
