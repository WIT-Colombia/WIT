import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { businesses, products, reviews, services, type Product, type Service } from "../data/mockData";
import { getProductById, getServiceById } from "../services/businessService";
import { getMatchingReportCount, getUserReviews, saveUserReport } from "../services/userDataService";
import { PageLayout } from "../components/PageLayout";
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
  const [loadingOffer, setLoadingOffer] = useState(false);
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
  const product = targetType === "product" ? (remoteOffer && "priceLabel" in remoteOffer ? remoteOffer as Product : products.find((item) => item.id === targetId)) : undefined;
  const service = targetType === "service" ? (remoteOffer as Service | undefined ?? services.find((item) => item.id === targetId)) : undefined;
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

  return <PageLayout className="report-page"><Link className="report-back" to={backTo}>← Volver</Link>{submitted ? <section className="report-confirmation" role="status"><span aria-hidden="true">✓</span><p className="report-eyebrow">GRACIAS POR AYUDARNOS</p><h1>Reporte guardado en este dispositivo</h1><p>El reporte se guardó localmente. Aún no se ha enviado a Administración: esa integración requiere el backend.</p>{reportCount >= 5 ? <p className="report-priority-note">Hay {reportCount} reportes locales de este motivo en este navegador. La prioridad en Admin se activará cuando conectemos el backend.</p> : <p className="report-count-note">Hay {reportCount} reporte{reportCount === 1 ? "" : "s"} local{reportCount === 1 ? "" : "es"} para este motivo en este navegador.</p>}<Link to={backTo}>Volver a {targetName}</Link></section> : <><div className="report-heading"><span className="report-eyebrow">AYÚDANOS A MANTENER XAMUKO ACTUALIZADO</span><h1>Reportar {targetType === "business" ? "negocio" : targetType === "product" ? "producto" : targetType === "service" ? "servicio" : "opinión"}</h1><p>Cuéntanos qué deberíamos revisar sobre <strong>{targetName}</strong>.</p></div><form className="report-form" onSubmit={submit}><label>¿Qué sucede?<select required value={category} onChange={(event) => setCategory(event.target.value)}><option value="">Elige un motivo</option>{categories[targetType].map((item) => <option key={item}>{item}</option>)}</select></label><label>Detalles <span>(opcional)</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Agrega información que nos ayude a entender el problema…" rows={4} maxLength={500}/></label><p className="report-privacy-note">En esta etapa el reporte se guarda únicamente en este navegador. Todavía no se transmite a Admin; integraremos el envío con el backend. Evita incluir datos personales sensibles.</p><button type="submit" disabled={!category}>Enviar reporte</button></form></>}</PageLayout>;
}
