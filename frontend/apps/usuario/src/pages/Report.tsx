import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { businesses, products, reviews, services, type Product, type Service } from "../data/mockData";
import { getProductById, getServiceById } from "../services/businessService";
import { getMatchingReportCount, getUserReviews, saveUserReport } from "../services/userDataService";
import { PageLayout } from "../components/PageLayout";
import "../components/BusinessReportDialog.css";
import "./Report.css";

type TargetType = "business" | "product" | "service" | "review";

const categories: Record<TargetType, string[]> = {
  business: ["La información es incorrecta", "El negocio está cerrado", "Está duplicado", "Otro motivo"],
  product: ["El producto ya no está disponible", "La información o el precio son incorrectos", "La imagen no corresponde", "Otro motivo"],
  service: ["El servicio ya no está disponible", "La información o el precio son incorrectos", "Otro motivo"],
  review: ["Tiene contenido ofensivo", "Parece falsa o engañosa", "No corresponde a este negocio", "Otro motivo"],
};

export default function Report() {
  const [params] = useSearchParams();
  const targetType = params.get("type") as TargetType | null;
  const targetId = params.get("id") ?? "";
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [reportCount, setReportCount] = useState(0);
  const [remoteOffer, setRemoteOffer] = useState<Product | Service | undefined>();
  const [loadingOffer, setLoadingOffer] = useState(() => Boolean(targetId && ((targetType === "product" && !products.some(item => item.id === targetId)) || (targetType === "service" && !services.some(item => item.id === targetId)))));
  useEffect(() => {
    let active = true;
    setRemoteOffer(undefined);
    if (!targetId || (targetType !== "product" && targetType !== "service")) return;
    // Los productos reales se cargan por ID; el catálogo local solo sirve de respaldo.
    if ((targetType === "product" ? products : services).some(item => item.id === targetId)) return;
    setLoadingOffer(true);
    void (targetType === "product" ? getProductById(targetId) : getServiceById(targetId))
      .then(item => { if (active) setRemoteOffer(item); })
      .catch(() => undefined)
      .finally(() => { if (active) setLoadingOffer(false); });
    return () => { active = false; };
  }, [targetId, targetType]);

  const business = targetType === "business" ? businesses.find((item) => item.id === targetId) : undefined;
  const product = targetType === "product" ? ((remoteOffer as Product | undefined) ?? products.find((item) => item.id === targetId)) : undefined;
  const service = targetType === "service" ? ((remoteOffer as Service | undefined) ?? services.find((item) => item.id === targetId)) : undefined;
  const review = targetType === "review" ? [...reviews, ...getUserReviews()].find((item) => item.id === targetId) : undefined;
  const target = business ?? product ?? service ?? review;
  const targetName = business?.name ?? product?.name ?? service?.name ?? (review ? `Opinión de ${review.author}` : "");
  const backTo = business ? `/business/${business.id}` : product ? `/product/${product.id}` : service ? `/service/${service.id}` : review ? `/reviews?businessId=${review.businessId}` : "/home";

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!target || !targetType || !category) return;
    saveUserReport({ id: `report-${Date.now()}`, targetType, targetId, targetName, category, description: description.trim(), createdAt: new Date().toISOString() });
    setReportCount(getMatchingReportCount(targetType, targetId, category));
    setSubmitted(true);
  }

  if (loadingOffer && !target) {
    return <PageLayout className="report-page"><div className="report-missing" role="status"><h1>Cargando elemento…</h1><p>Estamos consultando su información para preparar el reporte.</p></div></PageLayout>;
  }

  if (!target || !targetType || !(targetType in categories)) {
    return <PageLayout className="report-page"><div className="report-missing"><h1>No encontramos qué reportar</h1><p>Vuelve a la ficha o al elemento que quieres reportar e inténtalo de nuevo.</p><Link to="/home">Volver a explorar</Link></div></PageLayout>;
  }

  const reportTitle = targetType === "business" ? "Reportar negocio"
    : targetType === "product" ? "Reportar producto"
    : targetType === "service" ? "Reportar servicio"
    : "Reportar opinión";

  return <PageLayout className="report-page">
    <div className="report-panel-wrap">
      <section className="business-report-dialog report-form-panel" aria-labelledby="report-form-title" aria-describedby="report-form-intro">
        <svg className="business-report-decor" viewBox="0 0 640 210" fill="none" aria-hidden="true" focusable="false">
          <defs>
            <linearGradient id="offer-report-wave-violet" x1="160" y1="0" x2="640" y2="165" gradientUnits="userSpaceOnUse">
              <stop stopColor="#7B3FFB"/><stop offset=".56" stopColor="#904BF5"/><stop offset="1" stopColor="#3A8EFF"/>
            </linearGradient>
            <linearGradient id="offer-report-wave-pale" x1="200" y1="30" x2="580" y2="200" gradientUnits="userSpaceOnUse">
              <stop stopColor="#F4EBFF"/><stop offset="1" stopColor="#DDEBFF"/>
            </linearGradient>
          </defs>
          <path d="M145 0H640V210C521 187 444 153 368 104 287 52 230 27 145 0Z" fill="url(#offer-report-wave-pale)" opacity=".65"/>
          <path d="M240 0H640V173C556 158 506 134 450 93 396 54 353 31 240 0Z" fill="url(#offer-report-wave-violet)" opacity=".93"/>
          <path d="M371 0H640V128C578 124 526 95 493 63 461 32 427 14 371 0Z" fill="#B898FF" opacity=".48"/>
          <path d="M516 0H640V134C597 125 579 106 559 79 540 52 538 20 516 0Z" fill="#5AC5FF" opacity=".38"/>
        </svg>
        <Link to={backTo} className="business-report-close" aria-label="Cerrar reporte" title="Cerrar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" aria-hidden="true" focusable="false">
            <path d="M5 5l14 14M19 5 5 19"/>
          </svg>
        </Link>
        <div className="business-report-heading">
          <span className="business-report-shield" aria-hidden="true">
            <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="3.3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M24 4 40 11v12c0 10.5-6.5 17-16 21C14.5 40 8 33.5 8 23V11L24 4Z"/>
              <path d="M24 15v12"/><circle cx="24" cy="33" r="1.8" fill="currentColor" stroke="none"/>
            </svg>
          </span>
          <h1 id="report-form-title">{submitted ? "Reporte guardado" : reportTitle}</h1>
        </div>
        {submitted ? <>
          <p id="report-form-intro" className="business-report-intro">
            Gracias por contribuir al cuidado de XAMUKO. El reporte sobre <strong>{targetName}</strong> quedó guardado en este dispositivo.
          </p>
          <div className="business-report-info report-local-notice">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>
            <small>Aún no se ha enviado a Administración. La conexión con el backend está pendiente.</small>
          </div>
          <p className="report-count-note">En este navegador hay {reportCount} reporte{reportCount === 1 ? "" : "s"} del mismo motivo para este elemento.</p>
          <div className="business-report-actions">
            <Link className="business-report-submit" to={backTo}>Volver a la publicación</Link>
          </div>
        </> : <>
          <p id="report-form-intro" className="business-report-intro">
            Cuéntanos qué ocurre con <strong>{targetName}</strong>. Esta información nos ayudará a identificar lo que debemos revisar.
          </p>
          <form onSubmit={submit}>
            <label htmlFor="offer-report-reason" className="business-report-label">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M11 3H5a2 2 0 0 0-2 2v6l9 9a2 2 0 0 0 3 0l6-6a2 2 0 0 0 0-3l-9-9Z"/><circle cx="7.5" cy="7.5" r="1"/>
              </svg>
              Motivo
            </label>
            <select id="offer-report-reason" value={category} onChange={event => setCategory(event.target.value)} required>
              <option value="">Selecciona un motivo</option>
              {categories[targetType].map(item => <option key={item} value={item}>{item}</option>)}
            </select>
            <label htmlFor="offer-report-description" className="business-report-label">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 9 9 0 0 1-4-.9L3 21l1.9-5.4A8.5 8.5 0 1 1 21 11.5Z"/>
              </svg>
              Describe lo sucedido <span className="report-optional">(opcional)</span>
            </label>
            <textarea id="offer-report-description" aria-describedby="offer-report-note" value={description}
              onChange={event => setDescription(event.target.value)} rows={4} maxLength={500}
              placeholder="Explica qué deberíamos revisar sobre este elemento…" />
            <div id="offer-report-note" className="business-report-info report-local-notice">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>
              </svg>
              <small>Máximo 500 caracteres. Evita compartir datos sensibles. Por ahora el reporte se guarda solo en este navegador; todavía no se envía a Admin.</small>
            </div>
            <div className="business-report-actions">
              <Link to={backTo} className="business-report-cancel">Cancelar</Link>
              <button type="submit" className="business-report-submit" disabled={!category}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4L22 2Z"/><path d="M22 2 11 13"/></svg>
                Guardar reporte
              </button>
            </div>
          </form>
        </>}
      </section>
    </div>
  </PageLayout>;
}
