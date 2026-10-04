import { Link } from "react-router-dom";
import { InterestList } from "../components/dashboard/InterestList";
import { MetricCard } from "../components/dashboard/MetricCard";
import { metrics } from "../data/dashboard.mock";
import { businessCatalog } from "../data/business.mock";
import { useBusinessStore } from "../services/businessStore";

export function DashboardPage() {
  const { account, business, items, businesses } = useBusinessStore();
  const firstName = account.name.split(" ")[0];
  const personalBusiness = businesses.length === 0 || business.isNew || !businessCatalog[business.name];
  const businessItems = personalBusiness ? (business.catalog ?? []) : items;
  const products = businessItems.filter(item => item.kind === "product" && item.active).sort((a,b) => b.interest-a.interest).slice(0,3);
  const services = businessItems.filter(item => item.kind === "service" && item.active).sort((a,b) => b.interest-a.interest).slice(0,3);
  const dashboardMetrics = personalBusiness ? metrics.map(metric => ({ ...metric, value: "0", trend: "0%" })) : metrics;
  const rating = personalBusiness ? 0 : (business.rating ?? 0);
  const reviewCount = personalBusiness ? 0 : (business.reviewCount ?? 0);
  const statusLabel = business.status === "Pendiente" ? "Verificación pendiente" : business.status;
  const businessIndex = Math.max(0, businesses.findIndex(item => item.name === business.name));
  const completionChecks: [string, string | number | undefined][] = [["Nombre comercial", business.name], ["Categoría", business.category], ["Descripción", business.description], ["Ciudad", business.city], ["Dirección", business.address], ["Teléfono", business.phone], ["Horario de atención", business.hours], ["Fotos de tu negocio", business.coverImage || business.images?.length]];
  const missingFields = completionChecks.filter(([, value]) => !value).map(([label]) => label);
  const profileCompletion = businesses.length === 0 ? 0 : Math.round((completionChecks.length - missingFields.length) / completionChecks.length * 100);
  const today = new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long" }).format(new Date()).toUpperCase();
  return <>
    <section className="dashboard-heading"><div><p className="welcome">{today}</p><h1>Buenos días, {firstName} <span aria-hidden="true">👋</span></h1><p>Aquí tienes un resumen de cómo va <strong>{business.name}</strong>.</p></div><div className={`business-status ${business.status === "Verificado" ? "" : "pending"}`}><span className="verified-icon">{business.status === "Verificado" ? "✓" : "!"}</span><div><strong>{statusLabel}</strong><small>Estado de tu negocio en WIT</small></div></div></section>
    <section className="quick-actions" aria-label="Accesos rápidos"><Link className="primary-action" to={`/mis-negocios/editar/${businessIndex}`}><span>✎</span>Editar negocio</Link><Link to="/productos?nuevo=1"><span>＋</span>Agregar producto</Link><Link to="/servicios?nuevo=1"><span>＋</span>Agregar servicio</Link><Link to="/opiniones"><span>☆</span>Ver opiniones</Link></section>
    <section><div className="section-title-row"><div><h2>Tu actividad reciente</h2><p>Últimos 30 días</p></div><Link className="period-selector" to="/estadisticas">Ver estadísticas →</Link></div><div className="metrics-grid">{dashboardMetrics.map(metric => <MetricCard key={metric.label} metric={metric} />)}</div></section>
    <section className="completion-card"><div className="completion-copy"><span className="section-kicker">PERFIL DEL NEGOCIO</span><h2>{profileCompletion === 100 ? "Tu información está completa" : "Haz que tu negocio destaque más"}</h2><p>{profileCompletion === 100 ? "Tu tienda ya tiene todos los datos necesarios para comenzar." : `Completa algunos datos para que las personas encuentren mejor ${business.name}.`}</p><Link className="text-button" to="/mi-negocio">{profileCompletion === 100 ? "Revisar perfil →" : "Completar perfil →"}</Link></div><div className="completion-progress" role="img" aria-label={`Perfil completado al ${profileCompletion} por ciento`}><svg viewBox="0 0 120 120"><circle className="progress-track" cx="60" cy="60" r="49"/><circle className="progress-value" cx="60" cy="60" r="49" pathLength="100" strokeDasharray={`${profileCompletion} 100`}/></svg><div><strong>{profileCompletion}%</strong><span>completo</span></div></div><div className="completion-tasks"><strong>{profileCompletion === 100 ? "Todo listo" : "Aún puedes agregar"}</strong><ul>{profileCompletion === 100 ? <li>Datos obligatorios completos</li> : missingFields.map(field => <li key={field}>{field}</li>)}</ul></div></section>
    <section className="bottom-grid"><InterestList title="Productos con más interés" description="Lo que más miran las personas" items={products} to="/productos" /><InterestList title="Servicios más consultados" description="Interés de los últimos 30 días" items={services} to="/servicios" /><section className="rating-card"><div className="section-title-row"><div><h2>Tu reputación</h2><p>Opiniones de tu negocio</p></div><Link className="subtle-button" to="/opiniones">Ver opiniones</Link></div><div className="rating-summary"><strong>{rating.toFixed(1)}</strong><div><span className="stars">{rating ? "★★★★★" : "☆☆☆☆☆"}</span><p>Basado en {reviewCount} calificaciones</p></div></div><div className="rating-bars">{[[5,72],[4,19],[3,6],[2,2],[1,1]].map(([star,value]) => <div key={star}><span>{star} ★</span><i><b style={{width:`${personalBusiness ? 0 : value}%`}} /></i><small>{personalBusiness ? 0 : value}%</small></div>)}</div></section></section>
  </>;
}
