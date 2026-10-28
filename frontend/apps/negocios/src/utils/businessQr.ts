import QRCode from "qrcode";

const permanentHosts = new Set(["user.xamuko.com", "staging.xamuko.com"]);

/** Adds a non-identifying source marker so public analytics can attribute the visit to a QR scan. */
export function getBusinessQrDestination(publicUrl: string): string | null {
  try {
    const target = new URL(publicUrl);
    target.searchParams.set("source", "qr");
    return target.toString();
  } catch {
    return null;
  }
}

/** Only configured HTTPS XAMUKO hosts are considered permanent QR destinations. */
export function isPermanentBusinessQrUrl(publicUrl: string | null | undefined): boolean {
  if (!publicUrl) return false;
  try {
    const target = new URL(publicUrl);
    return target.protocol === "https:" && permanentHosts.has(target.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export async function generateBusinessQrPng(publicUrl: string): Promise<string> {
  const destination = getBusinessQrDestination(publicUrl);
  if (!destination) throw new Error("URL pública no válida");
  return QRCode.toDataURL(destination, {
    errorCorrectionLevel: "H",
    margin: 4,
    width: 1024,
    color: { dark: "#17112f", light: "#ffffff" },
  });
}
