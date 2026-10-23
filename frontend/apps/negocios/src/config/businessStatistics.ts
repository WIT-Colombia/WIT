export type StatisticsPeriod = "day" | "week" | "month" | "year" | "all";

export type StatisticsMetricId = "businessViews" | "searchAppearances" | "whatsappClicks" | "phoneClicks" | "favorites";

export type StatisticsMetricDefinition = {
  id: StatisticsMetricId;
  label: string;
  description: string;
  icon: "eye" | "search" | "whatsapp" | "phone" | "heart";
};

export type StatisticsMetricValue = {
  status: "available" | "no-events" | "insufficient-data" | "unavailable";
  value?: number;
  previousValue?: number;
};

export type BusinessStatisticsSnapshot = {
  planName?: string;
  planStatus?: "basic" | "pro" | "pending";
  recognitionLevelName?: string;
  referredUsers?: number | null;
  metrics: Partial<Record<StatisticsMetricId, StatisticsMetricValue>>;
};

export type AdvancedStatisticsIndicatorId =
  | "uniqueVisitors" | "visitEvolution" | "searchVisitRate" | "searchPosition" | "searchTerms"
  | "mostViewedProducts" | "mostViewedServices" | "mostLikedOffers" | "leastLikedOffers"
  | "directions" | "hourlyActivity" | "weekdayActivity" | "mapDiscoveries"
  | "promotionViews" | "mostViewedPromotions" | "ratingEvolution" | "favoriteAcquisitions" | "shares";

export type AdvancedStatisticsIndicator = {
  id: AdvancedStatisticsIndicatorId;
  name: string;
  description: string;
  pendingReason?: string;
};

export type AdvancedStatisticsCategory = {
  id: "visibility" | "catalog" | "behavior" | "reputation";
  label: string;
  description: string;
  icon: string;
  indicators: AdvancedStatisticsIndicator[];
};

export type CommercialIntelligenceDefinition = {
  level: "BRONZE" | "SILVER" | "GOLD" | "PLATINUM" | "DIAMOND";
  name: string;
  description: string;
};

export const statisticsPeriods: Array<{ id: StatisticsPeriod; label: string }> = [
  { id: "day", label: "Día" },
  { id: "week", label: "Semana" },
  { id: "month", label: "Mes" },
  { id: "year", label: "Año" },
  { id: "all", label: "Todo el tiempo" },
];

export const freeStatistics: StatisticsMetricDefinition[] = [
  { id: "businessViews", label: "Visualizaciones del negocio", description: "Aperturas registradas de la ficha de tu negocio; no visitantes únicos.", icon: "eye" },
  { id: "searchAppearances", label: "Apariciones en búsquedas", description: "Veces que tu negocio apareció en resultados.", icon: "search" },
  { id: "whatsappClicks", label: "Clics en WhatsApp", description: "Clics registrados para escribirte por WhatsApp.", icon: "whatsapp" },
  { id: "phoneClicks", label: "Clics en llamar", description: "Clics registrados para llamarte desde XAMUKO.", icon: "phone" },
  { id: "favorites", label: "Usuarios que te guardaron", description: "Usuarios que añadieron tu negocio a favoritos.", icon: "heart" },
];

export const advancedStatistics: AdvancedStatisticsCategory[] = [
  { id: "visibility", label: "Visibilidad", description: "Cómo encuentran tu negocio dentro de XAMUKO.", icon: "◌", indicators: [
    { id: "uniqueVisitors", name: "Usuarios únicos que visitaron el negocio", description: "Alcance de tu ficha.", pendingReason: "Falta una identidad de visitante que permita deduplicar todas las visitas." },
    { id: "visitEvolution", name: "Evolución de visitas", description: "Aperturas de la ficha por fecha; no visitantes únicos." },
    { id: "searchVisitRate", name: "Tasa de visitas desde resultados", description: "Interés después de aparecer en búsquedas.", pendingReason: "Falta atribuir cada apertura a un resultado de búsqueda." },
    { id: "searchPosition", name: "Posición promedio en búsquedas", description: "Ubicación agregada en resultados.", pendingReason: "No se registra la posición del negocio en los resultados." },
    { id: "searchTerms", name: "Palabras utilizadas para encontrar el negocio", description: "Términos agregados de búsqueda.", pendingReason: "No hay un historial de términos de búsqueda por negocio." },
  ] },
  { id: "catalog", label: "Productos y servicios", description: "Interés en la oferta que publicas.", icon: "□", indicators: [
    { id: "mostViewedProducts", name: "Productos más vistos", description: "Ranking por visualizaciones.", pendingReason: "No se registran aperturas de productos con alcance completo." },
    { id: "mostViewedServices", name: "Servicios más vistos", description: "Ranking por visualizaciones.", pendingReason: "No se registran aperturas de servicios con alcance completo." },
    { id: "mostLikedOffers", name: "Publicaciones con más Me gusta", description: "Productos y servicios con Me gusta vigentes creados en el período." },
    { id: "leastLikedOffers", name: "Publicaciones con menos Me gusta", description: "Productos y servicios actuales, con su fecha de creación y tiempo observado." },
  ] },
  { id: "behavior", label: "Comportamiento", description: "Acciones previas a una posible visita o contacto.", icon: "↗", indicators: [
    { id: "directions", name: "Solicitudes de indicaciones", description: "Interés en llegar a tu ubicación.", pendingReason: "No hay eventos persistidos de solicitudes de indicaciones." },
    { id: "hourlyActivity", name: "Horarios de mayor actividad", description: "Distribución de aperturas de la ficha por hora." },
    { id: "weekdayActivity", name: "Días de mayor actividad", description: "Distribución de aperturas de la ficha por día de la semana." },
    { id: "mapDiscoveries", name: "Descubrimientos desde el mapa", description: "Vistas originadas desde el mapa.", pendingReason: "No se registra el origen mapa de las aperturas." },
  ] },
  { id: "reputation", label: "Promociones y reputación", description: "Respuesta a ofertas, favoritos y opiniones.", icon: "✦", indicators: [
    { id: "promotionViews", name: "Visualizaciones de ofertas", description: "Aperturas registradas de promociones, incluidas las finalizadas." },
    { id: "mostViewedPromotions", name: "Promociones más vistas", description: "Ranking de visualizaciones; no clics ni conversiones." },
    { id: "ratingEvolution", name: "Evolución de calificaciones", description: "Promedio actual de reseñas publicadas, agrupado por fecha de creación." },
    { id: "favoriteAcquisitions", name: "Favoritos vigentes por fecha de alta", description: "Altas que siguen vigentes; no incluye favoritos eliminados." },
    { id: "shares", name: "Veces que compartieron el negocio", description: "Difusión de tu ficha pública.", pendingReason: "No se registran eventos de compartir la ficha." },
  ] },
];

export const commercialIntelligence: CommercialIntelligenceDefinition[] = [
  { level: "BRONZE", name: "Productos y servicios más buscados en tu ciudad", description: "Interés agregado dentro de la categoría y ciudad de tu negocio." },
  { level: "SILVER", name: "Búsquedas sin resultados en tu categoría", description: "Necesidades agregadas que aún no encuentran una opción." },
  { level: "GOLD", name: "Comparación con negocios similares", description: "Comparación agregada con negocios de categoría y ciudad similares." },
  { level: "PLATINUM", name: "Tendencias de demanda local", description: "Cambios agregados en el interés de tu zona." },
  { level: "DIAMOND", name: "Índice de oportunidades comerciales XAMUKO", description: "Indicador pendiente de cálculo con datos suficientes y agregados." },
];

/** Estado inicial sin cifras hasta recibir la respuesta del negocio seleccionado. */
export function unavailableBusinessStatistics(): BusinessStatisticsSnapshot {
  return { metrics: {} };
}
