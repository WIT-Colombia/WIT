import { useEffect, useMemo, useRef, useState, type PointerEvent as ChartPointerEvent } from 'react';
import { Icon } from '../components/Icon';
import { getAdminBusinessAnalytics, type AdminBusinessAnalytics } from '../services/adminApiClient';
import './AdminBusinessGrowthPanel.css';

type Range = '6m' | '12m' | '24m' | '60m' | 'all';
type Interval = 'month' | 'quarter' | 'year';
type Measure = 'registrations' | 'cumulative';
type Shape = 'area' | 'bars';
type Indicator = 'businesses' | 'reviews' | 'users';
type Datum = { label: string; registrations: number; cumulative: number };
const number = (value: number) => new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(value);

function groupSeries(series: Array<{ month: string; registrations: number; cumulative: number }>, interval: Interval): Datum[] {
  const records = new Map<string, Datum>();
  for (const item of series) {
    const [year, month] = item.month.split('-').map(Number);
    const label = interval === 'year' ? String(year) : interval === 'quarter'
      ? 'T' + Math.ceil(month / 3) + ' ' + year
      : new Date(Date.UTC(year, month - 1, 12)).toLocaleDateString('es-CO', { month: 'short', year: '2-digit', timeZone: 'UTC' });
    const record = records.get(label) ?? { label, registrations: 0, cumulative: 0 };
    record.registrations += item.registrations;
    record.cumulative = item.cumulative;
    records.set(label, record);
  }
  return [...records.values()];
}

function downloadSeries(series: Datum[], measure: Measure, indicator: Indicator) {
  const event = indicator === 'users' ? 'Usuarios registrados' : indicator === 'reviews' ? 'Opiniones publicadas' : 'Negocios registrados';
  const heading = ['Período', event + ' (nuevos)', event + ' (acumulado)'];
  const csv = [heading.join(';'), ...series.map(item => [item.label, item.registrations, item.cumulative].join(';'))].join('\r\n');
  const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = measure === 'registrations' ? 'xamuko-evolucion-registros.csv' : 'xamuko-evolucion-acumulada.csv';
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function GrowthCanvas({ points, measure, shape }: { points: Datum[]; measure: Measure; shape: Shape }) {
  const canvas = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(920);
  const [active, setActive] = useState<number | null>(null);
  useEffect(() => {
    const node = canvas.current;
    if (!node) return;
    const resize = new ResizeObserver(records => {
      const next = Math.max(310, Math.round(records[0]?.contentRect.width ?? 920));
      setWidth(current => current === next ? current : next);
    });
    resize.observe(node);
    return () => resize.disconnect();
  }, []);
  useEffect(() => { setActive(null); }, [points, measure, shape]);

  const h = 336, left = 58, right = 35, top = 29, bottom = 49;
  const plotW = width - left - right, plotH = h - top - bottom;
  const max = Math.max(1, ...points.map(point => point[measure]));
  const power = Math.pow(10, Math.floor(Math.log10(max / 4)));
  const tick = Math.max(1, Math.ceil(max / 4 / power) * power);
  const ceiling = tick * 4;
  const baseline = top + plotH;
  const xx = (index: number) => left + (points.length === 1 ? plotW / 2 : index / Math.max(1, points.length - 1) * plotW);
  const yy = (value: number) => top + plotH * (1 - Math.max(0, value) / ceiling);
  const values = points.map(point => point[measure]);
  const polyline = points.map((_, index) => xx(index) + ',' + yy(values[index])).join(' ');
  const area = points.length > 1
    ? 'M ' + xx(0) + ' ' + baseline + ' L ' + points.map((_, index) => xx(index) + ' ' + yy(values[index])).join(' L ')
      + ' L ' + xx(points.length - 1) + ' ' + baseline + ' Z'
    : '';
  const barWidth = Math.min(46, plotW / Math.max(1, points.length) * .63);
  const labelsStep = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(plotW / 93))));
  const selected = active === null ? null : points[active];
  const selectedX = active === null ? 0 : shape === 'bars' ? left + (active + .5) * plotW / points.length : xx(active);
  const hover = (event: ChartPointerEvent<SVGSVGElement>) => {
    const matrix = event.currentTarget.getScreenCTM();
    if (!matrix) return;
    const p = event.currentTarget.createSVGPoint();
    p.x = event.clientX; p.y = event.clientY;
    const local = p.matrixTransform(matrix.inverse()).x;
    const ratio = Math.max(0, Math.min(1, (local - left) / plotW));
    const index = shape === 'bars' ? Math.min(points.length - 1, Math.floor(ratio * points.length))
      : Math.round(ratio * Math.max(0, points.length - 1));
    setActive(index);
  };
  return <div ref={canvas} className="ad-business-growth-canvas">
    <svg viewBox={'0 0 ' + width + ' ' + h} role="group" aria-label={'Evolución de negocios por período: ' + points.map(item => item.label + ': ' + number(item[measure])).join('; ')}
      onPointerMove={hover} onPointerDown={hover} onPointerLeave={() => setActive(null)}>
      <defs>
        <linearGradient id="ad-business-growth-area-gradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2563eb" stopOpacity=".22" /><stop offset="100%" stopColor="#2563eb" stopOpacity=".015" /></linearGradient>
        <linearGradient id="ad-business-growth-bar-gradient" x1="0" y1="1" x2="1" y2="0"><stop offset="0%" stopColor="#245cf2" /><stop offset="100%" stopColor="#8359ef" /></linearGradient>
      </defs>
      {[0, 1, 2, 3, 4].map(index => {
        const y = top + index * plotH / 4;
        return <g key={index}><line x1={left} y1={y} x2={width - right} y2={y} className="ad-business-growth-grid" />
          <text x={left - 12} y={y + 4} textAnchor="end" className="ad-business-growth-axis">{number(ceiling - index * tick)}</text></g>;
      })}
      <rect x={left} y={top} width={plotW} height={plotH} fill="transparent" pointerEvents="all" />
      {shape === 'area' ? <>
        {area && <path d={area} fill="url(#ad-business-growth-area-gradient)" pointerEvents="none" />}
        <polyline points={polyline} fill="none" className="ad-business-growth-line" pointerEvents="none" />
        {points.map((item, index) => <circle key={item.label} cx={xx(index)} cy={yy(values[index])} r={active === index ? 5.4 : 3.5}
          className="ad-business-growth-point" tabIndex={0} aria-label={item.label + ': ' + number(values[index])}
          onFocus={() => setActive(index)} onClick={() => setActive(index)} />)}
      </> : points.map((item, index) => <rect key={item.label} x={left + (index + .5) * plotW / points.length - barWidth / 2}
        y={yy(values[index])} width={barWidth} height={Math.max(1, baseline - yy(values[index]))}
        rx="5" fill="url(#ad-business-growth-bar-gradient)" tabIndex={0}
        aria-label={item.label + ': ' + number(values[index])} onFocus={() => setActive(index)} onClick={() => setActive(index)} />)}
      {selected && active !== null && <>
        <line x1={selectedX} x2={selectedX} y1={yy(selected[measure])} y2={baseline} className="ad-business-growth-guide" pointerEvents="none" />
        <circle cx={selectedX} cy={yy(selected[measure])} r="6" fill="#fff" stroke="#245cf2" strokeWidth="2.5" pointerEvents="none" />
        {(() => {
          const x = Math.max(left, Math.min(width - right - 84, selectedX - 42));
          const y = Math.max(3, yy(selected[measure]) - 44);
          return <g className="ad-business-growth-tooltip" pointerEvents="none">
            <rect x={x} y={y} width="84" height="33" rx="9" fill="#172c53" />
            <text x={x + 42} y={y + 22} textAnchor="middle" fill="#fff">{number(selected[measure])}</text>
          </g>;
        })()}
      </>}
      {points.map((item, index) => (index % labelsStep === 0 || index === points.length - 1) &&
        <text key={item.label} x={shape === 'bars' ? left + (index + .5) * plotW / points.length : xx(index)} y={h - 17}
          textAnchor="middle" className="ad-business-growth-axis">{item.label}</text>)}
    </svg>
    <div className="ad-business-growth-canvas-caption" aria-live="polite">{selected
      ? <><strong>{number(selected[measure])}</strong><span>{selected.label}</span></>
      : <span>Mueve el cursor o desliza el dedo para explorar los registros.</span>}</div>
  </div>;
}

export function AdminBusinessGrowthPanel() {
  const [period, setPeriod] = useState<Range>('12m');
  const [indicator, setIndicator] = useState<Indicator>('businesses');
  const [city, setCity] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [status, setStatus] = useState('all');
  const [interval, setInterval] = useState<Interval>('month');
  const [measure, setMeasure] = useState<Measure>('registrations');
  const [shape, setShape] = useState<Shape>('area');
  const [display, setDisplay] = useState<'chart' | 'table'>('chart');
  const [data, setData] = useState<AdminBusinessAnalytics | null>(null);
  const [availableFilters, setAvailableFilters] = useState<AdminBusinessAnalytics['filters'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  // User registrations are global: city/category/status filters cannot be applied.
  useEffect(() => {
    if (indicator === 'users' && (city || categoryId || status !== 'all')) setIndicator('businesses');
  }, [city, categoryId, status, indicator]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    getAdminBusinessAnalytics({ period, city, categoryId, status }).then(result => {
      if (!active) return;
      setData(result);
      setAvailableFilters(result.filters);
    }).catch(cause => {
      if (!active) return;
      setData(null);
      setError(cause instanceof Error ? cause.message : 'No se pudo consultar la evolución.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [period, city, categoryId, status, attempt]);

  const globalUsersAvailable = !city && !categoryId && status === 'all';
  const label = indicator === 'users' ? 'Usuarios' : indicator === 'reviews' ? 'Opiniones' : 'Negocios';
  const raw = useMemo(() => (data?.series ?? []).map(item => ({
    month: item.month,
    registrations: indicator === 'users' ? item.users : indicator === 'reviews' ? item.reviews : item.registrations,
    cumulative: indicator === 'users' ? item.userCumulative : indicator === 'reviews' ? item.reviewCumulative : item.cumulative,
  })), [data, indicator]);
  const grouped = useMemo(() => groupSeries(raw, interval), [raw, interval]);
  const newRegistrations = grouped.reduce((total, item) => total + item.registrations, 0);
  const average = grouped.length ? newRegistrations / grouped.length : 0;
  const peak = grouped.reduce<Datum | null>((best, item) => !best || item.registrations > best.registrations ? item : best, null);
  const totalCurrent = indicator === 'users' ? data?.totalUsers ?? 0 : indicator === 'reviews' ? data?.totalReviews ?? 0 : data?.total ?? 0;
  const reset = () => { setPeriod('12m'); setCity(''); setCategoryId(''); setStatus('all'); setIndicator('businesses'); setInterval('month'); setMeasure('registrations'); setShape('area'); };
  return <section className="ad-business-growth-panel" aria-labelledby="ad-business-growth-title">
    <header className="ad-business-growth-heading">
      <div className="ad-business-growth-title"><span className="ad-business-growth-heading-icon"><Icon name="chart" size={27} /></span>
        <div><span className="ad-business-growth-eyebrow">INTELIGENCIA DE NEGOCIOS</span><h2 id="ad-business-growth-title">Evolución de XAMUKO</h2>
          <p>Analiza el crecimiento de los negocios, las opiniones y los usuarios con datos históricos reales.</p></div></div>
      <button type="button" className="ad-business-growth-export" disabled={loading || !!error || !grouped.length}
        onClick={() => downloadSeries(grouped, measure, indicator)}><Icon name="download" size={17} /> Exportar CSV</button>
    </header>
    <div className="ad-business-growth-filters">
      <label><span>Ciudad</span><select value={city} onChange={e => setCity(e.target.value)}><option value="">Todas las ciudades</option>
        {(availableFilters?.cities ?? []).map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      <label><span>Categoría</span><select value={categoryId} onChange={e => setCategoryId(e.target.value)}><option value="">Todas las categorías</option>
        {(availableFilters?.categories ?? []).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label><span>Período</span><select value={period} onChange={e => setPeriod(e.target.value as Range)}>
        <option value="6m">Últimos 6 meses</option><option value="12m">Últimos 12 meses</option><option value="24m">Últimos 24 meses</option>
        <option value="60m">Últimos 5 años</option><option value="all">Todo el histórico</option></select></label>
      <label><span>Estado actual</span><select value={status} onChange={e => setStatus(e.target.value)}>
        <option value="all">Todos los estados</option><option value="active">Publicados</option>
        <option value="review">En revisión</option><option value="inactive">No publicados</option></select></label>
      <button type="button" onClick={reset} className="ad-business-growth-reset" title="Restablecer los filtros"><Icon name="refresh" size={16} /> Limpiar</button>
    </div>
    {error ? <div className="ad-business-growth-state" role="alert"><strong>No fue posible consultar la evolución</strong><p>{error}</p>
      <button type="button" onClick={() => setAttempt(i => i + 1)}>Reintentar</button></div>
    : loading ? <div className="ad-business-growth-state" role="status">Consultando la evolución del directorio…</div>
    : data && <>
      <div className="ad-business-growth-metrics" aria-label="Resumen de evolución">
        <div><span><Icon name={indicator === 'users' ? 'users' : indicator === 'reviews' ? 'star' : 'store'} size={17} /> {label} totales</span><strong>{number(totalCurrent)}</strong><small>{indicator === 'users' ? 'Total global actual' : 'Total actual según los filtros'}</small></div>
        <div><span><Icon name="up" size={17} /> {indicator === 'reviews' ? 'Opiniones publicadas' : 'Nuevos registros'}</span><strong>{number(newRegistrations)}</strong><small>Dentro del período seleccionado</small></div>
        <div><span><Icon name="chart" size={17} /> Promedio por {interval === 'month' ? 'mes' : interval === 'quarter' ? 'trimestre' : 'año'}</span><strong>{number(Math.round(average))}</strong><small>Eventos por intervalo</small></div>
        <div><span><Icon name="award" size={17} /> Período destacado</span><strong>{peak && peak.registrations > 0 ? peak.label : '—'}</strong><small>{peak && peak.registrations > 0 ? number(peak.registrations) + ' eventos' : 'Sin registros nuevos'}</small></div>
      </div>
      <div className="ad-business-growth-chart-wrap">
        <div className="ad-business-growth-chart-toolbar">
          <div><h3>Comportamiento histórico</h3><p>{measure === 'registrations' ? 'Actividad por período: ' + label.toLowerCase() : 'Evolución acumulada: ' + label.toLowerCase()}</p></div>
          <div className="ad-business-growth-view-controls">
            <label className="ad-business-growth-resolution">Indicador <select aria-label="Indicador de evolución" value={indicator} onChange={e => setIndicator(e.target.value as Indicator)}>
              <option value="businesses">Negocios</option><option value="reviews">Opiniones publicadas</option>
              <option value="users" disabled={!globalUsersAvailable}>Usuarios (global)</option>
            </select></label>
            <div className="ad-business-growth-toggle" role="group" aria-label="Tipo de dato"><button type="button" className={measure === 'registrations' ? 'selected' : ''} aria-pressed={measure === 'registrations'} onClick={() => setMeasure('registrations')}>Nuevos</button><button type="button" className={measure === 'cumulative' ? 'selected' : ''} aria-pressed={measure === 'cumulative'} onClick={() => setMeasure('cumulative')}>Acumulado</button></div>
            <label className="ad-business-growth-resolution">Agrupar <select value={interval} onChange={e => setInterval(e.target.value as Interval)}><option value="month">Mes</option><option value="quarter">Trimestre</option><option value="year">Año</option></select></label>
            <div className="ad-business-growth-toggle" role="group" aria-label="Estilo de gráfica"><button type="button" aria-label="Gráfica de línea" title="Línea" aria-pressed={shape === 'area'} className={shape === 'area' ? 'selected' : ''} onClick={() => setShape('area')}><Icon name="up" size={16} /></button><button type="button" aria-label="Gráfica de barras" title="Barras" aria-pressed={shape === 'bars'} className={shape === 'bars' ? 'selected' : ''} onClick={() => setShape('bars')}><Icon name="chart" size={16} /></button></div>
            <div className="ad-business-growth-toggle" role="group" aria-label="Presentación de datos"><button type="button" className={display === 'chart' ? 'selected' : ''} aria-pressed={display === 'chart'} onClick={() => setDisplay('chart')}>Gráfica</button><button type="button" className={display === 'table' ? 'selected' : ''} aria-pressed={display === 'table'} onClick={() => setDisplay('table')}>Tabla</button></div>
          </div>
        </div>
        {display === 'chart' ? <GrowthCanvas points={grouped} measure={measure} shape={shape} /> :
          <div className="ad-business-growth-table-wrap"><table><thead><tr><th scope="col">Período</th><th scope="col">Nuevos</th><th scope="col">Acumulado</th></tr></thead>
            <tbody>{grouped.map(item => <tr key={item.label}><th scope="row">{item.label}</th><td>{number(item.registrations)}</td><td>{number(item.cumulative)}</td></tr>)}</tbody></table></div>}
      </div>
      <p className="ad-business-growth-definition"><Icon name="shield" size={17} />{data.definition} La serie utiliza meses UTC. {indicator === 'users' ? 'Los usuarios se muestran únicamente a nivel global.' : 'Los filtros de ciudad, categoría y estado corresponden a los negocios del directorio.'}</p>
    </>}
  </section>;
}
