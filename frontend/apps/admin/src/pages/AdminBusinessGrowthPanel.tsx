import { useEffect, useMemo, useRef, useState, type PointerEvent as ChartPointerEvent } from 'react';
import { Icon } from '../components/Icon';
import { AdminApiError, getAdminBusinessAnalytics, type AdminBusinessAnalytics } from '../services/adminApiClient';
import './AdminBusinessGrowthPanel.css';

type Range = '6m' | '12m' | '24m' | '60m' | 'all';
type Interval = 'month' | 'quarter' | 'year';
type Measure = 'registrations' | 'cumulative';
type Shape = 'area' | 'bars';
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

function downloadSeries(series: Datum[], measure: Measure) {
  const heading = ['Período', 'Negocios nuevos', 'Negocios acumulados'];
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
      const next = Math.max(245, Math.round(records[0]?.contentRect.width ?? 920));
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
        <linearGradient id="ad-business-growth-area-gradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6931f7" stopOpacity=".28" /><stop offset="100%" stopColor="#6931f7" stopOpacity=".015" /></linearGradient>
        <linearGradient id="ad-business-growth-bar-gradient" x1="0" y1="1" x2="1" y2="0"><stop offset="0%" stopColor="#7738ed" /><stop offset="100%" stopColor="#4e16d2" /></linearGradient>
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
        <line x1={selectedX} x2={selectedX} y1={top} y2={baseline} className="ad-business-growth-guide" pointerEvents="none" />
        <line x1={left} x2={width - right} y1={yy(selected[measure])} y2={yy(selected[measure])}
          className="ad-business-growth-guide" strokeDasharray="4 5" opacity=".42" pointerEvents="none" />
        <circle cx={selectedX} cy={yy(selected[measure])} r="6" fill="#fff" stroke="#245cf2" strokeWidth="2.5" pointerEvents="none" />
        {(() => {
          const x = Math.max(left + 10, Math.min(width - right - 95, selectedX - 42));
          const y = Math.max(3, yy(selected[measure]) - 44);
          return <g className="ad-business-growth-tooltip" pointerEvents="none">
            <rect x={x - 10} y={y - 11} width="104" height="54" rx="10" fill="#172c53" />
            <text x={x + 42} y={y + 8} textAnchor="middle" fill="#bacefb" fontSize="11">{selected.label}</text>
            <text x={x + 42} y={y + 29} textAnchor="middle" fill="#fff" fontWeight="800" fontSize="15">{number(selected[measure])}</text>
          </g>;
        })()}
      </>}
      {points.map((item, index) => (index % labelsStep === 0 || index === points.length - 1) &&
        <text key={item.label} x={shape === 'bars' ? left + (index + .5) * plotW / points.length : xx(index)} y={h - 17}
          textAnchor="middle" className="ad-business-growth-axis">{item.label}</text>)}
    </svg>
    <div className="ad-business-growth-canvas-caption" aria-live="polite">{selected
      ? <><strong>{number(selected[measure])}</strong><span>{selected.label}</span></>
      : <span>Mueve el cursor o desliza el dedo. Cada período sin nuevos registros se muestra con 0.</span>}</div>
  </div>;
}

export function AdminBusinessGrowthPanel() {
  const [period, setPeriod] = useState<Range>('12m');
  const [city, setCity] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [status, setStatus] = useState('all');
  const [interval, setInterval] = useState<Interval>('month');
  const [measure, setMeasure] = useState<Measure>('registrations');
  const [shape, setShape] = useState<Shape>('area');
  const [display, setDisplay] = useState<'chart' | 'table'>('chart');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [data, setData] = useState<AdminBusinessAnalytics | null>(null);
  const [availableFilters, setAvailableFilters] = useState<AdminBusinessAnalytics['filters'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
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
      const backendNotUpdated = cause instanceof AdminApiError &&
        (cause.status === 404 || cause.code === 'BUSINESS_NOT_FOUND');
      setError(backendNotUpdated
        ? 'El servidor de Admin no tiene todavía habilitada la consulta de evolución. Es necesario desplegar el backend actualizado.'
        : cause instanceof Error ? cause.message : 'No se pudo consultar la evolución.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [period, city, categoryId, status, attempt]);

  const raw = useMemo(() => (data?.series ?? []).map(item => ({
    month: item.month,
    registrations: item.registrations,
    cumulative: item.cumulative,
  })), [data]);
  const grouped = useMemo(() => groupSeries(raw, interval), [raw, interval]);
  const newRegistrations = grouped.reduce((total, item) => total + item.registrations, 0);
  const average = grouped.length ? newRegistrations / grouped.length : 0;
  const peak = grouped.reduce<Datum | null>((best, item) =>
    !best || item.registrations > best.registrations ? item : best, null);
  const quiet = grouped.reduce<Datum | null>((best, item) =>
    !best || item.registrations < best.registrations ? item : best, null);
  const periodText: Record<Range, string> = {
    '6m': 'últimos 6 meses', '12m': 'últimos 12 meses',
    '24m': 'últimos 24 meses', '60m': 'últimos 5 años', all: 'todo el histórico',
  };
  const intervalText: Record<Interval, string> = { month: 'mes', quarter: 'trimestre', year: 'año' };
  const decimal = (value: number) => new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 }).format(value);
  const reset = () => { setPeriod('12m'); setCity(''); setCategoryId(''); setStatus('all'); setInterval('month'); setMeasure('registrations'); setShape('area'); };
  const selectedFilters = [
    city ? availableFilters?.cities.find(item => item.value === city)?.label ?? 'Ciudad seleccionada' : '',
    categoryId ? availableFilters?.categories.find(item => item.id === categoryId)?.name ?? 'Categoría seleccionada' : '',
    period !== '12m' ? periodText[period] : '',
    status !== 'all' ? (status === 'active' ? 'Publicados' : status === 'review' ? 'En revisión' : 'No publicados') : '',
  ].filter(Boolean);
  return <section className="ad-business-growth-panel" aria-labelledby="ad-business-growth-title">
    <header className="ad-business-growth-heading">
      <div className="ad-business-growth-title">
        <span className="ad-business-growth-heading-icon"><Icon name="chart" size={25}/></span>
        <div><span className="ad-business-growth-eyebrow">EVOLUCIÓN DE XAMUKO</span>
          <h2 id="ad-business-growth-title">Inteligencia de negocios</h2>
          <p>Crecimiento histórico de los negocios registrados en Xamuko.</p>
        </div>
      </div>
      <div className="ad-business-growth-utilities">
        <button type="button" className="ad-business-growth-filter-trigger"
          aria-expanded={filtersOpen} aria-controls="ad-business-growth-filters"
          onClick={() => setFiltersOpen(open => !open)}>
          <Icon name="filter" size={16}/> Filtros del análisis
          {selectedFilters.length > 0 && <span className="ad-business-growth-filter-count">{selectedFilters.length}</span>}
          <Icon name="chevron" size={15}/>
        </button>
        <button type="button" className="ad-business-growth-export" disabled={loading || !!error || !grouped.length}
          onClick={() => downloadSeries(grouped, measure)}>
          <Icon name="download" size={16}/> Exportar CSV
        </button>
      </div>
    </header>
    <div className="ad-business-growth-filters" id="ad-business-growth-filters" hidden={!filtersOpen}>
      <label><span>Ciudad</span><select value={city} onChange={e => setCity(e.target.value)}><option value="">Todas las ciudades</option>
        {(availableFilters?.cities ?? []).map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      <label><span>Categoría</span><select value={categoryId} onChange={e => setCategoryId(e.target.value)}><option value="">Todas las categorías</option>
        {(availableFilters?.categories ?? []).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label><span>Período</span><select value={period} onChange={e => setPeriod(e.target.value as Range)}>
        <option value="6m">Últimos 6 meses</option><option value="12m">Últimos 12 meses</option><option value="24m">Últimos 24 meses</option>
        <option value="60m">Últimos 5 años</option><option value="all">Todo el histórico</option></select></label>
      <label><span>Estado de publicación</span><select value={status} onChange={e => setStatus(e.target.value)}>
        <option value="all">Todos los estados</option><option value="active">Publicados</option>
        <option value="review">En revisión</option><option value="inactive">No publicados</option></select></label>
      <button type="button" onClick={reset} className="ad-business-growth-reset">
        <Icon name="refresh" size={16}/> Limpiar filtros
      </button>
    </div>
    {selectedFilters.length > 0 && <div className="ad-business-growth-active-filters" aria-label="Filtros del análisis activos">
      {selectedFilters.map(value => <span key={value}>{value}</span>)}
    </div>}
    <div className="ad-business-growth-chart-toolbar">
      <div className="ad-business-growth-chart-mode" role="group" aria-label="Tipo de dato">
        <button type="button" className={measure === 'registrations' ? 'selected' : ''} aria-pressed={measure === 'registrations'}
          onClick={() => setMeasure('registrations')}>Nuevos</button>
        <button type="button" className={measure === 'cumulative' ? 'selected' : ''} aria-pressed={measure === 'cumulative'}
          onClick={() => setMeasure('cumulative')}>Acumulados</button>
      </div>
      <div className="ad-business-growth-interval" role="group" aria-label="Agrupar registros">
        <span>Agrupar:</span>
        {([['month', 'Mensual'], ['quarter', 'Trimestral'], ['year', 'Anual']] as const).map(([value, label]) =>
          <button key={value} type="button" className={interval === value ? 'selected' : ''}
            aria-pressed={interval === value} onClick={() => setInterval(value)}>{label}</button>)}
      </div>
      <div className="ad-business-growth-view-controls">
        <div className="ad-business-growth-toggle" role="group" aria-label="Presentación de datos">
          <button type="button" className={display === 'chart' ? 'selected' : ''} aria-pressed={display === 'chart'}
            onClick={() => setDisplay('chart')}><Icon name="chart" size={15}/> Gráfica</button>
          <button type="button" className={display === 'table' ? 'selected' : ''} aria-pressed={display === 'table'}
            onClick={() => setDisplay('table')}><Icon name="grid" size={15}/> Tabla</button>
        </div>
      </div>
    </div>
    {error ? <div className="ad-business-growth-state" role="alert"><strong>No fue posible consultar la evolución</strong><p>{error}</p>
      <button type="button" onClick={() => setAttempt(i => i + 1)}>Reintentar</button></div>
    : loading ? <div className="ad-business-growth-state" role="status">Consultando el crecimiento de los negocios…</div>
    : data && <>
      <div className="ad-business-growth-content">
        <div className="ad-business-growth-plot">
          {display === 'chart' ? <GrowthCanvas points={grouped} measure={measure} shape={shape}/> :
            <div className="ad-business-growth-table-wrap">
              <table><thead><tr><th scope="col">Período</th><th scope="col">Nuevos</th><th scope="col">Acumulados</th></tr></thead>
                <tbody>{grouped.map(item => <tr key={item.label}>
                  <th scope="row">{item.label}</th><td>{number(item.registrations)}</td><td>{number(item.cumulative)}</td>
                </tr>)}</tbody>
              </table>
            </div>}
          <div className="ad-business-growth-plot-footer">
            <span className="ad-business-growth-legend"><span aria-hidden="true"/> {measure === 'registrations' ? 'Nuevos negocios' : 'Negocios acumulados'}</span>
            {display === 'chart' && <div className="ad-business-growth-shape" role="group" aria-label="Estilo de gráfica">
              <button type="button" className={shape === 'area' ? 'selected' : ''} aria-pressed={shape === 'area'}
                onClick={() => setShape('area')}>Línea</button>
              <button type="button" className={shape === 'bars' ? 'selected' : ''} aria-pressed={shape === 'bars'}
                onClick={() => setShape('bars')}>Barras</button>
            </div>}
          </div>
        </div>
        <aside className="ad-business-growth-summary" aria-label="Resumen del período">
          <h3><Icon name="calendar" size={18}/> Resumen del período</h3>
          <p>Negocios nuevos · {periodText[period]}</p>
          <dl>
            <div><dt>Total de nuevos negocios</dt><dd>{number(newRegistrations)}</dd></div>
            <div><dt>Promedio por {intervalText[interval]}</dt><dd>{decimal(average)}</dd></div>
            <div><dt>{interval === 'month' ? 'Mes' : interval === 'quarter' ? 'Trimestre' : 'Año'} con más registros</dt><dd>{peak ? peak.label + ' (' + number(peak.registrations) + ')' : '—'}</dd></div>
            <div><dt>{interval === 'month' ? 'Mes' : interval === 'quarter' ? 'Trimestre' : 'Año'} con menos registros</dt><dd>{quiet ? quiet.label + ' (' + number(quiet.registrations) + ')' : '—'}</dd></div>
          </dl>
          <div className="ad-business-growth-current-total"><span>Negocios actuales según filtros</span>
            <strong>{number(data.total)}</strong>
          </div>
        </aside>
      </div>
      <p className="ad-business-growth-definition"><Icon name="shield" size={17}/>
        <span>{data.definition} La serie histórica utiliza meses UTC y conserva los períodos sin registros con valor cero.
          Los filtros de este análisis son independientes de los filtros del directorio.</span>
      </p>
    </>}
  </section>;
}
