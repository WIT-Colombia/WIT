import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isSupportedUploadImage,
  MAX_UPLOAD_IMAGE_BYTES,
  normalizeImageForUpload,
  PhotoUploadError,
  validateUploadImageSource,
} from "@wit/utils";

afterEach(() => vi.unstubAllGlobals());

describe("camera photo normalization shared by Usuario and Business", () => {
  it("recognizes HEIC/HEIF camera files and rejects non-image documents", () => {
    expect(isSupportedUploadImage({ name: "IMG_0001.HEIC", type: "image/heic" })).toBe(true);
    expect(isSupportedUploadImage({ name: "IMG_0002.HEIF", type: "" })).toBe(true);
    expect(isSupportedUploadImage({ name: "photo.jpeg", type: "image/jpeg" })).toBe(true);
    expect(isSupportedUploadImage({ name: "invoice.pdf", type: "application/pdf" })).toBe(false);
  });

  it("rejects empty files and excessively large sources", () => {
    expect(() => validateUploadImageSource(new File([], "empty.jpg", { type: "image/jpeg" }))).toThrow(PhotoUploadError);
    expect(() => validateUploadImageSource({
      name: "huge.heic", type: "image/heic", size: 41 * 1024 * 1024,
    } as File)).toThrow(/40 MB/);
  });

  it("keeps small PNGs untouched to preserve transparency", async () => {
    const transparent = new File([new Uint8Array([137, 80, 78, 71])], "logo.png", { type: "image/png" });
    await expect(normalizeImageForUpload(transparent)).resolves.toBe(transparent);
  });

  it("converts decoded iPhone HEIC into an uploadable oriented and compressed JPEG", async () => {
    const close = vi.fn();
    const decode = vi.fn().mockResolvedValue({ width: 4032, height: 3024, close });
    const fillRect = vi.fn();
    const drawImage = vi.fn();
    const toBlob = vi.fn((callback: (blob: Blob | null) => void) =>
      callback(new Blob([new Uint8Array(1024)], { type: "image/jpeg" })));
    const canvas = { width: 0, height: 0, getContext: () => ({ fillStyle: "", fillRect, drawImage }), toBlob };

    vi.stubGlobal("createImageBitmap", decode);
    vi.stubGlobal("document", { createElement: () => canvas });
    const original = new File([new Uint8Array(1600)], "IMG_3456.HEIC", { type: "image/heic" });
    const converted = await normalizeImageForUpload(original);
    expect(decode).toHaveBeenCalledWith(original, { imageOrientation: "from-image" });
    expect(converted.name).toBe("IMG_3456.jpg");
    expect(converted.type).toBe("image/jpeg");
    expect(converted.size).toBeLessThanOrEqual(MAX_UPLOAD_IMAGE_BYTES);
    expect(Math.max(canvas.width, canvas.height)).toBeLessThanOrEqual(2048);
    expect(drawImage).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
    expect(await normalizeImageForUpload(converted)).toBe(converted);
  });

  it("produces an actionable error when the browser cannot decode the camera format", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn().mockRejectedValue(new Error("Unsupported HEIC")));
    vi.stubGlobal("Image", class { src = ""; decode() { return Promise.reject(new Error("Unsupported")); } });
    const original = new File([new Uint8Array(3)], "photo.heic", { type: "image/heic" });
    await expect(normalizeImageForUpload(original)).rejects.toThrow(/formato JPEG|desde Fotos/);
  });
});
