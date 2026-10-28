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

export const proCards: ReadonlyArray<{ key: string; label: string; source: string; contextualHistory?: boolean }> = [
  { key: 'uniqueVisitors', label: 'Visitantes únicos', source: 'Personas distintas que abrieron tu ficha; seudónimo técnico, sin identificar a la persona.', contextualHistory: true },
  { key: 'repeatVisitors', label: 'Visitantes recurrentes', source: 'Personas seudónimas con más de una apertura de tu ficha en el período.', contextualHistory: true },
  { key: 'viewEvolution', label: 'Evolución de visualizaciones', source: 'Aperturas de tu ficha (BUSINESS_VIEW).' },
  { key: 'searchEvolution', label: 'Evolución de apariciones en búsquedas', source: 'Apariciones de tu negocio en resultados de búsqueda.' },
  { key: 'interactionRate', label: 'Tasa de interacción', source: '(WhatsApp + llamadas + cómo llegar + aperturas de producto/servicio) / visualizaciones × 100. Indica interés dentro de XAMUKO; no confirma ventas.' },
  { key: 'contactRate', label: 'Tasa de contacto', source: '(WhatsApp + llamadas) / visualizaciones × 100. No mide ventas.' },
  { key: 'navigationRate', label: 'Tasa de navegación', source: 'Clics en «Cómo llegar» / visualizaciones × 100. Mide intención de llegar, no llegada física.' },
  { key: 'hourlyActivity', label: 'Horarios de mayor actividad', source: 'Aperturas de la ficha, hora de Bogotá.' },
  { key: 'weekdayActivity', label: 'Días de mayor actividad', source: 'Aperturas de la ficha, día de Bogotá.' },
  { key: 'visitOrigins', label: 'Origen de las visitas', source: 'Aperturas atribuidas a búsqueda, mapa, destacado o acceso directo.', contextualHistory: true },
  { key: 'keywords', label: 'Palabras clave de búsqueda', source: 'Términos agregados con los que apareciste en resultados; nunca muestra quién buscó.', contextualHistory: true },
  { key: 'averagePosition', label: 'Posición promedio en búsquedas', source: 'Promedio de la posición visible de tu negocio en resultados de búsqueda.', contextualHistory: true },
  { key: 'categoryPerformance', label: 'Rendimiento por categoría', source: 'Visualizaciones agrupadas por la categoría con la que se abrió tu ficha.', contextualHistory: true },
  { key: 'topProducts', label: 'Productos más vistos', source: 'Los cinco productos con más aperturas de detalle en el período.' },
  { key: 'topServices', label: 'Servicios más vistos', source: 'Los cinco servicios con más aperturas de detalle en el período.' },
  { key: 'favoriteEvolution', label: 'Evolución de favoritos', source: 'Altas de favoritos aún vigentes; las bajas no conservan historial.' },
  { key: 'ratingEvolution', label: 'Evolución de calificaciones', source: 'Promedios de opiniones publicadas por fecha de creación; no reconstruye ediciones.' },
  { key: 'featuredPerformance', label: 'Rendimiento de destacados', source: 'Visualizaciones e interacciones atribuidas a negocios destacados durante el período.', contextualHistory: true },
  { key: 'periodComparison', label: 'Comparación entre períodos', source: 'Visualizaciones frente a la misma porción del período anterior.' },
  { key: 'commercialIndex', label: 'Índice de rendimiento comercial', source: 'Para compararte de forma justa se necesita una base suficiente de negocios de la misma ciudad y categoría. No representa ventas.' },
] as const;
import { recognitionLevels } from './businessRecognition';

