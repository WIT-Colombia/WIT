import type { BusinessDetails } from "../types/business";

/** Final printed card dimensions; portrait orientation, approximately 300 dpi. */
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

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("No fue posible cargar el diseño de la tarjeta."));
    image.src = src;
  });
}

/**
 * Foreign-object image export uses the same React card element and computed CSS as
 * the on-screen preview. Never manually re-create its text, artwork or badges:
 * that caused the previous downloaded graphic to differ from the preview.
 */
function copyComputedStyles(source: Element, target: Element): void {
  // The SVG artwork/medals already declare their vector styles in SVG markup.
  // Keep those attributes untouched while resolving their outer layout CSS.
  const isSvg = source instanceof SVGElement;
  if (!isSvg || source.tagName.toLowerCase() === "svg") {
    const computed = window.getComputedStyle(source);
    const targetStyle = (target as HTMLElement | SVGSVGElement).style;
    for (let i = 0; i < computed.length; i++) {
      const property = computed.item(i);
      const value = computed.getPropertyValue(property);
      if (value) targetStyle.setProperty(property, value, computed.getPropertyPriority(property));
    }
  }
  const sourceChildren = source.children;
  const targetChildren = target.children;
  for (let i = 0; i < sourceChildren.length; i++) {
    if (targetChildren[i]) copyComputedStyles(sourceChildren[i], targetChildren[i]);
  }
}

async function inlineImage(source: HTMLImageElement): Promise<string> {
  const existingData = source.currentSrc || source.src;
  if (existingData.startsWith("data:")) return existingData;
  try {
    if (!source.complete || !source.naturalWidth) await source.decode();
    if (!source.naturalWidth || !source.naturalHeight) throw new Error("Sin datos de imagen");

    // Render a browser-loaded image into a self-contained data URL: this also
    // handles private API photo blobs and the AVIF official logo.
    const maxEdge = 1600;
    const ratio = Math.min(1, maxEdge / Math.max(source.naturalWidth, source.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(source.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(source.naturalHeight * ratio));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No hay contexto de imagen");
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  } catch {
    throw new Error("No se pudo incluir la fotografía o el logo. Verifica que estén cargados antes de descargar.");
  }
}

async function clonePrintableCard(card: HTMLElement): Promise<HTMLElement> {
  const clone = card.cloneNode(true) as HTMLElement;
  copyComputedStyles(card, clone);
  const images = Array.from(card.querySelectorAll<HTMLImageElement>("img"));
  const clonedImages = Array.from(clone.querySelectorAll<HTMLImageElement>("img"));
  await Promise.all(images.map(async (original, index) => {
    const target = clonedImages[index];
    if (!target) return;
    target.setAttribute("src", await inlineImage(original));
    target.removeAttribute("srcset");
    target.removeAttribute("loading");
  }));

  const rect = card.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) throw new Error("La tarjeta debe estar visible para descargarse.");
  // Exact border-box size matters: container-query typography and absolute
  // positioning must have the same geometry in the exported illustration.
  clone.style.setProperty("width", rect.width + "px");
  clone.style.setProperty("height", rect.height + "px");
  clone.style.setProperty("box-sizing", "border-box");
  clone.style.setProperty("max-width", "none");
  clone.style.setProperty("margin", "0");
  clone.style.setProperty("box-shadow", "none");
  clone.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
  return clone;
}


type RectOnCard = { x: number; y: number; width: number; height: number };

function relativeRect(element: Element, cardRect: DOMRect): RectOnCard {
  const r = element.getBoundingClientRect();
  return { x: r.left - cardRect.left, y: r.top - cardRect.top, width: r.width, height: r.height };
}

function drawImageFitted(ctx: CanvasRenderingContext2D, image: HTMLImageElement, r: RectOnCard, mode: "contain" | "cover" = "contain") {
  if (!r.width || !r.height) return;
  const scale = (mode === "cover" ? Math.max : Math.min)(r.width / image.naturalWidth, r.height / image.naturalHeight);
  const w = image.naturalWidth * scale, h = image.naturalHeight * scale;
  ctx.drawImage(image, r.x + (r.width - w) / 2, r.y + (r.height - h) / 2, w, h);
}

async function drawEmbeddedSvg(ctx: CanvasRenderingContext2D, source: SVGSVGElement, cardRect: DOMRect): Promise<void> {
  const r = relativeRect(source, cardRect);
  const svg = source.cloneNode(true) as SVGSVGElement;
  svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  svg.setAttribute("width", String(r.width));
  svg.setAttribute("height", String(r.height));
  svg.style.color = getComputedStyle(source).color;
  const xml = new XMLSerializer().serializeToString(svg);
  const bitmap = await loadImage("data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml));
  ctx.drawImage(bitmap, r.x, r.y, r.width, r.height);
}

async function drawDomImage(ctx: CanvasRenderingContext2D, original: HTMLImageElement | null, cardRect: DOMRect) {
  if (!original || getComputedStyle(original).display === "none") return;
  const r = relativeRect(original, cardRect);
  const bitmap = await loadImage(await inlineImage(original));
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.width, r.height);
  ctx.clip();
  const style = getComputedStyle(original);
  if (style.filter !== "none") ctx.filter = style.filter;
  drawImageFitted(ctx, bitmap, r, style.objectFit === "cover" ? "cover" : "contain");
  ctx.restore();
}

function wrapCanvasText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, limit: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines: string[] = [];
  for (const word of words) {
    if (!lines.length) { lines.push(word); continue; }
    const candidate = lines[lines.length - 1] + " " + word;
    if (ctx.measureText(candidate).width <= maxWidth || lines.length >= limit) {
      lines[lines.length - 1] = candidate;
    } else {
      lines.push(word);
    }
  }
  return lines.slice(0, limit).map(line => {
    if (ctx.measureText(line).width <= maxWidth) return line;
    let compact = line;
    while (compact.length > 1 && ctx.measureText(compact + "…").width > maxWidth) compact = compact.slice(0, -1);
    return compact + "…";
  });
}

function drawDomText(ctx: CanvasRenderingContext2D, element: Element | null, cardRect: DOMRect, text?: string, maxLines = 2) {
  if (!element) return;
  const style = getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden") return;
  const r = relativeRect(element, cardRect);
  if (!r.width || !r.height) return;
  const fontSize = Number.parseFloat(style.fontSize) || 12;
  const lineHeight = Number.parseFloat(style.lineHeight) || fontSize * 1.2;
  ctx.save();
  ctx.font = [style.fontStyle, style.fontWeight, style.fontSize, style.fontFamily].filter(Boolean).join(" ");
  ctx.fillStyle = style.color;
  ctx.textBaseline = "middle";
  ctx.textAlign = style.textAlign === "left" || style.textAlign === "start" ? "left" :
    style.textAlign === "right" || style.textAlign === "end" ? "right" : "center";
  const x = ctx.textAlign === "left" ? r.x : ctx.textAlign === "right" ? r.x + r.width : r.x + r.width / 2;
  const raw = text ?? element.textContent ?? "";
  const lines = raw.includes("\n")
    ? raw.split("\n").filter(Boolean).slice(0, maxLines)
    : wrapCanvasText(ctx, raw, r.width - 1, maxLines);
  const totalHeight = lines.length * lineHeight;
  const firstY = r.y + Math.max(lineHeight / 2, (r.height - totalHeight) / 2 + lineHeight / 2);
  lines.forEach((line, i) => ctx.fillText(line, x, firstY + i * lineHeight, r.width));
  ctx.restore();
}

/**
 * Mobile Safari may reject rasterizing SVG foreignObject into canvas. This
 * fallback paints the actual React card's existing SVG artwork and the DOM
 * images/labels at their measured coordinates, without any foreignObject.
 */
async function drawNativeCard(ctx: CanvasRenderingContext2D, card: HTMLElement, cardRect: DOMRect): Promise<void> {
  const width = cardRect.width, height = cardRect.height;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(0, 0, width, height, 19);
  ctx.clip();
  ctx.fillStyle = getComputedStyle(card).backgroundColor || "#ffffff";
  ctx.fillRect(0, 0, width, height);

  const artwork = card.querySelector<SVGSVGElement>(".business-digital-card__artwork");
  if (artwork) await drawEmbeddedSvg(ctx, artwork, cardRect);

  const logo = card.querySelector<HTMLImageElement>(".business-digital-card__logo:not(.business-digital-card__logo--light)");
  if (!logo) throw new Error("No se encontró el logo oficial de la tarjeta.");
  await drawDomImage(ctx, logo, cardRect);
  await drawDomImage(ctx, card.querySelector<HTMLImageElement>(".business-digital-card__logo--light"), cardRect);

  const medal = card.querySelector<SVGSVGElement>(".business-digital-card__medal");
  if (medal) await drawEmbeddedSvg(ctx, medal, cardRect);
  const avatar = card.querySelector<HTMLElement>(".business-digital-card__avatar");
  if (avatar) {
    const r = relativeRect(avatar, cardRect);
    ctx.save();
    ctx.beginPath();
    ctx.arc(r.x + r.width / 2, r.y + r.height / 2, Math.min(r.width, r.height) / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = "#192c3e";
    ctx.fillRect(r.x, r.y, r.width, r.height);
    const photo = avatar.querySelector<HTMLImageElement>(".business-digital-card__photo");
    if (photo) {
      await drawDomImage(ctx, photo, cardRect);
    } else {
      const fallbackSvg = avatar.querySelector<SVGSVGElement>("svg");
      if (fallbackSvg) await drawEmbeddedSvg(ctx, fallbackSvg, cardRect);
    }
    ctx.restore();
    ctx.beginPath();
    ctx.arc(r.x + r.width / 2, r.y + r.height / 2, Math.min(r.width, r.height) / 2 - 0.75, 0, Math.PI * 2);
    ctx.strokeStyle = "#ffffffb0";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  drawDomText(ctx, card.querySelector(".business-digital-card__identity h3"), cardRect);
  drawDomText(ctx, card.querySelector(".business-digital-card__identity .business-pioneer-badge"), cardRect, undefined, 1);
  drawDomText(ctx, card.querySelector(".business-digital-card__identity p"), cardRect, undefined, 1);

  const meta = card.querySelector(".business-digital-card__meta");
  if (meta) {
    for (const entry of Array.from(meta.children)) {
      const icon = entry.querySelector<SVGSVGElement>("svg");
      if (icon) await drawEmbeddedSvg(ctx, icon, cardRect);
      drawDomText(ctx, entry.querySelector(".business-digital-card__meta-text"), cardRect, undefined, 1);
    }
  }
  const qrBox = card.querySelector(".business-digital-card__qr");
  const qrImage = qrBox?.querySelector<HTMLImageElement>("img");
  if (!qrBox || !qrImage) throw new Error("El código QR no se ha cargado.");
  const qrRect = relativeRect(qrBox, cardRect);
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.roundRect(qrRect.x, qrRect.y, qrRect.width, qrRect.height, 9);
  ctx.fill();
  ctx.strokeStyle = "#e7eaf3";
  ctx.lineWidth = 1;
  ctx.stroke();
  await drawDomImage(ctx, qrImage, cardRect);

  const scan = card.querySelector(".business-digital-card__scan");
  if (scan) drawDomText(ctx, scan, cardRect, "Escanéame y descubre\nnuestro negocio");
  drawDomText(ctx, card.querySelector(".business-digital-card__founder"), cardRect, undefined, 1);
  drawDomText(ctx, card.querySelector(".business-digital-card__footer"), cardRect, undefined, 1);
  ctx.restore();
}

export async function renderBusinessCardCanvas(card: HTMLElement): Promise<HTMLCanvasElement> {
  const rect = card.getBoundingClientRect();
  if (!rect.width || !rect.height) throw new Error("No se encontró la vista previa de la tarjeta.");
  await document.fonts?.ready;
  const canvas = document.createElement("canvas");
  canvas.width = BUSINESS_CARD_PRINT.widthPx;
  canvas.height = BUSINESS_CARD_PRINT.heightPx;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("No se pudo preparar el archivo de impresión.");
  const reset = () => {
    ctx.setTransform(canvas.width / rect.width, 0, 0, canvas.height / rect.height, 0, 0);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, rect.width, rect.height);
  };
  reset();
  try {
    const clone = await clonePrintableCard(card);
    const svg = [
      '<svg xmlns="http://www.w3.org/2000/svg" width="', rect.width,
      '" height="', rect.height, '" viewBox="0 0 ', rect.width, ' ', rect.height, '">',
      '<foreignObject x="0" y="0" width="100%" height="100%">',
      new XMLSerializer().serializeToString(clone),
      '</foreignObject></svg>',
    ].join("");
    const bitmap = await loadImage("data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg));
    ctx.drawImage(bitmap, 0, 0, rect.width, rect.height);
    ctx.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1);
    const [r, g, b] = ctx.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height * 0.95), 1, 1).data;
    if (r > 245 && g > 245 && b > 245) throw new Error("Captura SVG vacía");
  } catch {
    // Resetting width clears a potentially tainted canvas before native painting.
    canvas.width = BUSINESS_CARD_PRINT.widthPx;
    canvas.height = BUSINESS_CARD_PRINT.heightPx;
    reset();
    await drawNativeCard(ctx, card, rect);
    // Detect an origin-tainted canvas before offering a file.
    try { ctx.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1); }
    catch { throw new Error("No se pudo incluir una imagen de la tarjeta; verifica la foto del negocio."); }
  }
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
  const canvas = await renderBusinessCardCanvas(card);
  const blob = format === "png"
    ? await canvasToBlob(canvas, "image/png")
    : await businessCardPdfFromJpeg(await canvasToBlob(canvas, "image/jpeg", 0.96));
  const safeId = (business.publicId || business.id || "negocio").replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 70);
  return { blob, filename: "XAMUKO-" + safeId + "-15x23.5cm." + format };
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
