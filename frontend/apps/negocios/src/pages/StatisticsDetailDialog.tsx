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


/** What was measured and how to read it; never imply that a recorded click is a sale. */
type Explanation = { origin: string; meaning: string };
const metricExplanations: Record<string, Explanation> = {
  businessViews: {
    origin: 'Se cuentan los eventos de apertura de la ficha de tu negocio que registra XAMUKO (BUSINESS_VIEW), agrupados por hora, día o mes según el filtro.',
    meaning: 'Indica cuántas veces se abrió la ficha, no cuántas personas diferentes entraron. Una persona puede abrirla varias veces. No demuestra compras ni visitas al local.',
  },
  searchAppearances: {
    origin: 'Proviene de los eventos de impresión en resultados de búsqueda (SEARCH_IMPRESSION), guardados cuando XAMUKO muestra tu negocio en una búsqueda.',
    meaning: 'Cuenta las veces que tu negocio apareció como resultado, aunque nadie haya tocado el resultado. No equivale a visitas a tu ficha ni a clientes adquiridos.',
  },
  whatsappClicks: {
    origin: 'Se cuentan los eventos WHATSAPP_CLICK registrados al pulsar el enlace de WhatsApp desde XAMUKO.',
    meaning: 'Mide la intención de iniciar contacto. No permite saber si el usuario envió el mensaje, recibió respuesta o realizó una compra.',
  },
  phoneClicks: {
    origin: 'Se cuentan los eventos PHONE_CLICK registrados cuando alguien pulsa el botón para llamar desde XAMUKO.',
    meaning: 'Cada pulsación es un intento de contacto, no necesariamente una llamada completada o una conversación.',
  },
  directionsClicks: {
    origin: 'Se cuentan los eventos DIRECTIONS_CLICK al abrir la opción «Cómo llegar» del negocio desde XAMUKO.',
    meaning: 'Refleja interés por la ubicación, pero no prueba que la persona haya seguido la ruta ni visitado el establecimiento.',
  },
  uniqueVisitors: {
    origin: 'XAMUKO cuenta identificadores técnicos seudónimos distintos que quedaron asociados a eventos de apertura de la ficha en el período.',
    meaning: 'Es una estimación de visitantes diferentes según los identificadores disponibles. No identifica personas por nombre y puede no incluir aperturas sin identificador técnico.',
  },
  repeatVisitors: {
    origin: 'Dentro de los eventos de apertura de ficha, se cuentan identificadores seudónimos que registraron más de una apertura durante el período.',
    meaning: 'Indica cuántos identificadores repitieron una visita digital. Son parte de los visitantes únicos; no deben sumarse a ellos como usuarios adicionales.',
  },
  viewEvolution: {
    origin: 'Se agrupan por fecha los mismos eventos BUSINESS_VIEW que alimentan «Visualizaciones del negocio».',
    meaning: 'Permite observar cuándo se abrió más o menos la ficha. Los ceros indican períodos transcurridos sin aperturas registradas, no ausencia total de clientes.',
  },
  searchEvolution: {
    origin: 'Se agrupan por fecha los eventos SEARCH_IMPRESSION generados cuando el negocio apareció en resultados de búsqueda.',
    meaning: 'Permite identificar los períodos en que hubo mayor exposición en búsquedas, no necesariamente más aperturas de ficha o ventas.',
  },
  contactRate: {
    origin: 'El servidor calcula (clics en WhatsApp + clics para llamar) ÷ aperturas de ficha × 100 para el mismo período.',
    meaning: 'Indica cuántas acciones de contacto se generaron por cada 100 aperturas de la ficha. Una visita puede producir varios clics; por eso no es un porcentaje de compradores. Sin aperturas, la tasa no se calcula.',
  },
  interactionRate: {
    origin: 'El servidor suma clics en WhatsApp, llamadas, indicaciones y aperturas de productos o servicios, y divide el total entre las aperturas de ficha.',
    meaning: 'Mide acciones digitales por cada 100 aperturas. Una misma persona puede interactuar varias veces y el porcentaje puede superar 100 %. No representa una tasa de ventas.',
  },
  navigationRate: {
    origin: 'Se divide el número de clics en «Cómo llegar» entre las aperturas de la ficha del negocio y se multiplica por 100.',
    meaning: 'Indica cuántas solicitudes de indicaciones se produjeron por cada 100 aperturas. No confirma que alguien haya llegado físicamente.',
  },
  hourlyActivity: {
    origin: 'Los eventos BUSINESS_VIEW se agrupan por hora del día en el huso de Bogotá, sumando los días comprendidos en el período.',
    meaning: 'Cada barra muestra cuántas aperturas se registraron a esa hora entre todos los días seleccionados. Una hora con 0 no tuvo aperturas registradas; no es la evolución de un día particular.',
  },
  weekdayActivity: {
    origin: 'Los eventos BUSINESS_VIEW se agrupan por lunes, martes, miércoles y los demás días de la semana en hora de Bogotá.',
    meaning: 'Sirve para comparar qué días de la semana concentran más aperturas durante el período. Son totales acumulados por día de semana, no fechas consecutivas.',
  },
  visitOrigins: {
    origin: 'Proviene del campo de origen asociado a las aperturas de ficha cuando XAMUKO pudo registrar esa procedencia.',
    meaning: 'Muestra las aperturas clasificadas por su procedencia, como búsqueda o acceso directo. Las visitas sin origen identificable pueden no aparecer en este desglose.',
  },
  keywords: {
    origin: 'Son términos de búsqueda agregados asociados a eventos SEARCH_IMPRESSION. El servidor muestra los términos más frecuentes, sin identificar a quien buscó.',
    meaning: 'Sirve para conocer con qué expresiones se mostró tu negocio. No refleja necesariamente los términos de todos los usuarios ni demuestra que hayan abierto la ficha.',
  },
  averagePosition: {
    origin: 'El servidor obtiene el promedio de la posición registrada en resultados de búsqueda, solo en impresiones donde existe ese dato.',
    meaning: 'Una posición promedio menor significa una aparición más alta en la lista. No es un puesto fijo ni representa todas las búsquedas realizadas.',
  },
  categoryPerformance: {
    origin: 'Se agrupan las aperturas de ficha que traen una categoría asociada en el evento registrado por XAMUKO.',
    meaning: 'Permite comparar aperturas atribuidas a categorías. Pueden faltar eventos sin categoría registrada; no representa el tamaño de cada categoría en la plataforma.',
  },
  topProducts: {
    origin: 'Son eventos de apertura de fichas de productos (OFFER_VIEW), ordenados por cantidad durante el período. Se muestran hasta cinco productos.',
    meaning: 'Compara cuáles productos recibieron más consultas de detalle. El ranking puede excluir otros productos y una apertura no significa una venta.',
  },
  topServices: {
    origin: 'Son eventos de apertura de fichas de servicios (OFFER_VIEW), ordenados por cantidad durante el período. Se muestran hasta cinco servicios.',
    meaning: 'Compara cuáles servicios recibieron más consultas de detalle. No incluye necesariamente todo el catálogo ni confirma contrataciones.',
  },
  favoriteEvolution: {
    origin: 'Se agrupan por fecha de creación los registros de favoritos que todavía existen en XAMUKO para el negocio.',
    meaning: 'Muestra cuándo se añadieron los favoritos que siguen vigentes. Los favoritos retirados ya no forman parte de la serie, por lo que no es un histórico completo de altas y bajas.',
  },
  ratingEvolution: {
    origin: 'Se calcula el promedio de estrellas de las opiniones publicadas, agrupadas según su fecha de creación.',
    meaning: 'Cada punto es el promedio de las opiniones registradas en esa fecha o período. Si no hubo opiniones, no existe promedio: no debe confundirse con una calificación de 0 estrellas. Las modificaciones posteriores no se reconstruyen.',
  },
  featuredPerformance: {
    origin: 'Se cuentan los eventos de apertura e interacción marcados por XAMUKO como provenientes de apariciones destacadas.',
    meaning: 'Compara visualizaciones e interacciones atribuidas a destacados, no clientes únicos. La tasa de interacción resulta de las acciones registradas frente a esas visualizaciones.',
  },
  periodComparison: {
    origin: 'Compara los eventos de apertura de la ficha del período actual con la misma porción transcurrida del período anterior, cuando es comparable.',
    meaning: 'Sirve para observar si las aperturas aumentaron o disminuyeron en intervalos equivalentes. Con un valor anterior igual a 0 no se calcula un crecimiento porcentual fiable.',
  },
  commercialIndex: {
    origin: 'El índice requeriría suficientes negocios comparables de la misma ciudad y categoría, además de una metodología de referencia.',
    meaning: 'Todavía no hay una medición calculada y validada. No debe interpretarse como nivel de ventas, éxito comercial ni posición competitiva.',
  },
};
const referralExplanations: Explanation[] = [
  {
    origin: 'Se cuenta cuántas personas mantienen actualmente tu negocio en su lista de favoritos de XAMUKO.',
    meaning: 'Es el número de favoritos vigentes, no la cantidad de veces que se pulsó el botón históricamente. No existe un desglose diario fiable para este total.',
  },
  {
    origin: 'Se cuentan las reacciones «Me gusta» que siguen registradas en los productos y servicios no eliminados del catálogo del negocio.',
    meaning: 'Es un total actual de reacciones. No equivale a compras ni se dispone de una serie diaria completa de altas y bajas.',
  },
  {
    origin: 'Se cuentan las opiniones que XAMUKO registra como publicadas y creadas dentro del período seleccionado.',
    meaning: 'Mide opiniones públicas recibidas, no visitas a la ficha. Una opinión retirada o no publicada deja de formar parte del total visible.',
  },
  {
    origin: 'Se consultan las opiniones publicadas actuales y se cuentan por calificación de una a cinco estrellas.',
    meaning: 'Permite observar cómo se distribuyen las calificaciones. Este desglose corresponde a las opiniones publicadas actuales, no exclusivamente al período del selector.',
  },
  {
    origin: 'Se consultan las aperturas de detalle de productos y servicios (OFFER_VIEW) del período; el servidor entrega un ranking limitado.',
    meaning: 'Muestra las publicaciones con más aperturas dentro del ranking ofrecido. La suma de sus barras no necesariamente coincide con todas las aperturas del catálogo.',
  },
];
function explainSelection(selection: StatisticsSelection, detail: Detail): Explanation {
  if (selection.section === 'referral') {
    const index = referralCards.findIndex(card => card.key === selection.key);
    return referralExplanations[index] ?? { origin: detail.source, meaning: detail.description };
  }
  return metricExplanations[selection.key] ?? { origin: detail.source, meaning: detail.description };
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
  const explanation = explainSelection(selection, detail);
  return createPortal(<div className="stats-detail-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <section className="stats-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="stats-detail-title" aria-describedby="stats-detail-desc">
      <header className="stats-detail-header"><div><span>ANÁLISIS DETALLADO · {periodLabel.toLocaleUpperCase('es-CO')}</span><h2 id="stats-detail-title">{detail.title}</h2><p id="stats-detail-desc">{detail.description}</p></div><button ref={closeButton} type="button" onClick={onClose} aria-label="Cerrar detalle">×</button></header>
      <div className="stats-detail-body">
        <div className="stats-detail-summary"><div><span>{detail.valueLabel}</span><strong>{detail.value}</strong></div><div><span>Período</span><strong>{periodLabel}</strong></div>{measured(previous) && <div><span>Período anterior</span><strong>{count(previous)}</strong>{delta !== null && <small className={delta >= 0 ? 'positive' : 'negative'}>{(delta > 0 ? '+' : '') + delta + ' % respecto al anterior'}</small>}</div>}</div>
        {detail.status === 'locked' || detail.status === 'unavailable' || detail.status === 'pending' ?
          <div className="stats-detail-callout"><strong>{detail.status === 'locked' ? 'Acceso restringido' : 'Detalle no disponible'}</strong><p>{detail.note ?? detail.source}</p></div> :
          hasChart ? <div className="stats-detail-chart-card"><div className="stats-detail-chart-head"><div><h3>Explora los datos</h3><p>{detail.chart === 'line' ? 'Evolución registrada' : 'Desglose del indicador'} · Datos del servidor</p></div><div className="stats-detail-switch" role="group" aria-label="Tipo de visualización"><button type="button" aria-pressed={display === 'chart'} className={display === 'chart' ? 'active' : ''} onClick={() => setDisplay('chart')}>Gráfica</button><button type="button" aria-pressed={display === 'data'} className={display === 'data' ? 'active' : ''} onClick={() => setDisplay('data')}>Tabla</button></div></div>{display === 'chart' ? <DataChart key={selection.section + selection.key} points={points} chart={detail.chart!} unit={detail.unit} /> : <DataTable points={points} />}</div> : null
        }
        <section className="stats-detail-explanation" aria-labelledby="stats-detail-explanation-title">
          <h3 id="stats-detail-explanation-title">Cómo interpretar este dato</h3>
          <p>{explanation.meaning}</p>
          <h4>¿De dónde se obtiene este valor?</h4>
          <p>{explanation.origin}</p>
          {detail.note && detail.status !== 'pending' && <p className="stats-detail-explanation-precision"><strong>Ten en cuenta:</strong> {detail.note}</p>}
          {detail.chart === 'line' && detail.unit !== 'rating' && <p className="stats-detail-explanation-precision">
            <strong>¿Qué significa un 0?</strong> En un intervalo transcurrido con cero eventos registrados de este indicador,
            el punto se muestra en 0. No se omite ese período ni se inventa actividad para completar la gráfica.
          </p>}
          {detail.chart === 'line' && detail.unit === 'rating' && <p className="stats-detail-explanation-precision">
            <strong>Sin calificaciones no significa 0 estrellas:</strong> si no existen opiniones en un período, no se puede calcular un promedio.
          </p>}
          {!hasChart && detail.status !== 'locked' && <p className="stats-detail-explanation-precision">
            <strong>Sin gráfica temporal:</strong> el servidor no entrega un historial desglosado suficiente para este indicador.
            No se construye una evolución artificial a partir de un único total.
          </p>}
          {data && <small>Período seleccionado: {periodLabel}. Zona horaria de referencia: {data.timezone}.</small>}
        </section>
      </div>
      <footer className="stats-detail-footer"><span>Solo se muestran mediciones disponibles del negocio.</span><button type="button" onClick={onClose}>Volver a estadísticas</button></footer>
    </section>
  </div>, document.body);
}
