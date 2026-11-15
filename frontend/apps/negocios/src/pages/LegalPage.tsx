import { Link, useParams, useSearchParams } from "react-router-dom";
import { BusinessHeader } from "../components/layout/BusinessHeader";
import { useBusinessAuth } from "../services/businessAuthContext";
import "./LegalPage.css";
import { legalEffectiveDate, legalVersion, privacySections, termsSections } from "@wit/utils/legal";

export function LegalPage() {
  const { page = "terms" } = useParams();
  const [searchParams] = useSearchParams();
  const source = searchParams.get("from");
  const origin = source === "perfil" || source === "ajustes" ? source : "registro";
  const backLabel = origin === "perfil" ? "← Volver al perfil" : origin === "ajustes" ? "← Volver a Configuración" : "← Volver";
  const backPath = origin === "perfil" ? "/perfil" : origin === "ajustes" ? "/configuracion" : "/registro";
  const { state } = useBusinessAuth();
  const embedded = origin === "perfil" && state.status === "authenticated";
  const fromRegistration = origin === "registro";
  const PageRoot = embedded ? "div" : "main";
  const legalPath = (document: string) => `/legal/${document}?from=${origin}`;
  const isTerms = page === "terms";
  const sections = isTerms ? termsSections : privacySections;
  return <PageRoot className={`legal-page${embedded ? " business-legal-embedded" : ""}${fromRegistration ? " business-legal-registration" : ""}`}>
    {!embedded && !fromRegistration && <BusinessHeader />}
    <div className="legal-layout">
      <Link className="text-link legal-back legal-back-top" to={backPath}>{backLabel}</Link>
      {<aside className="legal-sidebar"><span className="legal-eyebrow">CENTRO LEGAL</span><h1>{isTerms ? "Términos y condiciones" : "Política de privacidad"}</h1><p>Versión {legalVersion} · Vigente desde el {legalEffectiveDate}.</p><nav aria-label="Documentos legales"><Link className={isTerms ? "active" : ""} to={legalPath("terms")}>Términos y condiciones</Link><Link className={!isTerms ? "active" : ""} to={legalPath("privacy")}>Política de privacidad</Link></nav></aside>}
      <article className="legal-card legal-document"><div className="legal-document-heading"><h2>{isTerms ? "Términos y condiciones" : "Política de privacidad"}</h2><p>Versión {legalVersion} · Vigente desde el {legalEffectiveDate}.</p></div>
        <nav className="legal-toc" aria-label="Contenido del documento"><strong>En este documento</strong>{sections.map(s => <a key={s.id} href={`#${s.id}`}>{s.title}</a>)}</nav>
        {sections.map(s => <section className="legal-section" id={s.id} key={s.id}><h3>{s.title}</h3>{s.paragraphs.map((paragraph,i) => <p key={i}>{paragraph}</p>)}</section>)}
      </article>
    </div>
  </PageRoot>;
}
