import { useEffect, useRef, useState } from "react";
import type { BusinessDetails } from "../../types/business";
import { BusinessCardFace, type BusinessCardLevel } from "./BusinessDigitalCard";
import { recognitionLevelFor, recognitionLevels, recognitionRange } from "../../config/businessRecognition";
import { getPublicBusinessUrl } from "../../config/publicApp";
import { shareLink } from "../../../../usuario/src/utils/share";
import "./BusinessCardPanel.css";

/** Data supplied by the referral integration when valid referrals become available. */
export type BusinessCardPanelData = {
  referredUsers?: number | null;
  currentLevel?: BusinessCardLevel | null;
  referralState?: 'loading' | 'available' | 'unavailable';
  publicUrl?: string | null;
  qrImageUrl?: string | null;
};

const validReferralCount = (value: unknown) => Number.isInteger(value) && typeof value === "number" && value >= 0 ? value : null;

type Props = { business: BusinessDetails; cardData?: BusinessCardPanelData };

export function BusinessCardPanel({ business, cardData }: Props) {
  const [shareMessage, setShareMessage] = useState("");
  const [sharing, setSharing] = useState(false);
  const [benefitsOpen, setBenefitsOpen] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState<BusinessCardLevel>("BASIC");
  const closeBenefitsRef = useRef<HTMLButtonElement>(null);
  const referralState = cardData?.referralState ?? 'unavailable';
  const referredUsers = referralState === 'available' ? validReferralCount(cardData?.referredUsers) : null;
  const hasReferralData = referredUsers !== null;
  const reportedLevel = recognitionLevels.find(item => item.level === cardData?.currentLevel);
  const currentLevel = hasReferralData ? reportedLevel ?? recognitionLevelFor(referredUsers) : recognitionLevels[0];
  const currentIndex = recognitionLevels.findIndex(item => item.level === currentLevel.level);
  const nextLevel = recognitionLevels[currentIndex + 1] ?? null;
  const progressPercent = nextLevel && referredUsers !== null ? Math.min(100, Math.round((referredUsers / nextLevel.min) * 100)) : null;
  const selected = recognitionLevels.find(item => item.level === selectedLevel) ?? recognitionLevels[0];
  const selectedIndex = recognitionLevels.findIndex(item => item.level === selected.level);
  const selectedUnlocked = hasReferralData ? selectedIndex <= currentIndex : null;
  const cumulativeStatistics = recognitionLevels.slice(0, selectedIndex + 1).flatMap(item => item.exclusiveStatistic ? [item.exclusiveStatistic] : []);
  const publicUrl = getPublicBusinessUrl(business.publicId);
  const qrImageUrl = publicUrl ? cardData?.qrImageUrl?.trim() || null : null;

  const share = async () => {
    if (!publicUrl) return;
    setSharing(true); setShareMessage("");
    const result = await shareLink(business.name, `Descubre ${business.name} en XAMUKO.`, publicUrl);
    setShareMessage(result === "copied" ? "Enlace copiado." : result === "unavailable" ? "No se pudo compartir el enlace." : "");
    setSharing(false);
  };

  useEffect(() => {
    if (!benefitsOpen) return;
    setSelectedLevel(currentLevel?.level ?? "BASIC");
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeBenefitsRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setBenefitsOpen(false); };
    document.addEventListener("keydown", closeOnEscape);
    return () => { document.removeEventListener("keydown", closeOnEscape); previous?.focus(); };
  }, [benefitsOpen, currentLevel?.level]);

  return <aside className="business-card-panel" aria-labelledby="business-card-panel-title">
    <div className="business-card-panel-heading"><span aria-hidden="true"><svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M3 9h18M7 14h4M7 17h7" /></svg></span><div><h2 id="business-card-panel-title">Mi tarjeta XAMUKO</h2><p>Comparte tu negocio con la comunidad.</p></div></div>
    <div className="business-card-panel-content">
      {referralState === 'loading' && <p className="business-card-panel-reference">Consultando referidos válidos…</p>}
      <BusinessCardFace business={business} level={currentLevel?.level} publicUrl={publicUrl} qrImageUrl={qrImageUrl} />
      <dl className="business-card-panel-stats"><div><dt>Nivel actual</dt><dd>{hasReferralData ? currentLevel.name : referralState === 'loading' ? 'Cargando…' : 'No disponible'}</dd></div><div><dt>Referidos válidos</dt><dd>{hasReferralData ? referredUsers.toLocaleString("es-CO") : referralState === 'loading' ? 'Cargando…' : 'No disponible'}</dd></div></dl>
      {hasReferralData && nextLevel && progressPercent !== null ? <div className="business-card-panel-progress"><div><span>Siguiente nivel: <strong>{nextLevel.name}</strong></span><strong>{referredUsers.toLocaleString("es-CO")} / {nextLevel.min.toLocaleString("es-CO")}</strong></div><progress max="100" value={progressPercent} aria-label={`Progreso hacia ${nextLevel.name}`} /></div> : hasReferralData ? <p className="business-card-panel-pending">Nivel máximo alcanzado.</p> : <p className="business-card-panel-pending">{referralState === 'loading' ? 'Estamos consultando tu progreso.' : 'No fue posible consultar tus referidos. Intenta recargar la página.'}</p>}
      {(!hasReferralData || !qrImageUrl) && <p className="business-card-panel-notice">{hasReferralData ? '' : referralState === 'loading' ? 'El nivel se actualizará al confirmar los referidos válidos. ' : 'El contador de referidos no está disponible en este momento. '}{!qrImageUrl && "El código QR estará disponible cuando exista una página pública válida."}</p>}
      <div className="business-card-panel-actions"><button type="button" className="action-button" disabled={!publicUrl || sharing} onClick={() => void share()} title={publicUrl ? "Compartir el enlace público de tu tarjeta" : "Disponible cuando exista un enlace público válido"}>{sharing ? "Compartiendo…" : "Compartir tarjeta"}</button><button type="button" className="outline-button" onClick={() => setBenefitsOpen(true)}>Beneficios del nivel</button></div>
      {shareMessage && <p className="business-card-panel-message" role="status">{shareMessage}</p>}
    </div>
    {benefitsOpen && <div className="business-card-benefits-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setBenefitsOpen(false); }}><section className="business-card-benefits-dialog" role="dialog" aria-modal="true" aria-labelledby="business-card-benefits-title"><div className="business-card-benefits-heading"><div><p>{hasReferralData ? `Nivel actual: ${currentLevel.name}` : "Nivel inicial: Principiante"}</p><h3 id="business-card-benefits-title">Beneficios del nivel</h3></div><button ref={closeBenefitsRef} type="button" className="business-card-benefits-close" aria-label="Cerrar beneficios" onClick={() => setBenefitsOpen(false)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button></div><div className="business-card-level-tabs" role="tablist" aria-label="Niveles de reconocimiento">{recognitionLevels.map((item, index) => <button type="button" role="tab" key={item.level} aria-selected={selected.level === item.level} className={`${selected.level === item.level ? "selected" : ""}${currentLevel.level === item.level ? " is-current" : ""}`} onClick={() => setSelectedLevel(item.level)}><span>{currentLevel.level === item.level ? "★ " : hasReferralData && currentIndex >= index ? "✓ " : "🔒 "}{item.name}</span><small>{recognitionRange(item)}</small></button>)}</div><section className="business-card-level-detail" aria-labelledby="selected-card-level-title"><div><p>{recognitionRange(selected)}</p><h4 id="selected-card-level-title">Nivel {selected.name}</h4></div><span className={selectedUnlocked === true ? "is-unlocked" : selectedUnlocked === false ? "is-locked" : "is-pending"}>{selected.level === "BASIC" && currentLevel.level === "BASIC" ? "Nivel actual" : !hasReferralData && selected.level === "BASIC" ? "Nivel inicial" : selectedUnlocked === true ? "✓ Desbloqueado" : selectedUnlocked === false ? "🔒 Pendiente" : "Pendiente de sincronizar"}</span></section><ul className="business-card-benefits-list"><li><strong>Business Básico</strong><p>Productos: hasta {selected.productLimit}. Servicios: hasta {selected.serviceLimit}.</p></li><li><strong>Business Pro</strong><p>{selected.proDiscount}% de descuento en Business Pro.</p></li><li><strong>Estadísticas exclusivas acumuladas</strong><p>Además de las 5 estadísticas gratuitas.</p>{cumulativeStatistics.length ? <ul className={selectedUnlocked === true ? "is-unlocked" : "is-pending"}>{cumulativeStatistics.map(statistic => <li key={statistic}>{statistic}</li>)}</ul> : <p>No hay estadísticas exclusivas en este nivel.</p>}</li></ul>{selected.level !== "DIAMOND" && <p className="business-card-next-level">Para alcanzar {recognitionLevels[selectedIndex + 1].name}: reúne {recognitionLevels[selectedIndex + 1].min.toLocaleString("es-CO")} referidos válidos.</p>}{selected.level === "DIAMOND" && <p className="business-card-next-level">Incluye las cinco estadísticas exclusivas al alcanzar 500 o más referidos válidos.</p>}<button type="button" className="action-button" onClick={() => setBenefitsOpen(false)}>Entendido</button></section></div>}
  </aside>;
}
