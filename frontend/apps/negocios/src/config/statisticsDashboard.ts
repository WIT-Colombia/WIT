export type Period = 'day' | 'week' | 'month' | 'year' | 'all';
export const periods: ReadonlyArray<{ id: Period; label: string }> = [
  { id: 'day', label: 'Día' }, { id: 'week', label: 'Semana' },
  { id: 'month', label: 'Mes' }, { id: 'year', label: 'Año' },
  { id: 'all', label: 'Todo el tiempo' },
];

export const freeCards = [
  { key: 'businessViews', label: 'Visualizaciones del negocio', caption: 'Aperturas de tu ficha; no visitantes únicos.', icon: '◉' },
  { key: 'searchAppearances', label: 'Apariciones en búsquedas', caption: 'Veces que apareciste en resultados.', icon: '⌕' },
  { key: 'whatsappClicks', label: 'Clics en WhatsApp', caption: 'Clics para escribirte por WhatsApp.', icon: '◌' },
  { key: 'phoneClicks', label: 'Clics en llamar', caption: 'Clics para llamarte desde XAMUKO.', icon: '☎' },
  { key: 'directionsClicks', label: 'Clics en cómo llegar', caption: 'Clics para abrir indicaciones hacia tu negocio.', icon: '⌖' },
] as const;

/** Single source of truth for the five level statistics shown in Benefits. */
export const referralCards = recognitionLevels.filter(level => level.exclusiveStatistic).map(level => ({
  key: `recognition-${level.level.toLowerCase()}`,
  label: level.exclusiveStatistic!,
  requiredLevel: level.name,
  requiredMinimum: level.min,
})) as ReadonlyArray<{ key: string; label: string; requiredLevel: string; requiredMinimum: number }>;

export const proCards = [
  { key: 'uniqueVisitors', label: 'Visitantes únicos', source: 'Falta una identidad seudónima legítima que cubra visitas anónimas.' },
  { key: 'repeatVisitors', label: 'Visitantes recurrentes', source: 'Depende de una medición fiable de visitantes únicos.' },
  { key: 'viewEvolution', label: 'Evolución de visualizaciones', source: 'BusinessAnalyticsEvent · BUSINESS_VIEW.' },
  { key: 'searchEvolution', label: 'Evolución de apariciones en búsquedas', source: 'BusinessAnalyticsEvent · SEARCH_IMPRESSION.' },
  { key: 'interactionRate', label: 'Tasa de interacción', source: 'Falta definir e instrumentar todas las interacciones relevantes.' },
  { key: 'contactRate', label: 'Tasa de contacto', source: '(WhatsApp + llamadas) / visualizaciones × 100. No mide ventas.' },
  { key: 'navigationRate', label: 'Tasa de navegación', source: 'Falta registrar clics en cómo llegar.' },
  { key: 'hourlyActivity', label: 'Horarios de mayor actividad', source: 'Aperturas de la ficha, hora de Bogotá.' },
  { key: 'weekdayActivity', label: 'Días de mayor actividad', source: 'Aperturas de la ficha, día de Bogotá.' },
  { key: 'visitOrigins', label: 'Origen de las visitas', source: 'Falta registrar la fuente de cada apertura.' },
  { key: 'keywords', label: 'Palabras clave de búsqueda', source: 'Falta registrar contexto de búsqueda agregado.' },
  { key: 'averagePosition', label: 'Posición promedio en búsquedas', source: 'Falta registrar posición en los resultados.' },
  { key: 'categoryPerformance', label: 'Rendimiento por categoría', source: 'Falta atribuir vistas y acciones a categorías.' },
  { key: 'topProducts', label: 'Productos más vistos', source: 'Falta registrar aperturas de productos.' },
  { key: 'topServices', label: 'Servicios más vistos', source: 'Falta registrar aperturas de servicios.' },
  { key: 'favoriteEvolution', label: 'Evolución de favoritos', source: 'Altas de favoritos aún vigentes; las bajas no conservan historial.' },
  { key: 'ratingEvolution', label: 'Evolución de calificaciones', source: 'Reseñas publicadas agrupadas por fecha de creación; no reconstruye ediciones.' },
  { key: 'featuredPerformance', label: 'Rendimiento de destacados', source: 'Falta asociar eventos con campañas destacadas.' },
  { key: 'periodComparison', label: 'Comparación entre períodos', source: 'Visualizaciones frente a la misma porción del período anterior.' },
  { key: 'commercialIndex', label: 'Índice de rendimiento comercial', source: 'Fórmula propuesta: 40 % visibilidad + 35 % contacto + 25 % reputación, normalizados contra una línea base válida. No representa ventas; pendiente hasta definir esa línea base.' },
] as const;
import { recognitionLevels } from './businessRecognition';

