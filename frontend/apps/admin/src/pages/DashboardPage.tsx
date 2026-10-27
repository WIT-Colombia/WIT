import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { getSession, can } from '../services/adminService';
import { loadDashboardSnapshot, type DashboardSnapshot } from '../services/dashboardService';
import xamukoLogo from '../assets/xamuko-logo.png';
import citySkyline from '../assets/city-skyline.svg';

const tiles = [
  { label: 'Negocios registrados', icon: 'store', tone: 'violet' },
  { label: 'Usuarios registrados', icon: 'users', tone: 'blue' },
  { label: 'Negocios verificados', icon: 'shield', tone: 'green' },
  { label: 'Opiniones publicadas', icon: 'star', tone: 'pink' },
  { label: 'Ingresos del mes', icon: 'card', tone: 'amber' },
];
const indicators = ['Usuarios', 'Negocios', 'Opiniones', 'Ingresos'] as const;
type Indicator = typeof indicators[number];
const empty = 'Aún no hay datos disponibles.';

function EmptyGraphic({ label }: { label: string }) {
  return <div className="xa-empty-graphic" role="status"><span className="xa-empty-graphic-icon"><Icon name="chart" size={27} /></span><strong>{label}</strong><p>{empty}</p></div>;
}
function Panel({ title, icon, children, action, className = '' }: { title: string; icon: string; children: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return <section className={`xa-panel ${className}`}><div className="xa-panel-head"><h2><Icon name={icon} size={20} />{title}</h2>{action}</div>{children}</section>;
}
function PlanCard({ kind }: { kind: 'business' | 'plus' }) {
  const business = kind === 'business';
  return <article className={`xa-plan-card ${business ? 'xa-plan-business' : 'xa-plan-plus'}`}><span className="xa-plan-icon"><Icon name={business ? 'store' : 'users'} size={26} /></span><div className="xa-plan-copy"><h3>{business ? 'Business PRO' : 'XAMUKO Plus'}</h3><span>{business ? 'Para establecimientos' : 'Para usuarios'}</span><p>{business ? 'Herramientas de crecimiento y visibilidad para negocios.' : 'Experiencias y beneficios para la comunidad.'}</p><Link to={business ? '/business-pro' : '/xamuko-plus'}>Gestionar {business ? 'Business PRO' : 'XAMUKO Plus'} <Icon name="arrow" size={16} /></Link></div><div className="xa-plan-stats"><span><strong>—</strong> Activas</span><span><strong>—</strong> En prueba</span><span><strong>—</strong> Próximas renovaciones</span></div></article>;
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
    loadDashboardSnapshot(admin).then(result => { if (active) setSnapshot(result); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [admin?.id, reload]);
  if (!admin || !can(admin, 'dashboard:read')) return <section className="xa-dashboard"><EmptyGraphic label="Acceso restringido" /></section>;
  const firstName = admin.name.trim().split(/\s+/)[0] || 'administrador';
  const reviews = snapshot?.recentReviews ?? [];
  const reports = snapshot?.recentReports ?? [];
  const activity = [
    ...reviews.map(item => ({ id: `review-${item.id}`, title: 'Nueva opinión publicada', context: item.business.name, date: item.createdAt, href: '/reviews', icon: 'star' })),
    ...reports.map(item => ({ id: `report-${item.id}`, title: 'Reporte recibido', context: item.review.business.name, date: item.createdAt, href: '/reports', icon: 'flag' })),
  ].filter(item => !month || item.date.slice(0, 7) === month).sort((a, b) => Date.parse(b.date) - Date.parse(a.date)).slice(0, 6);
  return <div className="xa-dashboard">
    <header className="xa-welcome"><div><h1>Hola, {firstName} <span aria-hidden="true">👋</span></h1><p>Aquí tienes un resumen del estado actual de XAMUKO.</p></div><div className="xa-skyline" aria-hidden="true"><img className="xa-skyline-art" src={citySkyline} alt="" /><img className="xa-skyline-logo" src={xamukoLogo} alt="" /></div></header>
    <section className="xa-metrics" aria-label="Indicadores principales">{tiles.map((tile, index) => <article className={`xa-metric xa-${tile.tone}`} key={tile.label}><span className="xa-metric-icon"><Icon name={tile.icon} size={28} /></span><div><span>{tile.label}</span><strong>{loading ? '…' : index === 3 && snapshot?.publishedReviews !== null ? snapshot?.publishedReviews?.toLocaleString('es-CO') : '—'}</strong><small>{loading ? 'Cargando' : index === 3 && snapshot?.publishedReviews !== null ? 'Total publicado' : 'Sin datos disponibles'}</small></div></article>)}</section>
    {snapshot?.reviewError && <div className="xa-dashboard-notice" role="alert">No se pudieron cargar algunas opiniones o reportes. <button onClick={() => setReload(value => value + 1)}>Reintentar</button></div>}
    <div className="xa-top-grid"><Panel title="Crecimiento de la plataforma" icon="chart" className="xa-growth" action={<div className="xa-chart-tabs" role="tablist" aria-label="Indicador de crecimiento">{indicators.map(value => <button key={value} role="tab" aria-selected={indicator === value} onClick={() => setIndicator(value)}>{value}</button>)}</div>}><EmptyGraphic label={`Crecimiento de ${indicator.toLowerCase()}`} /></Panel>
    <Panel title="Actividad reciente" icon="clock" className="xa-activity" action={<span className="xa-unavailable" title="La bitácora general aún no tiene una API de consulta">Ver todas · Pendiente</span>}>{loading ? <p className="xa-panel-state">Cargando actividad…</p> : activity.length ? <ul>{activity.map(item => <li key={item.id}><Link to={item.href}><span className="xa-activity-icon"><Icon name={item.icon} size={19} /></span><span><strong>{item.title}</strong><small>{item.context}</small></span><time dateTime={item.date}>{new Date(item.date).toLocaleDateString('es-CO')}</time></Link></li>)}</ul> : <p className="xa-panel-state">No hay actividad reciente disponible{month ? ' en el mes seleccionado' : ''}.</p>}</Panel>
    <Panel title="Acciones rápidas" icon="up" className="xa-actions"><div className="xa-action-list"><Link to="/verifications"><Icon name="store" />Ver negocios pendientes <Icon name="arrow" size={16} /></Link><Link to="/plans"><Icon name="crown" />Gestionar suscripciones <span>Pendiente</span></Link><Link to="/reports"><Icon name="flag" />Revisar reportes <Icon name="arrow" size={16} /></Link><Link to="/promotions"><Icon name="tag" />Crear promoción <span>Pendiente</span></Link><Link to="/notifications"><Icon name="bell" />Enviar notificación <span>Pendiente</span></Link></div></Panel></div>
    <div className="xa-middle-grid"><Panel title="Planes y suscripciones" icon="crown" className="xa-plans" action={<Link to="/plans">Gestionar planes</Link>}><div className="xa-plan-grid"><PlanCard kind="business" /><PlanCard kind="plus" /></div></Panel><Panel title="Ingresos por plan" icon="chart"><EmptyGraphic label="Ingresos no disponibles" /><div className="xa-revenue-labels"><span>Business PRO</span><span>XAMUKO Plus</span><span>Promociones</span><span>Otros ingresos</span></div></Panel></div>
    <div className="xa-bottom-grid"><Panel title="Negocios por estado" icon="store"><EmptyGraphic label="Estados de negocios" /></Panel><Panel title="Usuarios por tipo" icon="users"><EmptyGraphic label="Tipos de usuario" /></Panel><Panel title="Contenido reciente" icon="box"><p className="xa-panel-state">Todavía no existe un listado de contenido reciente en la API de Admin.</p><Link className="xa-subtle-link" to="/content">Ir a Contenido <Icon name="arrow" size={14} /></Link></Panel></div>
  </div>;
}
