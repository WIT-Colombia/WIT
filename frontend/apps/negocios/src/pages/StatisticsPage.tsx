import { useState } from "react";
import { BusinessProBenefitsDialog } from "../components/business/BusinessProBenefitsDialog";
import { PageHeader } from "../components/common/PageHeader";
import { advancedStatistics, commercialIntelligence, freeStatistics, statisticsPeriods, unavailableBusinessStatistics, type StatisticsMetricDefinition, type StatisticsMetricValue, type StatisticsPeriod } from "../config/businessStatistics";
import { recognitionLevelFor, recognitionLevels } from "../config/businessRecognition";
import { useBusinessStore } from "../services/businessStore";

function StatisticIcon({ icon }: Pick<StatisticsMetricDefinition, "icon">) {
  const common = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (icon === "eye") return <svg {...common}><path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.5" /></svg>;
  if (icon === "search") return <svg {...common}><circle cx="10.8" cy="10.8" r="5.8" /><path d="m16 16 4.2 4.2" /></svg>;
  if (icon === "whatsapp") return <svg {...common}><path d="M20 11.7a8 8 0 0 1-11.8 7l-4.1 1.1 1.1-4A8 8 0 1 1 20 11.7Z" /><path d="M8.7 8.6c.2-.5.5-.5.8-.5h.5c.2 0 .4.1.5.4l.8 1.8c.1.2.1.4 0 .6l-.5.7c.6 1.2 1.5 2.1 2.7 2.7l.7-.5c.2-.1.4-.1.6 0l1.8.8c.3.1.4.3.4.5v.5c0 .3 0 .6-.5.8-.5.2-1.7.4-3.7-.5-1.2-.5-2.3-1.4-3.2-2.3-.9-.9-1.8-2-2.3-3.2-.9-2-.7-3.2-.5-3.7Z" /></svg>;
  if (icon === "phone") return <svg {...common}><path d="M5.5 3.8 8.3 3l2 4.3-1.8 1.9c1.1 2.3 2.9 4.1 5.2 5.2l1.9-1.8 4.3 2-.8 2.8c-.3 1-1.3 1.7-2.4 1.5C9.9 18 6 14.1 5 7.3c-.2-1.1.5-2.1 1.5-2.4Z" /></svg>;
  return <svg {...common}><path d="M20.8 8.3c0 5.5-8.8 10.4-8.8 10.4S3.2 13.8 3.2 8.3A4.8 4.8 0 0 1 12 5.6a4.8 4.8 0 0 1 8.8 2.7Z" /></svg>;
}

function metricState(metric?: StatisticsMetricValue) {
  if (!metric || metric.status === "unavailable") return { value: "—", note: "Información no disponible todavía", className: "is-unavailable" };
  if (metric.status === "insufficient-data") return { value: "—", note: "Datos insuficientes para este período", className: "is-insufficient" };
  if (metric.status === "no-events") return { value: "0", note: "No se registraron eventos en este período", className: "is-empty" };
  return { value: metric.value?.toLocaleString("es-CO") ?? "—", note: metric.previousValue === undefined ? "Datos del período seleccionado" : "Comparado con el período anterior", className: "is-available" };
}

const validReferralCount = (value: unknown) => Number.isInteger(value) && typeof value === "number" && value >= 0 ? value : null;

export function StatisticsPage() {
  const { business } = useBusinessStore();
  const [period, setPeriod] = useState<StatisticsPeriod>("30d");
  const [proBenefitsOpen, setProBenefitsOpen] = useState(false);
  const statistics = unavailableBusinessStatistics();
  const planStatus = statistics.planStatus ?? "pending";
  const referredUsers = validReferralCount(statistics.referredUsers);
  const currentLevel = referredUsers === null ? null : recognitionLevelFor(referredUsers);
  const currentLevelIndex = currentLevel ? recognitionLevels.findIndex(item => item.level === currentLevel.level) : -1;
  const proState = planStatus === "pro" ? "Datos pendientes de disponibilidad" : planStatus === "basic" ? "Disponible con Business Pro" : "Plan pendiente de verificación";

  return <div className="statistics-page">
    <PageHeader
      eyebrow="ANÁLISIS COMERCIAL"
      title="Estadísticas"
      description="Conoce cómo los usuarios descubren e interactúan con tu negocio en XAMUKO."
      action={<div className="statistics-period-tabs" role="group" aria-label="Período de estadísticas">{statisticsPeriods.map(item => <button type="button" className={period === item.id ? "selected" : ""} aria-pressed={period === item.id} onClick={() => setPeriod(item.id)} key={item.id}>{item.label}</button>)}</div>}
    />

    <section className="statistics-context surface-card" aria-label="Contexto del negocio seleccionado">
      <div className="statistics-context-business"><span>NEGOCIO SELECCIONADO</span><strong>{business.name}</strong></div>
      <div><span>PLAN COMERCIAL</span><strong>{statistics.planName ?? "Pendiente de sincronizar"}</strong></div>
      <div><span>NIVEL DE RECONOCIMIENTO</span><strong>{statistics.recognitionLevelName ?? currentLevel?.name ?? "Pendiente de sincronizar"}</strong><small>{statistics.recognitionLevelName || currentLevel ? "Nivel conectado a referidos válidos" : "Referidos pendientes de sincronizar"}</small></div>
    </section>

    <section className="statistics-free-section" aria-labelledby="free-statistics-title">
      <div className="statistics-section-heading"><div><span>INFORMACIÓN DISPONIBLE SIN COSTO</span><h2 id="free-statistics-title">Resumen de actividad</h2><p>Estas cinco métricas estarán disponibles para todos los negocios.</p></div><p className="statistics-period-copy">Período: <strong>{statisticsPeriods.find(item => item.id === period)?.label}</strong></p></div>
      <div className="statistics-free-grid">{freeStatistics.map(definition => {
        const state = metricState(statistics.metrics[definition.id]);
        return <article className={`statistics-metric-card ${state.className}`} key={definition.id}>
          <span className="statistics-metric-icon"><StatisticIcon icon={definition.icon} /></span>
          <p>{definition.label}</p>
          <strong>{state.value}</strong>
          <small>{definition.description}</small>
          <span className="statistics-metric-state">{state.note}</span>
        </article>;
      })}</div>
    </section>

    <section className="statistics-empty-panel surface-card" aria-live="polite">
      <span className="statistics-empty-panel-icon"><StatisticIcon icon="eye" /></span>
      <div><h2>Aún no hay actividad analítica disponible</h2><p>Cuando XAMUKO registre de forma persistida las visualizaciones, apariciones y clics de tu negocio, verás aquí datos agregados para el período seleccionado.</p></div>
    </section>

    <section className="statistics-advanced-section" aria-labelledby="advanced-statistics-title">
      <div className="statistics-section-heading statistics-advanced-heading"><div><span>BUSINESS PRO</span><h2 id="advanced-statistics-title">Análisis avanzado — Business Pro</h2><p>18 indicadores para entender la visibilidad, el catálogo y la respuesta de los usuarios.</p></div><div className={`statistics-access-state ${planStatus}`}><span aria-hidden="true">{planStatus === "pro" ? "✓" : "⌾"}</span><p>{proState}</p>{planStatus !== "pro" && <button type="button" className="outline-button" onClick={() => setProBenefitsOpen(true)}>Conocer Business Pro</button>}</div></div>
      <div className="statistics-advanced-grid">{advancedStatistics.map(category => <section className="statistics-advanced-category surface-card" key={category.id} aria-labelledby={`advanced-${category.id}`}><header><span className="statistics-advanced-category-icon" aria-hidden="true">{category.icon}</span><div><h3 id={`advanced-${category.id}`}>{category.label}</h3><p>{category.description}</p></div><small>{category.indicators.length} indicadores</small></header><ul>{category.indicators.map(indicator => <li key={indicator.name}><div><strong>{indicator.name}</strong><span>{indicator.description}</span></div><em>{proState}</em></li>)}</ul></section>)}</div>
    </section>

    <section className="statistics-intelligence-section" aria-labelledby="intelligence-statistics-title">
      <div className="statistics-section-heading"><div><span>RECONOCIMIENTO</span><h2 id="intelligence-statistics-title">Inteligencia comercial XAMUKO</h2><p>Información exclusiva por nivel, independiente de Business Pro.</p></div><p className="statistics-period-copy">{referredUsers === null ? "Referidos pendientes de sincronizar" : `${referredUsers.toLocaleString("es-CO")} referidos válidos`}</p></div>
      <div className="statistics-intelligence-grid">{commercialIntelligence.map(indicator => {
        const level = recognitionLevels.find(item => item.level === indicator.level)!;
        const levelIndex = recognitionLevels.findIndex(item => item.level === indicator.level);
        const unlocked = currentLevelIndex >= levelIndex;
        const availability = referredUsers === null ? "Nivel pendiente de sincronizar" : unlocked ? "Datos pendientes de disponibilidad" : `Disponible desde ${level.name}`;
        return <article className={`statistics-intelligence-card ${unlocked ? "is-unlocked" : ""}`} key={indicator.level}><header><span>{level.name}</span><small>{level.min.toLocaleString("es-CO")} referidos</small></header><h3>{indicator.name}</h3><p>{indicator.description}</p><footer><span aria-hidden="true">{unlocked ? "✓" : "⌾"}</span>{availability}</footer></article>;
      })}</div>
    </section>
    {proBenefitsOpen && <BusinessProBenefitsDialog onClose={() => setProBenefitsOpen(false)} />}
  </div>;
}
