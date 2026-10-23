import { useId, useState } from "react";
import xamukoLogo from "../../assets/XAMUKO-V1-transparent.png";
import type { BusinessDetails } from "../../types/business";
import { formatCategoryName } from "../../services/realBusinessAdapter";
import { PersistedPhoto } from "../common/PersistedPhoto";
import { PioneerBadge } from "../PioneerBadge";
import "./BusinessDigitalCard.css";

export type BusinessCardLevel = "BASIC" | "BRONZE" | "SILVER" | "GOLD" | "PLATINUM" | "DIAMOND";

const levelLabels: Record<BusinessCardLevel, string> = {
  BASIC: "Principiante", BRONZE: "Bronce", SILVER: "Plata", GOLD: "Oro", PLATINUM: "Platino", DIAMOND: "Diamante",
};
const themeColors: Record<BusinessCardLevel, [string, string, string]> = {
  BASIC: ["#793bff", "#2858ff", "#23c6ff"],
  BRONZE: ["#7d2e10", "#c57535", "#ffe0b6"],
  SILVER: ["#485a6b", "#9aa8b6", "#f1f5f8"],
  GOLD: ["#986000", "#deb038", "#fff0a6"],
  PLATINUM: ["#0c151c", "#596c7c", "#e4edf4"],
  DIAMOND: ["#073251", "#128bea", "#4ee9ff"],
};

type CardIconName = "store" | "category" | "scissors" | "pin" | "download" | "print" | "share";
function CardIcon({ name }: { name: CardIconName }) {
  const paths: Record<CardIconName, string> = {
    store: "M3 10h18l-2-6H5l-2 6Zm1 0v10h16V10M9 20v-6h6v6M3 10c0 3 4 3 4 0 0 3 5 3 5 0 0 3 5 3 5 0 0 3 4 3 4 0",
    category: "M20 13 13 20a2 2 0 0 1-3 0L3 13V4h9l8 6a2 2 0 0 1 0 3ZM7.5 8h.01",
    scissors: "M9 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM9 17a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM8 9l12 11M8 15 20 3M13 12l-3-3",
    pin: "M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Zm-5 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
    download: "M12 3v12m-5-5 5 5 5-5M4 15v6h16v-6",
    print: "M6 9V3h12v6M6 18H3v-8h18v8h-3M6 14h12v8H6v-8Zm11-2h.01",
    share: "m8 11 8-5m-8 7 8 5M9 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM21 5a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM21 19a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}

/** Vector artwork keeps the six finishes sharp at every card size. */
function CardArtwork({ level }: { level: BusinessCardLevel }) {
  const id = useId().replace(/:/g, "");
  const [shadow, mid, light] = themeColors[level];
  const basic = level === "BASIC";
  const dark = level === "PLATINUM" || level === "DIAMOND";
  const diamond = level === "DIAMOND";
  return <svg className="business-digital-card__artwork" viewBox="0 0 264 414" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <linearGradient id={`${id}-paper`} x1="0" y1="0" x2="1" y2="1"><stop stopColor={dark ? "#172530" : "#ffffff"} /><stop offset=".55" stopColor={dark ? "#111b24" : "#ffffff"} /><stop offset="1" stopColor={dark ? "#050e18" : "#f8f9ff"} /></linearGradient>
      <linearGradient id={`${id}-metal`} x1="0" y1="0" x2="1" y2="1"><stop stopColor={shadow} /><stop offset=".22" stopColor={light} /><stop offset=".4" stopColor={mid} /><stop offset=".56" stopColor={light} /><stop offset=".74" stopColor={mid} /><stop offset="1" stopColor={shadow} /></linearGradient>
      <linearGradient id={`${id}-top`} x1="0" y1="0" x2="1" y2="1"><stop stopColor={basic ? "#873cff" : mid} /><stop offset="1" stopColor={basic ? "#6432ff" : shadow} /></linearGradient>
      <linearGradient id={`${id}-wave`} x1="0" y1="0" x2="1" y2=".4"><stop stopColor={basic ? "#803aff" : shadow} /><stop offset=".55" stopColor={basic ? "#5e41ff" : mid} /><stop offset="1" stopColor={basic ? "#28b7fa" : light} /></linearGradient>
      <linearGradient id={`${id}-bottom`} x1="0" y1="0" x2="1" y2=".1"><stop stopColor={basic ? "#2d65ff" : shadow} /><stop offset="1" stopColor={basic ? "#7e39ff" : shadow} /></linearGradient>
      <linearGradient id={`${id}-neon`} x1="0" y1="1" x2="1" y2="0"><stop stopColor="#7643ff" /><stop offset=".45" stopColor="#12367c" /><stop offset="1" stopColor="#00d9ff" /></linearGradient>
    </defs>
    <rect width="264" height="414" fill={`url(#${id}-paper)`} />
    {basic ? <>
      <path d="M0 0H87C61 31 31 35 0 66Z" fill="#f1edff" />
      <path d="M0 0H61C47 23 19 36 0 55Z" fill={`url(#${id}-top)`} />
      <path d="M92 0C52 56 40 69 0 113V86C40 52 55 30 67 0Z" fill="#faf8ff" />
      <path d="M86 0C67 43 26 82 0 117M0 283C38 310 60 347 88 360M264 191C248 228 217 240 202 271" fill="none" stroke="#e9e5ff" strokeWidth=".8" />
      <path d="M264 199C245 234 204 235 188 272 173 307 180 341 150 365 223 370 264 329 264 329Z" fill="#f4f2ff" />
      <path d="M0 274C40 298 51 337 94 353 49 357 20 330 0 321Z" fill="#f6f4ff" />
      <path d="M158 366C208 343 218 295 264 285V414H108Z" fill="#29b8fc" />
      <path d="M0 304C40 325 61 366 111 369 175 375 218 334 264 353V414H0Z" fill={`url(#${id}-wave)`} />
      <path d="M0 377C48 352 78 383 132 372 196 359 218 337 264 352V414H0Z" fill={`url(#${id}-bottom)`} />
      <path d="M0 399C60 415 102 415 141 414H0Z" fill="#22bbff" opacity=".45" />
    </> : <>
      <path d="M0 0H67L0 79Z" fill={`url(#${id}-metal)`} />
      <path d="M0 20 19 0H77L0 91Z" fill={light} opacity=".32" />
      <path d="M0 77 66 0M0 99 88 0" fill="none" stroke={light} strokeWidth=".85" opacity=".65" />
      <path d="M0 170 38 209 0 248Z" fill={`url(#${id}-metal)`} opacity={dark ? ".45" : ".7"} />
      <path d="M0 208 60 267 0 337Z" fill={`url(#${id}-metal)`} />
      <path d="M0 232 42 275 0 328Z" fill={light} opacity=".26" />
      <path d="M264 168 229 210 264 250Z" fill={`url(#${id}-metal)`} opacity=".48" />
      <path d="M264 224 200 294 264 359Z" fill={`url(#${id}-metal)`} opacity=".82" />
      <path d="M264 258 222 305 264 350Z" fill={light} opacity=".25" />
      <path d="M0 303C44 320 51 361 105 369 161 378 208 356 264 349V414H0Z" fill={`url(#${id}-wave)`} />
      <path d="M0 367C64 347 85 380 131 374 181 367 228 348 264 365V414H0Z" fill={`url(#${id}-bottom)`} />
      <path d="M0 219 46 266 0 319M264 245 214 299 264 348M0 366C52 349 88 379 132 373 185 367 226 348 264 364" fill="none" stroke={light} strokeWidth=".75" opacity=".72" />
      {dark && <path d="M23 0 0 27M58 0 0 63M0 169 38 209 0 249M264 200 225 245 264 286M264 289 209 355" fill="none" stroke={light} strokeWidth=".55" opacity=".6" />}
      {diamond && <>
        <path d="M0 64 67 0H96L0 109ZM0 260 56 325 0 354ZM264 200 222 253 264 280Z" fill={`url(#${id}-neon)`} />
        <path d="M0 39 39 0M0 279 58 338 77 347M264 274 222 322 209 356M264 184 231 226" fill="none" stroke="#35dfff" strokeWidth="1.3" opacity=".85" />
        <path d="M0 301 25 324 11 345 0 326M264 310 237 341 255 354 264 339Z" fill="#6a48ff" opacity=".8" />
      </>}
    </>}
  </svg>;
}

function LevelMedal({ level }: { level: Exclude<BusinessCardLevel, "BASIC"> }) {
  const id = useId().replace(/:/g, "");
  const [shadow, mid, light] = themeColors[level];
  const points = Array.from({ length: 80 }, (_, index) => {
    const angle = index * Math.PI / 40 - Math.PI / 2;
    const radius = index % 2 ? 29.5 : 31.5;
    return `${40 + Math.cos(angle) * radius},${34 + Math.sin(angle) * radius}`;
  }).join(" ");
  return <svg className="business-digital-card__medal" viewBox="0 0 80 88" role="img" aria-label={`Nivel ${levelLabels[level]}`}>
    <defs>
      <linearGradient id={`${id}-medal`} x1="0" y1="0" x2="1" y2="1"><stop stopColor={light} /><stop offset=".2" stopColor={mid} /><stop offset=".45" stopColor={light} /><stop offset=".72" stopColor={mid} /><stop offset="1" stopColor={shadow} /></linearGradient>
      <linearGradient id={`${id}-ribbon`} x1="0" y1="0" x2="0" y2="1"><stop stopColor={mid} /><stop offset="1" stopColor={shadow} /></linearGradient>
      <linearGradient id={`${id}-gem`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#edffff" /><stop offset=".4" stopColor="#63ddff" /><stop offset="1" stopColor="#1574d4" /></linearGradient>
    </defs>
    {level === "DIAMOND" ? <>
      <path d="M8 20 23 5H57L72 20 40 58Z" fill={`url(#${id}-gem)`} stroke="#c1faff" strokeWidth="1" />
      <path d="M8 20H72M23 5 30 20 40 58 50 20 57 5M23 5 40 20 57 5M30 20 40 5 50 20" fill="none" stroke="#b7f3ff" strokeWidth=".85" />
      <path d="M8 20 30 20 23 5ZM50 20H72L40 58Z" fill="#26b3ed" opacity=".55" />
      <path d="M30 20 40 5 50 20Z" fill="#e0ffff" opacity=".7" />
      <path d="M14 52 6 67 19 67 17 75 34 69H60L70 61 65 51 54 55Z" fill="#168ce2" stroke="#68dcff" strokeWidth=".7" />
      <text x="40" y="64" textAnchor="middle" fill="white" fontSize="8" fontWeight="800" fontFamily="Arial,sans-serif">DIAMANTE</text>
    </> : <>
      <path d="M17 50 13 81 26 75 35 84 40 55 47 83 55 75 68 81 62 49Z" fill={`url(#${id}-ribbon)`} stroke={light} strokeWidth=".6" />
      <polygon points={points} fill={`url(#${id}-medal)`} stroke={shadow} strokeWidth=".8" />
      <circle cx="40" cy="34" r="27" fill="none" stroke={light} strokeWidth="1.4" />
      <circle cx="40" cy="34" r="24" fill={`url(#${id}-ribbon)`} stroke={shadow} strokeWidth=".6" />
      <circle cx="40" cy="34" r="22" fill={`url(#${id}-medal)`} stroke={light} strokeWidth=".75" />
      <path d="m40 14 5.8 11.9L59 28l-9.6 9.3 2.3 13.2L40 44.3l-11.7 6.2 2.3-13.2L21 28l13.2-2.1Z" fill={`url(#${id}-medal)`} stroke={shadow} strokeWidth="1" />
      <path d="m40 16 0 15-17-2M40 31l9 6-9 5-10 7M40 31l10 6" fill="none" stroke={light} strokeWidth=".7" opacity=".8" />
      <path d="M13 59 22 55 40 59 60 55 69 59 67 71 40 74 15 70Z" fill={`url(#${id}-ribbon)`} stroke={light} strokeWidth=".7" />
      <text x="40" y="68" textAnchor="middle" fill={light} fontSize="7.8" fontWeight="800" fontFamily="Arial,sans-serif">{levelLabels[level].toLocaleUpperCase("es-CO")}</text>
    </>}
  </svg>;
}

function CardAvatar({ src }: { src?: string }) {
  const [failed, setFailed] = useState(false);
  return <div className="business-digital-card__avatar" onErrorCapture={() => setFailed(true)}>
    <span className="business-digital-card__avatar-fallback" role="img" aria-label="Establecimiento"><CardIcon name="store" /></span>
    {src && !failed && <PersistedPhoto src={src} alt="Imagen del establecimiento" className="business-digital-card__photo" />}
  </div>;
}

type Props = { business: BusinessDetails; level?: BusinessCardLevel; publicUrl?: string | null; qrImageUrl?: string | null; founderNumber?: number | null };

export function BusinessCardFace({ business, level = "BASIC", publicUrl = null, qrImageUrl = null, founderNumber = null }: Props) {
  const hasPublicDestination = Boolean(publicUrl?.trim() && qrImageUrl?.trim());
  const sede = business.sede?.trim();
  const sedeLabel = sede ? (/^sede\b/i.test(sede) ? sede : `Sede ${sede}`) : null;
  const hasFounder = Number.isInteger(founderNumber) && founderNumber! >= 1 && founderNumber! <= 20;
  const businessImage = business.profilePhotoId ? business.profileImage : undefined;
  return <article className={`business-digital-card business-digital-card--${level.toLowerCase()}${business.name.length > 25 ? " business-digital-card--long-name" : ""}`} aria-label={`Tarjeta XAMUKO de ${business.name}`}>
    <CardArtwork level={level} />
    <div className="business-digital-card__brand"><img className="business-digital-card__logo" src={xamukoLogo} alt="XAMUKO · Descubre · Apoya · Disfruta" /><img className="business-digital-card__logo business-digital-card__logo--light" src={xamukoLogo} alt="" aria-hidden="true" /></div>
    {level !== "BASIC" && <LevelMedal level={level} />}
    <CardAvatar key={`${business.id ?? ""}:${business.profilePhotoId ?? ""}`} src={businessImage} />
    <div className="business-digital-card__identity">
      <h3 title={business.name}>{business.name}</h3>
      <PioneerBadge pioneerNumber={business.pioneerNumber} />
      {sedeLabel && <p>{sedeLabel}</p>}
    </div>
    <div className="business-digital-card__meta">
      {business.category && <span title={formatCategoryName(business.category)}><CardIcon name={/barber|peluquer/i.test(business.category) ? "scissors" : "store"} /><span className="business-digital-card__meta-text">{formatCategoryName(business.category)}</span></span>}
      {business.city && <span title={business.city}><CardIcon name="pin" /><span className="business-digital-card__meta-text">{business.city}</span></span>}
    </div>
    <div className={`business-digital-card__qr${hasPublicDestination ? " is-ready" : ""}`} aria-label={hasPublicDestination ? "Código QR de la ficha pública" : "Código QR pendiente de publicación"}>
      {hasPublicDestination ? <img src={qrImageUrl!} alt="Código QR de la ficha pública" /> : <span className="business-digital-card__qr-placeholder"><span>QR</span><small>Próximamente</small></span>}
    </div>
    <strong className="business-digital-card__scan">Escanéame y descubre<br />nuestro negocio</strong>
    {hasFounder && <span className="business-digital-card__founder">FUNDADOR #{String(founderNumber).padStart(3, "0")}</span>}
    <div className="business-digital-card__footer">Descubre · Apoya · Disfruta</div>
  </article>;
}

export function BusinessDigitalCard(props: Props) {
  const { publicUrl = null, qrImageUrl = null } = props;
  const hasPublicDestination = Boolean(publicUrl?.trim() && qrImageUrl?.trim());
  const actionUnavailable = "Disponible cuando exista una ficha pública";
  return <div className="business-card-preview">
    <div className="business-card-preview__layout">
      <BusinessCardFace {...props} />
      <div className="business-card-preview__details">
        <div className="business-card-preview__intro"><h3>Vista previa de tu tarjeta</h3><p>Así se verá tu tarjeta con código QR. Podrás descargarla, imprimirla o compartirla.</p></div>
        <div className="business-card-preview__notice" role="status"><span className="business-card-preview__info" aria-hidden="true">i</span><p>{hasPublicDestination ? "Este código QR lleva al perfil público de tu negocio en XAMUKO. Mantendrá el mismo enlace aunque cambie tu nivel." : "El código QR estará disponible cuando se publique la ficha de tu negocio en XAMUKO. Mantendrá el mismo enlace aunque cambie tu nivel."}</p></div>
        <div className="business-card-preview__actions">
          <button className="business-card-action business-card-action--download" type="button" disabled={!hasPublicDestination} title={hasPublicDestination ? "Descargar tarjeta" : actionUnavailable}><CardIcon name="download" /><span><strong>Descargar</strong><small>PDF en alta calidad</small></span></button>
          <button className="business-card-action" type="button" disabled={!hasPublicDestination} title={hasPublicDestination ? "Imprimir tarjeta" : actionUnavailable}><CardIcon name="print" /><span><strong>Imprimir</strong><small>Lista para tu negocio</small></span></button>
          <button className="business-card-action" type="button" disabled={!hasPublicDestination} title={hasPublicDestination ? "Compartir tarjeta" : actionUnavailable}><CardIcon name="share" /><span><strong>Compartir</strong><small>En redes sociales</small></span></button>
        </div>
      </div>
    </div>
  </div>;
}
