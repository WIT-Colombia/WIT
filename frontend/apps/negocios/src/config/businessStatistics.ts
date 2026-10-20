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

export type AdvancedStatisticsCategory = {
  id: "visibility" | "catalog" | "behavior" | "reputation";
  label: string;
  description: string;
  icon: string;
  indicators: Array<{ name: string; description: string }>;
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
  { id: "businessViews", label: "Visualizaciones del negocio", description: "Personas que abrieron la ficha de tu negocio.", icon: "eye" },
  { id: "searchAppearances", label: "Apariciones en búsquedas", description: "Veces que tu negocio apareció en resultados.", icon: "search" },
  { id: "whatsappClicks", label: "Clics en WhatsApp", description: "Personas que eligieron escribirte por WhatsApp.", icon: "whatsapp" },
  { id: "phoneClicks", label: "Clics en llamar", description: "Personas que eligieron llamarte desde XAMUKO.", icon: "phone" },
  { id: "favorites", label: "Usuarios que te guardaron", description: "Usuarios que añadieron tu negocio a favoritos.", icon: "heart" },
];

export const advancedStatistics: AdvancedStatisticsCategory[] = [
  { id: "visibility", label: "Visibilidad", description: "Cómo encuentran tu negocio dentro de XAMUKO.", icon: "◌", indicators: [
    { name: "Usuarios únicos que visitaron el negocio", description: "Alcance de tu ficha." },
    { name: "Evolución de visitas", description: "Tendencia por período." },
    { name: "Tasa de visitas desde resultados", description: "Interés después de aparecer en búsquedas." },
    { name: "Posición promedio en búsquedas", description: "Ubicación agregada en resultados." },
    { name: "Palabras utilizadas para encontrar el negocio", description: "Términos agregados de búsqueda." },
  ] },
  { id: "catalog", label: "Productos y servicios", description: "Interés en la oferta que publicas.", icon: "□", indicators: [
    { name: "Productos más vistos", description: "Ranking por visualizaciones." },
    { name: "Servicios más vistos", description: "Ranking por visualizaciones." },
    { name: "Productos con más Me gusta", description: "Interacciones positivas de usuarios." },
    { name: "Productos y servicios con menor interacción", description: "Oportunidades para mejorar tu oferta." },
  ] },
  { id: "behavior", label: "Comportamiento", description: "Acciones previas a una posible visita o contacto.", icon: "↗", indicators: [
    { name: "Solicitudes de indicaciones", description: "Interés en llegar a tu ubicación." },
    { name: "Horarios de mayor actividad", description: "Momentos con más interés agregado." },
    { name: "Días de mayor actividad", description: "Días con mayor actividad agregada." },
    { name: "Descubrimientos desde el mapa", description: "Vistas originadas desde el mapa." },
  ] },
  { id: "reputation", label: "Promociones y reputación", description: "Respuesta a ofertas, favoritos y opiniones.", icon: "✦", indicators: [
    { name: "Visualizaciones de ofertas", description: "Alcance de tus promociones." },
    { name: "Ofertas con mayor interacción", description: "Promociones que generan más interés." },
    { name: "Evolución de calificaciones", description: "Cambio agregado en la reputación." },
    { name: "Evolución de favoritos", description: "Tendencia de usuarios que te guardan." },
    { name: "Veces que compartieron el negocio", description: "Difusión de tu ficha pública." },
  ] },
];

export const commercialIntelligence: CommercialIntelligenceDefinition[] = [
  { level: "BRONZE", name: "Productos y servicios más buscados en tu ciudad", description: "Interés agregado dentro de la categoría y ciudad de tu negocio." },
  { level: "SILVER", name: "Búsquedas sin resultados en tu categoría", description: "Necesidades agregadas que aún no encuentran una opción." },
  { level: "GOLD", name: "Comparación con negocios similares", description: "Comparación agregada con negocios de categoría y ciudad similares." },
  { level: "PLATINUM", name: "Tendencias de demanda local", description: "Cambios agregados en el interés de tu zona." },
  { level: "DIAMOND", name: "Índice de oportunidades comerciales XAMUKO", description: "Indicador pendiente de cálculo con datos suficientes y agregados." },
];

/** La analítica aún no expone un endpoint persistido. */
export function unavailableBusinessStatistics(): BusinessStatisticsSnapshot {
  return { metrics: {} };
}
