import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { BUSINESS_PRO_REFERENCE_PRICE, recognitionLevels } from "../../config/businessRecognition";
import "./BusinessProBenefitsDialog.css";

type Props = { onClose: () => void };

const formatCop = (value: number) => `$${value.toLocaleString("es-CO")} COP`;

const highlights = [
  ["Productos ilimitados", "Publica productos sin el límite del plan Básico."],
  ["Servicios ilimitados", "Ofrece todos tus servicios sin límite."],
  ["Ofertas ilimitadas", "Mantén activas tus promociones sin el límite de tres."],
  ["Programación de promociones", "Define fechas futuras de inicio y finalización."],
  ["Estadísticas avanzadas", "23 estadísticas en total: 5 gratuitas y 18 Pro."],
  ["Análisis del catálogo", "Conoce visualizaciones, interacciones y comportamiento de tus productos y servicios."],
  ["Análisis de visibilidad", "Revisa búsquedas, visitas, posicionamiento y descubrimiento."],
  ["Análisis de promociones", "Entiende las visualizaciones e interacciones de tus ofertas."],
] as const;

export function BusinessProBenefitsDialog({ onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("keydown", escape); previous?.focus(); };
  }, [onClose]);

  return createPortal(<div className="business-pro-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="business-pro-dialog" role="dialog" aria-modal="true" aria-labelledby="business-pro-title">
      <header className="business-pro-header"><div><span>PLAN PARA CRECER</span><h2 id="business-pro-title">XAMUKO Business Pro</h2><p>Más capacidad comercial y herramientas de análisis para tu negocio.</p></div><button ref={closeRef} type="button" aria-label="Cerrar beneficios de Business Pro" onClick={onClose}>×</button></header>
      <section className="business-pro-price" aria-label="Precio de referencia"><div><span>Precio de referencia</span><strong>{formatCop(BUSINESS_PRO_REFERENCE_PRICE)} <small>/ mes</small></strong><p>Pendiente de confirmación definitiva. No genera cobros ni suscripciones.</p></div><span className="business-pro-price-badge">PRÓXIMAMENTE</span></section>
      <section className="business-pro-section"><div className="business-pro-section-heading"><div><span>BENEFICIOS</span><h3>Todo lo que incluye Pro</h3></div><p>Estas capacidades describen el plan; no son estadísticas adicionales.</p></div><div className="business-pro-highlights">{highlights.map(([title, description]) => <article key={title}><span aria-hidden="true">✓</span><div><h4>{title}</h4><p>{description}</p></div></article>)}</div></section>
      <section className="business-pro-section"><div className="business-pro-section-heading"><div><span>COMPARACIÓN</span><h3>Business Básico y Pro</h3></div></div><div className="business-pro-comparison" role="table" aria-label="Comparación de planes"><div role="row" className="business-pro-comparison-head"><span role="columnheader">Característica</span><span role="columnheader">Básico</span><span role="columnheader">Pro</span></div><div role="row"><span role="cell">Precio</span><span role="cell">Gratis</span><span role="cell">{formatCop(BUSINESS_PRO_REFERENCE_PRICE)}/mes</span></div><div role="row"><span role="cell">Productos</span><span role="cell">Según nivel</span><span role="cell">Ilimitados</span></div><div role="row"><span role="cell">Servicios</span><span role="cell">Según nivel</span><span role="cell">Ilimitados</span></div><div role="row"><span role="cell">Ofertas activas</span><span role="cell">3</span><span role="cell">Ilimitadas</span></div><div role="row"><span role="cell">Programar ofertas</span><span role="cell">No</span><span role="cell">Sí</span></div><div role="row"><span role="cell">Estadísticas generales</span><span role="cell">5</span><span role="cell">23</span></div><div role="row"><span role="cell">Estadísticas por nivel</span><span role="cell">Sí</span><span role="cell">Sí</span></div></div></section>
      <section className="business-pro-section"><div className="business-pro-section-heading"><div><span>RECONOCIMIENTO</span><h3>Descuentos y estadísticas por nivel</h3></div><p>El descuento se aplicará cuando el nivel del negocio esté sincronizado.</p></div><div className="business-pro-levels">{recognitionLevels.map(level => { const discountedPrice = Math.round(BUSINESS_PRO_REFERENCE_PRICE * (1 - level.proDiscount / 100)); return <article key={level.level}><div><h4>{level.name}</h4><small>{level.proDiscount}% de descuento</small></div><strong>{formatCop(discountedPrice)}<small>/mes</small></strong><p>Business Básico: hasta {level.productLimit} productos y {level.serviceLimit} servicios.</p>{level.exclusiveStatistic && <p className="business-pro-level-stat">★ {level.exclusiveStatistic}</p>}</article>; })}</div><p className="business-pro-level-note">Las estadísticas por nivel son acumulativas e independientes de Business Pro.</p></section>
      <footer className="business-pro-actions"><button type="button" className="outline-button" onClick={onClose}>Cerrar</button><button type="button" className="action-button" disabled title="La contratación estará disponible próximamente">Contratación próximamente</button></footer>
    </section>
  </div>, document.body);
}
