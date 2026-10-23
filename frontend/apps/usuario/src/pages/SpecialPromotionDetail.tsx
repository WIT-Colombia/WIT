import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PageLayout } from "../components/PageLayout";
import { getPublicBusiness, getPublicPromotion, recordPublicPromotionView, type PublicPromotion } from "../services/publicBusinessApi";
import { requestBlobWithSession } from "../services/authService";
import "./SpecialPromotionDetail.css";

type PromotionState = "ACTIVE" | "SCHEDULED" | "FINISHED";

function displayDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Fecha no disponible" : new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Bogota" }).format(date);
}

function stateLabel(state: PromotionState) {
  if (state === "FINISHED") return "Promoción finalizada";
  if (state === "SCHEDULED") return "Próximamente";
  return "Promoción activa";
}

function PromotionImage({ promotion }: { promotion: PublicPromotion }) {
  const [src, setSrc] = useState("");
  const photo = promotion.photos[0];

  useEffect(() => {
    let current = true;
    let objectUrl = "";
    setSrc("");
    if (photo?.url) {
      void requestBlobWithSession(photo.url).then(blob => {
        if (!current) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      }).catch(() => { if (current) setSrc(""); });
    }
    return () => {
      current = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photo?.url]);

  return <div className={`special-promotion-detail__photo${src ? " has-image" : ""}`}>
    {src ? <img src={src} alt={promotion.title} /> : <div className="special-promotion-detail__photo-fallback" aria-label="Fotografía no disponible"><span aria-hidden="true">✦</span><small>Imagen no disponible</small></div>}
    <span className="special-promotion-detail__photo-label">PROMOCIÓN ESPECIAL</span>
  </div>;
}

function EstablishmentImage({ src, name }: { src: string; name: string }) {
  const [imageUrl, setImageUrl] = useState("");

  useEffect(() => {
    let current = true;
    let objectUrl = "";
    setImageUrl("");
    if (src) {
      void requestBlobWithSession(src).then(blob => {
        if (!current) return;
        objectUrl = URL.createObjectURL(blob);
        setImageUrl(objectUrl);
      }).catch(() => { if (current) setImageUrl(""); });
    }
    return () => {
      current = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

  return imageUrl
    ? <img className="special-promotion-detail__business-image" src={imageUrl} alt={`Imagen de ${name}`} />
    : <span className="special-promotion-detail__business-icon" aria-hidden="true">⌖</span>;
}

function createViewDedupeKey(id: string) {
  void id;
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function SpecialPromotionDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [promotion, setPromotion] = useState<PublicPromotion | null>(null);
  const [businessImage, setBusinessImage] = useState("");
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const trackedId = useRef("");

  useEffect(() => {
    let current = true;
    setLoading(true);
    setUnavailable(false);
    setPromotion(null);
    setBusinessImage("");
    void getPublicPromotion(id).then(value => {
      if (!current) return;
      if (value.type !== "PROMOTION" || !value.business?.publicId) {
        setUnavailable(true);
        return;
      }
      setPromotion(value);
      void getPublicBusiness(value.business.publicId).then(result => {
        if (current) setBusinessImage(result?.business.logo || result?.business.image || "");
      }).catch(() => undefined);
      if (value.state === "ACTIVE" && trackedId.current !== value.id) {
        trackedId.current = value.id;
        void recordPublicPromotionView(value.id, createViewDedupeKey(value.id)).catch(() => undefined);
      }
    }).catch(() => { if (current) setUnavailable(true); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [id]);

  if (loading) return <PageLayout className="special-promotion-detail-page"><div className="special-promotion-detail__message" role="status">Cargando promoción…</div></PageLayout>;
  if (unavailable || !promotion || !promotion.business) return <PageLayout className="special-promotion-detail-page"><button className="special-promotion-detail__back" type="button" onClick={() => window.history.length > 1 ? navigate(-1) : navigate("/home")}>← Volver</button><div className="special-promotion-detail__message"><span aria-hidden="true">✦</span><h1>Esta promoción no está disponible</h1><p>Puede haber finalizado o el negocio ya no la tiene publicada.</p><Link to="/home">Volver a explorar</Link></div></PageLayout>;

  const status = promotion.state ?? "ACTIVE";
  return <PageLayout className="special-promotion-detail-page">
    <button className="special-promotion-detail__back" type="button" onClick={() => window.history.length > 1 ? navigate(-1) : navigate("/home")}>← Volver</button>
    <article className="special-promotion-detail">
      <PromotionImage promotion={promotion} />
      <div className="special-promotion-detail__body">
        <div className="special-promotion-detail__eyebrow"><span>EVENTO ESPECIAL</span><span className={`special-promotion-detail__status is-${status.toLowerCase()}`}>{stateLabel(status)}</span></div>
        {promotion.business.category && <span className="special-promotion-detail__category">{promotion.business.category}</span>}
        <h1>{promotion.title}</h1>
        {promotion.description.trim() && <p className="special-promotion-detail__description">{promotion.description}</p>}
        <div className="special-promotion-detail__dates" aria-label="Vigencia de la promoción">
          <div><span>Inicia</span><strong>{displayDate(promotion.startsAt)}</strong></div>
          <div><span>Finaliza</span><strong>{displayDate(promotion.endsAt)}</strong></div>
        </div>
        <Link className="special-promotion-detail__business" to={`/business/${encodeURIComponent(promotion.business.publicId)}`}>
          <EstablishmentImage src={businessImage} name={promotion.business.name} />
          <span><small>EN ESTE ESTABLECIMIENTO</small><strong>{promotion.business.name}</strong><em>Ver perfil público del negocio</em></span>
          <span className="special-promotion-detail__business-arrow" aria-hidden="true">→</span>
        </Link>
        <Link className="special-promotion-detail__business-button" to={`/business/${encodeURIComponent(promotion.business.publicId)}`}>Ver negocio <span aria-hidden="true">→</span></Link>
      </div>
    </article>
  </PageLayout>;
}
