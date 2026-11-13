import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { faqs, type FaqAudience } from "@wit/utils";
import { PageLayout } from "../components/PageLayout";
import "./FaqPage.css";

export default function FaqPage() {
  const navigate = useNavigate();
  const [audience, setAudience] = useState<FaqAudience>("usuarios");

  function handleBack() {
    const index = (window.history.state as { idx?: number } | null)?.idx;
    if (typeof index === "number" && index > 0) navigate(-1);
    else navigate("/home", { replace: true });
  }

  return <PageLayout className="faq-page">
    <button type="button" className="faq-page__back" onClick={handleBack}>← Volver</button>
    <div className="faq-page__heading">
      <span>CENTRO DE AYUDA</span>
      <h1>Preguntas frecuentes</h1>
      <p>Encuentra respuestas sobre XAMUKO y el uso de sus aplicaciones.</p>
    </div>
    <section className="faq-page__card" aria-label="Respuestas a preguntas frecuentes">
      <div className="faq-page__tabs" role="group" aria-label="Tipo de cuenta">
        <button type="button" aria-pressed={audience === "usuarios"} className={audience === "usuarios" ? "is-active" : ""} onClick={() => setAudience("usuarios")}>Usuarios</button>
        <button type="button" aria-pressed={audience === "negocios"} className={audience === "negocios" ? "is-active" : ""} onClick={() => setAudience("negocios")}>Negocios</button>
      </div>
      <div className="faq-page__list" key={audience}>
        {faqs[audience].map(([question, answer]) => <details key={question}>
          <summary>{question}<span className="faq-page__chevron" aria-hidden="true" /></summary>
          <p>{answer}</p>
        </details>)}
      </div>
    </section>
  </PageLayout>;
}
