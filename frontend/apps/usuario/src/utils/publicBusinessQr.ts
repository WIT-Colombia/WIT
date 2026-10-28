import QRCode from "qrcode";
import { getPublicBusinessUrl } from "./share";

/** Builds the same stable public destination used by Business, with a non-identifying QR source marker. */
export async function generatePublicBusinessQrPng(publicId: string | null | undefined): Promise<string | null> {
  const publicUrl = getPublicBusinessUrl(publicId);
  if (!publicUrl) return null;
  const destination = new URL(publicUrl);
  destination.searchParams.set("source", "qr");
  return QRCode.toDataURL(destination.toString(), {
    errorCorrectionLevel: "H",
    margin: 4,
    width: 1024,
    color: { dark: "#17112f", light: "#ffffff" },
  });
}
