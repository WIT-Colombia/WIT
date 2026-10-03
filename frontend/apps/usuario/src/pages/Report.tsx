import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { businesses, products, reviews, services } from "../data/mockData";
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

  const business = targetType === "business" ? businesses.find((item) => item.id === targetId) : undefined;
  const product = targetType === "product" ? products.find((item) => item.id === targetId) : undefined;
  const service = targetType === "service" ? services.find((item) => item.id === targetId) : undefined;
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

  if (!target || !targetType || !(targetType in categories)) {
    return <PageLayout className="report-page"><div className="report-missing"><h1>No encontramos qué reportar</h1><p>Vuelve a la ficha o al elemento que quieres reportar e inténtalo de nuevo.</p><Link to="/home">Volver a explorar</Link></div></PageLayout>;
  }

  return <PageLayout className="report-page"><Link className="report-back" to={backTo}>← Volver</Link>{submitted ? <section className="report-confirmation" role="status"><span aria-hidden="true">✓</span><p className="report-eyebrow">GRACIAS POR AYUDARNOS</p><h1>Recibimos tu reporte</h1><p>Guardamos el reporte y lo agrupamos con otros que indiquen el mismo problema.</p>{reportCount >= 5 ? <p className="report-priority-note">Este elemento ya acumula {reportCount} reportes coincidentes y quedó marcado para atención prioritaria.</p> : <p className="report-count-note">Este motivo acumula {reportCount} reporte{reportCount === 1 ? "" : "s"}. Cuando haya varios coincidentes, lo revisaremos con prioridad.</p>}<Link to={backTo}>Volver a {targetName}</Link></section> : <><div className="report-heading"><span className="report-eyebrow">AYÚDANOS A MANTENER WIT ACTUALIZADO</span><h1>Reportar {targetType === "business" ? "negocio" : targetType === "product" ? "producto" : targetType === "service" ? "servicio" : "opinión"}</h1><p>Cuéntanos qué deberíamos revisar sobre <strong>{targetName}</strong>.</p></div><form className="report-form" onSubmit={submit}><label>¿Qué sucede?<select required value={category} onChange={(event) => setCategory(event.target.value)}><option value="">Elige un motivo</option>{categories[targetType].map((item) => <option key={item}>{item}</option>)}</select></label><label>Detalles <span>(opcional)</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Agrega información que nos ayude a entender el problema…" rows={4} maxLength={500}/></label><p className="report-privacy-note">Los reportes se almacenan y agrupan por elemento y motivo. Varios reportes coincidentes harán que WIT lo revise con prioridad.</p><button type="submit" disabled={!category}>Enviar reporte</button></form></>}</PageLayout>;
}
