import type { BusinessDetails } from "../types/business";
import { formatCategoryName } from "../services/realBusinessAdapter";

/** Exact print trim: 150 × 235 mm, portrait, at approximately 300 dpi. */
export const BUSINESS_CARD_PRINT = {
  widthMm: 150,
  heightMm: 235,
  widthPx: 1772,
  heightPx: 2776,
} as const;

export type BusinessCardDownloadFormat = "pdf" | "png";

type BusinessCardDownloadOptions = {
  card: HTMLElement;
  business: BusinessDetails;
  qrImageUrl: string;
  format: BusinessCardDownloadFormat;
};

const DESIGN_WIDTH = 264;
const DESIGN_HEIGHT = 414;
const NAVY = "#091632";
const PURPLE = "#7b3ffb";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("No fue posible cargar una imagen de la tarjeta."));
    image.src = src;
  });
}

async function drawInlineSvg(ctx: CanvasRenderingContext2D, source: SVGSVGElement, x: number, y: number, width: number, height: number) {
  // The six approved card artworks are drawn as SVG, without mobile HTML/CSS.
  const svg = source.cloneNode(true) as SVGSVGElement;
  svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  svg.style.color = getComputedStyle(source).color;
  const image = await loadImage("data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(svg)));
  ctx.drawImage(image, x, y, width, height);
}

function drawContained(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number, height: number) {
  const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  ctx.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
}

function drawAvatar(ctx: CanvasRenderingContext2D, image: HTMLImageElement | null, dark: boolean) {
  const x = 99;
  const y = 69;
  const size = 66;
  ctx.save();
  ctx.shadowColor = "#17253a40";
  ctx.shadowBlur = 5;
  ctx.fillStyle = dark ? "#1c344a" : "#eff0f6";
  ctx.beginPath();
  ctx.arc(132, 102, size / 2, 0, 2 * Math.PI);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.arc(132, 102, size / 2 - 1, 0, 2 * Math.PI);
  ctx.clip();
  if (image) {
    const scale = Math.max(size / image.naturalWidth, size / image.naturalHeight);
    const w = image.naturalWidth * scale;
    const h = image.naturalHeight * scale;
    ctx.drawImage(image, x + (size - w) / 2, y + (size - h) / 2, w, h);
  } else {
    ctx.fillStyle = dark ? "#153e59" : "#e6e9f9";
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = dark ? "#ffffff" : PURPLE;
    ctx.font = "700 27px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("X", 132, 102);
  }
  ctx.restore();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(132, 102, size / 2, 0, 2 * Math.PI);
  ctx.stroke();
}

function nameLines(ctx: CanvasRenderingContext2D, value: string, maxWidth: number): string[] {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2 || ctx.measureText(value).width <= maxWidth) return [value.trim() || "Mi negocio"];
  let best = 1, minimum = Infinity;
  for (let i = 1; i < words.length; i++) {
    const width = Math.max(ctx.measureText(words.slice(0, i).join(" ")).width, ctx.measureText(words.slice(i).join(" ")).width);
    if (width < minimum) { minimum = width; best = i; }
  }
  return [words.slice(0, best).join(" "), words.slice(best).join(" ")];
}

function drawBusinessIdentity(ctx: CanvasRenderingContext2D, business: BusinessDetails, dark: boolean) {
  ctx.fillStyle = dark ? "#ffffff" : NAVY;
  const longName = business.name.length > 25;
  ctx.font = "750 " + (longName ? "14" : "17") + "px Arial, sans-serif";
  const lines = nameLines(ctx, business.name, 230);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const lineHeight = longName ? 16 : 20;
  const start = lines.length === 1 ? 153 : 145;
  lines.forEach((line, i) => ctx.fillText(line, 132, start + i * lineHeight, 230));

  const pioneer = business.pioneerNumber;
  const hasPioneer = Number.isInteger(pioneer) && pioneer! >= 1 && pioneer! <= 20;
  if (hasPioneer) {
    const label = "Pionero #" + String(pioneer).padStart(3, "0");
    ctx.font = "700 11px Arial, sans-serif";
    const x = (264 - ctx.measureText(label).width - 19) / 2;
    ctx.font = "14px Arial, sans-serif";
    ctx.fillText("🥇", x + 7, 181);
    ctx.fillStyle = dark ? "#e1d5ff" : PURPLE;
    ctx.font = "700 11px Arial, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(label, x + 19, 181);
    ctx.textAlign = "center";
  }
  const sede = business.sede?.trim();
  if (sede) {
    ctx.fillStyle = dark ? "#e5eaf1" : NAVY;
    ctx.font = "600 9px Arial, sans-serif";
    ctx.fillText(/^sede\b/i.test(sede) ? sede : "Sede " + sede, 132, hasPioneer ? 194 : 184, 225);
  }
}

async function drawBusinessMeta(ctx: CanvasRenderingContext2D, card: HTMLElement, business: BusinessDetails, dark: boolean) {
  // Draw the complete category and city; neither text is taken from the
  // narrow preview DOM (where CSS ellipsis may truncate it).
  const category = business.category?.trim() ? formatCategoryName(business.category) : "Negocio";
  const city = business.city?.trim() || "";
  const icons = Array.from(card.querySelectorAll<SVGSVGElement>(".business-digital-card__meta > span svg"));
  const iconW = 13, iconGap = 4, between = 14;
  ctx.font = "500 10.5px Arial, sans-serif";
  const measuredCategory = ctx.measureText(category).width, measuredCity = ctx.measureText(city).width;
  const iconCount = city ? 2 : 1;
  const textSpace = 224 - iconCount * (iconW + iconGap) - (city ? between : 0);
  const textWidth = Math.min(textSpace, measuredCategory + measuredCity);
  const categoryWidth = city
    ? Math.max(52, Math.min(textWidth - 48, textWidth * measuredCategory / (measuredCategory + measuredCity)))
    : textWidth;
  const cityWidth = city ? Math.max(1, textWidth - categoryWidth) : 0;
  const width = textWidth + iconCount * (iconW + iconGap) + (city ? between : 0);
  let x = (264 - width) / 2;
  const y = 207;
  ctx.fillStyle = dark ? "#e5eaf1" : "#445778";
  ctx.textAlign = "left"; ctx.textBaseline = "middle";
  if (icons[0]) await drawInlineSvg(ctx, icons[0], x, y - iconW / 2, iconW, iconW);
  x += iconW + iconGap;
  ctx.fillText(category, x, y, Math.max(1, categoryWidth));
  x += categoryWidth;
  if (city) {
    x += between;
    if (icons[1]) await drawInlineSvg(ctx, icons[1], x, y - iconW / 2, iconW, iconW);
    x += iconW + iconGap;
    ctx.fillText(city, x, y, cityWidth);
  }
  ctx.textAlign = "center";
}

function drawQr(ctx: CanvasRenderingContext2D, qr: HTMLImageElement) {
  ctx.save();
  ctx.shadowColor = "#1826481d";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.roundRect(76, 218, 112, 112, 10);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = "#e4e9f5";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.roundRect(76, 218, 112, 112, 10);
  ctx.stroke();
  // 83 design units / 264 × 150 mm ≈ 47 mm, including the QR's quiet zone.
  ctx.drawImage(qr, 90.5, 232.5, 83, 83);
}

function drawCallToAction(ctx: CanvasRenderingContext2D, dark: boolean) {
  ctx.fillStyle = dark ? "#ffffff" : NAVY;
  ctx.font = "700 11px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Escanéame y descubre", 132, 343);
  ctx.fillText("nuestro negocio", 132, 355);
  ctx.fillStyle = "#fff";
  ctx.font = "500 12.5px Arial, sans-serif";
  ctx.fillText("Descubre · Apoya · Disfruta", 132, 394);
}

function getSourceImage(card: HTMLElement, selector: string) {
  const element = card.querySelector<HTMLImageElement>(selector);
  return element?.currentSrc || element?.src || null;
}

export async function renderBusinessCardCanvas(card: HTMLElement, business: BusinessDetails, qrImageUrl: string): Promise<HTMLCanvasElement> {
  const artwork = card.querySelector<SVGSVGElement>(".business-digital-card__artwork");
  const logoSrc = getSourceImage(card, ".business-digital-card__logo:not(.business-digital-card__logo--light)");
  const photoSrc = getSourceImage(card, ".business-digital-card__photo");
  if (!artwork || !logoSrc) throw new Error("No se encontró el diseño original de la tarjeta.");
  if (business.profilePhotoId && !photoSrc) throw new Error("La fotografía del negocio todavía no está cargada.");

  const [logo, qr, photo] = await Promise.all([
    loadImage(logoSrc), loadImage(qrImageUrl),
    photoSrc ? loadImage(photoSrc) : Promise.resolve(null),
  ]);
  const canvas = document.createElement("canvas");
  canvas.width = BUSINESS_CARD_PRINT.widthPx;
  canvas.height = BUSINESS_CARD_PRINT.heightPx;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("No se pudo preparar la tarjeta para impresión.");
  // Use the original fixed 264 x 414 composition, not responsive DOM geometry.
  ctx.scale(canvas.width / DESIGN_WIDTH, canvas.height / DESIGN_HEIGHT);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
  ctx.save();
  ctx.beginPath(); ctx.roundRect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT, 16); ctx.clip();
  await drawInlineSvg(ctx, artwork, 0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
  const dark = card.classList.contains("business-digital-card--platinum") || card.classList.contains("business-digital-card--diamond");
  const logoX = dark ? 24 : 53, logoY = dark ? 22 : 17, logoW = dark ? 150 : 158;
  drawContained(ctx, logo, logoX, logoY, logoW, 44);
  if (dark) {
    ctx.save(); ctx.beginPath(); ctx.rect(logoX + logoW * .22, logoY, logoW * .78, 44); ctx.clip();
    ctx.filter = "brightness(0) invert(1)";
    drawContained(ctx, logo, logoX, logoY, logoW, 44);
    ctx.restore();
  }
  const medal = card.querySelector<SVGSVGElement>(".business-digital-card__medal");
  if (medal) await drawInlineSvg(ctx, medal, 189, 7, 72, 88);
  drawAvatar(ctx, photo, dark);
  drawBusinessIdentity(ctx, business, dark);
  await drawBusinessMeta(ctx, card, business, dark);
  drawQr(ctx, qr);
  drawCallToAction(ctx, dark);
  ctx.restore();
  return canvas;
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("No se pudo generar el archivo.")), mime, quality);
  });
}

/** Produces a standards-compliant, one-page PDF with an exact 150 × 235 mm MediaBox. */
export async function businessCardPdfFromJpeg(jpeg: Blob): Promise<Blob> {
  const image = new Uint8Array(await jpeg.arrayBuffer());
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  let size = 0;
  const append = (value: string | Uint8Array) => {
    const bytes = typeof value === "string" ? encoder.encode(value) : value;
    chunks.push(bytes);
    size += bytes.length;
  };
  const offsets: number[] = [0];
  const beginObject = (index: number) => { offsets[index] = size; append(String(index) + " 0 obj\n"); };
  const endObject = () => append("endobj\n");
  const widthPt = (BUSINESS_CARD_PRINT.widthMm / 25.4 * 72).toFixed(3);
  const heightPt = (BUSINESS_CARD_PRINT.heightMm / 25.4 * 72).toFixed(3);

  append("%PDF-1.4\n");
  append(new Uint8Array([37, 226, 227, 207, 211, 10]));
  beginObject(1); append("<< /Type /Catalog /Pages 2 0 R >>\n"); endObject();
  beginObject(2); append("<< /Type /Pages /Kids [3 0 R] /Count 1 >>\n"); endObject();
  beginObject(3); append("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + widthPt + " " + heightPt + "] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\n"); endObject();
  beginObject(4);
  append("<< /Type /XObject /Subtype /Image /Width " + BUSINESS_CARD_PRINT.widthPx + " /Height " + BUSINESS_CARD_PRINT.heightPx + " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " + image.length + " >>\nstream\n");
  append(image);
  append("\nendstream\n");
  endObject();
  const painting = "q\n" + widthPt + " 0 0 " + heightPt + " 0 0 cm\n/Im0 Do\nQ\n";
  beginObject(5); append("<< /Length " + encoder.encode(painting).length + " >>\nstream\n" + painting + "endstream\n"); endObject();
  const xref = size;
  append("xref\n0 6\n0000000000 65535 f \n");
  for (let index = 1; index <= 5; index++) append(String(offsets[index]).padStart(10, "0") + " 00000 n \n");
  append("trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF\n");
  const merged = new Uint8Array(size);
  let position = 0;
  for (const chunk of chunks) { merged.set(chunk, position); position += chunk.length; }
  return new Blob([merged.buffer as ArrayBuffer], { type: "application/pdf" });
}

export type PreparedBusinessCard = { blob: Blob; filename: string };

export async function prepareBusinessCard({ card, business, qrImageUrl, format }: BusinessCardDownloadOptions): Promise<PreparedBusinessCard> {
  const shownQr = card.querySelector<HTMLImageElement>(".business-digital-card__qr > img");
  if (!qrImageUrl || !shownQr || !shownQr.complete || !shownQr.naturalWidth) {
    throw new Error("El código QR aún no está listo para descargar.");
  }
  const canvas = await renderBusinessCardCanvas(card, business, qrImageUrl);
  const blob = format === "png"
    ? await canvasToBlob(canvas, "image/png")
    : await businessCardPdfFromJpeg(await canvasToBlob(canvas, "image/jpeg", 0.96));
  const safeId = (business.publicId || business.id || "negocio").replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 70);
  return { blob, filename: "XAMUKO-" + safeId + "-15x23.5cm." + format };
}

/**
 * Prepare both files ahead of a mobile download gesture. Safari needs the
 * download link to have a real href before the user taps it.
 * One canvas render keeps the PDF and PNG visually identical.
 */
export async function prepareBusinessCardDownloads(
  { card, business, qrImageUrl }: Omit<BusinessCardDownloadOptions, "format">,
): Promise<Record<BusinessCardDownloadFormat, PreparedBusinessCard>> {
  const shownQr = card.querySelector<HTMLImageElement>(".business-digital-card__qr > img");
  if (!qrImageUrl || !shownQr || !shownQr.complete || !shownQr.naturalWidth) {
    throw new Error("El código QR aún no está listo para descargar.");
  }
  const canvas = await renderBusinessCardCanvas(card, business, qrImageUrl);
  const png = await canvasToBlob(canvas, "image/png");
  const jpeg = await canvasToBlob(canvas, "image/jpeg", 0.96);
  const pdf = await businessCardPdfFromJpeg(jpeg);
  const safeId = (business.publicId || business.id || "negocio")
    .replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 70);
  const baseName = "XAMUKO-" + safeId + "-15x23.5cm";
  return {
    pdf: { blob: pdf, filename: baseName + ".pdf" },
    png: { blob: png, filename: baseName + ".png" },
  };
}

export async function downloadBusinessCard(options: BusinessCardDownloadOptions): Promise<void> {
  const { blob, filename } = await prepareBusinessCard(options);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}
