import { useId, type ReactNode } from "react";
import type { AdvancedStatisticsCategory, AdvancedStatisticsIndicator } from "../../config/businessStatistics";
import type { AnalyticsOfferRanking, BusinessAnalyticsSummary } from "../../services/businessApiClient";
import "./StatisticsIndicatorCard.css";

export const connectedStatisticsIds = new Set([
  "visitEvolution", "mostLikedOffers", "leastLikedOffers", "hourlyActivity", "weekdayActivity",
  "promotionViews", "mostViewedPromotions", "ratingEvolution", "favoriteAcquisitions",
]);

const number = (value: number) => value.toLocaleString("es-CO", { maximumFractionDigits: 2 });
const dateLabel = (value: string) => new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value.slice(0, 10)}T12:00:00Z`));
const weekdays = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
type Point = { label: string; value: number | null; count?: number; date?: string };

/** Every bar represents a returned bucket. Dates are positioned by calendar distance, including sparse all-time series. */
function Distribution({ points, title, unit, rating = false }: { points: Point[]; title: string; unit: string; rating?: boolean }) {
  const titleId = useId();
  if (points.length === 0) return null;
  const ceiling = rating ? 5 : Math.max(1, ...points.map(point => point.value ?? 0));
  const firstDate = points[0]?.date ? Date.parse(points[0].date) : null;
  const lastDate = points.at(-1)?.date ? Date.parse(points.at(-1)!.date!) : null;
  const days = firstDate !== null && lastDate !== null ? Math.round((lastDate - firstDate) / 86_400_000) + 1 : points.length;
  const x = (point: Point, index: number) => 10 + 280 * ((firstDate !== null && point.date ? (Date.parse(point.date) - firstDate) / 86_400_000 : index) + .5) / Math.max(1, days);
  const barWidth = Math.max(.3, Math.min(18, 220 / Math.max(1, days)));
  return <figure className="statistics-distribution">
    <svg viewBox="0 0 300 125" role="img" aria-labelledby={titleId}>
      <title id={titleId}>{title}. {rating ? "Cada punto muestra el promedio de las reseñas creadas en esa fecha" : `Cada barra muestra ${unit}`}. Valores exactos en la tabla desplegable.</title>
      <line x1="10" x2="290" y1="104" y2="104" className="statistics-distribution-axis" />
      {points.map((point, index) => point.value === null ? null : rating ? <circle key={point.label} cx={x(point, index)} cy={104 - point.value / ceiling * 90} r="3.5"><title>{point.label}: {number(point.value)} / 5 · {number(point.count ?? 0)} reseñas</title></circle> : <rect key={point.label} x={x(point, index) - barWidth / 2} y={104 - point.value / ceiling * 90} width={barWidth} height={point.value / ceiling * 90} rx="1"><title>{point.label}: {number(point.value)} {unit}</title></rect>)}
      <text x="10" y="119">{rating ? "0–5 estrellas" : `Máx. ${number(ceiling)}`}</text>
    </svg>
    <figcaption><span>{points[0].label}</span><span>{points.at(-1)!.label}</span></figcaption>
    <details className="statistics-data-details"><summary>Ver valores ({points.length})</summary><div className="statistics-data-table-wrap"><table><caption>{title}</caption><thead><tr><th scope="col">{points[0].date ? "Fecha" : "Franja"}</th><th scope="col">{rating ? "Promedio / 5" : unit}</th>{rating && <th scope="col">Reseñas</th>}</tr></thead><tbody>{points.map(point => <tr key={point.label}><th scope="row">{point.label}</th><td>{point.value === null ? "Sin reseñas" : number(point.value)}</td>{rating && <td>{number(point.count ?? 0)}</td>}</tr>)}</tbody></table></div></details>
  </figure>;
}

function OfferIdentity({ offer }: { offer: AnalyticsOfferRanking }) {
  return <div className="statistics-pro-product-identification"><span>{offer.kind === "PRODUCT" ? "Producto" : offer.kind === "SERVICE" ? "Servicio" : "Publicación"}</span><strong>{offer.code ?? "Código no disponible"}</strong><b>{offer.name}</b></div>;
}

function OfferRanking({ offers }: { offers: AnalyticsOfferRanking[] }) {
  return <ol className="statistics-data-ranking">{offers.map(offer => <li key={offer.offerId}><span><b>{offer.code ? `${offer.code} · ` : ""}{offer.name}</b><small>{offer.kind === "PRODUCT" ? "Producto" : offer.kind === "SERVICE" ? "Servicio" : "Publicación"}</small></span><em>{number(offer.value)} Me gusta</em></li>)}</ol>;
}

export function StatisticsIndicatorCard({ indicator, category, analytics, loading, error }: {
  indicator: AdvancedStatisticsIndicator;
  category: AdvancedStatisticsCategory["id"];
  analytics: BusinessAnalyticsSummary | null;
  loading: boolean;
  error: boolean;
}) {
  const isConnected = connectedStatisticsIds.has(indicator.id);
  const isTopLikes = indicator.id === "mostLikedOffers";
  const icon = isTopLikes ? "♥" : category === "visibility" ? "◉" : category === "catalog" ? "◇" : category === "behavior" ? "↗" : "✦";
  let value: string | null = null;
  let unit: string | null = null;
  let body: ReactNode = null;
  let explanation: string | undefined;
  let note = "Fuente aún no disponible";
  let missing = false;
  let empty = false;
  if (isConnected) {
    note = error ? "Error al cargar" : loading ? "Cargando…" : "Fuente no disponible";
    if (analytics) {
      note = "Datos del período seleccionado";
      const series = analytics.series;
      const rankings = analytics.rankings;
      const metrics = analytics.metrics;
      const timezone = `${analytics.timezone} (UTC−5)`;
      if (indicator.id === "visitEvolution") {
        const rows = series?.visits;
        missing = !rows;
        if (rows) {
          const total = rows.reduce((sum, row) => sum + row.value, 0);
          value = number(total); unit = "visitas"; empty = total === 0;
          body = <Distribution points={rows.map(row => ({ ...row, label: dateLabel(row.date) }))} title={indicator.name} unit="visitas" />;
        }
        note = `Fechas en ${timezone}. Son visitas, no visitantes únicos.`;
        explanation = analytics.definitions?.visits;
      } else if (indicator.id === "hourlyActivity" || indicator.id === "weekdayActivity") {
        const points: Point[] | undefined = indicator.id === "hourlyActivity"
          ? series?.hourlyActivity?.map(row => ({ label: `${String(row.hour).padStart(2, "0")}:00`, value: row.value }))
          : series?.weekdayActivity?.map(row => ({ label: weekdays[row.weekday], value: row.value }));
        missing = !points;
        if (points) {
          const total = points.reduce((sum, point) => sum + (point.value ?? 0), 0);
          value = number(total); unit = "visitas"; empty = total === 0;
          body = <Distribution points={points} title={indicator.name} unit="visitas" />;
        }
        note = `Actividad = aperturas de la ficha. ${timezone}.`;
        explanation = analytics.definitions?.activity;
      } else if (indicator.id === "ratingEvolution") {
        const rows = series?.ratings;
        missing = !rows || metrics.reviewsCount === undefined || metrics.averageRating === undefined;
        if (!missing && rows) {
          value = metrics.averageRating === null ? null : number(metrics.averageRating); unit = value === null ? null : "/ 5"; empty = metrics.reviewsCount === 0;
          body = <><p className="statistics-data-caption">{number(metrics.reviewsCount)} reseñas publicadas creadas en el período</p><Distribution points={rows.map(row => ({ label: dateLabel(row.date), date: row.date, value: row.average, count: row.count }))} title={indicator.name} unit="promedio" rating /></>;
        }
        note = `Calificaciones actuales agrupadas por fecha de creación (${timezone}); no reconstruye ediciones anteriores.`;
        explanation = analytics.definitions?.ratings;
      } else if (indicator.id === "favoriteAcquisitions") {
        const rows = series?.favoriteAcquisitions;
        missing = !rows;
        if (rows) {
          const total = rows.reduce((sum, row) => sum + row.value, 0);
          value = number(total); unit = "altas vigentes"; empty = total === 0;
          body = <Distribution points={rows.map(row => ({ ...row, label: dateLabel(row.date) }))} title={indicator.name} unit="favoritos vigentes" />;
        }
        note = `Solo favoritos que siguen guardados, por fecha de alta (${timezone}). Las bajas se eliminan: no es un historial completo ni un saldo histórico.`;
        explanation = analytics.definitions?.favorites;
      } else if (indicator.id === "promotionViews") {
        missing = metrics.promotionViews === undefined;
        if (!missing) { value = number(metrics.promotionViews); unit = "vistas"; empty = metrics.promotionViews === 0; }
        explanation = analytics.definitions?.promotionViews;
      } else if (indicator.id === "mostViewedPromotions") {
        const rows = rankings?.mostViewedPromotions;
        missing = !rows;
        if (rows) {
          empty = rows.length === 0;
          value = rows[0] ? number(rows[0].value) : null; unit = rows[0] ? "vistas de la primera" : null;
          body = <ol className="statistics-data-ranking">{rows.map(row => <li key={row.promotionId}><span><b>{row.title}</b></span><em>{number(row.value)} vistas</em></li>)}</ol>;
        }
        note = "Vistas registradas en el período; incluye promociones finalizadas. No mide clics ni conversiones.";
        explanation = analytics.definitions?.promotionViews;
      } else if (isTopLikes) {
        const rows = rankings?.offerLikes;
        missing = !rows;
        if (rows) {
          empty = rows.length === 0;
          value = rows[0] ? number(rows[0].value) : null;
          body = rows[0] ? <><OfferIdentity offer={rows[0]} />{rows.length > 1 && <details className="statistics-data-details"><summary>Ver ranking ({rows.length})</summary><OfferRanking offers={rows} /></details>}</> : null;
        }
        note = "Me gusta que siguen vigentes y fueron creados en el período; no incluye los retirados.";
        explanation = analytics.definitions?.offerLikes;
      } else if (indicator.id === "leastLikedOffers") {
        const rows = rankings?.leastLikedOffers;
        missing = !rows;
        if (rows) {
          empty = rows.length === 0;
          value = rows[0] ? number(rows[0].value) : null; unit = rows[0] ? "Me gusta de la primera" : null;
          body = <ol className="statistics-data-ranking">{rows.map(row => <li key={row.offerId}><span><b>{row.code ? `${row.code} · ` : ""}{row.name}</b><small>{row.kind === "PRODUCT" ? "Producto" : "Servicio"} · Creado {new Intl.DateTimeFormat("es-CO", { timeZone: analytics.timezone }).format(new Date(row.createdAt))}</small><small>{number(row.observedDays)} días observados desde {new Intl.DateTimeFormat("es-CO", { timeZone: analytics.timezone }).format(new Date(row.eligibleSince))}</small></span><em>{number(row.value)} Me gusta</em></li>)}</ol>;
        }
        note = "Me gusta vigentes del período. La fecha es de creación: no se conoce el tiempo publicado ni se comparan tasas. Las publicaciones recientes tuvieron menos exposición.";
        explanation = analytics.definitions?.leastLikedOffers;
      }
      if (missing) { value = null; unit = null; body = null; note = "Fuente no disponible en esta respuesta"; }
    }
  }
  const state = !isConnected ? "pending" : error ? "error" : loading ? "loading" : missing || !analytics ? "unavailable" : empty ? "empty" : "available";
  const emptyMessage = indicator.id === "leastLikedOffers" ? "Sin publicaciones elegibles para este período" : indicator.id === "ratingEvolution" ? "Sin reseñas publicadas creadas en este período" : isTopLikes ? "Sin Me gusta vigentes creados en este período" : indicator.id === "favoriteAcquisitions" ? "Sin altas vigentes en este período" : "Sin actividad registrada en este período";
  return <article className={`statistics-pro-metric ${isConnected ? "is-connected" : "is-pending"} ${isTopLikes ? "is-like-ranking" : ""} statistics-data-card`} data-state={state} aria-busy={state === "loading"}>
    <span className="statistics-pro-metric-icon" aria-hidden="true">{icon}</span>
    <h4>{indicator.name}</h4>
    <strong>{value ?? "—"}{value !== null && unit ? <small> {unit}</small> : null}</strong>
    {body && <div className="statistics-data-body">{body}</div>}
    {!isTopLikes && <p>{indicator.description}</p>}
    <footer>{state === "empty" && <span className="statistics-data-empty">{emptyMessage}. </span>}{note}{explanation && !missing && <details className="statistics-data-details"><summary>Cómo se calcula</summary><p>{explanation}</p></details>}{!isConnected && indicator.pendingReason && <details className="statistics-data-details"><summary>Qué falta</summary><p>{indicator.pendingReason}</p></details>}</footer>
  </article>;
}
