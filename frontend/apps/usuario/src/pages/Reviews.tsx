import { useMemo, useState, type FormEvent } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { businesses, reviews as sampleReviews } from "../data/mockData";
import { getUserReviews, isUserAuthenticated, saveUserReview } from "../services/userDataService";
import { PageLayout } from "../components/PageLayout";
import "./Reviews.css";

export default function Reviews() {
  const [params] = useSearchParams();
  const location = useLocation();
  const canReview = isUserAuthenticated();
  const [businessId, setBusinessId] = useState(params.get("businessId") ?? "");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [revision, setRevision] = useState(0);
  const business = businesses.find((item) => item.id === businessId);
  const allReviews = useMemo(() => [...sampleReviews, ...getUserReviews()], [revision]);
  const shownReviews = businessId ? allReviews.filter((review) => review.businessId === businessId) : allReviews;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!business || !rating || !comment.trim()) return;
    saveUserReview({ id: `review-${Date.now()}`, businessId, author: "Tú", rating, date: new Date().toLocaleDateString("es-CO"), comment: comment.trim() });
    setComment(""); setRating(0); setRevision((current) => current + 1);
  }

  return <PageLayout className="reviews-page"><div className="user-page-heading"><span>EXPERIENCIAS LOCALES</span><h1>{business ? `Opiniones sobre ${business.name}` : "Opiniones"}</h1><p>Lee experiencias de muestra y, si quieres, deja la tuya en este dispositivo.</p></div>{!businessId && <label className="reviews-business-select">Lugar<select value={businessId} onChange={(event) => setBusinessId(event.target.value)}><option value="">Todos los negocios</option>{businesses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
    {business && (canReview ? <form className="review-form" onSubmit={submit}><b>¿Cómo fue tu experiencia?</b><div className="review-rating-pick" role="group" aria-label="Califica de una a cinco estrellas">{[1,2,3,4,5].map((value) => <button key={value} type="button" aria-label={`${value} estrellas`} aria-pressed={rating === value} className={value <= rating ? "selected" : ""} onClick={() => setRating(value)}>★</button>)}</div><label className="sr-only" htmlFor="review-comment">Escribe tu opinión</label><textarea id="review-comment" value={comment} onChange={(event) => setComment(event.target.value)} placeholder="¿Qué te gustaría contarle a otras personas?" rows={3} maxLength={500}/><button type="submit" disabled={!rating || !comment.trim()}>Publicar opinión</button><small>Tu opinión se guarda localmente como muestra; no se publica ni se envía.</small></form> : <div className="review-login-required"><p>Para compartir tu experiencia, primero crea tu cuenta o entra a WIT.</p><Link to={`/register?next=${encodeURIComponent(`${location.pathname}${location.search}`)}`}>Crear cuenta o entrar →</Link></div>)}
    <section className="reviews-list"><h2>{business ? "Opiniones" : "Experiencias compartidas"} <span>{shownReviews.length}</span></h2>{shownReviews.length ? shownReviews.map((review) => <article className="review-row" key={review.id}><span className="review-avatar">{review.author.charAt(0)}</span><div><div className="review-row-heading"><b>{review.author}</b><time>{review.date}</time></div><span className="review-stars">{"★".repeat(review.rating)}{"☆".repeat(5-review.rating)}</span><p>{review.comment}</p><Link className="review-report-link" to={`/report?type=review&id=${review.id}`}>Reportar opinión</Link>{!business && <Link to={`/business/${review.businessId}`}>{businesses.find((item) => item.id === review.businessId)?.name ?? "Ver negocio"} →</Link>}</div></article>) : <div className="user-empty-state"><h2>Aún no hay opiniones</h2><p>Cuando las personas compartan su experiencia, podrás leerla aquí.</p></div>}</section>
  </PageLayout>;
}
