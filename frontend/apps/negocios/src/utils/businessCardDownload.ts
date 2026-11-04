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

export async function renderBusinessCardCanvas(card: HTMLElement): Promise<HTMLCanvasElement> {
  const rect = card.getBoundingClientRect();
  if (!rect.width || !rect.height) throw new Error("No se encontró la vista previa de la tarjeta.");
  await document.fonts?.ready;
  const clone = await clonePrintableCard(card);
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="', rect.width,
    '" height="', rect.height, '" viewBox="0 0 ', rect.width, ' ', rect.height, '">',
    '<foreignObject x="0" y="0" width="100%" height="100%">',
    new XMLSerializer().serializeToString(clone),
    '</foreignObject></svg>',
  ].join("");
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const artwork = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = BUSINESS_CARD_PRINT.widthPx;
    canvas.height = BUSINESS_CARD_PRINT.heightPx;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("No se pudo preparar el archivo de impresión.");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    try {
      ctx.drawImage(artwork, 0, 0, canvas.width, canvas.height);
      // Explicitly detect tainted/blank exports instead of downloading a broken
      // image or PDF. The first pixel may be transparent because of rounded corners.
      ctx.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1);
    } catch {
      throw new Error("Este navegador no pudo capturar la tarjeta completa. Prueba desde Chrome en un computador.");
    }
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
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
  const canvas = await renderBusinessCardCanvas(card);
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