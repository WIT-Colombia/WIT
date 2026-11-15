import { useEffect, useMemo, useRef, useState, type PointerEvent as ChartPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { freeCards, periods, proCards, referralCards, type Period } from '../config/statisticsDashboard';
import type { BusinessStatisticsDashboard, OfferViewRanking } from '../services/businessApiClient';
import './StatisticsDetailDialog.css';

type Point = { label: string; value: number };
export type StatisticsSelection = { section: 'free' | 'referral' | 'pro'; key: string };
type ReviewStats = { periodCount: number; total: number; distribution: Array<{ rating: number; count: number }> };
type ChartKind = 'line' | 'columns' | 'ranking';
type Detail = {
  title: string; description: string; value: string; valueLabel: string; source: string;
  points?: Point[]; chart?: ChartKind; previous?: number | null; current?: number;
  unit?: 'count' | 'rating'; status?: 'locked' | 'pending' | 'unavailable'; note?: string;
};
type Props = {
  selection: StatisticsSelection; onClose: () => void; data: BusinessStatisticsDashboard | null;
  period: Period; favoriteCount: number | null; offerLikeCount: number | null;
  reviewStatistics: ReviewStats | null; offerViewRanking: OfferViewRanking | null;
  unlockedReferralStatistics: number; availablePro: boolean; loading: boolean; error: boolean;
};
const count = (n: number) => new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 }).format(n);
const percent = (n: number) => count(n) + ' %';
const sum = (points: Point[]) => points.reduce((total, point) => total + point.value, 0);
const measured = (n: number | null | undefined): n is number => typeof n === 'number' && Number.isFinite(n);

function getDetail(p: Props): Detail {
  const { selection, data, favoriteCount, offerLikeCount, reviewStatistics, offerViewRanking, availablePro, unlockedReferralStatistics, loading, error } = p;
  const basic = freeCards.find(card => card.key === selection.key);
  const referred = referralCards.find(card => card.key === selection.key);
  const proCard = proCards.find(card => card.key === selection.key);
  const title = basic?.label ?? referred?.label ?? proCard?.label ?? 'Detalle de estadística';
  const unavailable = (message: string): Detail => ({ title, description: message, value: 'No disponible', valueLabel: 'Valor del indicador', source: message, status: 'unavailable' });
  if (loading) return { title, description: 'Consultando las estadísticas del período.', value: 'Cargando…', valueLabel: 'Valor del indicador', source: 'Esperando datos del servidor.', status: 'pending' };
  if (!data) return unavailable(error ? 'No se pudieron cargar las estadísticas. Usa Reintentar en el panel.' : 'No hay datos disponibles del período seleccionado.');
  if (basic) {
    const current = data.metrics[basic.key];
    return { title, description: basic.caption, value: count(current), valueLabel: 'Eventos del período',
      source: 'Eventos registrados por XAMUKO. La serie proviene directamente de la API.',
      points: data.trends[basic.key], chart: 'line', current, previous: data.previous?.[basic.key] ?? null,
      note: basic.key === 'whatsappClicks' ? 'Un clic indica la intención de abrir WhatsApp; no confirma mensajes enviados ni ventas.'
        : basic.key === 'phoneClicks' ? 'Un clic para llamar no confirma que se haya completado una llamada.'
        : basic.key === 'directionsClicks' ? 'Abrir indicaciones no confirma una visita física.'
        : basic.key === 'businessViews' ? 'Las aperturas no equivalen a personas únicas.'
        : 'Aparecer en los resultados no confirma que se haya abierto la ficha.' };
  }
  if (referred) {
    const index = referralCards.findIndex(item => item.key === selection.key);
    if (index >= unlockedReferralStatistics) return {
      title, description: 'Estadística por referidos aún no desbloqueada.', value: 'Bloqueada',
      valueLabel: 'Acceso por reconocimiento', status: 'locked',
      source: 'Requiere nivel ' + referred.requiredLevel + ' (' + count(referred.requiredMinimum) + ' referidos válidos).' };
    if (index === 0) return { title, description: 'Personas que tienen guardado el negocio actualmente.',
      value: count(favoriteCount ?? data.metrics.currentFavorites), valueLabel: 'Favoritos actuales',
      source: 'Conteo actual de favoritos.', note: 'El servidor no entrega un historial para este conteo actual.' };
    if (index === 1) {
      const n = offerLikeCount ?? data.referral?.offerLikes;
      return measured(n) ? { title, description: 'Me gusta activos en el catálogo.', value: count(n),
        valueLabel: 'Me gusta actuales', source: 'Conteo actual de reacciones.',
        note: 'La API no proporciona la serie temporal de este indicador.' }
        : unavailable('No fue posible obtener las reacciones del catálogo.');
    }
    if (index === 2) {
      const n = reviewStatistics?.periodCount ?? data.referral?.reviewsCount;
      return measured(n) ? { title, description: 'Opiniones publicadas durante el período seleccionado.',
        value: count(n), valueLabel: 'Opiniones del período', source: 'Opiniones públicas registradas.',
        note: 'No se proporciona una evolución diaria de este conteo.' }
        : unavailable('No se pudieron cargar las opiniones públicas.');
    }
    if (index === 3) {
      if (!reviewStatistics) return unavailable('No se pudo cargar la distribución de calificaciones.');
      return { title, description: 'Distribución actual por estrellas.', value: count(reviewStatistics.total),
        valueLabel: 'Opiniones publicadas', source: 'Distribución actual de opiniones públicas.',
        points: [...reviewStatistics.distribution].sort((a, b) => b.rating - a.rating).map(row => ({ label: row.rating + ' estrellas', value: row.count })),
        chart: 'ranking', note: 'La distribución comprende todas las opiniones actuales, no solo las del período.' };
    }
    if (index === 4) {
      if (!offerViewRanking) return unavailable('No se pudo cargar el ranking de productos y servicios.');
      const points = offerViewRanking.offers.map(row => ({ label: row.name + ' · ' + (row.kind === 'PRODUCT' ? 'Producto' : 'Servicio'), value: row.value }));
      return { title, description: 'Aperturas de productos y servicios.', value: count(sum(points)),
        valueLabel: 'Aperturas incluidas', source: 'Ranking de aperturas registrado por XAMUKO.',
        points, chart: 'ranking', note: 'Solo se suman los elementos que entrega este ranking.' };
    }
  }
  if (!proCard) return unavailable('No se reconoce la estadística solicitada.');
  if (!availablePro || !data.pro) return { title, description: proCard.source, value: 'Bloqueada',
    valueLabel: 'Estadística Business PRO', status: 'locked', source: 'Se requiere una suscripción Business PRO vigente.' };
  const pro = data.pro;
  const base = { title, description: proCard.source, source: 'Datos reales de XAMUKO correspondientes al período seleccionado.' };
  const scalar = (value: number | null, label: string, extra: Partial<Detail> = {}): Detail =>
    value === null ? { ...base, value: 'Sin datos suficientes', valueLabel: label, status: 'pending' }
      : { ...base, value: count(value), valueLabel: label, ...extra };
  const series = (value: number, label: string, points: Point[], chart: ChartKind, extra: Partial<Detail> = {}): Detail =>
    ({ ...base, value: count(value), valueLabel: label, points, chart, ...extra });

  switch (selection.key) {
    case 'uniqueVisitors':
      return scalar(pro.uniqueVisitors, 'Visitantes únicos', {
        points: [{ label: 'Únicos', value: pro.uniqueVisitors }, { label: 'Recurrentes', value: pro.repeatVisitors }],
        chart: 'columns', note: 'Los recurrentes están incluidos entre los visitantes únicos.' });
    case 'repeatVisitors':
      return scalar(pro.repeatVisitors, 'Visitantes recurrentes', {
        points: [{ label: 'Únicos', value: pro.uniqueVisitors }, { label: 'Recurrentes', value: pro.repeatVisitors }],
        chart: 'columns', note: 'Los recurrentes son un subconjunto de los visitantes únicos.' });
    case 'viewEvolution':
      return series(data.metrics.businessViews, 'Visualizaciones', data.trends.businessViews, 'line',
        { current: data.metrics.businessViews, previous: data.previous?.businessViews ?? null });
    case 'searchEvolution':
      return series(data.metrics.searchAppearances, 'Apariciones', data.trends.searchAppearances, 'line',
        { current: data.metrics.searchAppearances, previous: data.previous?.searchAppearances ?? null });
    case 'contactRate':
      return scalar(pro.contactRate, 'Tasa de contacto', {
        value: pro.contactRate === null ? '—' : percent(pro.contactRate),
        points: [{ label: 'WhatsApp', value: data.metrics.whatsappClicks }, { label: 'Llamadas', value: data.metrics.phoneClicks }],
        chart: 'columns', note: 'La gráfica muestra clics de contacto, no porcentajes individuales.' });
    case 'interactionRate':
      return scalar(pro.interactionRate, 'Tasa de interacción', {
        value: pro.interactionRate === null ? '—' : percent(pro.interactionRate),
        note: 'La API no ofrece una evolución histórica de esta tasa. Incluye también aperturas de productos y servicios.' });
    case 'navigationRate':
      return scalar(pro.navigationRate, 'Tasa de navegación', {
        value: pro.navigationRate === null ? '—' : percent(pro.navigationRate),
        points: [{ label: 'Cómo llegar', value: data.metrics.directionsClicks }, { label: 'Visualizaciones', value: data.metrics.businessViews }],
        chart: 'columns', note: 'Las barras representan los eventos que componen la tasa, no porcentajes individuales.' });
    case 'hourlyActivity':
      return series(data.metrics.businessViews, 'Aperturas de ficha', pro.hourlyActivity, 'columns', { note: 'Distribución por hora de Bogotá, no por días.' });
    case 'weekdayActivity':
      return series(data.metrics.businessViews, 'Aperturas de ficha', pro.weekdayActivity, 'columns', { note: 'Distribución por día de semana, no una secuencia cronológica.' });
    case 'visitOrigins':
      return series(sum(pro.visitOrigins), 'Aperturas atribuidas', pro.visitOrigins, 'ranking');
    case 'keywords':
      return series(sum(pro.keywords), 'Apariciones clasificadas', pro.keywords, 'ranking', { note: 'Términos agregados: no identifican quién realizó la búsqueda.' });
    case 'averagePosition':
      return scalar(pro.averagePosition, 'Posición promedio', {
        value: pro.averagePosition === null ? '—' : '#' + count(pro.averagePosition),
        note: 'El servidor no proporciona una evolución histórica de posiciones.' });
    case 'categoryPerformance':
      return series(sum(pro.categoryPerformance), 'Visualizaciones clasificadas', pro.categoryPerformance, 'ranking');
    case 'topProducts':
    case 'topServices': {
      if (!offerViewRanking) return unavailable('No se pudo cargar el ranking de aperturas del catálogo.');
      const offers = selection.key === 'topProducts' ? offerViewRanking.productOffers : offerViewRanking.serviceOffers;
      const points = offers.map(row => ({ label: row.name, value: row.value }));
      return series(sum(points), 'Aperturas incluidas', points, 'ranking', { note: 'El ranking no necesariamente incluye todos los elementos del catálogo.' });
    }
    case 'favoriteEvolution':
      return series(sum(pro.favoriteAcquisitions), 'Altas vigentes', pro.favoriteAcquisitions, 'line', { note: 'Las bajas de favoritos no conservan historial.' });
    case 'ratingEvolution':
      return pro.ratingEvolution.length ? { ...base, value: count(pro.ratingEvolution[pro.ratingEvolution.length - 1].value) + ' / 5',
        valueLabel: 'Último promedio', points: pro.ratingEvolution, chart: 'line', unit: 'rating',
        note: 'La vista de todo el tiempo presenta los últimos 24 meses; no reconstruye ediciones de opiniones.' }
        : { ...base, value: 'Sin calificaciones', valueLabel: 'Período seleccionado', status: 'pending' };
    case 'featuredPerformance':
      return { ...base, value: pro.featuredPerformance.interactionRate === null ? count(pro.featuredPerformance.views) : percent(pro.featuredPerformance.interactionRate),
        valueLabel: pro.featuredPerformance.interactionRate === null ? 'Visualizaciones' : 'Tasa de interacción en destacados',
        points: [{ label: 'Vistas', value: pro.featuredPerformance.views }, { label: 'Interacciones', value: pro.featuredPerformance.interactions }],
        chart: 'columns', note: 'Las barras representan eventos diferentes, no períodos diferentes.' };
    case 'periodComparison':
      return data.previous ? { ...base, value: count(data.metrics.businessViews), valueLabel: 'Visualizaciones actuales',
        current: data.metrics.businessViews, previous: data.previous.businessViews,
        points: [{ label: 'Anterior', value: data.previous.businessViews }, { label: 'Actual', value: data.metrics.businessViews }],
        chart: 'columns', note: 'Comparación con la misma porción del período anterior informada por la API.' }
        : scalar(data.metrics.businessViews, 'Visualizaciones actuales', { note: 'No hay un período anterior comparable disponible.' });
    case 'commercialIndex':
      return { ...base, value: 'Medición pendiente', valueLabel: 'Índice de rendimiento comercial', status: 'pending',
        note: 'Todavía no existe una base suficiente de negocios comparables.' };
  }
  return unavailable('La API todavía no ofrece un desglose adicional.');
}

function DataChart({ points, chart, unit }: { points: Point[]; chart: ChartKind; unit?: 'count' | 'rating' }) {
  const [active, setActive] = useState<number | null>(null);
  if (!points.length) return <div className="stats-detail-empty">No hay registros desglosados para mostrar.</div>;
  if (chart === 'ranking') {
    const max = Math.max(1, ...points.map(p => p.value));
    return <div className="stats-detail-ranking">{points.map((p, i) => <div className="stats-detail-ranking-row" key={p.label + i}>
      <span title={p.label}>{p.label}</span><i role="img" aria-label={p.label + ': ' + count(p.value)}><b style={{ width: (Math.min(100, p.value / max * 100)) + '%' }} /></i><strong>{count(p.value)}</strong>
    </div>)}</div>;
  }
  const w = 760, h = 295, left = 51, right = 18, top = 23, bottom = 50;
  const pw = w - left - right, ph = h - top - bottom;
  const max = Math.max(0, ...points.map(p => p.value));
  const ceiling = unit === 'rating' ? 5 : max === 0 ? 4 : Math.max(1, Math.ceil(max * 1.12));
  const y = (v: number) => top + ph * (1 - Math.min(v, ceiling) / ceiling);
  const x = (i: number) => left + (points.length === 1 ? pw / 2 : (i / (points.length - 1)) * pw);
  const labelsStep = Math.max(1, Math.ceil(points.length / 7));
  const base = y(0);
  const lineCoords = points.map((p, i) => x(i) + ',' + y(p.value)).join(' ');
  const area = points.length > 1 ? 'M' + x(0) + ' ' + base + ' L' + points.map((p, i) => x(i) + ' ' + y(p.value)).join(' L') + ' L' + x(points.length - 1) + ' ' + base + ' Z' : '';
  const barWidth = Math.min(47, pw / points.length * .62);
  // Explore nearest data point along the X axis across the entire chart surface.
  // Screen coordinate transforms support responsive SVG sizing on mobile and iPad.
  const selectNearest = (event: ChartPointerEvent<SVGSVGElement>) => {
    const svg = event.currentTarget;
    const matrix = svg.getScreenCTM();
    if (!matrix) return;
    const pointer = svg.createSVGPoint();
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    const relativeX = pointer.matrixTransform(matrix.inverse()).x;
    const ratio = Math.max(0, Math.min(1, (relativeX - left) / pw));
    const index = chart === 'columns'
      ? Math.min(points.length - 1, Math.floor(ratio * points.length))
      : Math.round(ratio * (points.length - 1));
    setActive(index);
  };
  const activePoint = active === null ? null : points[active];
  const activeX = active === null ? 0 : chart === 'columns'
    ? left + (active + .5) * pw / points.length : x(active);
  return <div className="stats-detail-plot">
    <svg viewBox={'0 0 ' + w + ' ' + h} role="group" aria-label="Gráfica interactiva. Mueve el cursor o desliza el dedo para consultar el punto más cercano." onPointerMove={selectNearest} onPointerDown={selectNearest} onPointerLeave={() => setActive(null)}>
      <defs><linearGradient id="stats-detail-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2563eb" stopOpacity=".25" /><stop offset="100%" stopColor="#2563eb" stopOpacity="0" /></linearGradient><linearGradient id="stats-detail-bar" x1="0" y1="1" x2="1" y2="0"><stop offset="0%" stopColor="#275cf1" /><stop offset="100%" stopColor="#7954eb" /></linearGradient></defs>
      {[0, 1, 2, 3, 4].map(i => <g key={i}><line x1={left} y1={top + i * ph / 4} x2={w - right} y2={top + i * ph / 4} stroke="#e1e9f5" strokeDasharray="4 5" /><text x={left - 11} y={top + i * ph / 4 + 4} textAnchor="end" fill="#7183a0" fontSize="11">{count(ceiling * (1 - i / 4))}</text></g>)}
      {chart === 'line' ? <>
        {area && <path d={area} fill="url(#stats-detail-area)" />}
        <polyline points={lineCoords} fill="none" stroke="#275cf1" strokeWidth="3.3" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => <circle key={p.label + i} cx={x(i)} cy={y(p.value)} r={active === i ? 6 : 4} fill="#fff" stroke="#275cf1" strokeWidth="2.5" tabIndex={0} aria-label={p.label + ': ' + count(p.value)} onMouseEnter={() => setActive(i)} onFocus={() => setActive(i)} onClick={() => setActive(i)} />)}
      </> : points.map((p, i) => <rect key={p.label + i} x={left + (i + .5) * pw / points.length - barWidth / 2} y={y(p.value)} width={barWidth} height={Math.max(1, base - y(p.value))} rx="5" fill="url(#stats-detail-bar)" tabIndex={0} aria-label={p.label + ': ' + count(p.value)} onMouseEnter={() => setActive(i)} onFocus={() => setActive(i)} onClick={() => setActive(i)} />)}
      {points.map((p, i) => (i % labelsStep === 0 || i === points.length - 1) && <text key={p.label + i} x={chart === 'columns' ? left + (i + .5) * pw / points.length : x(i)} y={h - 21} textAnchor="middle" fill="#6e819e" fontSize="11">{p.label.length > 12 ? p.label.slice(0, 11) + '…' : p.label}</text>)}
      {activePoint && <>
        <line className="stats-detail-crosshair" x1={activeX} y1={y(activePoint.value)} x2={activeX} y2={base} stroke="#82a1dc" strokeWidth="1.4" strokeDasharray="4 5" pointerEvents="none" />
        <circle className="stats-detail-crosshair-dot" cx={activeX} cy={y(activePoint.value)} r="5.5" fill="#fff" stroke="#245cf2" strokeWidth="2.4" pointerEvents="none" />
      </>}
      {activePoint && (() => {
        const tx = Math.max(left, Math.min(w - right - 90, activeX - 45));
        const ty = Math.max(3, y(activePoint.value) - 42);
        return <g pointerEvents="none"><rect x={tx} y={ty} width="90" height="32" rx="8" fill="#172b51" /><text x={tx + 45} y={ty + 21} textAnchor="middle" fill="#fff" fontSize="14" fontWeight="700">{count(activePoint.value)}</text></g>;
      })()}
    </svg>
    <p className="stats-detail-chart-hint">{active === null ? 'Mueve el cursor por la gráfica o desliza el dedo para explorar los valores.' : 'Valor: ' + count(points[active].value)}</p>
  </div>;
}

function DataTable({ points }: { points: Point[] }) {
  return <div className="stats-detail-table-wrap"><table><thead><tr><th scope="col">Categoría / período</th><th scope="col">Valor registrado</th></tr></thead><tbody>{points.map((p, i) => <tr key={p.label + i}><th scope="row">{p.label}</th><td>{count(p.value)}</td></tr>)}</tbody></table></div>;
}

export function StatisticsDetailDialog(props: Props) {
  const { onClose, selection, data, period } = props;
  const closeButton = useRef<HTMLButtonElement>(null);
  const [display, setDisplay] = useState<'chart' | 'data'>('chart');
  const detail = useMemo(() => getDetail(props), [props.selection, props.data, props.favoriteCount, props.offerLikeCount, props.reviewStatistics, props.offerViewRanking, props.unlockedReferralStatistics, props.availablePro, props.loading, props.error]);
  useEffect(() => { setDisplay('chart'); }, [selection.section, selection.key]);
  useEffect(() => {
    const prior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButton.current?.focus({ preventScroll: true });
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } };
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('keydown', onKeyDown); document.body.style.overflow = prior; previousFocus?.focus({ preventScroll: true }); };
  }, [onClose]);
  const previous = detail.previous;
  const delta = measured(previous) && measured(detail.current) && previous > 0 ? Math.round((detail.current - previous) / previous * 100) : null;
  const points = detail.points ?? [];
  const hasChart = Boolean(detail.chart && points.length && detail.status !== 'locked');
  const periodLabel = periods.find(item => item.id === period)?.label ?? period;
  return createPortal(<div className="stats-detail-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <section className="stats-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="stats-detail-title" aria-describedby="stats-detail-desc">
      <header className="stats-detail-header"><div><span>ANÁLISIS DETALLADO · {periodLabel.toLocaleUpperCase('es-CO')}</span><h2 id="stats-detail-title">{detail.title}</h2><p id="stats-detail-desc">{detail.description}</p></div><button ref={closeButton} type="button" onClick={onClose} aria-label="Cerrar detalle">×</button></header>
      <div className="stats-detail-body">
        <div className="stats-detail-summary"><div><span>{detail.valueLabel}</span><strong>{detail.value}</strong></div><div><span>Período</span><strong>{periodLabel}</strong></div>{measured(previous) && <div><span>Período anterior</span><strong>{count(previous)}</strong>{delta !== null && <small className={delta >= 0 ? 'positive' : 'negative'}>{(delta > 0 ? '+' : '') + delta + ' % respecto al anterior'}</small>}</div>}</div>
        {detail.status === 'locked' || detail.status === 'unavailable' || detail.status === 'pending' ?
          <div className="stats-detail-callout"><strong>{detail.status === 'locked' ? 'Acceso restringido' : 'Detalle no disponible'}</strong><p>{detail.note ?? detail.source}</p></div> :
          hasChart ? <div className="stats-detail-chart-card"><div className="stats-detail-chart-head"><div><h3>Explora los datos</h3><p>{detail.chart === 'line' ? 'Evolución registrada' : 'Desglose del indicador'} · Datos del servidor</p></div><div className="stats-detail-switch" role="group" aria-label="Tipo de visualización"><button type="button" aria-pressed={display === 'chart'} className={display === 'chart' ? 'active' : ''} onClick={() => setDisplay('chart')}>Gráfica</button><button type="button" aria-pressed={display === 'data'} className={display === 'data' ? 'active' : ''} onClick={() => setDisplay('data')}>Tabla</button></div></div>{display === 'chart' ? <DataChart key={selection.section + selection.key} points={points} chart={detail.chart!} unit={detail.unit} /> : <DataTable points={points} />}</div> : null
        }
        {detail.note && detail.status !== 'pending' && <p className="stats-detail-note"><strong>Cómo interpretar este dato:</strong> {detail.note}</p>}
        <p className="stats-detail-source"><strong>Fuente:</strong> {detail.source} {data && <span>Zona horaria: {data.timezone}.</span>}</p>
      </div>
      <footer className="stats-detail-footer"><span>Solo se muestran mediciones disponibles del negocio.</span><button type="button" onClick={onClose}>Volver a estadísticas</button></footer>
    </section>
  </div>, document.body);
}
