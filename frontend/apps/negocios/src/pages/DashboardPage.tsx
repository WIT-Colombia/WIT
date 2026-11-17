import { useEffect, useMemo, useRef, useState, type PointerEvent as ChartPointerEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import { PersistedPhoto } from "../components/common/PersistedPhoto";
import { BusinessProfileThumbnail } from "../components/layout/Sidebar";
import { getPublicBusinessUrl, getPublicBusinessPreviewUrl } from "../config/publicApp";
import { businessApi, type BusinessStatisticsDashboard, type BusinessVisibility } from "../services/businessApiClient";
import { homeVisibilityState } from "../services/homeVisibilityState";
import { useBusinessStore } from "../services/businessStore";
import { shareLink } from "../../../usuario/src/utils/share";
import { formatCategoryName, visibleBusinessStatus } from "../services/realBusinessAdapter";
import type { BusinessDetails } from "../types/business";
import { BUSINESS_VISIBILITY_DAYS } from "../services/visibilityPolicy";
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
  { value: "day", label: "Hoy" }, { value: "week", label: "Esta semana" }, { value: "month", label: "Este mes" },
  { value: "year", label: "Este año" }, { value: "all", label: "Todo el historial" },
];

const number = (value: number) => value.toLocaleString("es-CO");

// El vencimiento se muestra en fecha de Colombia. Contar fechas de calendario
// en esa misma zona evita "41 días" justo después de renovar por fracciones
// de hora, diferencias entre relojes o el huso horario del dispositivo.
const visibilityDateParts = new Intl.DateTimeFormat("en-GB", {
  timeZone: "America/Bogota",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
function colombiaCalendarDay(timestamp: number): number {
  const parts = visibilityDateParts.formatToParts(new Date(timestamp));
  const value = (part: "year" | "month" | "day") => Number(parts.find(item => item.type === part)?.value);
  return Math.floor(Date.UTC(value("year"), value("month") - 1, value("day")) / 86_400_000);
}
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

/**
 * Fecha exacta según el intervalo seleccionado. La zona horaria del dato
 * ya es Bogotá: no reinterpretar etiquetas de fecha como hora del dispositivo.
 */
function businessChartDate(label: string, period: Period): string {
  if (period === "day") return label.match(/\d{2}:\d{2}$/)?.[0] ?? label;
  if (period === "week" || period === "month") {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(label);
    if (!match) return label;
    return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", timeZone: "UTC" })
      .format(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12)));
  }
  const match = /^(\d{4})-(\d{2})$/.exec(label);
  if (!match) return label;
  return new Intl.DateTimeFormat("es-CO", { month: "short", year: "2-digit", timeZone: "UTC" })
    .format(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 12)));
}

function VisitChart({ points, period }: { points: Array<{ label: string; value: number }>; period: Period }) {
  const visual = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(660);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  useEffect(() => {
    const node = visual.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(entries => {
      const next = Math.max(300, Math.round(entries[0]?.contentRect.width ?? 660));
      setWidth(previous => previous === next ? previous : next);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => setHoveredIndex(null), [period, points]);
  // A zero is a valid measurement; only absent/invalid data is unavailable.
  const validPoints = points.filter(point => Number.isFinite(point.value) && point.value >= 0);
  if (!validPoints.length) {
    return <div className="business-home-chart-empty"><span aria-hidden="true">⌁</span>
      <strong>Sin serie temporal disponible</strong>
      <p>No se recibió un desglose horario, diario o mensual para el período consultado.</p></div>;
  }
  const chartWidth = width, chartHeight = 254;
  const left = 47, right = chartWidth - 16, top = 22, bottom = 208;
  const max = Math.max(...validPoints.map(point => point.value), 1);
  const rawStep = max / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const fraction = rawStep / magnitude;
  const niceStep = (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10) * magnitude;
  const axisMax = Math.ceil(max / niceStep) * niceStep;
  const tickCount = Math.round(axisMax / niceStep);
  const xx = (index: number) => left + (validPoints.length === 1 ? (right - left) / 2 : index * (right - left) / (validPoints.length - 1));
  const yy = (value: number) => bottom - (value / axisMax) * (bottom - top);
  const coords = validPoints.map((point, index) => ({ x: xx(index), y: yy(point.value) }));
  const line = coords.map(point => point.x + "," + point.y).join(" ");
  const area = coords.length > 1 ? left + "," + bottom + " " + line + " " + right + "," + bottom : "";
  const selectedIndex = hoveredIndex !== null && hoveredIndex < validPoints.length ? hoveredIndex : null;
  const selected = selectedIndex === null ? null : validPoints[selectedIndex];
  const selectedPoint = selectedIndex === null ? null : coords[selectedIndex];
  const labelEvery = Math.max(1, Math.ceil(validPoints.length / Math.max(2, Math.floor((right - left) / 86))));
  const selectNearest = (event: ChartPointerEvent<SVGSVGElement>) => {
    const svg = event.currentTarget;
    const matrix = svg.getScreenCTM();
    if (!matrix) return;
    const pointer = svg.createSVGPoint();
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    const horizontal = pointer.matrixTransform(matrix.inverse()).x;
    const ratio = Math.max(0, Math.min(1, (horizontal - left) / (right - left)));
    setHoveredIndex(Math.round(ratio * (validPoints.length - 1)));
  };

  return <div className="business-home-chart-wrap">
    <div className="business-home-chart-visual" ref={visual}>
      <svg className="business-home-chart" viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        role="group" aria-label={"Evolución de visualizaciones. " + validPoints.map(point => point.label + ": " + number(point.value)).join("; ")}
        onPointerMove={selectNearest} onPointerDown={selectNearest} onPointerLeave={() => setHoveredIndex(null)}>
        <defs><linearGradient id="business-home-chart-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7b3ffb" stopOpacity=".19"/><stop offset="100%" stopColor="#7b3ffb" stopOpacity="0"/>
        </linearGradient></defs>
        {Array.from({ length: tickCount + 1 }, (_, index) => {
          const value = index * niceStep;
          const y = bottom - value / axisMax * (bottom - top);
          return <g key={index}>
            <line x1={left} x2={right} y1={y} y2={y} className="business-home-chart-gridline"/>
            <text x={left - 12} y={y + 4} textAnchor="end" className="business-home-chart-axis-label">{number(Number(value.toFixed(5)))}</text>
          </g>;
        })}
        <rect x={left} y={top} width={right - left} height={bottom - top} fill="transparent" pointerEvents="all"/>
        {area && <polygon points={area} fill="url(#business-home-chart-fill)" pointerEvents="none"/>}
        <polyline points={line} className="business-home-chart-line" pointerEvents="none"/>
        {coords.map((point, index) => <circle key={validPoints[index].label + index}
          cx={point.x} cy={point.y} r={selectedIndex === index ? 5.5 : 3.7}
          className={`business-home-chart-dot${selectedIndex === index ? " is-active" : ""}`}
          tabIndex={0} aria-label={validPoints[index].label + ": " + number(validPoints[index].value) + " visualizaciones"}
          onFocus={() => setHoveredIndex(index)} onBlur={() => setHoveredIndex(null)}/>)}
        {selected && selectedPoint && <>
          <line className="business-home-chart-crosshair" x1={selectedPoint.x} y1={top}
            x2={selectedPoint.x} y2={bottom} pointerEvents="none"/>
          <circle className="business-home-chart-crosshair-dot" cx={selectedPoint.x} cy={selectedPoint.y}
            r="6" pointerEvents="none"/>
          {(() => {
            const tx = Math.max(left, Math.min(right - 79, selectedPoint.x - 39.5));
            const ty = Math.max(2, selectedPoint.y - 46);
            return <g className="business-home-chart-value" pointerEvents="none">
              <rect x={tx} y={ty} width="79" height="34" rx="9"/>
              <text x={tx + 39.5} y={ty + 23} textAnchor="middle">{number(selected.value)}</text>
            </g>;
          })()}
        </>}
        {validPoints.map((point, index) =>
          (index % labelEvery === 0 || index === validPoints.length - 1) &&
          <text key={point.label + index} className="business-home-chart-date"
            x={xx(index)} y={chartHeight - 16} textAnchor="middle">
            {businessChartDate(point.label, period)}
          </text>)}
      </svg>
    </div>
    <p className="business-home-chart-hint">{selected
      ? <><strong>{number(selected.value)}</strong> visualizaciones · {businessChartDate(selected.label, period)}</>
      : "Mueve el cursor o desliza el dedo para consultar cada período, incluidos los valores de 0."}</p>
    {period === "all" && <p className="business-home-chart-clarification">
      El total histórico incluye todos los registros disponibles; la gráfica representa los últimos 24 meses.
    </p>}
  </div>;
}

/** Icons shared by the existing Business dashboard components. */
function MetricSymbol({ name }: { name: MetricKey }) {
  if (name === "businessViews") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 12s3.8-6.5 10-6.5S22 12 22 12s-3.8 6.5-10 6.5S2 12 2 12Z"/><circle cx="12" cy="12" r="3.2"/></svg>;
  if (name === "searchAppearances") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.4 15.4 5 5"/></svg>;
  if (name === "whatsappClicks") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20.5 11.6a8.5 8.5 0 0 1-12.6 7.5L3 20.5l1.5-4.7A8.5 8.5 0 1 1 20.5 11.6Z"/><path d="M8.5 8.2c.4-.5.8-.4 1-.1l.9 1.5c.2.4.1.7-.3 1.1l-.4.5c.8 1.4 1.7 2.3 3.2 3.1l.5-.5c.3-.3.7-.4 1.1-.2l1.6.8c.4.3.4.7.1 1.1-.7.9-1.8 1.1-3.1.7-2.6-.8-5.1-3.3-5.8-5.9-.3-1.1.1-1.8 1.2-2.1Z"/></svg>;
  if (name === "phoneClicks") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7.4 3H4.9A1.9 1.9 0 0 0 3 4.9C3.1 13.8 10.2 20.9 19.1 21a1.9 1.9 0 0 0 1.9-1.9v-2.5l-5.1-2.1-2.4 2.4a17.5 17.5 0 0 1-6.4-6.4l2.4-2.4L7.4 3Z"/></svg>;
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="6.7"/><path d="M12 1v6M12 17v6M1 12h6M17 12h6"/><circle cx="12" cy="12" r="2.2"/></svg>;
}

type QuickActionIcon = "promotion" | "gallery" | "catalog" | "edit";
function QuickActionSymbol({ name }: { name: QuickActionIcon }) {
  if (name === "promotion") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="6.7" cy="6.5" r="2"/><circle cx="17.3" cy="17.5" r="2"/><path d="M18.8 4 5.2 20"/></svg>;
  if (name === "gallery") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m4 17 5-5 4 4 3-3 5 5"/></svg>;
  if (name === "catalog") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true"><path d="m12 3 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 16l9 5 9-5"/></svg>;
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 20h4l11-11-4-4L4 16v4ZM13.5 6.5l4 4"/><path d="M4 20h16"/></svg>;
}

function QuickAction({ to, title, description, icon, disabled = false }: { to?: string; title: string; description: string; icon: QuickActionIcon; disabled?: boolean }) {
  const content = <><span className="business-home-action-icon" aria-hidden="true"><QuickActionSymbol name={icon}/></span><span className="business-home-action-copy"><strong>{title}</strong><small>{description}</small></span><span className="business-home-action-arrow" aria-hidden="true">↗</span></>;
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
  const [visibility, setVisibility] = useState<BusinessVisibility | null>(null);
  const [visibilityBusy, setVisibilityBusy] = useState(false);
  const [visibilityError, setVisibilityError] = useState("");
  const [visibilityNow, setVisibilityNow] = useState(() => Date.now());
  const [proUnlocked, setProUnlocked] = useState<boolean | null>(null);
  const [reviewSummary, setReviewSummary] = useState<{ average: number | null; total: number } | null>(null);
  const realBusiness = business.source === "real" && Boolean(business.id);
  const canReadAnalytics = !isPreview && realBusiness && (business.role === "Propietario" || business.permissions?.includes("READ_ANALYTICS"));
  const businessIndex = Math.max(0, businesses.findIndex(item => item.id === business.id || item.name === business.name));
  const profileUrl = publicProfileUrl(business);
  // Open the actual Usuarios public page in the same tab, never render it with Business CSS.
  const readOnlyPreviewUrl = profileUrl && typeof window !== "undefined"
    ? getPublicBusinessPreviewUrl(business.publicId, new URL("/inicio", window.location.origin).toString())
    : null;
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

  // Admin changes can arrive while Inicio remains open: refresh on focus,
  // visibility changes and once per minute (only while this page is visible).
  useEffect(() => {
    let active = true;
    let requestId = 0;
    setVisibility(null);
    setVisibilityError("");
    if (isPreview || !realBusiness || !business.id) return () => { active = false; };
    const businessId = business.id;
    const load = () => {
      const currentRequest = ++requestId;
      void businessApi.getVisibility(businessId)
        .then(({ visibility: result }) => {
          if (!active || currentRequest !== requestId) return;
          setVisibility(result);
          setVisibilityError("");
          setVisibilityNow(Date.now());
        })
        .catch(() => {
          if (active && currentRequest === requestId) setVisibilityError("No pudimos actualizar el estado de visibilidad.");
        });
    };
    const onFocus = () => { if (document.visibilityState === "visible") load(); };
    const onVisible = () => { if (document.visibilityState === "visible") load(); };
    load();
    const refresh = window.setInterval(onVisible, 60_000);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      window.clearInterval(refresh);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [business.id, isPreview, realBusiness]);

  // Mantiene el contador actualizado si el propietario deja Inicio abierto.
  useEffect(() => {
    const updateClock = () => setVisibilityNow(Date.now());
    const interval = window.setInterval(updateClock, 60_000);
    window.addEventListener("focus", updateClock);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", updateClock);
    };
  }, []);

  const expiresAt = visibility?.period?.expiresAt;
  const expiry = expiresAt ? new Date(expiresAt) : null;
  const validExpiry = expiry !== null && Number.isFinite(expiry.getTime());
  const expiryTime = validExpiry ? expiry.getTime() : null;
  const remainingMs = expiryTime === null ? null : expiryTime - visibilityNow;
  const remainingDays = expiryTime === null ? null : Math.max(0, colombiaCalendarDay(expiryTime) - colombiaCalendarDay(visibilityNow));
  const withinVisibilityPeriod = visibility?.isWithinPeriod === true && remainingMs !== null && remainingMs > 0;
  const visibilityExpired = remainingMs !== null && remainingMs <= 0;
  const visibilityView = homeVisibilityState(visibility, withinVisibilityPeriod);
  const visibilityBadge = visibility === null ? (visibilityError ? "No disponible" : "Consultando") : visibilityView.label;
  const visibilityBadgeVariant = visibility === null ? "unknown" : visibilityView.variant;
  const expiryLabel = validExpiry && expiry ? new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Bogota" }).format(expiry) : null;
  const expiryTimestamp = validExpiry && expiry ? new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeStyle: "short", timeZone: "America/Bogota" }).format(expiry) : undefined;
  const visibilityRemainingLabel = visibilityExpired
    ? "El período de visibilidad terminó"
    : !withinVisibilityPeriod
      ? "No hay una vigencia activa confirmada"
      : remainingMs !== null && remainingMs < 86_400_000
        ? "Menos de 24 horas restantes"
        : `Quedan ${remainingDays} días`;

  const renewBusinessVisibility = async () => {
    if (!realBusiness || !business.id || visibilityBusy || visibilityView.blockedByAdmin) return;
    setVisibilityBusy(true);
    setVisibilityError("");
    try {
      const { visibility: result } = await businessApi.renewVisibility(business.id);
      setVisibility(result);
      setVisibilityNow(Date.now());
    } catch {
      setVisibilityError("No fue posible renovar la vigencia. Comprueba que no exista una restricción administrativa.");
    } finally {
      setVisibilityBusy(false);
    }
  };

  const restoreBusinessVisibility = async () => {
    if (!realBusiness || !business.id || visibilityBusy || visibilityView.blockedByAdmin || !visibilityView.hiddenByOwner) return;
    setVisibilityBusy(true);
    setVisibilityError("");
    try {
      // An active period is reused; only an expired one needs a new 40-day period.
      const { visibility: result } = withinVisibilityPeriod
        ? await businessApi.setVisibility(business.id, true)
        : await businessApi.renewVisibility(business.id);
      setVisibility(result);
      setVisibilityNow(Date.now());
    } catch {
      setVisibilityError("No se pudo volver a mostrar el negocio. Revisa su publicación o solicita asistencia.");
    } finally {
      setVisibilityBusy(false);
    }
  };

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
  const previousVisits = data?.previous?.businessViews;
  const currentVisits = data?.metrics.businessViews;
  const visitsChange = currentVisits !== undefined && previousVisits !== undefined && previousVisits !== null && previousVisits > 0
    ? Math.round((currentVisits - previousVisits) / previousVisits * 100)
    : null;
  const comparisonPeriod = period === "day" ? "vs. el día anterior" : period === "week" ? "vs. la misma parte de la semana anterior" : period === "month" ? "vs. la misma parte del mes anterior" : period === "year" ? "vs. la misma parte del año anterior" : "Sin período comparable";
  const showEmptyAccount = !business.name;

  return <div className="business-home">
    <div className="business-home-heading">
      <div><span className="business-home-eyebrow">CENTRO DE CONTROL</span><h1>Inicio</h1><p>{currentDate.charAt(0).toLocaleUpperCase("es-CO") + currentDate.slice(1)} · Un resumen de tu negocio en XAMUKO.</p></div>
      {business.name && realBusiness && !isPreview && business.role === "Propietario" && (
        <div className={`business-home-visibility-action is-${visibilityBadgeVariant}`}>
          <div className="business-home-visibility-info" aria-live="polite">
            <div className="business-home-visibility-label">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2.2 12s3.5-6.3 9.8-6.3 9.8 6.3 9.8 6.3-3.5 6.3-9.8 6.3S2.2 12 2.2 12Z"/><circle cx="12" cy="12" r="3"/></svg>
              <span>VISIBILIDAD DEL NEGOCIO</span>
              <span className={`business-home-visibility-badge ${visibilityBadgeVariant}`}>{visibilityBadge}</span>
            </div>
            <strong className="business-home-visibility-date">
              {expiryLabel ? <>Vigencia hasta el <time dateTime={expiresAt} title={expiryTimestamp}>{expiryLabel}</time></> : visibility === null ? (visibilityError ? "Vigencia no disponible" : "Consultando vigencia…") : "Sin fecha de vencimiento"}
            </strong>
            <span className="business-home-visibility-remaining">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M7.5 3v4M16.5 3v4M3.5 10.5h17"/></svg>
              {visibility === null ? (visibilityError ? "No se pudo consultar la fecha" : "Fecha pendiente de consulta") : visibilityRemainingLabel}
            </span>
            {visibilityView.note && <span className={`business-home-visibility-note ${visibilityBadgeVariant}`} role="status">{visibilityView.note}</span>}
          </div>
          {visibility && !visibilityView.blockedByAdmin && visibilityView.hiddenByOwner && (
            <button type="button" onClick={() => void restoreBusinessVisibility()} disabled={visibilityBusy}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2.2 12s3.5-6.3 9.8-6.3 9.8 6.3 9.8 6.3-3.5 6.3-9.8 6.3S2.2 12 2.2 12Z"/><circle cx="12" cy="12" r="3"/></svg>
              <span>{visibilityBusy ? "Actualizando…" : withinVisibilityPeriod ? "Volver a mostrar negocio" : `Renovar y mostrar ${BUSINESS_VISIBILITY_DAYS} días`}</span>
            </button>
          )}
          {visibility && !visibilityView.blockedByAdmin && !visibilityView.hiddenByOwner && visibility.publicationStatus !== "UNPUBLISHED" && (
            <button type="button" onClick={() => void renewBusinessVisibility()} disabled={visibilityBusy}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 1 0-.9 4.4"/><path d="M20 4v7h-7"/></svg>
              <span>{visibilityBusy ? "Renovando…" : visibilityBadgeVariant === "expired" ? `Renovar visibilidad ${BUSINESS_VISIBILITY_DAYS} días` : `Mantener visible ${BUSINESS_VISIBILITY_DAYS} días`}</span>
            </button>
          )}
          {visibilityError && <small className="business-home-visibility-error" role="alert">{visibilityError}</small>}
        </div>
      )}
    </div>

    {showEmptyAccount ? <section className="business-home-no-business"><span aria-hidden="true">✦</span><h2>¡Qué alegría tenerte en XAMUKO Business!</h2><p>{businesses.length === 0 ? "Nos encanta que estés aquí. Da el primer paso: registra tu negocio, muestra lo que te hace especial y empieza a conectar con más personas." : "Selecciona uno de tus negocios para consultar su actividad y administrarlo."}</p><Link className="business-home-primary" to={businesses.length === 0 ? "/mis-negocios/nuevo" : "/mis-negocios"}>{businesses.length === 0 ? "Crear mi primer negocio" : "Ver mis negocios"} <span aria-hidden="true">→</span></Link><Link to="/notificaciones" style={{ display: "inline-block", marginTop: 15, color: "#2563eb", fontSize: 12, fontWeight: 750 }}>Ver mis notificaciones</Link></section> : <>
      <section className="business-home-hero" aria-label={`Perfil de ${business.name}`}>
        <BusinessImage src={business.coverImage} name={business.name} className="business-home-cover" alt={`Portada de ${business.name}`} isPreview={isPreview} objectPosition={business.coverImagePosition ? `${business.coverImagePosition.x}% ${business.coverImagePosition.y}%` : undefined} />
        <div className="business-home-hero-shade" />
        <div className="business-home-hero-content">
          <SelectedBusinessProfileImage business={business} className="business-home-profile" isPreview={isPreview} />
          <div className="business-home-business-copy"><div className="business-home-name-line"><h2>{business.name}</h2>{verified && <span className="business-home-verified" title="Negocio verificado" aria-label="Negocio verificado">✓</span>}</div><p>{[categoryLabel, business.city].filter(Boolean).join(" · ")}</p>{business.description && <p className="business-home-description">{business.description}</p>}{businessStatus && <span className={`business-home-status${business.isOpen === false ? " closed" : ""}`}>{business.isOpen === true && <i />}{businessStatus}</span>}</div>
          <div className="business-home-hero-actions">
            {readOnlyPreviewUrl ? <a className="business-home-button glass" href={readOnlyPreviewUrl}><span aria-hidden="true">↗</span>Ver en XAMUKO</a> : <span className="business-home-button glass disabled" aria-disabled="true" title="Este negocio aún no tiene un perfil público">Perfil público no disponible</span>}
            <button className="business-home-button glass" type="button" onClick={() => void shareBusiness()} disabled={!profileUrl}><span aria-hidden="true">↗</span>Compartir</button>
            {availableActions.edit && <Link className="business-home-button glass" to={`/mi-negocio/detalle/${businessIndex}?tab=general${business.role === "Propietario" ? "&edit=general" : ""}`}><span aria-hidden="true">✎</span>Editar negocio</Link>}
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
              <span className="business-home-metric-icon" aria-hidden="true"><MetricSymbol name={metric.key}/></span><div className="business-home-metric-copy"><span>{metric.label}</span><strong>{loading ? "…" : current === undefined ? "—" : number(current)}</strong><small>{loading ? "Cargando" : metric.detail}</small></div>
              {change !== null && <span className={`business-home-change${change < 0 ? " negative" : ""}`}>{change > 0 ? "+" : ""}{change}%</span>}
            </article>;
          })}
        </div>
      </section>

      <div className="business-home-main-grid">
        <section className="business-home-panel business-home-performance" aria-labelledby="business-home-performance-title">
          <div className="business-home-panel-heading">
            <div><span className="business-home-eyebrow">VISIBILIDAD</span><h2 id="business-home-performance-title">Evolución de visualizaciones</h2><p>Actividad de {business.name} · {periodLabel}</p></div>
            {canReadAnalytics ? <Link className="business-home-statistics-link" to="/estadisticas"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="4" y="12" width="3.2" height="8" rx=".6"/><rect x="10.4" y="7" width="3.2" height="13" rx=".6"/><rect x="16.8" y="3" width="3.2" height="17" rx=".6"/></svg><span>Ver estadísticas</span><span aria-hidden="true">→</span></Link> : <span className="business-home-statistics-link is-disabled" aria-disabled="true">Ver estadísticas <span aria-hidden="true">→</span></span>}
          </div>
          <div className="business-home-performance-summary" aria-live="polite">
            <div className="business-home-views-total">
              <svg className="business-home-views-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true"><path d="M2.25 12s3.5-6 9.75-6 9.75 6 9.75 6-3.5 6-9.75 6-9.75-6-9.75-6Z"/><circle cx="12" cy="12" r="3.2"/></svg>
              <div><strong>{loading ? "…" : currentVisits === undefined ? "—" : number(currentVisits)}</strong><span>Visualizaciones</span></div>
            </div>
            <div className="business-home-growth">
              {visitsChange !== null ? <strong className={`business-home-growth-value ${visitsChange > 0 ? "positive" : visitsChange < 0 ? "negative" : "neutral"}`}><span aria-hidden="true">{visitsChange > 0 ? "↗" : visitsChange < 0 ? "↘" : "→"}</span>{visitsChange > 0 ? "+" : ""}{visitsChange}%</strong> : <strong className="business-home-growth-value neutral">{loading ? "…" : previousVisits === 0 && (currentVisits ?? 0) > 0 ? "Nuevo" : "—"}</strong>}
              <span>{visitsChange !== null ? comparisonPeriod : previousVisits === 0 && (currentVisits ?? 0) > 0 ? "Sin visitas en el período anterior" : "Sin comparación disponible"}</span>
            </div>
          </div>
          {loading ? <div className="business-home-chart-loading" aria-live="polite">Cargando actividad…</div> : data ? <VisitChart points={data.trends.businessViews} period={period} /> : <div className="business-home-chart-empty"><span aria-hidden="true">⌁</span><strong>{error ? "Gráfica no disponible" : "Sin datos para graficar"}</strong><p>{error ? "Intenta cargar las estadísticas nuevamente." : "La gráfica mostrará únicamente visualizaciones registradas por la API."}</p></div>}
        </section>

        <section className="business-home-panel business-home-details" aria-labelledby="business-home-details-title">
          <div className="business-home-panel-heading"><div><span className="business-home-eyebrow">TU ESTABLECIMIENTO</span><h2 id="business-home-details-title">Información del negocio</h2></div><SelectedBusinessProfileImage business={business} className="business-home-details-avatar" isPreview={isPreview} /></div>
          {((currentRating != null) || (reviewCount ?? 0) > 0) && <div className="business-home-rating"><span aria-hidden="true">★</span><strong>{currentRating == null ? "—" : currentRating.toFixed(1)}</strong><small>{reviewCount === undefined ? "Calificación disponible" : `${number(reviewCount)} ${reviewCount === 1 ? "opinión" : "opiniones"}`}</small></div>}
          <dl className="business-home-info-list">
            {address && <div><dt><span aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="2.7"/></svg></span>Ubicación</dt><dd>{address}</dd></div>}
            {business.isOpen !== undefined && <div><dt><span aria-hidden="true">◷</span>Estado</dt><dd className={business.isOpen ? "open" : "closed"}>{business.isOpen ? "Abierto ahora" : "Cerrado"}</dd></div>}
            {business.hours && <div><dt><span aria-hidden="true">◷</span>Horario</dt><dd>{business.hours}</dd></div>}
            {business.phone && <div><dt><span aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M7 3H4.6A1.6 1.6 0 0 0 3 4.6C3 14 10 21 19.4 21a1.6 1.6 0 0 0 1.6-1.6V17l-5.3-2.1-2.2 2.2a17 17 0 0 1-6.6-6.6L9.1 8.3 7 3Z"/></svg></span>Teléfono</dt><dd><a href={`tel:${business.phone.replace(/[^+\d]/g, "")}`}>{business.phone}</a></dd></div>}
            {business.website && <div><dt><span aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M5 19 19 5M8 5h11v11"/></svg></span>Sitio web</dt><dd><a href={/^https?:\/\//i.test(business.website) ? business.website : `https://${business.website}`} target="_blank" rel="noreferrer">{business.website}</a></dd></div>}
            {!address && !business.hours && !business.phone && !business.website && currentRating == null && !(reviewCount ?? 0) && <li className="business-home-info-empty">Todavía no hay información adicional registrada.</li>}
          </dl>
        </section>
      </div>

      <section className="business-home-panel business-home-actions-section" aria-labelledby="business-home-actions-title">
        <div className="business-home-panel-heading"><div><span className="business-home-eyebrow">GESTIÓN DIARIA</span><h2 id="business-home-actions-title">Acciones rápidas</h2></div></div>
        <div className="business-home-actions-grid">
          <QuickAction title="Nueva promoción" description="Abre ofertas y promociones" icon="promotion" to={availableActions.promotions ? "/ofertas" : undefined} disabled={!availableActions.promotions} />
          <QuickAction title="Actualizar galería" description="Gestiona las fotos del negocio desde su edición" icon="gallery" to={availableActions.edit ? `/mi-negocio/detalle/${businessIndex}?tab=photos` : undefined} disabled={!availableActions.edit} />
          <QuickAction title="Productos y servicios" description="Gestiona tu catálogo" icon="catalog" to={availableActions.catalog ? "/productos" : undefined} disabled={!availableActions.catalog} />
          <QuickAction title="Editar información" description="Actualiza los datos del negocio" icon="edit" to={availableActions.edit ? `/mi-negocio/detalle/${businessIndex}?tab=general` : undefined} disabled={!availableActions.edit} />
        </div>
        {(business.role !== "Propietario" && (!availableActions.catalog || !availableActions.edit || !availableActions.promotions)) && <p className="business-home-muted-note">Algunas acciones requieren permisos del propietario del negocio.</p>}
      </section>

      <section className="business-home-pro" aria-labelledby="business-home-pro-title">
        <div className="business-home-pro-mark" aria-hidden="true">♛</div><div className="business-home-pro-copy"><span className="business-home-eyebrow">MÁS HERRAMIENTAS PARA CRECER</span><h2 id="business-home-pro-title">Business PRO</h2><p>5 estadísticas gratuitas · 20 estadísticas PRO · 5 desbloqueables por nivel.</p></div><div className="business-home-pro-status"><span>{proUnlocked === true ? "Plan activo" : proUnlocked === false ? "Plan Básico" : "Plan sin verificar"}</span><small>{proUnlocked === true ? "Acceso Business PRO vigente" : "La contratación del plan no está disponible en esta versión."}</small></div><Link to="/estadisticas" className="business-home-pro-link">Ver estadísticas <span aria-hidden="true">→</span></Link>
      </section>
    </>}
  </div>;
}
