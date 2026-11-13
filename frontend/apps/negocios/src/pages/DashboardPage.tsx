import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { PersistedPhoto } from "../components/common/PersistedPhoto";
import { BusinessProfileThumbnail } from "../components/layout/Sidebar";
import { getPublicBusinessUrl } from "../config/publicApp";
import { businessApi, type BusinessStatisticsDashboard } from "../services/businessApiClient";
import { useBusinessStore } from "../services/businessStore";
import { shareLink } from "../../../usuario/src/utils/share";
import { formatCategoryName, visibleBusinessStatus } from "../services/realBusinessAdapter";
import type { BusinessDetails } from "../types/business";
import "./DashboardPage.css";

type Period = BusinessStatisticsDashboard["period"];
type MetricKey = keyof Pick<BusinessStatisticsDashboard["metrics"], "businessViews" | "searchAppearances" | "whatsappClicks" | "phoneClicks" | "directionsClicks">;

const metricDefinitions: Array<{ key: MetricKey; label: string; detail: string; icon: string }> = [
  { key: "businessViews", label: "Visualizaciones", detail: "Visitas a tu ficha", icon: "◉" },
  { key: "searchAppearances", label: "Apariciones en búsquedas", detail: "Veces que apareciste", icon: "⌕" },
  { key: "whatsappClicks", label: "Clics en WhatsApp", detail: "Contactos iniciados", icon: "◌" },
  { key: "phoneClicks", label: "Clics en llamar", detail: "Interés por teléfono", icon: "⌕" },
  { key: "directionsClicks", label: "Cómo llegar", detail: "Solicitudes de ruta", icon: "⌖" },
];

const periods: Array<{ value: Period; label: string }> = [
  { value: "day", label: "Hoy" }, { value: "week", label: "7 días" }, { value: "month", label: "30 días" },
  { value: "year", label: "12 meses" }, { value: "all", label: "Todo el historial" },
];

const number = (value: number) => value.toLocaleString("es-CO");
const publicProfileUrl = (business: BusinessDetails) => getPublicBusinessUrl(business.publicId);

function BusinessImage({ src, name, className, alt, isPreview = false, objectPosition }: { src?: string; name: string; className: string; alt: string; isPreview?: boolean; objectPosition?: string }) {
  const safeSrc = isPreview && src?.startsWith("/api/") ? undefined : src;
  return <span className={`${className}${safeSrc ? " has-image" : ""}`} aria-label={safeSrc ? undefined : alt}>
    {!className.includes("business-home-cover") && <span className="business-home-image-fallback" aria-hidden="true">{name.trim().charAt(0).toLocaleUpperCase("es-CO") || "X"}</span>}
    {safeSrc && <PersistedPhoto src={safeSrc} alt={alt} className="business-home-photo" style={objectPosition ? { objectPosition } : undefined} />}
  </span>;
}

function SelectedBusinessProfileImage({ business, className, isPreview = false }: { business: BusinessDetails; className: string; isPreview?: boolean }) {
  const previewBusiness = isPreview && business.profileImage?.startsWith("/api/") ? { ...business, profileImage: undefined } : business;
  return <span className={className}><BusinessProfileThumbnail business={previewBusiness} /></span>;
}

function VisitChart({ points }: { points: Array<{ label: string; value: number }> }) {
  const validPoints = points.filter(point => Number.isFinite(point.value) && point.value >= 0);
  if (!validPoints.length || validPoints.every(point => point.value === 0)) {
    return <div className="business-home-chart-empty"><span aria-hidden="true">⌁</span><strong>Aún no hay actividad para mostrar</strong><p>La evolución aparecerá cuando existan visualizaciones registradas.</p></div>;
  }
  const max = Math.max(1, ...validPoints.map(point => point.value));
  const coords = validPoints.map((point, index) => ({
    x: validPoints.length === 1 ? 50 : 20 + index * 560 / (validPoints.length - 1),
    y: 180 - point.value / max * 145,
  }));
  const line = coords.map(point => `${point.x},${point.y}`).join(" ");
  const area = `20,180 ${line} ${coords.at(-1)?.x ?? 20},180`;
  const labelIndexes = [...new Set([0, Math.floor((validPoints.length - 1) / 2), validPoints.length - 1])];
  return <div className="business-home-chart-wrap">
    <svg className="business-home-chart" viewBox="0 0 600 220" role="img" aria-label={`Visualizaciones: ${validPoints.map(point => `${point.label}, ${number(point.value)}`).join("; ")}`}>
      <defs><linearGradient id="business-home-chart-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7b3ffb" stopOpacity=".2"/><stop offset="100%" stopColor="#7b3ffb" stopOpacity="0"/></linearGradient></defs>
      {[35, 83, 131, 180].map(y => <line key={y} x1="20" y1={y} x2="580" y2={y} className="business-home-chart-gridline" />)}
      <polygon points={area} fill="url(#business-home-chart-fill)" />
      <polyline points={line} className="business-home-chart-line" />
      {coords.map((point, index) => <circle key={`${validPoints[index].label}-${index}`} cx={point.x} cy={point.y} r="3.5" className="business-home-chart-dot"><title>{validPoints[index].label}: {number(validPoints[index].value)}</title></circle>)}
    </svg>
    <div className="business-home-chart-labels">{labelIndexes.map(index => <span key={`${validPoints[index].label}-${index}`}>{validPoints[index].label}</span>)}</div>
  </div>;
}

function QuickAction({ to, title, description, icon, disabled = false }: { to?: string; title: string; description: string; icon: string; disabled?: boolean }) {
  const content = <><span className="business-home-action-icon" aria-hidden="true">{icon}</span><span className="business-home-action-copy"><strong>{title}</strong><small>{description}</small></span><span className="business-home-action-arrow" aria-hidden="true">↗</span></>;
  return to && !disabled ? <Link className="business-home-action" to={to}>{content}</Link> : <div className="business-home-action unavailable" aria-disabled="true" title={description}>{content}</div>;
}

export function DashboardPage() {
  const { business, businesses } = useBusinessStore();
  const location = useLocation();
  const isPreview = location.pathname === "/preview" || location.pathname.startsWith("/preview/");
  const [period, setPeriod] = useState<Period>("month");
  const [data, setData] = useState<BusinessStatisticsDashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [shareStatus, setShareStatus] = useState("");
  const [proUnlocked, setProUnlocked] = useState<boolean | null>(null);
  const [reviewSummary, setReviewSummary] = useState<{ average: number | null; total: number } | null>(null);
  const realBusiness = business.source === "real" && Boolean(business.id);
  const canReadAnalytics = !isPreview && realBusiness && (business.role === "Propietario" || business.permissions?.includes("READ_ANALYTICS"));
  const businessIndex = Math.max(0, businesses.findIndex(item => item.id === business.id || item.name === business.name));
  const profileUrl = publicProfileUrl(business);
  const verified = visibleBusinessStatus(business) === "Verificado";
  const businessStatus = business.isOpen === true ? "Abierto ahora" : business.isOpen === false ? "Cerrado" : visibleBusinessStatus(business);
  const periodLabel = periods.find(item => item.value === period)?.label.toLocaleLowerCase("es-CO") ?? "período seleccionado";

  useEffect(() => {
    setData(null);
    setError(false);
    setLoading(Boolean(canReadAnalytics));
    if (!business.id || !canReadAnalytics) return;
    const controller = new AbortController();
    void businessApi.getStatisticsDashboard(business.id, period, controller.signal)
      .then(result => { if (!controller.signal.aborted) setData(result); })
      .catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [business.id, canReadAnalytics, period, retry]);

  useEffect(() => {
    let active = true;
    setProUnlocked(null);
    if (isPreview || !realBusiness || !business.id) return () => { active = false; };
    void businessApi.getCatalogLimits(business.id).then(result => { if (active) setProUnlocked(result.plan === "PRO"); }).catch(() => { if (active) setProUnlocked(null); });
    return () => { active = false; };
  }, [business.id, isPreview, realBusiness]);

  useEffect(() => {
    let active = true;
    setReviewSummary(null);
    if (isPreview || !realBusiness || !business.publicId) return () => { active = false; };
    void businessApi.listReviews(business.publicId, 1, 1).then(result => {
      if (active) setReviewSummary({ average: result.summary.average, total: result.summary.total });
    }).catch(() => { if (active) setReviewSummary(null); });
    return () => { active = false; };
  }, [business.publicId, isPreview, realBusiness]);

  const currentDate = useMemo(() => new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long" }).format(new Date()), []);
  const availableActions = {
    edit: business.role === "Propietario" || Boolean(business.permissions?.includes("EDIT_BUSINESS")),
    catalog: business.role === "Propietario" || Boolean(business.permissions?.includes("MANAGE_CATALOG")),
    promotions: business.role === "Propietario" || Boolean(business.permissions?.includes("MANAGE_PROMOTIONS")),
  };

  const shareBusiness = async () => {
    if (!profileUrl) return;
    const result = await shareLink(business.name, `Conoce ${business.name} en XAMUKO.`, profileUrl);
    setShareStatus(result === "shared" ? "Enlace compartido." : result === "copied" ? "Enlace copiado." : "No fue posible compartir el enlace desde este dispositivo.");
  };

  const rating = business.rating;
  const currentRating = reviewSummary?.average ?? rating;
  const reviewCount = reviewSummary?.total ?? business.reviewCount;
  const address = [business.address, business.additionalAddressInfo, business.city, business.regionName].filter(Boolean).join(", ");
  const categoryLabel = formatCategoryName(business.category.replace(/[-_]+/g, " "));
  const showEmptyAccount = !business.name;

  return <div className="business-home">
    <div className="business-home-heading">
      <div><span className="business-home-eyebrow">CENTRO DE CONTROL</span><h1>Inicio</h1><p>{currentDate.charAt(0).toLocaleUpperCase("es-CO") + currentDate.slice(1)} · Un resumen de tu negocio en XAMUKO.</p></div>
      {business.name && <div className="business-home-selected"><span>NEGOCIO SELECCIONADO</span><strong>{business.name}</strong><small>{business.role}</small></div>}
    </div>

    {showEmptyAccount ? <section className="business-home-no-business"><span aria-hidden="true">⌂</span><h2>Selecciona o crea tu negocio</h2><p>Cuando elijas un establecimiento, aquí encontrarás su actividad y accesos de gestión.</p><Link className="business-home-primary" to="/mis-negocios">Ir a mis negocios <span aria-hidden="true">→</span></Link></section> : <>
      <section className="business-home-hero" aria-label={`Perfil de ${business.name}`}>
        <BusinessImage src={business.coverImage} name={business.name} className="business-home-cover" alt={`Portada de ${business.name}`} isPreview={isPreview} objectPosition={business.coverImagePosition ? `${business.coverImagePosition.x}% ${business.coverImagePosition.y}%` : undefined} />
        <div className="business-home-hero-shade" />
        <div className="business-home-hero-content">
          <SelectedBusinessProfileImage business={business} className="business-home-profile" isPreview={isPreview} />
          <div className="business-home-business-copy"><div className="business-home-name-line"><h2>{business.name}</h2>{verified && <span className="business-home-verified" title="Negocio verificado" aria-label="Negocio verificado">✓</span>}</div><p>{[categoryLabel, business.city].filter(Boolean).join(" · ")}</p>{business.description && <p className="business-home-description">{business.description}</p>}{businessStatus && <span className={`business-home-status${business.isOpen === false ? " closed" : ""}`}>{business.isOpen === true && <i />}{businessStatus}</span>}</div>
          <div className="business-home-hero-actions">
            {profileUrl ? <a className="business-home-button glass" href={profileUrl} target="_blank" rel="noreferrer"><span aria-hidden="true">↗</span>Ver en XAMUKO</a> : <span className="business-home-button glass disabled" aria-disabled="true" title="Este negocio aún no tiene un perfil público">Perfil público no disponible</span>}
            <button className="business-home-button glass" type="button" onClick={() => void shareBusiness()} disabled={!profileUrl}><span aria-hidden="true">↗</span>Compartir</button>
            {availableActions.edit && <Link className="business-home-button glass" to={`/mis-negocios/editar/${businessIndex}`}><span aria-hidden="true">✎</span>Editar negocio</Link>}
          </div>
        </div>
      </section>
      {shareStatus && <p className="business-home-share-status" role="status">{shareStatus}</p>}

      <section className="business-home-section" aria-labelledby="business-home-metrics-title">
        <div className="business-home-section-heading"><div><span className="business-home-eyebrow">RESUMEN DE ACTIVIDAD</span><h2 id="business-home-metrics-title">Rendimiento de tu negocio</h2></div><div className="business-home-period"><label htmlFor="business-home-period">Período</label><select id="business-home-period" value={period} onChange={event => setPeriod(event.target.value as Period)}>{periods.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div></div>
        {error && <div className="business-home-alert" role="alert">No pudimos cargar las estadísticas de {business.name}. <button type="button" onClick={() => setRetry(value => value + 1)}>Reintentar</button></div>}
        {!error && !canReadAnalytics && <p className="business-home-muted-note">{isPreview ? "La vista previa no usa métricas simuladas." : realBusiness ? "Tu cuenta no tiene acceso a las estadísticas de este negocio." : "Las estadísticas aparecerán cuando el negocio esté conectado."}</p>}
        <div className="business-home-metrics">
          {metricDefinitions.map((metric, index) => {
            const current = data?.metrics[metric.key];
            const previous = data?.previous?.[metric.key];
            const change = current !== undefined && previous !== undefined && previous > 0 ? Math.round((current - previous) / previous * 100) : null;
            return <article className={`business-home-metric metric-${index + 1}`} key={metric.key} aria-busy={loading}>
              <span className="business-home-metric-icon" aria-hidden="true">{metric.icon}</span><div className="business-home-metric-copy"><span>{metric.label}</span><strong>{loading ? "…" : current === undefined ? "—" : number(current)}</strong><small>{loading ? "Cargando" : metric.detail}</small></div>
              {change !== null && <span className={`business-home-change${change < 0 ? " negative" : ""}`}>{change > 0 ? "+" : ""}{change}%</span>}
            </article>;
          })}
        </div>
      </section>

      <div className="business-home-main-grid">
        <section className="business-home-panel business-home-performance" aria-labelledby="business-home-performance-title">
          <div className="business-home-panel-heading"><div><span className="business-home-eyebrow">VISIBILIDAD</span><h2 id="business-home-performance-title">Evolución de visualizaciones</h2><p>Actividad de {business.name} · {periodLabel}</p></div><span className="business-home-chart-icon" aria-hidden="true">↗</span></div>
          {loading ? <div className="business-home-chart-loading" aria-live="polite">Cargando actividad…</div> : data ? <VisitChart points={data.trends.businessViews} /> : <div className="business-home-chart-empty"><span aria-hidden="true">⌁</span><strong>{error ? "Gráfica no disponible" : "Sin datos para graficar"}</strong><p>{error ? "Intenta cargar las estadísticas nuevamente." : "La gráfica mostrará únicamente visualizaciones registradas por la API."}</p></div>}
        </section>

        <section className="business-home-panel business-home-details" aria-labelledby="business-home-details-title">
          <div className="business-home-panel-heading"><div><span className="business-home-eyebrow">TU ESTABLECIMIENTO</span><h2 id="business-home-details-title">Información del negocio</h2></div><SelectedBusinessProfileImage business={business} className="business-home-details-avatar" isPreview={isPreview} /></div>
          {((currentRating != null) || (reviewCount ?? 0) > 0) && <div className="business-home-rating"><span aria-hidden="true">★</span><strong>{currentRating == null ? "—" : currentRating.toFixed(1)}</strong><small>{reviewCount === undefined ? "Calificación disponible" : `${number(reviewCount)} ${reviewCount === 1 ? "opinión" : "opiniones"}`}</small></div>}
          <dl className="business-home-info-list">
            {address && <div><dt><span aria-hidden="true">⌖</span>Ubicación</dt><dd>{address}</dd></div>}
            {business.isOpen !== undefined && <div><dt><span aria-hidden="true">◷</span>Estado</dt><dd className={business.isOpen ? "open" : "closed"}>{business.isOpen ? "Abierto ahora" : "Cerrado"}</dd></div>}
            {business.hours && <div><dt><span aria-hidden="true">◷</span>Horario</dt><dd>{business.hours}</dd></div>}
            {business.phone && <div><dt><span aria-hidden="true">⌕</span>Teléfono</dt><dd><a href={`tel:${business.phone.replace(/[^+\d]/g, "")}`}>{business.phone}</a></dd></div>}
            {business.website && <div><dt><span aria-hidden="true">↗</span>Sitio web</dt><dd><a href={/^https?:\/\//i.test(business.website) ? business.website : `https://${business.website}`} target="_blank" rel="noreferrer">{business.website}</a></dd></div>}
            {!address && !business.hours && !business.phone && !business.website && currentRating == null && !(reviewCount ?? 0) && <li className="business-home-info-empty">Todavía no hay información adicional registrada.</li>}
          </dl>
          {profileUrl && <a className="business-home-profile-link" href={profileUrl} target="_blank" rel="noreferrer">Ver perfil público <span aria-hidden="true">↗</span></a>}
        </section>
      </div>

      <section className="business-home-panel business-home-actions-section" aria-labelledby="business-home-actions-title">
        <div className="business-home-panel-heading"><div><span className="business-home-eyebrow">GESTIÓN DIARIA</span><h2 id="business-home-actions-title">Acciones rápidas</h2></div></div>
        <div className="business-home-actions-grid">
          <QuickAction title="Nueva promoción" description="Abre ofertas y promociones" icon="％" to={availableActions.promotions ? "/ofertas" : undefined} disabled={!availableActions.promotions} />
          <QuickAction title="Actualizar galería" description="Gestiona las fotos del negocio desde su edición" icon="▧" to={availableActions.edit ? `/mis-negocios/editar/${businessIndex}` : undefined} disabled={!availableActions.edit} />
          <QuickAction title="Productos y servicios" description="Gestiona tu catálogo" icon="◇" to={availableActions.catalog ? "/productos" : undefined} disabled={!availableActions.catalog} />
          <QuickAction title="Editar información" description="Actualiza los datos del negocio" icon="✎" to={availableActions.edit ? `/mis-negocios/editar/${businessIndex}` : undefined} disabled={!availableActions.edit} />
        </div>
        {(business.role !== "Propietario" && (!availableActions.catalog || !availableActions.edit || !availableActions.promotions)) && <p className="business-home-muted-note">Algunas acciones requieren permisos del propietario del negocio.</p>}
      </section>

      <section className="business-home-pro" aria-labelledby="business-home-pro-title">
        <div className="business-home-pro-mark" aria-hidden="true">♛</div><div className="business-home-pro-copy"><span className="business-home-eyebrow">MÁS HERRAMIENTAS PARA CRECER</span><h2 id="business-home-pro-title">Business PRO</h2><p>5 estadísticas gratuitas · 20 estadísticas PRO · 5 desbloqueables por nivel.</p></div><div className="business-home-pro-status"><span>{proUnlocked === true ? "Plan activo" : proUnlocked === false ? "Plan Básico" : "Plan sin verificar"}</span><small>{proUnlocked === true ? "Acceso Business PRO vigente" : "La contratación del plan no está disponible en esta versión."}</small></div><Link to="/estadisticas" className="business-home-pro-link">Ver estadísticas <span aria-hidden="true">→</span></Link>
      </section>
    </>}
  </div>;
}
