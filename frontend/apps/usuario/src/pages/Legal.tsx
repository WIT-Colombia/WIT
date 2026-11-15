import { useEffect } from "react";
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { PageLayout } from "../components/PageLayout";
import "./Legal.css";
import { legalEffectiveDate, legalVersion, privacySections, termsSections } from "@wit/utils/legal";

export default function Legal() {
  const { page = "terms" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const fromRegister = params.get("from") === "register";
  const returnTo = fromRegister ? "/register" : "/settings";
  useEffect(() => {
    const id = location.hash.slice(1);
    if (!/^legal-\d+$/.test(id)) return;
    const frame = requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView());
    return () => cancelAnimationFrame(frame);
  }, [location.hash, page]);
  const handleBack = () => {
    const referrer = document.referrer;
    let trustedReferrer = false;
    try {
      const hostname = new URL(referrer).hostname;
      trustedReferrer = hostname === "xamuko.com" || hostname.endsWith(".xamuko.com") || hostname === window.location.hostname;
    } catch {
      // No referrer on direct visits.
    }
    const routerIndex = (window.history.state as { idx?: number } | null)?.idx;
    if ((typeof routerIndex === "number" && routerIndex > 0) || (trustedReferrer && window.history.length > 1)) {
      navigate(-1);
    } else {
      navigate(returnTo, { replace: true });
    }
  };
  const isTerms = page === "terms";
  const sections = isTerms ? termsSections : privacySections;
  const title = isTerms ? "Términos y condiciones" : "Política de privacidad";
  const description = `Versión ${legalVersion} · Vigente desde el ${legalEffectiveDate}.`;
  if (page === "cookies" || page === "security") {
    const query = params.toString();
    return <Navigate replace to={`/legal/privacy${query ? `?${query}` : ""}#${page === "cookies" ? "legal-11" : "legal-14"}`} />;
  }
  if (!isTerms && page !== "privacy") return <Navigate replace to="/legal/privacy" />;
  return <PageLayout className="legal-page">
    <div className="legal-layout">
      <button type="button" className="legal-back legal-back--top" onClick={handleBack}>← Volver</button>
      <aside className="legal-sidebar"><span className="legal-eyebrow">CENTRO LEGAL</span><h1>{title}</h1><p>{description}</p><nav aria-label="Documentos legales"><Link className={isTerms ? "active" : ""} to={`/legal/terms?from=${fromRegister ? "register" : "settings"}`}>Términos y condiciones</Link><Link className={page === "privacy" ? "active" : ""} to={`/legal/privacy?from=${fromRegister ? "register" : "settings"}`}>Política de privacidad</Link></nav></aside>
      <article className="legal-card legal-document"><div className="legal-document-heading"><h2>{title}</h2><p>Versión {legalVersion} · Vigente desde el {legalEffectiveDate}.</p></div>
        <nav className="legal-toc" aria-label="Contenido del documento"><strong>En este documento</strong>{sections.map(s => <a key={s.id} href={`#${s.id}`}>{s.title}</a>)}</nav>
        {sections.map(s => <section className="legal-section" id={s.id} key={s.id}><h3>{s.title}</h3>{s.paragraphs.map((paragraph,i) => <p key={i}>{paragraph}</p>)}</section>)}
      </article>
    </div>
  </PageLayout>;
}
