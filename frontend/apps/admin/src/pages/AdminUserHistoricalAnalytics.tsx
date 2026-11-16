import { useEffect, useMemo, useRef, useState, type PointerEvent as ChartPointerEvent } from 'react';
import { Icon } from '../components/Icon';
import { getAdminUserAnalytics, type AdminUserAnalytics } from '../services/adminApiClient';

type Interval = 'month' | 'quarter' | 'year';
type Measure = 'registrations' | 'cumulative';
type Mode = 'area' | 'bars';
type Datum = { label: string; registrations: number; cumulative: number };
const fmt = (value: number) => value.toLocaleString('es-CO');

export function groupedPoints(data: AdminUserAnalytics['series'], interval: Interval): Datum[] {
  const map = new Map<string, Datum>();
  for (const item of data) {
    const [year, month] = item.month.split('-').map(Number);
    const label = interval === 'year' ? String(year) : interval === 'quarter'
      ? 'T' + Math.ceil(month / 3) + ' ' + year
      : new Date(Date.UTC(year, month - 1, 12)).toLocaleDateString('es-CO', { month: 'short', year: '2-digit', timeZone: 'UTC' });
    const current = map.get(label) ?? { label, registrations: 0, cumulative: 0 };
    current.registrations += item.registrations;
    current.cumulative = item.cumulative;
    map.set(label, current);
  }
  return [...map.values()];
}

export function AdminUserHistoricalChart({ points, measure, shape }: {
  points: Datum[]; measure: Measure; shape: Mode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);
  const [index, setIndex] = useState<number | null>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(entries => {
      const value = Math.max(310, Math.round(entries[0]?.contentRect.width ?? 900));
      setWidth(current => current === value ? current : value);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => { setIndex(null); }, [points, measure, shape]);
  const height = 335, left = 58, right = 31, top = 31, bottom = 49;
  const plotWidth = width - left - right, plotHeight = height - top - bottom;
  const max = Math.max(1, ...points.map(item => item[measure]));
  const power = Math.pow(10, Math.floor(Math.log10(max / 4)));
  const tick = Math.max(1, Math.ceil(max / 4 / power) * power);
  const ceiling = tick * 4, baseline = top + plotHeight;
  const x = (i: number) => left + (points.length <= 1 ? plotWidth / 2 : i / (points.length - 1) * plotWidth);
  const y = (value: number) => top + plotHeight * (1 - value / ceiling);
  const values = points.map(item => item[measure]);
  const line = points.map((_, i) => x(i) + ',' + y(values[i])).join(' ');
  const area = points.length > 1
    ? 'M' + x(0) + ' ' + baseline + ' L' + points.map((_, i) => x(i) + ' ' + y(values[i])).join(' L')
      + ' L' + x(points.length - 1) + ' ' + baseline + 'Z' : '';
  const barWidth = Math.min(46, plotWidth / Math.max(1, points.length) * .64);
  const step = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(plotWidth / 90))));
  const selected = index === null ? null : points[index];
  const activeX = index === null ? 0 : shape === 'bars' ? left + (index + .5) * plotWidth / points.length : x(index);
  function hover(event: ChartPointerEvent<SVGSVGElement>) {
    if (!points.length) return;
    const matrix = event.currentTarget.getScreenCTM();
    if (!matrix) return;
    const pt = event.currentTarget.createSVGPoint(); pt.x = event.clientX; pt.y = event.clientY;
    const localX = pt.matrixTransform(matrix.inverse()).x;
    const ratio = Math.max(0, Math.min(1, (localX - left) / plotWidth));
    setIndex(shape === 'bars' ? Math.min(points.length - 1, Math.floor(ratio * points.length))
      : Math.round(ratio * Math.max(0, points.length - 1)));
  }
  return <div ref={ref} className="au-control-plot">
    <svg viewBox={'0 0 ' + width + ' ' + height} role="group" aria-label={'Evolución de usuarios por período: ' + points.map(item => item.label + ': ' + fmt(item[measure])).join('; ')}
      onPointerMove={hover} onPointerDown={hover} onPointerLeave={() => setIndex(null)}>
      <defs>
        <linearGradient id="au-control-chart-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#245cf2" stopOpacity=".22"/><stop offset="100%" stopColor="#245cf2" stopOpacity=".012"/>
        </linearGradient>
        <linearGradient id="au-control-chart-bar" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#225cf1"/><stop offset="100%" stopColor="#8050eb"/>
        </linearGradient>
      </defs>
      {[0,1,2,3,4].map(i => <g key={i}>
        <line className="au-plot-grid" x1={left} y1={top + i * plotHeight / 4} x2={width - right} y2={top + i * plotHeight / 4}/>
        <text x={left - 10} y={top + i * plotHeight / 4 + 4} textAnchor="end" className="au-plot-axis">{fmt(ceiling - i * tick)}</text>
      </g>)}
      <rect x={left} y={top} width={plotWidth} height={plotHeight} fill="transparent" pointerEvents="all"/>
      {shape === 'area' ? <>
        {area && <path d={area} fill="url(#au-control-chart-area)" pointerEvents="none"/>}
        <polyline points={line} fill="none" className="au-plot-line" pointerEvents="none"/>
        {points.map((item,i) => <circle key={item.label} cx={x(i)} cy={y(values[i])} r={index === i ? 5.5 : 3.4}
          className="au-plot-point" tabIndex={0} aria-label={item.label + ': ' + fmt(values[i])}
          onFocus={() => setIndex(i)} onClick={() => setIndex(i)}/>)}
      </> : points.map((item,i) => <rect key={item.label} x={left + (i + .5) * plotWidth / points.length - barWidth / 2}
        y={y(values[i])} width={barWidth} height={Math.max(1, baseline - y(values[i]))} rx="5"
        fill="url(#au-control-chart-bar)" tabIndex={0} aria-label={item.label + ': ' + fmt(values[i])}
        onFocus={() => setIndex(i)} onClick={() => setIndex(i)}/>)}
      {selected && index !== null && <>
        <line x1={activeX} x2={activeX} y1={top} y2={baseline} className="au-plot-guide" pointerEvents="none"/>
        <line x1={left} x2={width-right} y1={y(selected[measure])} y2={y(selected[measure])}
          className="au-plot-guide" opacity=".45" pointerEvents="none"/>
        <circle cx={activeX} cy={y(selected[measure])} r="6" fill="#fff" stroke="#245cf2" strokeWidth="2.5" pointerEvents="none"/>
        {(() => {
          const tx = Math.max(left+10, Math.min(width - right - 105, activeX - 52));
          const ty = Math.max(8, y(selected[measure]) - 57);
          return <g pointerEvents="none" className="au-control-chart-tooltip">
            <rect x={tx} y={ty} width="110" height="54" rx="10" fill="#142b4e"/>
            <text x={tx + 55} y={ty + 20} fontSize="11" textAnchor="middle" fill="#bdd0fb">{selected.label}</text>
            <text x={tx + 55} y={ty + 41} fontSize="15" fontWeight="850" textAnchor="middle" fill="#fff">{fmt(selected[measure])}</text>
          </g>;
        })()}
      </>}
      {points.map((item,i) => (i % step === 0 || i === points.length-1) &&
        <text key={item.label} x={shape === 'bars' ? left + (i + .5) * plotWidth / points.length : x(i)} y={height - 15}
          textAnchor="middle" className="au-plot-axis">{item.label}</text>)}
    </svg>
    <p className="au-control-chart-caption" aria-live="polite">{selected
      ? <><strong>{fmt(selected[measure])}</strong> · {selected.label}</>
      : 'Mueve el cursor o toca un período. Los meses sin registros se muestran con 0.'}</p>
  </div>;
}

function downloadCsv(points: Datum[]) {
  const lines = ['Período;Altas;Acumulado', ...points.map(item => [item.label,item.registrations,item.cumulative].join(';'))].join('\r\n');
  const href = URL.createObjectURL(new Blob(['\ufeff'+lines],{type:'text/csv;charset=utf-8'}));
  const link = document.createElement('a');link.href = href;link.download = 'xamuko-admin-usuarios-historico.csv';link.click();
  window.setTimeout(() => URL.revokeObjectURL(href),1000);
}

export function AdminUserHistoricalAnalytics({ initial }: { initial: AdminUserAnalytics }) {
  const [period, setPeriod] = useState<AdminUserAnalytics['period']>('12m');
  const [interval, setInterval] = useState<Interval>('month');
  const [measure, setMeasure] = useState<Measure>('registrations');
  const [shape, setShape] = useState<Mode>('area');
  const [view, setView] = useState<'chart'|'table'>('chart');
  const [data, setData] = useState<AdminUserAnalytics>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (period === '12m' && revision === 0) { setData(initial); return; }
    let active = true;
    setLoading(true);setError('');
    void getAdminUserAnalytics(period).then(value => { if (active) setData(value); })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'No disponible'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  },[period,initial,revision]);
  const points = useMemo(() => groupedPoints(data.series, interval), [data, interval]);
  const sum = points.reduce((n,p) => n+p.registrations, 0);
  const peak = points.reduce<Datum | null>((prev,item) => !prev || item.registrations > prev.registrations ? item : prev, null);
  return <section className="au-control-analytics au-info-card" aria-labelledby="au-control-chart-title">
    <header className="au-panel-heading">
      <div><span className="au-eyebrow">INTELIGENCIA DE USUARIOS</span><h2 id="au-control-chart-title">Evolución y crecimiento</h2>
        <p>Histórico real, cursor vertical de precisión y valores exactos, incluidos los períodos con cero altas.</p></div>
      <button type="button" className="au-outline-button" onClick={() => downloadCsv(points)} disabled={loading || !!error || !points.length}>
        <Icon name="download" size={16}/> Exportar CSV
      </button>
    </header>
    <div className="au-control-chart-filters">
      <label>Período<select value={period} onChange={e => setPeriod(e.target.value as AdminUserAnalytics['period'])}>
        <option value="6m">6 meses</option><option value="12m">12 meses</option><option value="24m">24 meses</option>
        <option value="60m">5 años</option><option value="all">Todo el histórico</option>
      </select></label>
      <label>Agrupar<select value={interval} onChange={e => setInterval(e.target.value as Interval)}>
        <option value="month">Mes</option><option value="quarter">Trimestre</option><option value="year">Año</option>
      </select></label>
      <div className="au-control-chart-buttons" role="group" aria-label="Tipo de dato">
        <button type="button" className={measure==='registrations'?'selected':''} aria-pressed={measure==='registrations'} onClick={()=>setMeasure('registrations')}>Nuevos</button>
        <button type="button" className={measure==='cumulative'?'selected':''} aria-pressed={measure==='cumulative'} onClick={()=>setMeasure('cumulative')}>Acumulado</button>
      </div>
      <div className="au-control-chart-buttons" role="group" aria-label="Tipo de gráfica">
        <button type="button" className={shape==='area'?'selected':''} aria-pressed={shape==='area'} title="Línea" onClick={()=>setShape('area')}><Icon name="up" size={17}/></button>
        <button type="button" className={shape==='bars'?'selected':''} aria-pressed={shape==='bars'} title="Barras" onClick={()=>setShape('bars')}><Icon name="chart" size={17}/></button>
      </div>
      <div className="au-control-chart-buttons" role="group" aria-label="Presentación">
        <button type="button" className={view==='chart'?'selected':''} aria-pressed={view==='chart'} onClick={()=>setView('chart')}>Gráfica</button>
        <button type="button" className={view==='table'?'selected':''} aria-pressed={view==='table'} onClick={()=>setView('table')}>Tabla</button>
      </div>
    </div>
    {error ? <div className="au-control-chart-message" role="alert">No se pudo cargar el período: {error} <button onClick={()=>setRevision(n=>n+1)} type="button">Reintentar</button></div>
      : loading ? <div className="au-control-chart-message" role="status">Consultando el histórico…</div>
      : view === 'chart' ? <AdminUserHistoricalChart points={points} measure={measure} shape={shape}/>
      : <div className="au-control-chart-table"><table><thead><tr><th>Período</th><th>Nuevos</th><th>Acumulado</th></tr></thead><tbody>
        {points.map(item=><tr key={item.label}><th>{item.label}</th><td>{fmt(item.registrations)}</td><td>{fmt(item.cumulative)}</td></tr>)}
      </tbody></table></div>}
    <div className="au-control-chart-summary">
      <div><small>Altas en período</small><strong>{fmt(sum)}</strong></div>
      <div><small>Promedio por intervalo</small><strong>{fmt(points.length ? Math.round(sum / points.length) : 0)}</strong></div>
      <div><small>Período de mayor actividad</small><strong>{peak && peak.registrations ? peak.label+' · '+fmt(peak.registrations) : 'Sin altas'}</strong></div>
    </div>
    <p className="au-analytics-note"><Icon name="shield" size={16}/>{data.definition} Los usuarios suspendidos o dados de baja siguen contando como registros históricos, no como cuentas activas.</p>
  </section>;
}
