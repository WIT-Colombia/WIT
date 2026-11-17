import { useEffect, useId, useRef, useState, type PointerEvent } from 'react';
import { Icon } from '../../components/Icon';
import { getRecordActivity, type ActivityMetric, type RecordActivity } from '../../services/adminBusinessRecord';
import { Card, Loading, number, useResource } from './shared';

const metrics: Record<ActivityMetric, { title: string; icon: string; source: string }> = {
  views: { title: 'Visualizaciones de la ficha', icon: 'eye', source: 'Aperturas registradas de la ficha. No representan personas únicas.' },
  interactions: { title: 'Interacciones de contacto', icon: 'message', source: 'Suma de clics registrados en WhatsApp, teléfono e indicaciones. Un visitante puede realizar varias interacciones.' },
  offerViews: { title: 'Visualizaciones del catálogo', icon: 'box', source: 'Aperturas registradas de los productos y servicios de este negocio.' },
  reviews: { title: 'Opiniones registradas', icon: 'star', source: 'Opiniones creadas en cada fecha, incluidas las retiradas después. No es la evolución de la calificación media.' },
  products: { title: 'Productos registrados', icon: 'box', source: 'Productos creados en cada fecha, incluidos los retirados después. Son altas, no el total acumulado.' },
  services: { title: 'Servicios registrados', icon: 'settings', source: 'Servicios creados en cada fecha, incluidos los retirados después. Son altas, no el total acumulado.' },
};
function dateLabel(key: string, full = false): string {
  if (key.includes(' ')) return full ? `${dateLabel(key.slice(0, 10), true)} · ${key.slice(11)}` : key.slice(11);
  return new Date((key.length === 7 ? key + '-01' : key) + 'T12:00:00Z').toLocaleDateString('es-CO', key.length === 7 ? { month: 'short', year: full ? 'numeric' : '2-digit', timeZone: 'UTC' } : { day: '2-digit', month: 'short', ...(full ? { year: 'numeric' as const } : {}), timeZone: 'UTC' });
}
export function ActivityChart({ data, metric, variant = 'standard' }: { data: RecordActivity; metric: ActivityMetric; variant?: 'standard' | 'overview' }) {
  const holder = useRef<HTMLDivElement>(null);
  const gradientId = useId().replace(/:/g, '');
  const [width, setWidth] = useState(700), [selected, setSelected] = useState<number | null>(null);
  useEffect(() => {
    if (!holder.current || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(entries => setWidth(Math.max(260, Math.round(entries[0].contentRect.width))));
    observer.observe(holder.current); return () => observer.disconnect();
  }, []);
  useEffect(() => setSelected(null), [data, metric]);
  const left = 46, right = 28, top = 24, height = 285, w = width - left - right, h = height - top - 48;
  const points = data.series, maximum = Math.max(1, ...points.map(row => row[metric])), step = Math.max(1, Math.ceil(maximum / 4)), ceiling = step * 4;
  const x = (index: number) => left + (points.length < 2 ? w / 2 : index * w / (points.length - 1));
  const y = (value: number) => top + h * (1 - value / ceiling);
  const active = selected === null ? null : points[selected];
  const labelEvery = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(w / 85))));
  const tooltipX = selected === null ? left : Math.max(left, Math.min(width - right - 145, x(selected) - 72));
  const tooltipY = selected === null ? top : Math.max(top + 6, y(points[selected][metric]) - 68);
  const move = (event: PointerEvent<SVGSVGElement>) => { const rect = event.currentTarget.getBoundingClientRect(); const position = (event.clientX - rect.left) / rect.width * width; setSelected(Math.max(0, Math.min(points.length - 1, Math.round((position - left) / w * (points.length - 1))))); };
  return <div className={'bd-chart' + (variant === 'overview' ? ' bd-chart--overview' : '')} ref={holder}><svg viewBox={`0 0 ${width} ${height}`} role="group" tabIndex={0} aria-label={`${metrics[metric].title}. Usa las flechas izquierda y derecha para consultar cada fecha.`}
    onPointerMove={move} onPointerDown={move} onPointerLeave={() => setSelected(null)} onFocus={() => setSelected(value => value ?? 0)}
    onKeyDown={event => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) { event.preventDefault(); setSelected(index => event.key === 'Home' ? 0 : event.key === 'End' ? points.length - 1 : Math.max(0, Math.min(points.length - 1, (index ?? 0) + (event.key === 'ArrowRight' ? 1 : -1)))); } }}>
    {variant === 'overview' && <defs><linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
      <stop offset="0%" stopColor="#7B3FFB" stopOpacity="0.28"/>
      <stop offset="100%" stopColor="#7B3FFB" stopOpacity="0.015"/>
    </linearGradient></defs>}
    {[0, 1, 2, 3, 4].map(tick => <g key={tick}><line className="bd-grid-line" x1={left} x2={width - right} y1={top + tick * h / 4} y2={top + tick * h / 4}/><text className="bd-axis" x={left - 10} y={top + tick * h / 4 + 4} textAnchor="end">{number(ceiling - tick * step)}</text></g>)}
    <rect x={left} y={top} width={w} height={h} fill="transparent"/>
    {variant === 'overview' && points.length > 0 && <path
      d={'M ' + x(0) + ' ' + (top + h) + ' L ' + points.map((row, index) => x(index) + ' ' + y(row[metric])).join(' L ') + ' L ' + x(points.length - 1) + ' ' + (top + h) + ' Z'}
      fill={'url(#' + gradientId + ')'} stroke="none" pointerEvents="none"/>}
    <polyline points={points.map((row, index) => `${x(index)},${y(row[metric])}`).join(' ')} className="bd-trend-line" fill="none" pointerEvents="none"/>
    {points.map((row, index) => <circle key={row.label} cx={x(index)} cy={y(row[metric])} r={selected === index ? 4.5 : 2.5} className="bd-trend-dot" pointerEvents="none"/>)}
    {active && selected !== null && <><line data-testid="activity-guide" className="bd-chart-guide" x1={x(selected)} x2={x(selected)} y1={top} y2={top + h}/><circle cx={x(selected)} cy={y(active[metric])} r="5" fill="#fff" stroke="#7B3FFB" strokeWidth="3"/></>}
    {variant === 'overview' && active && selected !== null && <g className="bd-summary-svg-tooltip" pointerEvents="none">
      <rect x={tooltipX} y={tooltipY} width="145" height="53" rx="9" fill="#6825DB"/>
      <text x={tooltipX + 72.5} y={tooltipY + 22} textAnchor="middle" fill="#fff" fontSize="17" fontWeight="750">{number(active[metric])}</text>
      <text x={tooltipX + 72.5} y={tooltipY + 39} textAnchor="middle" fill="#fff" fontSize="11">{metrics[metric].title}</text>
    </g>}
    {points.map((row, index) => ((index % labelEvery === 0 && (index === 0 || index < points.length - 1 - labelEvery / 2)) || index === points.length - 1) && <text key={row.label} className="bd-axis" x={x(index)} y={height - 18} textAnchor="middle">{dateLabel(row.label)}</text>)}
  </svg><div className="bd-chart-value" role="status">{active ? <><strong>{dateLabel(active.label, true)}</strong><span>{number(active[metric])} · {metrics[metric].title.toLocaleLowerCase('es')}</span></> : <><Icon name="chart" size={16}/><span>Mueve el cursor, toca la gráfica o utiliza las flechas para consultar una fecha.</span></>}</div></div>;
}
export function Activity({ id }: { id: string }) {
  const [period, setPeriod] = useState('month'), [metric, setMetric] = useState<ActivityMetric>('views'), [view, setView] = useState('chart');
  const source = useResource(() => getRecordActivity(id, period), [id, period]);
  return <Card title="Actividad del negocio" icon="chart"><div className="bd-filters">
    <label>Período de actividad<select aria-label="Período de actividad" value={period} onChange={event => setPeriod(event.target.value)}><option value="day">Hoy</option><option value="week">Esta semana</option><option value="month">Este mes</option><option value="year">Este año</option><option value="all">Todo el historial</option></select></label>
    <label>Indicador<select aria-label="Indicador de actividad" value={metric} onChange={event => setMetric(event.target.value as ActivityMetric)}>{Object.entries(metrics).map(([key, item]) => <option value={key} key={key}>{item.title}</option>)}</select></label>
    <div className="bd-subtabs" role="group" aria-label="Presentación de actividad"><button aria-pressed={view === 'chart'} onClick={() => setView('chart')}>Gráfica</button><button aria-pressed={view === 'table'} onClick={() => setView('table')}>Tabla</button></div>
  </div><Loading {...source}/>{!source.loading && !source.error && source.data && <>
    <div className="bd-activity-metrics">{(['views', 'interactions', 'offerViews', 'reviews'] as ActivityMetric[]).map(key => <article key={key}><Icon name={metrics[key].icon} size={20}/><div><span>{metrics[key].title}</span><strong>{number(source.data!.totals[key])}</strong><small>En el período consultado</small></div></article>)}</div>
    <div className="bd-chart-head"><h3>{metrics[metric].title}</h3><span className="bd-timezone"><Icon name="clock" size={13}/>Hora de Bogotá</span></div>
    {view === 'chart' ? <ActivityChart data={source.data} metric={metric}/> : <div className="bd-table-scroll"><table><thead><tr><th>Fecha</th><th>{metrics[metric].title}</th></tr></thead><tbody>{source.data.series.map(row => <tr key={row.label}><td>{dateLabel(row.label, true)}</td><td>{number(row[metric])}</td></tr>)}</tbody></table></div>}
    <p className="bd-chart-definition"><Icon name="info" size={17}/><span>{metrics[metric].source} Los intervalos transcurridos sin registros tienen valor cero. {period === 'all' ? 'La gráfica muestra los últimos 24 meses; los totales incluyen todo el historial.' : 'La gráfica muestra únicamente el intervalo ya transcurrido.'}</span></p><details className="bd-data-source"><summary>Origen e interpretación de los datos</summary><p>{source.data.definition}</p></details>
  </>}</Card>;
}
