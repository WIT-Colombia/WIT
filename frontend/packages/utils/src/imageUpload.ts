/**
 * Normalizes camera photos before upload to endpoints that accept JPEG/PNG/WebP <= 5 MB.
 * Safari 17+ can decode HEIC/HEIF natively; other browsers get a clear error rather
 * than uploading an unsupported format or silently dropping a selected picture.
 */
export const MAX_UPLOAD_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_CAMERA_IMAGE_BYTES = 40 * 1024 * 1024;
const DEFAULT_MAX_SIDE = 2048;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const ALLOWED_EXTENSIONS = /\.(jpe?g|png|webp|heic|heif)$/i;
const normalizedFiles = new WeakSet<File>();

export const PHOTO_INPUT_ACCEPT = "image/*,.heic,.heif";

export function isSupportedUploadImage(file: Pick<File, "name" | "type">): boolean {
  const type = file.type.toLowerCase();
  return ALLOWED_TYPES.has(type) || ((!type || type === "application/octet-stream") && ALLOWED_EXTENSIONS.test(file.name));
}

export class PhotoUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PhotoUploadError";
  }
}

export function validateUploadImageSource(file: File): void {
  if (!isSupportedUploadImage(file)) {
    throw new PhotoUploadError("Selecciona una fotografía JPG, PNG, WebP o HEIC/HEIF.");
  }
  if (!file.size) throw new PhotoUploadError("La fotografía está vacía. Toma otra foto e inténtalo de nuevo.");
  if (file.size > MAX_CAMERA_IMAGE_BYTES) {
    throw new PhotoUploadError("La fotografía supera 40 MB. Selecciona otra imagen.");
  }
}

type LoadedImage = {
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
};

async function loadPhoto(file: File): Promise<LoadedImage> {
  // createImageBitmap normalizes EXIF orientation when supported.
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      if (!bitmap.width || !bitmap.height) throw new Error("Invalid dimensions");
      return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
    } catch {
      // iOS Safari sometimes decodes HEIC through <img> but not ImageBitmap.
    }
  }
  const src = URL.createObjectURL(file);
  try {
    const photo = new Image();
    photo.src = src;
    if (typeof photo.decode === "function") await photo.decode();
    else await new Promise<void>((resolve, reject) => {
      photo.onload = () => resolve();
      photo.onerror = () => reject(new Error("Image decode failed"));
    });
    if (!photo.naturalWidth || !photo.naturalHeight) throw new Error("Invalid dimensions");
    return {
      source: photo,
      width: photo.naturalWidth,
      height: photo.naturalHeight,
      release: () => URL.revokeObjectURL(src),
    };
  } catch (error) {
    URL.revokeObjectURL(src);
    throw error;
  }
}

function canvasJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob || blob.type !== "image/jpeg") {
        reject(new PhotoUploadError("No fue posible procesar la fotografía en este dispositivo."));
      } else resolve(blob);
    }, "image/jpeg", quality);
  });
}

function safeJpegName(name: string): string {
  return (name.replace(/\.[^/.]+$/, "") || "fotografia") + ".jpg";
}

/**
 * Converts large photos and camera HEIC/HEIF to a correctly oriented,
 * compressed JPEG. Small PNG/WebP assets are retained to preserve transparency.
 */
export async function normalizeImageForUpload(file: File, maxBytes = MAX_UPLOAD_IMAGE_BYTES): Promise<File> {
  validateUploadImageSource(file);
  if (normalizedFiles.has(file)) return file;
  if ((file.type === "image/png" || file.type === "image/webp") && file.size <= maxBytes) return file;

  let loaded: LoadedImage;
  try {
    loaded = await loadPhoto(file);
  } catch {
    throw new PhotoUploadError(
      /\.(heic|heif)$/i.test(file.name) || /image\/hei[cf]/i.test(file.type)
        ? "No se pudo convertir la foto HEIC en este navegador. Intenta tomarla en formato JPEG o seleccionarla desde Fotos."
        : "No se pudo leer la fotografía. Vuelve a tomarla o selecciona otra imagen."
    );
  }
  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new PhotoUploadError("Este navegador no permite procesar fotografías.");
    let scale = Math.min(1, DEFAULT_MAX_SIDE / Math.max(loaded.width, loaded.height));
    for (let attempt = 0; attempt < 7; attempt++) {
      canvas.width = Math.max(1, Math.round(loaded.width * scale));
      canvas.height = Math.max(1, Math.round(loaded.height * scale));
      // JPEG does not support transparency: paint a white background.
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(loaded.source, 0, 0, canvas.width, canvas.height);
      const quality = Math.max(0.60, 0.86 - attempt * 0.055);
      const blob = await canvasJpeg(canvas, quality);
      if (blob.size <= maxBytes) {
        const result = new File([blob], safeJpegName(file.name), { type: "image/jpeg", lastModified: file.lastModified });
        normalizedFiles.add(result);
        return result;
      }
      scale *= 0.77;
    }
    throw new PhotoUploadError("No se pudo reducir la fotografía a menos de 5 MB.");
  } finally {
    loaded.release();
  }
}
