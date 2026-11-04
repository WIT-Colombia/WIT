import type { BusinessDetails } from "../types/business";

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

async function drawInlineSvg(ctx: CanvasRenderingContext2D, element: SVGSVGElement, x: number, y: number, width: number, height: number) {
  const clone = element.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  const blob = new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const image = await loadImage(url);
    ctx.drawImage(image, x, y, width, height);
  } finally {
    URL.revokeObjectURL(url);
  }
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

function fitText(ctx: CanvasRenderingContext2D, value: string, maxWidth: number) {
  let text = value.trim();
  while (text.length > 1 && ctx.measureText(text).width > maxWidth) {
    text = text.slice(0, -1).trimEnd();
  }
  return text === value.trim() ? text : text.trimEnd() + "…";
}

function nameLines(ctx: CanvasRenderingContext2D, value: string, maxWidth: number): string[] {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return ["Mi negocio"];
  const lines: string[] = [];
  for (const word of words) {
    const current = lines[lines.length - 1];
    if (current && ctx.measureText(current + " " + word).width <= maxWidth) lines[lines.length - 1] = current + " " + word;
    else lines.push(word);
  }
  if (lines.length > 2) return [fitText(ctx, lines[0], maxWidth), fitText(ctx, lines.slice(1).join(" "), maxWidth)];
  return lines.map(line => fitText(ctx, line, maxWidth));
}

function drawBusinessIdentity(ctx: CanvasRenderingContext2D, business: BusinessDetails, dark: boolean) {
  ctx.fillStyle = dark ? "#ffffff" : NAVY;
  const longName = business.name.length > 25;
  ctx.font = "750 " + (longName ? "14" : "17") + "px Arial, sans-serif";
  const lines = nameLines(ctx, business.name, 236);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const lineHeight = longName ? 16 : 20;
  const start = lines.length === 1 ? 157 : 150;
  lines.forEach((line, index) => ctx.fillText(line, 132, start + index * lineHeight));
  const pioneer = business.pioneerNumber;
  if (Number.isInteger(pioneer) && pioneer! >= 1 && pioneer! <= 20) {
    ctx.fillStyle = "#d5a31a";
    ctx.beginPath();
    ctx.arc(87, 185, 5, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = dark ? "#e1d5ff" : PURPLE;
    ctx.font = "700 11px Arial, sans-serif";
    ctx.fillText("Pionero #" + String(pioneer).padStart(3, "0"), 142, 185);
  } else if (business.sede?.trim()) {
    ctx.fillStyle = dark ? "#e5eaf1" : NAVY;
    ctx.font = "600 10px Arial, sans-serif";
    ctx.fillText(fitText(ctx, business.sede, 224), 132, 184);
  }
}

function drawBusinessMeta(ctx: CanvasRenderingContext2D, business: BusinessDetails, dark: boolean) {
  const category = business.category.trim() || "Negocio";
  const city = business.city.trim();
  ctx.font = "11px Arial, sans-serif";
  const gap = city ? 24 : 0;
  const categoryMax = city ? 156 : 225;
  const visibleCategory = fitText(ctx, category, categoryMax);
  const visibleCity = city ? fitText(ctx, city, 76) : "";
  const categoryWidth = ctx.measureText(visibleCategory).width;
  const cityWidth = ctx.measureText(visibleCity).width;
  const total = categoryWidth + cityWidth + gap;
  const left = (264 - total) / 2;
  ctx.textBaseline = "middle";
  ctx.fillStyle = dark ? "#e5eaf1" : "#445778";
  ctx.textAlign = "left";
  ctx.fillText(visibleCategory, left, 207);
  if (visibleCity) {
    const pinX = left + categoryWidth + 9;
    ctx.strokeStyle = dark ? "#a99aff" : PURPLE;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(pinX + 4, 205, 3.2, 0, Math.PI * 2);
    ctx.moveTo(pinX + 1.5, 208);
    ctx.lineTo(pinX + 4, 213);
    ctx.lineTo(pinX + 6.5, 208);
    ctx.stroke();
    ctx.fillText(visibleCity, left + categoryWidth + gap, 207);
  }
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
  const background = card.querySelector<SVGSVGElement>(".business-digital-card__artwork");
  if (!background) throw new Error("No se encontró el diseño original de la tarjeta.");
  const logoUrl = getSourceImage(card, ".business-digital-card__logo:not(.business-digital-card__logo--light)");
  if (!logoUrl) throw new Error("No se encontró el logotipo oficial de XAMUKO.");
  const avatarUrl = getSourceImage(card, ".business-digital-card__photo");
  if (business.profilePhotoId && !avatarUrl) throw new Error("Espera a que cargue la fotografía del negocio antes de descargar.");
  const [logo, qr, avatar] = await Promise.all([
    loadImage(logoUrl),
    loadImage(qrImageUrl),
    avatarUrl ? loadImage(avatarUrl) : Promise.resolve(null),
  ]);
  const canvas = document.createElement("canvas");
  canvas.width = BUSINESS_CARD_PRINT.widthPx;
  canvas.height = BUSINESS_CARD_PRINT.heightPx;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Tu navegador no pudo preparar la imagen para impresión.");
  ctx.scale(canvas.width / DESIGN_WIDTH, canvas.height / DESIGN_HEIGHT);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT, 16);
  ctx.clip();
  await drawInlineSvg(ctx, background, 0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
  const dark = card.classList.contains("business-digital-card--platinum") || card.classList.contains("business-digital-card--diamond");
  drawContained(ctx, logo, 53, 17, 158, 44);
  const medal = card.querySelector<SVGSVGElement>(".business-digital-card__medal");
  if (medal) await drawInlineSvg(ctx, medal, 189, 7, 72, 88);
  drawAvatar(ctx, avatar, dark);
  drawBusinessIdentity(ctx, business, dark);
  drawBusinessMeta(ctx, business, dark);
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

export async function downloadBusinessCard({ card, business, qrImageUrl, format }: BusinessCardDownloadOptions): Promise<void> {
  const canvas = await renderBusinessCardCanvas(card, business, qrImageUrl);
  const blob = format === "png"
    ? await canvasToBlob(canvas, "image/png")
    : await businessCardPdfFromJpeg(await canvasToBlob(canvas, "image/jpeg", 0.96));
  const safeId = (business.publicId || business.id || "negocio").replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 70);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "XAMUKO-" + safeId + "-15x23.5cm." + format;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10000);
}