import { useEffect, useId, useState } from "react";
import type { Business } from "../data/mockData";
import { PioneerBadge } from "./PioneerBadge";
import xamukoLogo from "../assets/XAMUKO-V1-transparent.png";
import "./PublicBusinessDigitalCard.css";
import { generatePublicBusinessQrPng } from "../utils/publicBusinessQr";

function CardArtwork() {
  const id = useId().replace(/:/g, "");
  return <svg className="public-digital-card__artwork" viewBox="0 0 264 414" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <linearGradient id={`${id}-top`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#873cff" /><stop offset="1" stopColor="#6432ff" /></linearGradient>
      <linearGradient id={`${id}-wave`} x1="0" y1="0" x2="1" y2=".4"><stop stopColor="#803aff" /><stop offset=".55" stopColor="#5e41ff" /><stop offset="1" stopColor="#28b7fa" /></linearGradient>
      <linearGradient id={`${id}-bottom`} x1="0" y1="0" x2="1" y2=".1"><stop stopColor="#2d65ff" /><stop offset="1" stopColor="#7e39ff" /></linearGradient>
    </defs>
    <rect width="264" height="414" fill="#fff" />
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
  </svg>;
}

function CardIcon({ name }: { name: "store" | "pin" }) {
  const paths = {
    store: "M3 10h18l-2-6H5l-2 6Zm1 0v10h16V10M9 20v-6h6v6M3 10c0 3 4 3 4 0 0 3 5 3 5 0 0 3 5 3 5 0 0 3 4 3 4 0",
    pin: "M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Zm-5 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}

export function PublicBusinessDigitalCard({ business }: { business: Business }) {
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setQrImageUrl(null);
    setQrError(false);
    void generatePublicBusinessQrPng(business.id).then((image) => {
      if (!cancelled) setQrImageUrl(image);
    }).catch(() => {
      if (!cancelled) setQrError(true);
    });
    return () => { cancelled = true; };
  }, [business.id]);
  const qrReady = Boolean(qrImageUrl);
  return <article className={`public-digital-card${business.name.length > 25 ? " public-digital-card--long-name" : ""}`} aria-label={`Tarjeta XAMUKO de ${business.name}`}>
    <CardArtwork />
    <div className="public-digital-card__brand"><img src={xamukoLogo} alt="XAMUKO · Descubre · Apoya · Disfruta" /></div>
    <div className="public-digital-card__avatar">
      {business.logo ? <img src={business.logo} alt={`Imagen de ${business.name}`} /> : <span aria-hidden="true"><CardIcon name="store" /></span>}
    </div>
    <div className="public-digital-card__identity"><h3 title={business.name}>{business.name}</h3><PioneerBadge pioneerNumber={business.pioneerNumber} /></div>
    <div className="public-digital-card__meta">
      {business.category && <span title={business.category}><CardIcon name="store" /><span className="public-digital-card__meta-text">{business.category}</span></span>}
      {business.city && <span title={business.city}><CardIcon name="pin" /><span className="public-digital-card__meta-text">{business.city}</span></span>}
    </div>
    <div className={`public-digital-card__qr${qrReady ? " is-ready" : ""}`} aria-label={qrReady ? "Código QR de la ficha pública" : "Código QR en preparación"}>{qrReady ? <img src={qrImageUrl!} alt="Código QR de la ficha pública" /> : <span className="public-digital-card__qr-placeholder"><span>QR</span><small>{qrError ? "No disponible" : "Generando…"}</small></span>}</div>
    <strong className="public-digital-card__scan">Escanéame y descubre<br />nuestro negocio</strong>
    <div className="public-digital-card__footer">Descubre · Apoya · Disfruta</div>
  </article>;
}
